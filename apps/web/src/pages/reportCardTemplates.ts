/**
 * BANCO DE FORMATOS DE BOLETÍN — Constructores de plantilla (HTML string).
 * (docs/DISENO_BANCO_FORMATOS_BOLETIN.md)
 *
 * Funciones puras: reciben datos + contexto (colores, logo, config) y devuelven
 * el HTML del boletín. `edusyn-clasico` sigue viviendo en ReportCards.tsx como
 * fallback; aquí van las plantillas nuevas del banco.
 *
 *  - preescolar-narrativo (A1): cualitativo por dimensiones, sin notas/ranking.
 *  - multiperiodo-tabular (C1): modelo "San José", P1..Pn + DEF acumulado, con
 *    recuperaciones en la casilla del período.
 */

export interface TemplatePalette {
  primary: string;
  secondary: string;
  accent: string;
  headerBg: string;
  tableStripe: string;
  text: string;
}

export interface TemplateCtx {
  colors: TemplatePalette;
  logoSrc: string;
  shieldSrc?: string;
  institutionName: string;
  headerLines: string[]; // resolución · DANE · NIT / dirección · tel · correo
  signatures: Array<{ label: string; name: string; imageSrc?: string }>;
  performanceLabels: Record<string, string>; // BAJO→Bajo, etc.
  qualitativeLevels?: Array<{ code: string; name: string; color: string }>;
  showRanking: boolean;
  showAttendance: boolean;
  showVerification: boolean;
  verificationCode?: string;
}

export interface TemplateMeta {
  key: string;
  name: string;
  description: string;
  supportedStructures: string[]; // DIMENSIONS | SUBJECTS_ONLY | AREAS_SUBJECTS
  multiperiod: boolean;
}

/** Catálogo del mini banco (en código, §5). edusyn-clasico se resuelve en ReportCards. */
export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    key: 'edusyn-clasico',
    name: 'Edusyn Clásico',
    description: 'Boletín estándar actual (un período). Fallback universal.',
    supportedStructures: ['DIMENSIONS', 'SUBJECTS_ONLY', 'AREAS_SUBJECTS'],
    multiperiod: false,
  },
  {
    key: 'preescolar-narrativo',
    name: 'Preescolar Narrativo',
    description: 'Cualitativo por dimensiones del desarrollo, con descriptor por nivel. Sin notas ni ranking (Decreto 1411).',
    supportedStructures: ['DIMENSIONS'],
    multiperiod: false,
  },
  {
    key: 'multiperiodo-tabular',
    name: 'Multiperíodo Tabular (San José)',
    description: 'Tabla Área·Asignatura·I.H.·Logro·P1..Pn·DEF·Desempeño, acumulado y recuperaciones. Bachillerato/primaria.',
    supportedStructures: ['AREAS_SUBJECTS', 'SUBJECTS_ONLY'],
    multiperiod: true,
  },
];

// ── Helpers de formato ───────────────────────────────────────────────────────
const esc = (s: any): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : Number(n).toFixed(2);
const fmt1 = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : Number(n).toFixed(1);
const studentName = (s: any): string =>
  [s?.lastName, s?.secondLastName, s?.firstName, s?.secondName].filter(Boolean).join(' ') ||
  [s?.firstName, s?.lastName].filter(Boolean).join(' ');

function headerBlock(ctx: TemplateCtx): string {
  const c = ctx.colors;
  const shield = ctx.shieldSrc
    ? `<img src="${ctx.shieldSrc}" style="height:54px;object-fit:contain;" />`
    : '<div style="width:54px;"></div>';
  const logo = ctx.logoSrc
    ? `<img src="${ctx.logoSrc}" style="height:54px;object-fit:contain;" />`
    : '<div style="width:54px;"></div>';
  return `
    <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid ${c.primary};padding-bottom:8px;">
      ${shield}
      <div style="flex:1;text-align:center;">
        <div style="font-size:10px;letter-spacing:3px;color:${c.text};text-transform:uppercase;">Boletín Académico</div>
        <div style="font-size:20px;font-weight:800;color:${c.primary};letter-spacing:1px;">${esc(ctx.institutionName)}</div>
        ${ctx.headerLines.map(l => `<div style="font-size:8.5px;color:#64748b;">${esc(l)}</div>`).join('')}
      </div>
      ${logo}
    </div>`;
}

