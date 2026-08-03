import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';
import type { ApplyResult, ImportAnalysis, Issue, SummaryFact } from '@edusyn/types';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * MÓDULO 4 (Onboarding v2) — Importador de DOCENTES canónico.
 *
 * Patrón dos fases (I1–I6):
 *  - analyze: lee el Excel, valida y cuadra. NO escribe. Devuelve ImportAnalysis.
 *  - apply: crea User(DOCENTE) + InstitutionUser + dual-write, IDEMPOTENTE por
 *    correo (login global). No borra a nadie. Devuelve ApplyResult (cuadre I6).
 *
 * Responde con los tipos del contrato @edusyn/types (AR3) para que el frontend
 * use ImportSummaryCard/ValidationReportTable sin adaptadores.
 *
 * Nota: Especialidad/TipoContrato del formato NO se persisten aún (el modelo
 * User no tiene esos campos). Añadirlos requiere migración (User o TeacherProfile).
 */

interface TeacherRow {
  rowNumber: number;
  tipoDocumento?: string;
  documento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  celular?: string;
}

function norm(s: any): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Normaliza el tipo de documento a un valor del enum DocumentType (adulto → CC). */
function normalizeDocType(raw?: string): string {
  const n = norm(raw).replace(/\./g, '').replace(/\s+/g, '');
  const map: Record<string, string> = {
    cc: 'CC', cedula: 'CC', ce: 'CE', pa: 'PASAPORTE', pasaporte: 'PASAPORTE',
    ti: 'TI', rc: 'RC', nip: 'NIP', nuip: 'NUIP',
  };
  return map[n] || 'CC';
}

