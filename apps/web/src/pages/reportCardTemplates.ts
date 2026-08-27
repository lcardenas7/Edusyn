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
  fontFamily?: string; // Familia tipográfica configurable (CSS font-family stack)
  showHeaderTitle?: boolean; // Mostrar el rótulo "Boletín Académico" sobre el nombre de la institución
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
  // Contenido descriptivo (Aprendizajes y Evidencias). Si no viene, se asume el
  // comportamiento histórico (solo aprendizaje/narrativa).
  achievementContent?: {
    showLearning: boolean;
    showEvidences: boolean;
    showLevelDescriptor: boolean;
    showJudgment: boolean;
    granularity: 'PRIMARY_ONLY' | 'ALL';
  };
}

// Tipo de un bloque descriptivo por asignatura que llega desde el backend.
export interface LearningBlock {
  learning: string | null;
  evidences: string[];
  levelDescriptor: string | null;
  judgment: string | null;
  performanceLevel: string | null;
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
    name: 'Multiperíodo Tabular',
    description: 'Tabla Área·Asignatura·I.H.·Aprendizaje·P1..Pn·DEF·Desempeño, con acumulado y recuperaciones. Para primaria/bachillerato.',
    supportedStructures: ['AREAS_SUBJECTS', 'SUBJECTS_ONLY'],
    multiperiod: true,
  },
  {
    key: 'transicion-propositos',
    name: 'Transición · Propósitos e Imprescindibles',
    description: 'Cualitativo por dimensiones con Propósito (negrita) + Imprescindibles (viñetas), columnas de escala configurable, I.H. y convivencia. Etiquetas configurables por institución.',
    supportedStructures: ['DIMENSIONS'],
    multiperiod: false,
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

/**
 * Renderiza el contenido descriptivo por asignatura (Aprendizaje → Evidencias →
 * Descriptor del nivel → Juicio valorativo) respetando la configuración institucional.
 * Cae al comportamiento histórico (mostrar la narrativa/aprendizaje) si no hay flags.
 */
function renderLearningBlocks(sub: any, ctx: TemplateCtx): string {
  const c = ctx.colors;
  const cfg = ctx.achievementContent;
  const blocks: LearningBlock[] = (sub?.learningBlocks as LearningBlock[]) || [];

  // Fallback histórico: sin config o sin bloques → narrativa simple (aprendizaje).
  if (!cfg || blocks.length === 0) {
    const narrative = sub?.achievement || sub?.qualitativeObservation || sub?.achievementObservation || '';
    return narrative
      ? `<div style="font-size:10px;color:#475569;margin-top:3px;line-height:1.4;">${esc(narrative)}</div>`
      : '';
  }

  const label = (t: string) =>
    `<span style="font-size:9px;font-weight:800;color:${c.primary};text-transform:uppercase;letter-spacing:0.3px;">${esc(t)}</span>`;

  const parts = blocks.map((b) => {
    const rows: string[] = [];
    if (cfg.showLearning && b.learning) {
      rows.push(`<div style="margin-top:3px;">${label('Aprendizaje')}<div style="font-size:10px;color:#334155;line-height:1.4;">${esc(b.learning)}</div></div>`);
    }
    if (cfg.showEvidences && b.evidences && b.evidences.length > 0) {
      const items = b.evidences.map((e) => `<li style="margin:1px 0;">${esc(e)}</li>`).join('');
      rows.push(`<div style="margin-top:3px;">${label('Evidencias de aprendizaje')}<ul style="margin:2px 0 0 14px;padding:0;font-size:10px;color:#475569;line-height:1.4;">${items}</ul></div>`);
    }
    if (cfg.showLevelDescriptor && b.levelDescriptor) {
      const lvl = b.performanceLevel ? (ctx.performanceLabels[b.performanceLevel] || b.performanceLevel) : '';
      rows.push(`<div style="margin-top:3px;">${label(`Descriptor del nivel${lvl ? ' ' + lvl : ''}`)}<div style="font-size:10px;color:#475569;line-height:1.4;">${esc(b.levelDescriptor)}</div></div>`);
    }
    if (cfg.showJudgment && b.judgment) {
      rows.push(`<div style="margin-top:3px;">${label('Juicio valorativo')}<div style="font-size:10px;color:#64748b;font-style:italic;line-height:1.4;">${esc(b.judgment)}</div></div>`);
    }
    return rows.join('');
  }).filter(Boolean);

  return parts.join('<div style="height:5px;"></div>');
}

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
        ${ctx.showHeaderTitle === false ? '' : '<div style="font-size:9px;letter-spacing:3px;color:#94a3b8;text-transform:uppercase;">Boletín Académico</div>'}
        <div style="font-size:16px;font-weight:800;color:${c.primary};line-height:1.15;text-transform:uppercase;">${esc(ctx.institutionName)}</div>
        ${ctx.headerLines.map(l => `<div style="font-size:8px;color:#64748b;">${esc(l)}</div>`).join('')}
      </div>
      ${logo}
    </div>`;
}

function signaturesBlock(ctx: TemplateCtx, marginTop = 32): string {
  const sigs = ctx.signatures.filter(Boolean);
  if (sigs.length === 0) return '';
  const single = sigs.length === 1;
  return `
    <div style="display:flex;justify-content:${single ? 'center' : 'space-around'};margin-top:${marginTop}px;gap:16px;">
      ${sigs.map(s => `
        <div style="text-align:center;flex:${single ? '0 0 220px' : '1'};max-width:240px;">
          ${s.imageSrc ? `<img src="${s.imageSrc}" style="height:34px;object-fit:contain;margin-bottom:2px;" />` : '<div style="height:34px;"></div>'}
          <div style="border-top:1px solid #94a3b8;padding-top:3px;font-size:9px;font-weight:700;color:${ctx.colors.text};">${esc(s.label)}</div>
          <div style="font-size:9px;color:#475569;">${esc(s.name || '')}</div>
        </div>`).join('')}
    </div>`;
}

function footerBlock(ctx: TemplateCtx, marginTop = 16): string {
  const date = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
  const verif = ctx.showVerification && ctx.verificationCode
    ? `<span>Código de verificación: <b>${esc(ctx.verificationCode)}</b></span>` : '';
  return `
    <div style="margin-top:${marginTop}px;padding-top:6px;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;font-size:8px;color:#94a3b8;">
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
      const descriptive = renderLearningBlocks(sub, ctx);
      return `
        <div style="padding:7px 0;border-bottom:1px dashed #e2e8f0;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span style="font-size:11px;font-weight:700;color:${c.text};">${esc(sub.subject)}</span>
            ${levelChip(sub.performanceLevel)}
          </div>
          ${descriptive}
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
    <div class="report-card-page" style="font-family:${ctx.fontFamily || 'Arial, Helvetica, sans-serif'};color:${c.text};padding:6px;">
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
    if (!cell || cell.grade === null || cell.grade === undefined) return '<td style="text-align:center;color:#cbd5e1;border-left:1px solid #eef2f7;">—</td>';
    const recovered = cell.hasRecovery && cell.originalGrade !== null && cell.originalGrade !== undefined;
    const shown = recovered ? cell.originalGrade : cell.grade; // en P1 se ve la nota perdida
    const badge = recovered && cell.recoveryGrade != null
      ? `<div style="font-size:7.5px;color:#16a34a;font-weight:700;">rec. ${fmt1(cell.recoveryGrade)}</div>`
      : '';
    return `<td style="text-align:center;border-left:1px solid #eef2f7;padding:3px 2px;">
      <div style="font-weight:800;color:${recovered ? '#dc2626' : c.text};">${fmt1(shown)}</div>
      <div style="font-size:7px;text-transform:uppercase;color:${perfColor(cell.performanceLevel)};">${esc(perfLabel(cell.performanceLevel))}</div>
      ${badge}
    </td>`;
  };

  const periodHeaders = periods.map(p => `<th style="padding:5px 4px;text-align:center;border-left:1px solid #e2e8f0;">${esc(shortPeriod(p.name, p.order))}</th>`).join('');

  // Paleta rotativa para el nombre del área (estilo referencia San José).
  const areaPalette = ['#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be123c', '#0369a1', '#4d7c0f'];
  const areaRows = ((year.areas || []) as any[]).map((area, ai) => {
    const subjects = (area.subjects || []) as any[];
    const areaColor = areaPalette[ai % areaPalette.length];
    return subjects.map((sub, i) => `
      <tr style="border-top:1px solid #eef2f7;${i % 2 ? `background:${c.tableStripe};` : ''}">
        ${i === 0 ? `<td rowspan="${subjects.length}" style="font-weight:800;color:${areaColor};vertical-align:middle;text-align:center;padding:4px 6px;border-right:1px solid #e2e8f0;font-size:8.5px;line-height:1.2;">${esc(area.area)}</td>` : ''}
        <td style="padding:4px 6px;font-weight:600;">${esc(sub.subject)}</td>
        <td style="text-align:center;color:#94a3b8;">${sub.weeklyHours ? esc(sub.weeklyHours) + 'h' : ''}</td>
        <td style="padding:4px 6px;font-size:8px;color:#475569;line-height:1.3;">${esc(sub.achievement || '')}</td>
        ${periods.map(p => periodCell(sub.cells?.[p.id])).join('')}
        <td style="text-align:center;font-weight:800;color:${c.primary};border-left:1px solid #e2e8f0;">${fmt(sub.def)}</td>
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
    <div class="report-card-page" style="font-family:${ctx.fontFamily || 'Arial, Helvetica, sans-serif'};color:${c.text};padding:6px;">
      ${headerBlock(ctx)}
      ${studentCard(ctx, year, curLabel)}
      <div style="margin-top:12px;font-size:12px;font-weight:800;color:${c.primary};text-transform:uppercase;letter-spacing:1px;">Desempeño académico</div>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:9px;">
        <thead>
          <tr style="background:${c.headerBg};color:${c.primary};font-size:8px;text-transform:uppercase;">
            <th style="padding:4px;text-align:left;">Área</th>
            <th style="padding:4px;text-align:left;">Asignatura</th>
            <th style="padding:4px;">I.H.</th>
            <th style="padding:4px;text-align:left;">Aprendizaje</th>
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

// ═══════════════════════════════════════════════════════════════════════════
// transicion-propositos · Boletín de Transición (Propósitos e Imprescindibles)
// Cualitativo por dimensiones: Propósito (negrita) + Imprescindibles (viñetas),
// columnas de escala configurable, I.H. (displayHours), convivencia y puesto opcional.
// ═══════════════════════════════════════════════════════════════════════════
export function buildTransicionPropositosHtml(data: any, ctx: TemplateCtx, periodLabel: string): string {
  const c = ctx.colors;
  const rc = data.reportContent || {};
  const learningLabelSingular = rc.learningLabelSingular || 'Aprendizaje';
  const evidenceLabelPlural = rc.evidenceLabelPlural || 'Evidencias';

  // Escala dinámica: usa los niveles cualitativos configurados; si no, deriva de performanceLabels.
  let scale: Array<{ code: string; name: string }> = (ctx.qualitativeLevels || []).map(l => ({ code: l.code, name: l.name }));
  if (scale.length === 0) {
    scale = Object.entries(ctx.performanceLabels || {}).map(([code, name]) => ({ code, name: String(name) }));
  }

  const absencesRaw = data.attendance?.absent ?? 0;
  const showZero = !!rc.showZeroAbsences;
  const inasCell = (absencesRaw === 0 && !showZero) ? '' : String(absencesRaw);

  const norm = (v: any) => String(v ?? '').trim().toUpperCase();

  // El nivel se guarda como enum PerformanceLevel (SUPERIOR/ALTO/BASICO/BAJO),
  // asignado por posición sobre la escala ordenada de mejor a menor. Para marcar
  // la columna correcta hay que reconstruir el código de escala (L/EP/I…) desde el enum.
  const PERF_SLOTS: Record<number, string[]> = {
    4: ['SUPERIOR', 'ALTO', 'BASICO', 'BAJO'],
    3: ['SUPERIOR', 'BASICO', 'BAJO'],
    2: ['SUPERIOR', 'BAJO'],
  };
  const perfSlots = PERF_SLOTS[scale.length] || PERF_SLOTS[4] || [];
  const codeByPerf: Record<string, string> = {};
  scale.forEach((s, i) => { if (perfSlots[i]) codeByPerf[norm(perfSlots[i])] = norm(s.code); });

  // Modo de valoración: 'EVIDENCE' = un nivel por imprescindible (inline); 'PURPOSE' = un nivel por propósito.
  const evidenceMode = rc.valuationScope === 'EVIDENCE';
  // Modo de visualización (solo PURPOSE): 'SINGLE' = una columna con el código; 'COLUMNS' = ✓ por nivel.
  const valSingle = rc.preschoolLevelDisplay === 'SINGLE';
  // EVIDENCE has one real, independent valuation column for each evidence row.
  const valCols = evidenceMode ? 1 : (valSingle ? 1 : scale.length); // columnas de valoración a la derecha
  const usesScaleColumns = !evidenceMode && !valSingle && scale.length > 0;

  // La valoración es una columna ESTRUCTURAL, no un texto alineado a la derecha dentro
  // del contenido: ancho fijo vía <colgroup> + table-layout:fixed (para que no dependa
  // del largo del texto) y una línea divisoria sólida en el borde con el contenido.
  const COL_DIVIDER = '1px solid #cbd5e1';   // separador entre columnas estructurales
  const SUBCOL_DIVIDER = '1px solid #e2e8f0'; // separador entre niveles de la escala
  // Los anchos dan cabida al rótulo COMPLETO sin bajar el tamaño de letra:
  // "VALORACIÓN" a 9.5px ocupa ~61px + padding, e "INAS" ~22px + padding. El espacio
  // sale de la columna de contenido, que es la única elástica.
  const IH_COL_W = 42;
  const INAS_COL_W = 48;
  const valColWidth = (evidenceMode || valSingle) ? 86 : 38;
  const valDivider = (index: number) => (index === 0 ? COL_DIVIDER : SUBCOL_DIVIDER);
  const colGroup = `<colgroup>
              <col style="width:${IH_COL_W}px;" />
              <col />
              ${Array.from({ length: valCols }).map(() => `<col style="width:${valColWidth}px;" />`).join('')}
              <col style="width:${INAS_COL_W}px;" />
            </colgroup>`;

  const scaleHeaders = (evidenceMode || valSingle)
    ? `<th style="padding:4px 3px;text-align:center;white-space:nowrap;border-left:${COL_DIVIDER};">Valoración</th>`
    : `<th colspan="${scale.length}" style="padding:4px 3px;text-align:center;white-space:nowrap;border-left:${COL_DIVIDER};">Valoración</th>`;
  const scaleSubheaders = usesScaleColumns
    ? `<tr style="background:${c.headerBg};color:#334155;font-size:9px;text-transform:uppercase;border-bottom:2px solid ${c.primary};">${scale.map((s, i) => `<th style="padding:3px;text-align:center;border-left:${valDivider(i)};">${esc(s.code)}</th>`).join('')}</tr>`
    : '';

  const subjects: any[] = (data.areaGrades || []).flatMap((a: any) => a.subjects || []);
  const emptyValCells = (evidenceMode || valSingle)
    ? `<td style="border-left:${COL_DIVIDER};"></td>`
    : scale.map((_s, i) => `<td style="border-left:${valDivider(i)};"></td>`).join('');
  const rows = subjects.map((sub: any) => {
    const isConvivencia = sub.subjectType === 'CONVIVENCIA';
    const ih = sub.displayHours ?? sub.weeklyHours ?? '';
    if (isConvivencia) {
      const txt = sub.convivenciaText || '';
      // Cada desempeño libre mantiene su propia valoración. Las entradas antiguas
      // (solo texto) siguen apareciendo como viñetas sin valoración.
      const storedItems = Array.isArray(sub.convivenciaItems) ? sub.convivenciaItems : [];
      const convItems = storedItems.length
        ? storedItems.map((item: any) => ({ text: String(item?.text || '').trim(), level: norm(item?.level) })).filter((item: any) => item.text)
        : txt.split('\n').map((text: string) => ({ text: text.trim(), level: '' })).filter((item: any) => item.text);
      const convValCells = (rawLevel: string) => {
        const level = codeByPerf[norm(rawLevel)] || norm(rawLevel);
        if (evidenceMode || valSingle) {
          return `<td style="text-align:center;border-left:${COL_DIVIDER};vertical-align:middle;font-weight:800;color:${c.primary};">${esc(level)}</td>`;
        }
        return scale.map((s, i) => `<td style="text-align:center;border-left:${valDivider(i)};vertical-align:middle;font-weight:800;color:${c.primary};">${norm(s.code) === level ? '✓' : ''}</td>`).join('');
      };
      const rowCount = Math.max(convItems.length + 1, 1);
      const convRows = convItems.map((item: { text: string; level: string }) => `
        <tr style="border-top:1px dotted #eef2f7;">
          <td style="padding:4px 8px;font-size:10px;color:#475569;line-height:1.4;vertical-align:middle;">• ${esc(item.text)}</td>
          ${convValCells(item.level)}
        </tr>`).join('');
      return `
        <tr style="border-top:1px solid #e2e8f0;">
          <td rowspan="${rowCount}" style="text-align:center;font-weight:700;padding:5px 4px;vertical-align:top;">${esc(String(ih))}</td>
          <td style="padding:5px 8px;"><div style="font-weight:800;color:${c.text};">${esc(sub.subject)}</div></td>
          ${emptyValCells}
          <td rowspan="${rowCount}" style="text-align:center;border-left:${COL_DIVIDER};vertical-align:top;">${esc(inasCell)}</td>
        </tr>${convRows}`;
    }

    // ─── Modo EVIDENCE: propósito (negrita, sin ✓) + imprescindibles con su valoración ───
    if (evidenceMode) {
      const blocks = (sub.learningBlocks || []) as any[];
      const detailRows = blocks.flatMap((block: any) => {
        const purposeRow = {
          content: `<div style="font-weight:800;color:${c.text};line-height:1.35;">${esc(block.learning || '')}</div>`,
          level: '',
          purpose: true,
        };
        const evidenceRows = (block.evidenceItems || []).map((item: any) => ({
          content: `<span style="font-size:10px;color:#475569;line-height:1.4;">• ${esc(item.text)}</span>`,
          level: codeByPerf[norm(item.level)] || norm(item.level) || '',
          purpose: false,
        }));
        return [purposeRow, ...evidenceRows];
      });
      const rowCount = Math.max(detailRows.length, 1);
      if (!detailRows.length) {
        return `<tr style="border-top:1px solid #e2e8f0;">
          <td style="text-align:center;font-weight:700;padding:5px 4px;vertical-align:top;">${esc(String(ih))}</td>
          <td style="padding:5px 8px;"><span style="font-size:10px;color:#94a3b8;">Sin registros.</span></td>
          <td style="border-left:${COL_DIVIDER};"></td>
          <td style="text-align:center;border-left:${COL_DIVIDER};vertical-align:top;">${esc(inasCell)}</td>
        </tr>`;
      }
      return detailRows.map((item: any, index: number) => `
        <tr style="border-top:${index === 0 ? '1px solid #e2e8f0' : '1px dotted #eef2f7'};">
          ${index === 0 ? `<td rowspan="${rowCount}" style="text-align:center;font-weight:700;padding:5px 4px;vertical-align:top;">${esc(String(ih))}</td>` : ''}
          <td style="padding:${item.purpose ? '5px 8px' : '4px 8px'};vertical-align:middle;">${item.content}</td>
          <td style="text-align:center;border-left:${COL_DIVIDER};vertical-align:middle;font-weight:800;color:${c.primary};">${esc(item.level)}</td>
          ${index === 0 ? `<td rowspan="${rowCount}" style="text-align:center;border-left:${COL_DIVIDER};vertical-align:top;">${esc(inasCell)}</td>` : ''}
        </tr>`).join('');
    }

    // ─── Modo PURPOSE (actual): un nivel por propósito ───
    const block = (sub.learningBlocks && sub.learningBlocks[0]) || null;
    const proposito = block?.learning || sub.achievement || '';
    const evidences: string[] = block?.evidences || [];
    const rawLevel = norm(block?.performanceLevel || sub.performanceLevel);
    // El valor guardado suele ser el enum PerformanceLevel; traducir al código de escala.
    const level = codeByPerf[rawLevel] || rawLevel;
    const evidencesHtml = (rc.showEvidences !== false && evidences.length)
      ? `<div style="font-size:9.5px;font-weight:700;color:#64748b;margin-top:3px;">${esc(evidenceLabelPlural)}</div>
         <ul style="margin:2px 0 0 14px;padding:0;font-size:10px;color:#475569;line-height:1.4;">${evidences.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`
      : '';
    const descriptorHtml = (rc.showLevelDescriptor && block?.levelDescriptor)
      ? `<div style="font-size:10px;color:#475569;margin-top:3px;font-style:italic;">${esc(block.levelDescriptor)}</div>` : '';
    return `
      <tr style="border-top:1px solid #e2e8f0;">
        <td style="text-align:center;font-weight:700;padding:5px 4px;vertical-align:top;">${esc(String(ih))}</td>
        <td style="padding:5px 8px;">
          <div style="font-weight:800;color:${c.text};line-height:1.35;">${esc(proposito)}</div>
          ${evidencesHtml}
          ${descriptorHtml}
        </td>
        ${valSingle
          ? `<td style="text-align:center;border-left:${COL_DIVIDER};vertical-align:middle;font-weight:800;color:${c.primary};">${esc(level)}</td>`
          : scale.map((s, i) => `<td style="text-align:center;border-left:${valDivider(i)};vertical-align:middle;font-weight:800;color:${c.primary};">${norm(s.code) === level ? '✓' : ''}</td>`).join('')}
        <td style="text-align:center;border-left:${COL_DIVIDER};vertical-align:top;">${esc(inasCell)}</td>
      </tr>`;
  }).join('');

  const scaleLegend = scale.map(s => `${esc(s.code)} = ${esc(s.name)}`).join('  ·  ');

  const s = data.student || {};
  const g = data.group || {};
  const showRank = !!(rc.preschoolShowRank && data.rank);
  const infoCell = (label: string, value: string, last = false) =>
    `<div style="padding:5px 9px;${last ? '' : `border-right:1px solid ${c.primary}33;`}">
      <div style="font-size:7.5px;letter-spacing:0.5px;color:#94a3b8;text-transform:uppercase;">${esc(label)}</div>
      <div style="font-size:10.5px;font-weight:700;color:${c.text};">${esc(value) || '—'}</div>
    </div>`;

  return `
    <div class="report-card-page" style="font-family:${ctx.fontFamily || 'Arial, Helvetica, sans-serif'};color:${c.text};padding:9px;">
      ${headerBlock(ctx)}

      <div style="text-align:center;background:${c.primary};color:#fff;padding:8px 0;border-radius:5px;margin-top:10px;">
        <div style="font-size:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Informe Académico</div>
        <div style="font-size:11px;opacity:0.92;margin-top:1px;">${esc(periodLabel)}</div>
      </div>

      <div style="margin-top:10px;border:1px solid ${c.primary};border-radius:4px;overflow:hidden;">
        <div style="display:grid;grid-template-columns:${showRank ? '2fr 1fr 1.4fr 1fr' : '2fr 1fr 1.4fr'};">
          ${infoCell('Estudiante', studentName(s))}
          ${infoCell('Documento', s.documentNumber || '')}
          ${infoCell('Curso', `${g.gradeLevel || g.gradeName || ''} ${g.name || ''}`.trim(), !showRank)}
          ${showRank ? infoCell('Puesto', `${data.rank}${data.totalStudents ? ' / ' + data.totalStudents : ''}`, true) : ''}
        </div>
      </div>

      <div style="margin-top:10px;border:1px solid ${c.primary};border-radius:4px;overflow:hidden;">
        <table style="width:100%;table-layout:fixed;word-break:break-word;border-collapse:collapse;font-size:10.5px;">
          ${colGroup}
          <thead style="display:table-header-group;">
            <tr style="background:${c.headerBg};color:#334155;font-size:9.5px;text-transform:uppercase;border-bottom:2px solid ${c.primary};">
              <th rowspan="${usesScaleColumns ? 2 : 1}" style="padding:7px 4px;white-space:nowrap;">I.H.</th>
              <th rowspan="${usesScaleColumns ? 2 : 1}" style="padding:7px 6px;text-align:left;">${esc(learningLabelSingular)} / ${esc(evidenceLabelPlural)}</th>
              ${scaleHeaders}
              <th rowspan="${usesScaleColumns ? 2 : 1}" style="padding:7px 4px;white-space:nowrap;border-left:${COL_DIVIDER};">Inas</th>
            </tr>
            ${scaleSubheaders}
          </thead>
          <tbody>${rows || `<tr><td colspan="${valCols + 3}" style="padding:8px;color:#94a3b8;text-align:center;">Sin registros.</td></tr>`}</tbody>
        </table>
      </div>

      <div style="margin-top:7px;font-size:9.5px;color:#64748b;"><b style="color:#475569;">Interpretación de la escala:</b> ${scaleLegend}</div>
      <div style="margin-top:10px;border:1px solid ${c.primary}55;border-radius:4px;padding:8px 12px;min-height:60px;">
        <div style="font-size:11px;font-weight:800;color:${c.primary};text-transform:uppercase;margin-bottom:4px;letter-spacing:0.5px;">Observaciones</div>
        ${(data.observations || []).slice(0, 4).map((o: any) => `<div style="font-size:10.5px;color:#475569;margin:3px 0;line-height:1.45;">${esc(o.description || o)}</div>`).join('')}
      </div>
      ${signaturesBlock(ctx, 18)}
      ${footerBlock(ctx, 8)}
    </div>`;
}