function signaturesBlock(ctx: TemplateCtx): string {
  const sigs = ctx.signatures.filter(Boolean);
  if (sigs.length === 0) return '';
  return `
    <div style="display:flex;justify-content:space-around;margin-top:32px;gap:16px;">
      ${sigs.map(s => `
        <div style="text-align:center;flex:1;">
          ${s.imageSrc ? `<img src="${s.imageSrc}" style="height:34px;object-fit:contain;margin-bottom:2px;" />` : '<div style="height:34px;"></div>'}
          <div style="border-top:1px solid #94a3b8;padding-top:3px;font-size:9px;font-weight:700;color:${ctx.colors.text};">${esc(s.label)}</div>
          <div style="font-size:9px;color:#475569;">${esc(s.name || '')}</div>
        </div>`).join('')}
    </div>`;
}

function footerBlock(ctx: TemplateCtx): string {
  const date = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  const verif = ctx.showVerification && ctx.verificationCode
    ? `<span>Código de verificación: <b>${esc(ctx.verificationCode)}</b></span>` : '';
  return `
    <div style="margin-top:16px;padding-top:6px;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;font-size:8px;color:#94a3b8;">
      <span>Fecha de expedición: <b>${date}</b></span>
      ${verif}
      <span>Edusyn</span>
    </div>`;
}

