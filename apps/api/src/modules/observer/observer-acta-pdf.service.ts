import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { ObserverActaExportMode } from './dto/create-observation.dto';

const FORMAL_ACTA_TYPES = ['ACTA_TYPE_I', 'ACTA_TYPE_II', 'ACTA_TYPE_III'] as const;
const PRIVILEGED_ROLES = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'];

type ExportParams = {
  institutionId: string;
  actorId: string;
  actorRoles: string[];
  observationIds: string[];
  mode: ObserverActaExportMode;
};

@Injectable()
export class ObserverActaPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async generate(params: ExportParams): Promise<Buffer> {
    const observationIds = [...new Set(params.observationIds)];
    if (!observationIds.length || observationIds.length > 30) {
      throw new BadRequestException('Seleccione entre 1 y 30 actas');
    }

    const [institution, reportConfig, observations] = await Promise.all([
      this.prisma.institution.findUnique({
        where: { id: params.institutionId },
        select: {
          id: true,
          name: true,
          nit: true,
          daneCode: true,
          address: true,
          city: true,
          phone: true,
          email: true,
          website: true,
          logo: true,
          primaryColor: true,
        },
      }),
      this.prisma.reportCardConfig.findUnique({
        where: { institutionId: params.institutionId },
        // `logoUrl` conserva compatibilidad con escudos cargados antes de que el
        // perfil institucional fuera la fuente canónica. Así ningún formato de
        // Observador queda sin identidad mientras se consolida el perfil.
        select: { headerResolution: true, signatureConfig: true, logoUrl: true },
      }),
      this.prisma.studentObservation.findMany({
        where: {
          id: { in: observationIds },
          institutionId: params.institutionId,
          type: { in: [...FORMAL_ACTA_TYPES] },
        },
        include: {
          actaRecord: true,
          author: { select: { id: true, firstName: true, lastName: true } },
          studentEnrollment: {
            include: {
              student: {
                select: { id: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
              },
              academicYear: { select: { year: true } },
              group: {
                include: {
                  grade: { select: { name: true } },
                  campus: { select: { name: true } },
                  director: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!institution) throw new NotFoundException('Institución no encontrada');
    if (observations.length !== observationIds.length) {
      throw new NotFoundException('Una o más actas no existen o no pertenecen a la institución');
    }

    const canExportAll = params.actorRoles.some((role) => PRIVILEGED_ROLES.includes(role));
    if (!canExportAll) {
      const unauthorized = observations.some(
        (observation) => observation.authorId !== params.actorId && observation.studentEnrollment.group.directorId !== params.actorId,
      );
      if (unauthorized) throw new ForbiddenException('No puede exportar actas de estudiantes fuera de sus grupos o registros');
    }

    const order = new Map(observationIds.map((id, index) => [id, index]));
    observations.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const logo = await this.resolveLogo(this.institutionLogo(institution, reportConfig));
    return this.buildPdf({ institution, reportConfig, observations, logo, mode: params.mode });
  }

  async generatePedagogicalFollowups(params: Omit<ExportParams, 'mode'>): Promise<Buffer> {
    const observationIds = [...new Set(params.observationIds)];
    if (!observationIds.length || observationIds.length > 30) {
      throw new BadRequestException('Seleccione entre 1 y 30 seguimientos pedagógicos');
    }

    const [institution, reportConfig, observations] = await Promise.all([
      this.prisma.institution.findUnique({
        where: { id: params.institutionId },
        select: {
          id: true, name: true, nit: true, daneCode: true, address: true, city: true,
          phone: true, email: true, website: true, logo: true, primaryColor: true,
        },
      }),
      this.prisma.reportCardConfig.findUnique({
        where: { institutionId: params.institutionId },
        select: { headerResolution: true, signatureConfig: true, logoUrl: true },
      }),
      this.prisma.studentObservation.findMany({
        where: {
          id: { in: observationIds },
          institutionId: params.institutionId,
          type: 'PEDAGOGICAL_FOLLOWUP',
        },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          studentEnrollment: {
            include: {
              student: { select: { id: true, firstName: true, secondName: true, lastName: true, secondLastName: true } },
              academicYear: { select: { year: true } },
              group: {
                include: {
                  grade: { select: { name: true } },
                  campus: { select: { name: true } },
                  director: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    if (!institution) throw new NotFoundException('Institución no encontrada');
    if (observations.length !== observationIds.length) {
      throw new NotFoundException('Uno o más seguimientos no existen o no pertenecen a la institución');
    }
    const canExportAll = params.actorRoles.some((role) => PRIVILEGED_ROLES.includes(role));
    if (!canExportAll && observations.some((observation) => observation.authorId !== params.actorId && observation.studentEnrollment.group.directorId !== params.actorId)) {
      throw new ForbiddenException('No puede exportar seguimientos de estudiantes fuera de sus grupos o registros');
    }
    const order = new Map(observationIds.map((id, index) => [id, index]));
    observations.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const logo = await this.resolveLogo(this.institutionLogo(institution, reportConfig));
    return this.buildPedagogicalPdf({ institution, reportConfig, observations, logo });
  }

  private buildPdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'LETTER', margin: 42, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const records = data.mode === ObserverActaExportMode.JOINT
          ? [data.observations]
          : data.observations.map((observation: any) => [observation]);

        records.forEach((observations: any[], index: number) => {
          if (index > 0) doc.addPage();
          this.renderActa(doc, data.institution, data.reportConfig, observations, data.logo, data.mode);
          observations.forEach((observation) => {
            doc.addPage();
            this.renderStudentStatementAnnex(doc, data.institution, data.reportConfig, observation, data.logo);
          });
        });

        const range = doc.bufferedPageRange();
        for (let page = range.start; page < range.start + range.count; page += 1) {
          doc.switchToPage(page);
          const bottomMargin = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc.font('Helvetica').fontSize(7).fillColor('#64748b').text(
            `Documento confidencial - Observador del estudiante   |   Página ${page + 1} de ${range.count}`,
            42,
            doc.page.height - 28,
            { width: doc.page.width - 84, align: 'center', lineBreak: false },
          );
          doc.page.margins.bottom = bottomMargin;
        }
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private buildPedagogicalPdf(data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'LETTER', margin: 42, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        data.observations.forEach((observation: any, index: number) => {
          if (index > 0) doc.addPage();
          this.renderPedagogicalFollowup(doc, data.institution, data.reportConfig, observation, data.logo);
        });
        const range = doc.bufferedPageRange();
        for (let page = range.start; page < range.start + range.count; page += 1) {
          doc.switchToPage(page);
          const bottomMargin = doc.page.margins.bottom;
          doc.page.margins.bottom = 0;
          doc.font('Helvetica').fontSize(7).fillColor('#64748b').text(
            `Documento confidencial - Seguimiento pedagógico   |   Página ${page + 1} de ${range.count}`,
            42, doc.page.height - 28, { width: doc.page.width - 84, align: 'center', lineBreak: false },
          );
          doc.page.margins.bottom = bottomMargin;
        }
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  private renderPedagogicalFollowup(doc: PDFKit.PDFDocument, institution: any, reportConfig: any, observation: any, logo: Buffer | null) {
    const margin = 42;
    const width = doc.page.width - margin * 2;
    const brand = this.brandColor(institution.primaryColor);
    this.renderInstitutionHeader(doc, institution, reportConfig, logo, brand, margin, width);
    const titleY = doc.y;
    doc.roundedRect(margin, titleY, width, 29, 4).fill(brand);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('INFORME DE SEGUIMIENTO PEDAGÓGICO', margin + 8, titleY + 9, { width: width - 16, align: 'center' });
    doc.y = titleY + 37;

    const enrollment = observation.studentEnrollment;
    const group = `${enrollment.group?.grade?.name || ''} ${enrollment.group?.name || ''}`.trim();
    this.renderMetaGrid(doc, margin, width, [
      ['Fecha de registro', this.dateOnly(observation.date)],
      ['Estado', this.statusLabel(observation.status)],
      ['Estudiante', this.studentName(enrollment.student)],
      ['Grupo', group || 'No registrado'],
      ['Año lectivo', String(enrollment.academicYear?.year || 'No registrado')],
      ['Sede', enrollment.group?.campus?.name || 'No registrada'],
    ], brand);
    this.renderBoxSection(doc, '1. SITUACIÓN O NECESIDAD PEDAGÓGICA IDENTIFICADA', observation.description, brand, margin, width, 72);
    this.renderBoxSection(doc, '2. ACCIONES PEDAGÓGICAS Y APOYOS ACORDADOS', observation.actionTaken || 'Pendiente de registrar.', brand, margin, width, 58);
    const followUp = [
      observation.requiresFollowUp ? 'Requiere seguimiento: Sí.' : 'Requiere seguimiento: No.',
      observation.followUpDate ? `Fecha acordada: ${this.dateOnly(observation.followUpDate)}.` : '',
      observation.followUpNotes ? `Notas de seguimiento: ${observation.followUpNotes}` : '',
    ].filter(Boolean).join('\n');
    this.renderBoxSection(doc, '3. PLAN Y VALORACIÓN DEL SEGUIMIENTO', followUp || 'Pendiente de registrar.', brand, margin, width, 66);
    const parentNotice = observation.parentNotified
      ? `Acudiente notificado${observation.parentNotifiedAt ? ` el ${this.dateOnly(observation.parentNotifiedAt)}` : ''}.`
      : 'Acudiente pendiente de notificación.';
    this.renderBoxSection(doc, '4. COMUNICACIÓN CON EL ACUDIENTE', parentNotice, brand, margin, width, 34);
    this.renderSignatures(doc, [observation], reportConfig, brand, margin, width, '5. FIRMAS Y CONSTANCIA', 'Las firmas dejan constancia del acompañamiento y los acuerdos pedagógicos registrados.');
  }

  private renderActa(doc: PDFKit.PDFDocument, institution: any, reportConfig: any, observations: any[], logo: Buffer | null, mode: ObserverActaExportMode) {
    const margin = 42;
    const width = doc.page.width - margin * 2;
    const brand = this.brandColor(institution.primaryColor);
    this.renderInstitutionHeader(doc, institution, reportConfig, logo, brand, margin, width);

    const types = [...new Set(observations.map((item) => item.type))];
    const title = types.length === 1 ? `ACTA DE CONVIVENCIA - ${this.typeLabel(types[0])}` : 'ACTA DE CONVIVENCIA ESCOLAR';
    const titleY = doc.y;
    doc.roundedRect(margin, titleY, width, 27, 4).fill(brand);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text(title, margin + 8, titleY + 8, { width: width - 16, align: 'center' });
    doc.y = titleY + 36;

    const actaNumbers = [...new Set(observations.map((item) => item.actaRecord?.actaNumber).filter(Boolean))];
    const dates = [...new Set(observations.map((item) => this.dateOnly(item.date)))];
    const years = [...new Set(observations.map((item) => item.studentEnrollment.academicYear?.year).filter(Boolean))];
    const campuses = [...new Set(observations.map((item) => item.studentEnrollment.group?.campus?.name).filter(Boolean))];
    this.renderMetaGrid(doc, margin, width, [
      ['Número de acta', actaNumbers.length === 1 ? actaNumbers[0] : actaNumbers.length > 1 ? actaNumbers.join(', ') : 'Sin consecutivo'],
      ['Fecha del hecho', dates.join(', ')],
      ['Año lectivo', years.join(', ') || 'No registrado'],
      ['Modalidad', mode === ObserverActaExportMode.JOINT && observations.length > 1 ? 'Acta conjunta' : 'Acta individual'],
      ['Lugar o sede', campuses.join(', ') || 'Pendiente de registrar'],
      ['Hora', 'Pendiente de registrar'],
    ], brand);

    this.renderBoxSection(doc, '1. ESTUDIANTES IMPLICADOS', this.participantsText(observations), brand, margin, width, 38);
    this.renderBoxSection(doc, '2. DESCRIPCIÓN OBJETIVA DE LA SITUACIÓN', this.sharedOrEnumeratedText(observations, (item) => item.actaRecord?.facts || item.description), brand, margin, width, 82);
    const regulation = this.sharedOrEnumeratedText(observations, (item) => item.actaRecord?.regulationApplied);
    this.renderBoxSection(doc, '3. NORMA O APARTADO DEL MANUAL DE CONVIVENCIA', regulation || 'Pendiente de registrar.', brand, margin, width, 48);
    const actions = this.sharedOrEnumeratedText(observations, (item) => item.actaRecord?.sanctions || item.actionTaken);
    this.renderBoxSection(doc, '4. MEDIDAS, ACUERDOS Y COMPROMISOS', actions || 'Pendiente de registrar.', brand, margin, width, 58);
    const witnesses = this.sharedOrEnumeratedText(observations, (item) => item.actaRecord?.witnesses);
    this.renderBoxSection(doc, '5. TESTIGOS U OTROS ASISTENTES', witnesses || 'No registrados.', brand, margin, width, 36);

    this.renderSignatures(doc, observations, reportConfig, brand, margin, width);
  }

  private renderStudentStatementAnnex(doc: PDFKit.PDFDocument, institution: any, reportConfig: any, observation: any, logo: Buffer | null) {
    const margin = 42;
    const width = doc.page.width - margin * 2;
    const brand = this.brandColor(institution.primaryColor);
    this.renderInstitutionHeader(doc, institution, reportConfig, logo, brand, margin, width);

    const titleY = doc.y;
    doc.roundedRect(margin, titleY, width, 35, 4).fill(brand);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text('ANEXO INDIVIDUAL', margin + 8, titleY + 6, { width: width - 16, align: 'center' });
    doc.font('Helvetica').fontSize(8).text('VERSIÓN O DESCARGOS DEL ESTUDIANTE', margin + 8, titleY + 20, { width: width - 16, align: 'center' });
    doc.y = titleY + 44;

    const enrollment = observation.studentEnrollment;
    const group = `${enrollment.group?.grade?.name || ''} ${enrollment.group?.name || ''}`.trim();
    this.renderMetaGrid(doc, margin, width, [
      ['Acta asociada', observation.actaRecord?.actaNumber || 'Sin consecutivo'],
      ['Fecha del hecho', this.dateOnly(observation.date)],
      ['Estudiante', this.studentName(enrollment.student)],
      ['Grupo', group || 'No registrado'],
    ], brand);

    doc.font('Helvetica').fontSize(7.5).fillColor('#475569').text(
      'Este anexo recoge la versión libre del estudiante y forma parte integral del acta indicada. Puede diligenciarse en el sistema o completarse de forma manuscrita al imprimir.',
      margin,
      doc.y,
      { width, align: 'justify', lineGap: 1.5 },
    );
    doc.moveDown(0.7);

    const statement = String(observation.actaRecord?.studentStatement || '').trim();
    this.renderBoxSection(
      doc,
      'VERSIÓN LIBRE Y VOLUNTARIA DEL ESTUDIANTE',
      statement || 'Espacio para que el estudiante relate los hechos con sus propias palabras:',
      brand,
      margin,
      width,
      310,
      !statement,
    );

    doc.font('Helvetica').fontSize(7.2).fillColor('#475569').text(
      'La firma deja constancia de que esta versión fue leída o registrada según lo expresado por el estudiante.',
      margin,
      doc.y,
      { width },
    );
    doc.moveDown(0.7);
    this.renderAnnexSignatures(doc, observation, margin, width);
  }

  private renderInstitutionHeader(doc: PDFKit.PDFDocument, institution: any, config: any, logo: Buffer | null, brand: string, margin: number, width: number) {
    const startY = doc.y;
    if (logo) {
      try { doc.image(logo, margin, startY, { fit: [58, 58], align: 'center', valign: 'center' }); } catch { /* continuar sin logo */ }
    }
    const textX = logo ? margin + 68 : margin;
    const textWidth = logo ? width - 68 : width;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13).text(String(institution.name || '').toUpperCase(), textX, startY, { width: textWidth, align: 'center' });
    doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
    const address = String(institution.address || '').trim();
    const city = String(institution.city || '').trim();
    const location = [address, city && !address.toLocaleLowerCase('es').includes(city.toLocaleLowerCase('es')) ? city : ''].filter(Boolean).join(' - ');
    if (location) doc.text(`DIRECCIÓN ${location.toUpperCase()}`, textX, doc.y + 2, { width: textWidth, align: 'center' });
    const resolution = this.resolutionLine(config?.headerResolution);
    if (resolution) doc.text(resolution, textX, doc.y + 1, { width: textWidth, align: 'center' });
    const identifiers = [institution.nit ? `NIT ${institution.nit}` : '', institution.daneCode ? `DANE ${institution.daneCode}` : ''].filter(Boolean).join('   |   ');
    if (identifiers) doc.text(identifiers.toUpperCase(), textX, doc.y + 1, { width: textWidth, align: 'center' });
    const contact = [institution.phone ? `TEL. ${institution.phone}` : '', institution.email || '', institution.website || ''].filter(Boolean).join('   |   ');
    if (contact) doc.fontSize(7.2).text(contact, textX, doc.y + 1, { width: textWidth, align: 'center' });
    doc.y = Math.max(doc.y + 8, startY + 66);
    doc.moveTo(margin, doc.y).lineTo(margin + width, doc.y).strokeColor(brand).lineWidth(1.5).stroke();
    doc.moveDown(0.6);
  }

  private renderMetaGrid(doc: PDFKit.PDFDocument, x: number, width: number, entries: Array<[string, string]>, brand: string) {
    const col = width / 2;
    const rowHeight = 31;
    const startY = doc.y;
    entries.forEach(([label, value], index) => {
      const row = Math.floor(index / 2);
      const column = index % 2;
      const cellX = x + column * col;
      const y = startY + row * rowHeight;
      doc.rect(cellX, y, col, rowHeight).strokeColor('#cbd5e1').lineWidth(0.6).stroke();
      doc.font('Helvetica-Bold').fontSize(7).fillColor(brand).text(label.toUpperCase(), cellX + 6, y + 5, { width: col - 12 });
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(String(value || 'No registrado'), cellX + 6, y + 15, { width: col - 12 });
    });
    doc.y = startY + rowHeight * Math.ceil(entries.length / 2) + 6;
  }

  private renderBoxSection(doc: PDFKit.PDFDocument, title: string, text: string, brand: string, x: number, width: number, minBodyHeight = 32, writingLines = false) {
    const safeText = String(text || 'No registrado.');
    const textHeight = doc.heightOfString(safeText, { width: width - 20, lineGap: 2 });
    const bodyHeight = Math.max(minBodyHeight, textHeight + 16);
    const totalHeight = bodyHeight + 23;
    this.ensureSpace(doc, totalHeight + 4);
    const y = doc.y;
    doc.roundedRect(x, y, width, totalHeight, 4).fillAndStroke('#ffffff', '#cbd5e1');
    doc.save().roundedRect(x, y, width, 22, 4).clip().rect(x, y + 11, width, 11).fill('#f1f5f9').restore();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(brand).text(title, x + 9, y + 7, { width: width - 18 });
    doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b').text(safeText, x + 10, y + 31, { width: width - 20, lineGap: 2, align: 'justify' });
    if (writingLines) {
      const firstLineY = y + 68;
      for (let lineY = firstLineY; lineY < y + totalHeight - 13; lineY += 22) {
        doc.moveTo(x + 10, lineY).lineTo(x + width - 10, lineY).strokeColor('#dbe3ee').lineWidth(0.45).stroke();
      }
    }
    doc.y = y + totalHeight + 4;
  }

  private renderSignatures(doc: PDFKit.PDFDocument, observations: any[], config: any, brand: string, x: number, width: number, title = '6. FIRMAS INSTITUCIONALES', note = 'Los estudiantes y acudientes firman sus respectivos anexos de versión o descargos.') {
    const configured = Array.isArray(config?.signatureConfig) ? config.signatureConfig : [];
    const configuredName = (roles: string[]) => configured.find((item: any) => item?.enabled !== false && roles.includes(String(item?.role || '').toUpperCase()))?.name || '';
    const people = new Map<string, { name: string; role: string }>();
    const addUser = (user: any, role: string) => {
      if (!user?.id) return;
      const key = `user-${user.id}`;
      const current = people.get(key);
      const roles = current ? current.role.split(' / ') : [];
      people.set(key, { name: this.userName(user), role: roles.includes(role) ? current!.role : [...roles, role].join(' / ') });
    };
    observations.forEach((item) => {
      addUser(item.author, 'Docente que registra');
      addUser(item.studentEnrollment.group?.director, 'Director(a) de grupo');
    });
    people.set('coordinator', { name: configuredName(['COORDINATOR', 'COORDINADOR']), role: 'Coordinador(a)' });
    const list = [...people.values()];
    this.ensureSpace(doc, 40 + Math.ceil(list.length / 3) * 46);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(brand).text(title, x, doc.y, { width });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(7.2).fillColor('#475569').text(note, x, doc.y, { width });
    doc.moveDown(0.5);

    const gap = 14;
    const columnWidth = (width - gap * 2) / 3;
    for (let row = 0; row < Math.ceil(list.length / 3); row += 1) {
      const rowY = doc.y;
      for (let column = 0; column < 3; column += 1) {
        const person = list[row * 3 + column];
        if (!person) continue;
        const sigX = x + column * (columnWidth + gap);
        const sigY = rowY + 23;
        doc.moveTo(sigX, sigY).lineTo(sigX + columnWidth, sigY).strokeColor('#64748b').lineWidth(0.6).stroke();
        doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#0f172a').text(person.name || 'Nombre: __________________', sigX, sigY + 4, { width: columnWidth, align: 'center' });
        doc.font('Helvetica').fontSize(6.5).fillColor('#475569').text(person.role, sigX, sigY + 15, { width: columnWidth, align: 'center' });
        doc.y = rowY;
      }
      doc.y = rowY + 46;
    }
  }

  private renderAnnexSignatures(doc: PDFKit.PDFDocument, observation: any, x: number, width: number) {
    const student = this.studentName(observation.studentEnrollment.student);
    const people = [
      { name: student, role: 'Estudiante' },
      { name: '', role: 'Acudiente' },
      { name: this.userName(observation.author), role: 'Docente que recibe o registra' },
    ];
    const gap = 14;
    const columnWidth = (width - gap * 2) / 3;
    const rowY = doc.y;
    people.forEach((person, index) => {
      const sigX = x + index * (columnWidth + gap);
      const sigY = rowY + 25;
      doc.moveTo(sigX, sigY).lineTo(sigX + columnWidth, sigY).strokeColor('#64748b').lineWidth(0.6).stroke();
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#0f172a').text(person.name || 'Nombre: __________________', sigX, sigY + 4, { width: columnWidth, align: 'center' });
      doc.font('Helvetica').fontSize(6.5).fillColor('#475569').text(person.role, sigX, sigY + 15, { width: columnWidth, align: 'center' });
    });
    doc.y = rowY + 50;
  }

  private ensureSpace(doc: PDFKit.PDFDocument, required: number) {
    if (doc.y + required > doc.page.height - 42) doc.addPage();
  }

  private participantsText(observations: any[]) {
    return observations.map((item, index) => {
      const enrollment = item.studentEnrollment;
      const group = `${enrollment.group?.grade?.name || ''} ${enrollment.group?.name || ''}`.trim();
      return `${index + 1}. ${this.studentName(enrollment.student)} - Grupo ${group || 'no registrado'}`;
    }).join('\n');
  }

  private sharedOrEnumeratedText(observations: any[], pick: (item: any) => string | null | undefined) {
    const values = observations.map((item) => String(pick(item) || '').trim());
    const nonEmpty = values.filter(Boolean);
    if (!nonEmpty.length) return '';
    if (new Set(nonEmpty).size === 1 && nonEmpty.length === observations.length) return nonEmpty[0];
    return observations.map((item, index) => `${this.studentName(item.studentEnrollment.student)}: ${values[index] || 'No registrado.'}`).join('\n\n');
  }

  private studentName(student: any) {
    return [student?.lastName, student?.secondLastName, student?.firstName, student?.secondName].filter(Boolean).join(' ').toUpperCase();
  }

  private userName(user: any) {
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  }

  private typeLabel(type: string) {
    return ({ ACTA_TYPE_I: 'TIPO I', ACTA_TYPE_II: 'TIPO II', ACTA_TYPE_III: 'TIPO III' } as Record<string, string>)[type] || 'ACTA';
  }

  private statusLabel(status?: string | null) {
    return ({ OPEN: 'Abierto', IN_PROGRESS: 'En seguimiento', CLOSED: 'Cerrado' } as Record<string, string>)[String(status || '')] || 'No registrado';
  }

  private dateOnly(value: Date | string) {
    const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    const [year, month, day] = raw.split('-');
    return year && month && day ? `${day}/${month}/${year}` : raw;
  }

  private resolutionLine(value?: string | null) {
    const resolution = String(value || '').trim();
    if (!resolution) return '';
    return /resoluci[oó]n/i.test(resolution) ? resolution.toUpperCase() : `APROBACIÓN RESOLUCIÓN OFICIAL ${resolution.toUpperCase()}`;
  }

  private brandColor(value?: string | null) {
    return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#1E3A8A';
  }

  /** El perfil es la fuente oficial; el campo histórico de boletines es respaldo de lectura. */
  private institutionLogo(institution: { logo?: string | null }, reportConfig?: { logoUrl?: string | null } | null) {
    return institution.logo || reportConfig?.logoUrl || null;
  }

  private async resolveLogo(storedValue?: string | null): Promise<Buffer | null> {
    if (!storedValue) return null;
    try {
      const dataUri = await this.storage.resolveToDataUri(storedValue);
      const match = dataUri?.match(/^data:[^;]+;base64,(.+)$/);
      return match ? Buffer.from(match[1], 'base64') : null;
    } catch {
      return null;
    }
  }
}