@Injectable()
export class TeacherImportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Parseo (detección de columnas por encabezado) ──────────────────────────
  private mapColumns(headerRow: ExcelJS.Row): Record<string, number> {
    const map: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      const h = norm(cell.value);
      if (!h) return;
      const set = (k: string) => { if (map[k] === undefined) map[k] = col; };
      if (h.includes('tipo') && h.includes('doc')) set('tipoDocumento');
      else if (h.includes('documento') || h.includes('cedula') || h.includes('identificacion') || h.includes('identidad')) set('documento');
      else if (h.includes('correo') || h.includes('email') || h.includes('mail')) set('correo');
      else if (h.includes('celular') || h.includes('telefono') || h.includes('movil') || h.includes('contacto')) set('celular');
      else if (h.includes('apellido')) set('apellidos');
      else if (h.includes('nombre')) set('nombres');
    });
    return map;
  }

  private async parse(buffer: Buffer): Promise<TeacherRow[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const sheet = wb.getWorksheet('PLANTILLA') || wb.getWorksheet('Docentes') || wb.worksheets[0];
    if (!sheet) throw new BadRequestException('El archivo no contiene hojas.');

    const cols = this.mapColumns(sheet.getRow(1));
    if (cols.documento === undefined || cols.correo === undefined) {
      throw new BadRequestException(
        'El archivo no tiene las columnas mínimas (Documento y Correo). Descarga la plantilla oficial.',
      );
    }
    const cell = (row: ExcelJS.Row, key: string): string => {
      const c = cols[key];
      if (c === undefined) return '';
      const v = row.getCell(c).value as any;
      if (v && typeof v === 'object') {
        if (v.text) return String(v.text).trim();
        if (v.hyperlink) return String(v.hyperlink).replace(/^mailto:/, '').trim();
        if (v.result !== undefined) return String(v.result).trim();
      }
      return String(v ?? '').trim();
    };

    const rows: TeacherRow[] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const documento = cell(row, 'documento');
      const correo = cell(row, 'correo').toLowerCase();
      const nombres = cell(row, 'nombres');
      const apellidos = cell(row, 'apellidos');
      if (!documento && !correo && !nombres && !apellidos) continue; // fila vacía
      if (nombres.startsWith('*') || norm(nombres).startsWith('tipos')) continue; // notas
      rows.push({
        rowNumber: i,
        tipoDocumento: cell(row, 'tipoDocumento') || undefined,
        documento,
        nombres,
        apellidos,
        correo,
        celular: cell(row, 'celular') || undefined,
      });
    }
    return rows;
  }

  /** Valida una fila; devuelve el motivo bloqueante o null si es importable. */
  private rowError(r: TeacherRow): string | null {
    if (!r.nombres) return 'Falta el nombre';
    if (!r.apellidos) return 'Falta el apellido';
    if (!r.correo) return 'Falta el correo (es el usuario de acceso)';
    if (!isValidEmail(r.correo)) return `Correo inválido: "${r.correo}"`;
    if (!r.documento || r.documento.length < 3) return 'Falta el documento (es la contraseña inicial)';
    return null;
  }

  // ── ANALYZE (read-only) ────────────────────────────────────────────────────
  async analyze(institutionId: string, buffer: Buffer): Promise<ImportAnalysis> {
    const rows = await this.parse(buffer);
    const issues: Issue[] = [];

    const seenEmails = new Set<string>();
    const validEmails: string[] = [];
    let invalid = 0;

    for (const r of rows) {
      const err = this.rowError(r);
      if (err) {
        invalid++;
        issues.push({ severity: 'blocking', code: 'ROW_INVALID', message: err, location: { row: r.rowNumber } });
        continue;
      }
      if (seenEmails.has(r.correo)) {
        issues.push({
          severity: 'warning', code: 'DUPLICATE_EMAIL_IN_FILE',
          message: `El correo ${r.correo} está repetido en el archivo; solo se importará una vez`,
          location: { row: r.rowNumber, field: 'correo' },
        });
        continue;
      }
      seenEmails.add(r.correo);
      validEmails.push(r.correo);
    }

    const existing = validEmails.length
      ? await this.prisma.user.findMany({ where: { email: { in: validEmails } }, select: { email: true } })
      : [];
    const existingSet = new Set(existing.map((e) => e.email));
    const nuevos = validEmails.filter((e) => !existingSet.has(e)).length;
    const existentes = validEmails.length - nuevos;

    for (const email of existingSet) {
      issues.push({
        severity: 'warning', code: 'TEACHER_ALREADY_EXISTS',
        message: `El correo ${email} ya está registrado; esa fila se omitirá`,
        howToFix: 'Si es un docente distinto, usa otro correo.',
      });
    }

    const summary: SummaryFact[] = [
      { key: 'total', label: 'Filas en el archivo', value: String(rows.length) },
      { key: 'nuevos', label: 'Docentes nuevos', value: String(nuevos) },
      { key: 'existentes', label: 'Ya registrados', value: String(existentes) },
    ];
    if (invalid > 0) summary.push({ key: 'invalidos', label: 'Filas con error', value: String(invalid) });

    return {
      contractVersion: 1,
      summary,
      issues,
      canApply: nuevos > 0,
      ...(nuevos > 0 ? {} : { blockedReason: 'No hay docentes nuevos para importar en este archivo.' }),
    };
  }

  // ── APPLY (escribe — idempotente por correo, no borra a nadie) ──────────────
  async apply(institutionId: string, buffer: Buffer): Promise<ApplyResult> {
    const rows = await this.parse(buffer);

    let created = 0;
    let skipped = 0;
    const errors: Issue[] = [];
    const warnings: Issue[] = [];

    // Rol DOCENTE (find-or-create).
    let docenteRole = await this.prisma.role.findUnique({ where: { name: 'DOCENTE' } });
    if (!docenteRole) docenteRole = await this.prisma.role.create({ data: { name: 'DOCENTE' } });

    const seenEmails = new Set<string>();

    for (const r of rows) {
      const err = this.rowError(r);
      if (err) {
        skipped++;
        errors.push({ severity: 'blocking', code: 'ROW_INVALID', message: err, location: { row: r.rowNumber } });
        continue;
      }
      if (seenEmails.has(r.correo)) { skipped++; continue; } // duplicado en el archivo
      seenEmails.add(r.correo);

      try {
        // Idempotencia: si el correo ya existe (login global), se omite.
        const existing = await this.prisma.user.findUnique({ where: { email: r.correo }, select: { id: true } });
        if (existing) {
          skipped++;
          warnings.push({
            severity: 'warning', code: 'TEACHER_ALREADY_EXISTS',
            message: `El correo ${r.correo} ya estaba registrado; no se creó de nuevo`,
            location: { row: r.rowNumber, field: 'correo' },
          });
          continue;
        }

        const username = await this.generateUsername(r.nombres, r.apellidos);
        const passwordHash = await bcrypt.hash(r.documento, 10);
        const documentType = normalizeDocType(r.tipoDocumento);

        await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: r.correo,
              username,
              firstName: r.nombres,
              lastName: r.apellidos,
              passwordHash,
              documentType: documentType as any,
              documentNumber: r.documento,
              phone: r.celular,
              isActive: true,
              mustChangePassword: true,
              roles: { create: { roleId: docenteRole!.id } },
              institutionUsers: { create: { institutionId, isAdmin: false } },
            } as any,
          });
          // Dual-write: rol por tenant (InstitutionUserRole).
          const iu = await tx.institutionUser.findUnique({
            where: { userId_institutionId: { userId: user.id, institutionId } },
            select: { id: true },
          });
          if (iu) {
            await tx.institutionUserRole.upsert({
              where: { institutionUserId_roleId: { institutionUserId: iu.id, roleId: docenteRole!.id } },
              create: { institutionUserId: iu.id, roleId: docenteRole!.id },
              update: {},
            });
          }
        });
        created++;
      } catch (e: any) {
        errors.push({ severity: 'blocking', code: 'ROW_FAILED', message: e?.message || String(e), location: { row: r.rowNumber } });
      }
    }

    const summary: SummaryFact[] = [
      { key: 'creados', label: 'Docentes creados', value: String(created) },
      { key: 'omitidos', label: 'Omitidos', value: String(skipped) },
    ];

    return { contractVersion: 1, summary, created, updated: 0, skipped, errors, warnings };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  /** Usuario = inicial del nombre + apellido, deduplicado (ej. lcardenas, lcardenas1). */
  private async generateUsername(firstName: string, lastName: string): Promise<string> {
    const base =
      (norm(firstName).charAt(0) + norm(lastName).replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')) || 'docente';
    let username = base;
    let n = 1;
    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${base}${n++}`;
    }
    return username;
  }
}