function studentCard(ctx: TemplateCtx, data: any, periodLabel: string): string {
  const c = ctx.colors;
  const s = data.student || {};
  const g = data.group || {};
  const cell = (label: string, value: string) =>
    `<div style="padding:5px 8px;border:1px solid #e2e8f0;"><div style="font-size:7.5px;letter-spacing:1px;color:#94a3b8;text-transform:uppercase;">${label}</div><div style="font-size:10.5px;font-weight:700;color:${c.text};">${esc(value) || '—'}</div></div>`;
  return `
    <div style="margin-top:10px;border:1px solid ${c.primary};border-radius:4px;overflow:hidden;">
      <div style="background:${c.headerBg};padding:5px 8px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;font-weight:800;letter-spacing:1px;color:${c.primary};text-transform:uppercase;">Información del Estudiante</span>
        <span style="font-size:9px;color:#64748b;">${esc(periodLabel)}</span>
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr;">
        ${cell('Nombre completo', studentName(s))}
        ${cell('Documento', s.documentNumber || '')}
        ${cell('Código', s.code || g.code || '')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;">
        ${cell('Curso', g.gradeName || g.gradeLevel || '')}
        ${cell('Grupo', g.name || '')}
        ${cell('Jornada', g.shift || g.jornada || '')}
        ${cell('Sede', g.campus || g.sede || '')}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// A1 · preescolar-narrativo
// ═══════════════════════════════════════════════════════════════════════════
export function buildPreescolarNarrativoHtml(data: any, ctx: TemplateCtx, periodLabel: string): string {
  const c = ctx.colors;
  const levelByCode = new Map((ctx.qualitativeLevels || []).map(l => [l.code, l]));
  const levelChip = (level: string | null) => {
    if (!level) return '';
    const q = levelByCode.get(level) || Array.from(levelByCode.values()).find(l => l.name.toUpperCase() === level.toUpperCase());
    const color = q?.color || c.accent;
    const label = q?.name || ctx.performanceLabels[level] || level;
    return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${color}22;color:${color};border:1px solid ${color};font-size:10px;font-weight:700;">${esc(label)}</span>`;
  };

  // Cada "dimensión" = un área; sus indicadores = subjects/achievements.
  const areas = (data.areaGrades || []) as any[];
  const dimensions = areas.map(area => {
    const subjects = (area.subjects || []) as any[];
    const rows = subjects.map(sub => {
      const narrative = sub.achievement || sub.qualitativeObservation || sub.achievementObservation || '';
      return `
        <div style="padding:7px 0;border-bottom:1px dashed #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="font-size:11px;font-weight:700;color:${c.text};">${esc(sub.subject)}</span>
            ${levelChip(sub.performanceLevel)}
          </div>
          ${narrative ? `<div style="font-size:10px;color:#475569;margin-top:3px;line-height:1.4;">${esc(narrative)}</div>` : ''}
        </div>`;
    }).join('');
    return `
      <div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;">
        <div style="background:${c.headerBg};padding:5px 10px;font-size:11px;font-weight:800;color:${c.primary};text-transform:uppercase;letter-spacing:0.5px;">${esc(area.area)}</div>
        <div style="padding:2px 10px;">${rows || '<div style="font-size:10px;color:#94a3b8;padding:6px 0;">Sin valoraciones registradas.</div>'}</div>
      </div>`;
  }).join('');

  const attendance = ctx.showAttendance && data.attendance ? `
    <div style="margin-top:10px;font-size:10px;color:#475569;">
      <b style="color:${c.primary};">Asistencia:</b> ${data.attendance.present ?? 0} presentes · ${data.attendance.absent ?? 0} inasistencias
      ${data.attendance.attendanceRate != null ? `· ${data.attendance.attendanceRate}%` : ''}
    </div>` : '';

  const observations = (data.observations || []).length > 0 ? `
    <div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:4px;padding:8px 10px;">
      <div style="font-size:10px;font-weight:800;color:${c.primary};text-transform:uppercase;margin-bottom:4px;">Observaciones del docente</div>
      ${(data.observations || []).slice(0, 4).map((o: any) => `<div style="font-size:10px;color:#475569;margin:2px 0;">${esc(o.description || o)}</div>`).join('')}
    </div>` : '';

  return `
    <div class="report-card-page" style="font-family:Arial,Helvetica,sans-serif;color:${c.text};padding:6px;">
      ${headerBlock(ctx)}
      ${studentCard(ctx, data, periodLabel)}
      <div style="margin-top:12px;font-size:12px;font-weight:800;color:${c.primary};text-transform:uppercase;letter-spacing:1px;">Valoración por dimensiones del desarrollo</div>
      ${dimensions}
      ${attendance}
      ${observations}
      ${signaturesBlock(ctx)}
      ${footerBlock(ctx)}
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// C1 · multiperiodo-tabular (San José)
// ═══════════════════════════════════════════════════════════════════════════
export function buildMultiperiodoTabularHtml(year: any, ctx: TemplateCtx, extra?: { rank?: number | null; totalStudents?: number | null }): string {
  const c = ctx.colors;
  const periods = (year.periods || []) as Array<{ id: string; name: string; order: number }>;
  const perfLabel = (lvl: string | null) => (lvl ? (ctx.performanceLabels[lvl] || lvl) : '');
  const perfColor = (lvl: string | null) => {
    const map: Record<string, string> = { SUPERIOR: '#16a34a', ALTO: '#2563eb', BASICO: '#d97706', BAJO: '#dc2626' };
    return lvl ? (map[lvl] || c.text) : c.text;
  };

  // Celda de período: nota + (si recuperó) badge con la recuperación.
  const periodCell = (cell: any) => {
    if (!cell || cell.grade === null || cell.grade === undefined) return '<td style="text-align:center;color:#cbd5e1;">—</td>';
    const recovered = cell.hasRecovery && cell.originalGrade !== null && cell.originalGrade !== undefined;
    const shown = recovered ? cell.originalGrade : cell.grade; // en P1 se ve la nota perdida
    const badge = recovered && cell.recoveryGrade != null
      ? `<div style="font-size:7.5px;color:#16a34a;font-weight:700;">rec. ${fmt1(cell.recoveryGrade)}</div>`
      : '';
    return `<td style="text-align:center;">
      <div style="font-weight:700;color:${recovered ? '#dc2626' : c.text};">${fmt1(shown)}</div>
      <div style="font-size:7px;color:${perfColor(cell.performanceLevel)};">${esc(perfLabel(cell.performanceLevel))}</div>
      ${badge}
    </td>`;
  };

  const periodHeaders = periods.map(p => `<th style="padding:4px;text-align:center;">${esc(shortPeriod(p.name, p.order))}</th>`).join('');

  const areaRows = ((year.areas || []) as any[]).map(area => {
    const subjects = (area.subjects || []) as any[];
    return subjects.map((sub, i) => `
      <tr style="${i % 2 ? `background:${c.tableStripe};` : ''}">
        ${i === 0 ? `<td rowspan="${subjects.length}" style="font-weight:700;color:${c.secondary};vertical-align:middle;padding:4px;border-right:1px solid #e2e8f0;">${esc(area.area)}</td>` : ''}
        <td style="padding:4px;">${esc(sub.subject)}</td>
        <td style="text-align:center;color:#94a3b8;">${sub.weeklyHours ? esc(sub.weeklyHours) + 'h' : ''}</td>
        <td style="padding:4px;font-size:8.5px;color:#475569;">${esc(sub.achievement || '')}</td>
        ${periods.map(p => periodCell(sub.cells?.[p.id])).join('')}
        <td style="text-align:center;font-weight:800;color:${c.primary};">${fmt(sub.def)}</td>
        <td style="text-align:center;font-weight:700;color:${perfColor(sub.defPerformanceLevel)};">${esc(perfLabel(sub.defPerformanceLevel))}</td>
      </tr>`).join('');
  }).join('');

  const summary = year.summary || {};
  const summaryCards = `
    <div style="display:grid;grid-template-columns:repeat(${ctx.showRanking ? 4 : 3}, 1fr);gap:8px;margin-top:12px;">
      ${summaryCard('Promedio período', fmt(summary.promedioPeriodo), c)}
      ${summaryCard('Promedio acumulado', fmt(summary.promedioAcumulado), c)}
      ${ctx.showRanking && extra?.rank ? summaryCard('Puesto', `${extra.rank} / ${extra.totalStudents ?? ''}`, c) : ''}
      ${summaryCard('Inasistencias', `${summary.inasistencias ?? 0}`, c)}
    </div>`;

  const scale = (ctx.qualitativeLevels && ctx.qualitativeLevels.length)
    ? '' // en numérico se muestra la escala de desempeño
    : `<div style="margin-top:10px;font-size:9px;color:#64748b;"><b style="color:${c.primary};">Escala institucional:</b> Bajo · Básico · Alto · Superior</div>`;

  const observations = (year.observations || []).length > 0 ? `
    <div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:4px;padding:8px 10px;">
      <div style="font-size:10px;font-weight:800;color:${c.primary};text-transform:uppercase;margin-bottom:4px;">Observaciones del director de grupo</div>
      ${(year.observations || []).slice(0, 3).map((o: any) => `<div style="font-size:10px;color:#475569;margin:2px 0;">${esc(o.description || o)}</div>`).join('')}
    </div>` : '';

  const curLabel = periods.length ? periods[periods.length - 1].name : '';

  return `
    <div class="report-card-page" style="font-family:Arial,Helvetica,sans-serif;color:${c.text};padding:6px;">
      ${headerBlock(ctx)}
      ${studentCard(ctx, year, curLabel)}
      <div style="margin-top:12px;font-size:12px;font-weight:800;color:${c.primary};text-transform:uppercase;letter-spacing:1px;">Desempeño académico</div>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:9px;">
        <thead>
          <tr style="background:${c.headerBg};color:${c.primary};font-size:8px;text-transform:uppercase;">
            <th style="padding:4px;text-align:left;">Área</th>
            <th style="padding:4px;text-align:left;">Asignatura</th>
            <th style="padding:4px;">I.H.</th>
            <th style="padding:4px;text-align:left;">Logro</th>
            ${periodHeaders}
            <th style="padding:4px;">DEF.</th>
            <th style="padding:4px;">Desemp.</th>
          </tr>
        </thead>
        <tbody>${areaRows}</tbody>
      </table>
      ${summaryCards}
      ${scale}
      ${observations}
      ${signaturesBlock(ctx)}
      ${footerBlock(ctx)}
    </div>`;
}

function summaryCard(label: string, value: string, c: TemplatePalette): string {
  return `<div style="border:1px solid #e2e8f0;border-radius:4px;padding:6px 8px;">
    <div style="font-size:7.5px;letter-spacing:1px;color:#94a3b8;text-transform:uppercase;">${label}</div>
    <div style="font-size:16px;font-weight:800;color:${c.accent};">${value || '—'}</div>
  </div>`;
}

function shortPeriod(name: string, order: number): string {
  const m = /(\d+)/.exec(name || '');
  return m ? `P${m[1]}` : `P${order}`;
}
