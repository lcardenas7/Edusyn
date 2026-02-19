import React, { useRef, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

// ─── Colores corporativos (alineados con la plataforma) ─────────────────────
const C = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  primaryDeep: '#1e3a5f',
  accent: '#3b82f6',
  primaryLight: '#dbeafe',
  dark: '#0f172a',
  text: '#1e293b',
  sub: '#475569',
  muted: '#64748b',
  light: '#f8fafc',
  lighter: '#f1f5f9',
  border: '#e2e8f0',
  green: '#16a34a',
  greenBg: '#f0fdf4',
  greenBorder: '#bbf7d0',
  amber: '#d97706',
  amberBg: '#fffbeb',
  amberBorder: '#fde68a',
  red: '#dc2626',
  redBg: '#fef2f2',
  redBorder: '#fecaca',
  purple: '#7c3aed',
  purpleBg: '#faf5ff',
  purpleBorder: '#e9d5ff',
  blue: '#0ea5e9',
  blueBg: '#f0f9ff',
  blueBorder: '#bae6fd',
}

// ─── Estilos A4 ─────────────────────────────────────────────────────────────
const PAGE: React.CSSProperties = {
  width: '210mm',
  minHeight: '297mm',
  padding: '16mm 20mm',
  margin: '0 auto 20px auto',
  background: '#ffffff',
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  position: 'relative',
  pageBreakAfter: 'always' as const,
  boxSizing: 'border-box',
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
  color: C.text,
  lineHeight: 1.6,
  overflow: 'hidden',
}
const LAST_PAGE: React.CSSProperties = { ...PAGE, pageBreakAfter: 'auto' as const }

// ─── Logo EduSyn (idéntico al sidebar: cuadrado azul + GraduationCap de Lucide) ──
function EdusynLogo({ size = 64 }: { size?: number }) {
  // Lucide GraduationCap paths (viewBox 0 0 24 24), scaled inside a blue rounded square
  const pad = size * 0.2 // padding inside the square
  const iconSize = size - pad * 2
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.22, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
        <path d="M22 10v6" />
        <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
      </svg>
    </div>
  )
}

function EdusynLogoSmall() {
  return (
    <div style={{ width: 24, height: 24, borderRadius: 6, background: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
        <path d="M22 10v6" />
        <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
      </svg>
    </div>
  )
}

// ─── Íconos SVG inline ──────────────────────────────────────────────────────
const Icon = {
  alert: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  check: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  book: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
  users: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  chart: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  file: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  clock: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  shield: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  eye: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  zap: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  award: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  grid: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  target: (c: string) => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  mail: (c: string) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  phone: (c: string) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>,
  mapPin: (c: string) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  user: (c: string) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  trending: (c: string) => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
}

// ─── Componentes reutilizables ──────────────────────────────────────────────
function PageFooterBar({ num, total }: { num: number; total: number }) {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '10mm', background: C.lighter, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22mm' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <EdusynLogoSmall />
        <span style={{ fontSize: '8px', color: C.muted, letterSpacing: '0.5px' }}>Edusyn · Sistema Académico</span>
      </div>
      <span style={{ fontSize: '8px', color: C.muted }}>{num} / {total}</span>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle, color }: { icon: React.ReactNode; title: string; subtitle: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '24px', paddingBottom: '16px', borderBottom: `2px solid ${C.border}` }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: C.dark, margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>{title}</h2>
        <p style={{ fontSize: '12px', color: C.muted, margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  )
}

function ProblemCard({ icon, title, desc, accent }: { icon: React.ReactNode; title: string; desc: string; accent: string }) {
  return (
    <div style={{ display: 'flex', gap: '14px', padding: '14px', borderRadius: '10px', border: `1px solid ${accent}30`, background: `${accent}08`, marginBottom: '12px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 700, color: C.dark, margin: '0 0 4px 0' }}>{title}</p>
        <p style={{ fontSize: '11px', color: C.sub, lineHeight: 1.55, margin: 0 }}>{desc}</p>1504
      </div>
    </div>
  )
}

function SolutionCard({ icon, title, desc, bg, border }: { icon: React.ReactNode; title: string; desc: string; bg: string; border: string }) {
  return (
    <div style={{ borderRadius: '10px', padding: '16px', border: `1px solid ${border}`, background: bg, marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        {icon}
        <p style={{ fontSize: '14px', fontWeight: 700, color: C.dark, margin: 0 }}>{title}</p>
      </div>
      <p style={{ fontSize: '11.5px', color: C.sub, lineHeight: 1.6, margin: 0, paddingLeft: '38px' }}>{desc}</p>
    </div>
  )
}

function ModuleCard2({ icon, title, items, accentBg }: { icon: React.ReactNode; title: string; items: string[]; accentBg: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <p style={{ fontSize: '12.5px', fontWeight: 700, color: C.dark, margin: 0 }}>{title}</p>
      </div>
      <ul style={{ margin: 0, paddingLeft: '16px' }}>
        {items.map((it, i) => <li key={i} style={{ fontSize: '10.5px', color: C.sub, marginBottom: '3px', lineHeight: 1.45 }}>{it}</li>)}
      </ul>
    </div>
  )
}

function RoleSection({ icon, role, color, benefits }: { icon: React.ReactNode; role: string; color: string; benefits: string[] }) {
  return (
    <div style={{ border: `1px solid ${color}30`, borderRadius: '12px', padding: '18px', marginBottom: '14px', background: `${color}06` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <p style={{ fontSize: '16px', fontWeight: 700, color: C.dark, margin: 0 }}>{role}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', paddingLeft: '46px' }}>
        {benefits.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ color, fontSize: '12px', lineHeight: '18px' }}>✓</span>
            <span style={{ fontSize: '11px', color: C.sub, lineHeight: 1.5 }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ value, label, icon, color, bg }: { value: string; label: string; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '18px 12px', borderRadius: '12px', background: bg, border: `1px solid ${color}25` }}>
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <p style={{ fontSize: '28px', fontWeight: 800, color, margin: '0 0 4px 0' }}>{value}</p>
      <p style={{ fontSize: '10px', color: C.muted, margin: 0, lineHeight: 1.3 }}>{label}</p>
    </div>
  )
}

// ─── Componente principal ───────────────────────────────────────────────────
const TOTAL_PAGES = 7

export default function InstitutionalPortfolio() {
  const contentRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return
    setGenerating(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default
      const opt: any = {
        margin: 0,
        filename: 'EduSyn_Portafolio_Institucional.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      }
      await html2pdf().set(opt).from(contentRef.current).save()
    } catch (err) {
      console.error('Error generating PDF:', err)
      alert('Error al generar el PDF')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ background: '#f1f5f9', minHeight: '100vh', paddingBottom: '40px' }}>
      {/* Barra de control (no se imprime) */}
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 50, background: '#1e293b', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '15px' }}>Portafolio Institucional — EduSyn</span>
          <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '12px' }}>Vista previa · {TOTAL_PAGES} páginas A4</span>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 20px', background: '#3b82f6', color: '#fff',
            border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
            cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1,
          }}
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {generating ? 'Generando PDF...' : 'Descargar PDF'}
        </button>
      </div>

      {/* Contenido del portafolio */}
      <div ref={contentRef}>

        {/* ═══════════════════ PÁGINA 1: PORTADA ═══════════════════ */}
        <div style={{ ...PAGE, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: `linear-gradient(90deg, ${C.primary}, ${C.accent}, ${C.primary})` }} />
          <div style={{ marginBottom: '24px' }}><EdusynLogo size={90} /></div>
          <h1 style={{ fontSize: '48px', fontWeight: 800, color: C.dark, margin: '0 0 8px 0', letterSpacing: '-1.5px' }}>Edusyn</h1>
          <p style={{ fontSize: '16px', fontWeight: 600, color: C.primary, margin: '0 0 6px 0', letterSpacing: '3px', textTransform: 'uppercase' }}>Sistema Académico</p>
          <div style={{ width: '50px', height: '3px', background: C.primary, margin: '16px auto 24px auto', borderRadius: '2px' }} />
          <p style={{ fontSize: '16px', color: C.sub, maxWidth: '440px', margin: '0 auto', lineHeight: 1.7 }}>
            ERP académico diseñado por docentes para instituciones educativas. Centraliza notas, boletines, observador, reportes y más en una sola plataforma.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '32px' }}>
            {['Multi-institución', 'Boletines automáticos', 'Reportes en tiempo real', 'Observador integrado'].map(f => (
              <span key={f} style={{ padding: '6px 14px', background: C.primaryLight, color: C.primaryDark, fontSize: '11px', fontWeight: 600, borderRadius: '20px' }}>{f}</span>
            ))}
          </div>
          <div style={{ position: 'absolute', bottom: '50mm', textAlign: 'center', width: '100%' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: C.lighter, borderRadius: '8px', border: `1px solid ${C.border}` }}>
              {Icon.user(C.muted)}
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: C.text, margin: 0 }}>Luis Alberto Cárdenas Pernett</p>
                <p style={{ fontSize: '11px', color: C.muted, margin: 0 }}>Ingeniero · Desarrollador Full Stack</p>
              </div>
            </div>
            <p style={{ fontSize: '26px', color: C.border, fontWeight: 300, marginTop: '20px', letterSpacing: '4px' }}>2025</p>
          </div>
          <PageFooterBar num={1} total={TOTAL_PAGES} />
        </div>

        {/* ═══════════════════ PÁGINA 2: DIAGNÓSTICO ═══════════════════ */}
        <div style={PAGE}>
          <SectionHeader icon={Icon.alert(C.red)} title="Diagnóstico del Problema" subtitle="Las instituciones educativas enfrentan desafíos operativos que afectan la calidad académica" color={C.red} />
          <ProblemCard icon={Icon.clock(C.amber)} accent={C.amber} title="Sobrecarga administrativa docente" desc="Los docentes dedican entre el 30% y 40% de su tiempo a tareas administrativas: diligenciar planillas, calcular promedios manualmente, generar informes y duplicar registros en múltiples formatos. Este tiempo se resta directamente de la preparación pedagógica." />
          <ProblemCard icon={Icon.grid(C.red)} accent={C.red} title="Duplicación y fragmentación de registros" desc="Notas en Excel, observaciones en cuadernos físicos, asistencia en planillas impresas. La información académica se dispersa en múltiples formatos sin conexión entre sí, generando inconsistencias y pérdida de trazabilidad." />
          <ProblemCard icon={Icon.alert(C.amber)} accent={C.amber} title="Errores recurrentes en boletines" desc="El cálculo manual de promedios ponderados, escalas de valoración y promociones genera errores que solo se detectan cuando los boletines ya fueron entregados a las familias. Cada corrección implica reprocesos que afectan la credibilidad institucional." />
          <ProblemCard icon={Icon.eye(C.red)} accent={C.red} title="Falta de integración entre módulos" desc="Las herramientas actuales operan de forma aislada: el sistema de notas no se comunica con el observador del estudiante, la asistencia no alimenta los reportes académicos, y la coordinación no tiene visibilidad en tiempo real del estado de cada grupo." />
          <ProblemCard icon={Icon.chart(C.amber)} accent={C.amber} title="Ausencia de indicadores en tiempo real" desc="Rectores y coordinadores no disponen de dashboards ni métricas actualizadas para tomar decisiones oportunas. La generación de informes consolidados puede tomar días o semanas, limitando la capacidad de intervención temprana." />
          <PageFooterBar num={2} total={TOTAL_PAGES} />
        </div>

        {/* ═══════════════════ PÁGINA 3: PROPUESTA ═══════════════════ */}
        <div style={PAGE}>
          <SectionHeader icon={Icon.check(C.green)} title="Propuesta de Solución" subtitle="Un sistema unificado que centraliza toda la gestión académica en una sola plataforma" color={C.green} />
          <SolutionCard icon={Icon.shield(C.primary)} title="Fuente única de verdad" desc="Toda la información académica — notas, asistencia, observaciones, logros, actas — reside en un único sistema con base de datos centralizada. Cualquier dato se registra una sola vez y se propaga automáticamente a todos los reportes, boletines y estadísticas que lo requieran." bg={C.blueBg} border={C.blueBorder} />
          <SolutionCard icon={Icon.zap(C.green)} title="Automatización de cálculos académicos" desc="Promedios ponderados por área, escala de valoración configurable, cálculo automático de promoción, recuperaciones, ranking de estudiantes y proyección de notas mínimas. Todo parametrizado según el SIEE de cada institución, sin fórmulas manuales." bg={C.greenBg} border={C.greenBorder} />
          <SolutionCard icon={Icon.grid(C.purple)} title="Integración académica total" desc="Notas, asistencia, observador del estudiante, logros, actas de comisión, boletines y reportes institucionales conectados entre sí. Una nota registrada por el docente se refleja instantáneamente en el boletín, el ranking, los promedios por área y los indicadores de la coordinación." bg={C.purpleBg} border={C.purpleBorder} />
          <SolutionCard icon={Icon.users(C.amber)} title="Multi-institución y multi-año" desc="Arquitectura multi-tenant que permite gestionar múltiples instituciones desde una sola instancia. Cada institución mantiene su configuración propia (escala, períodos, niveles, estructura académica) con historial de años académicos completo." bg={C.amberBg} border={C.amberBorder} />
          <PageFooterBar num={3} total={TOTAL_PAGES} />
        </div>

        {/* ═══════════════════ PÁGINA 4: MÓDULOS ═══════════════════ */}
        <div style={PAGE}>
          <SectionHeader icon={Icon.grid(C.primary)} title="Módulos Principales" subtitle="Cada módulo cubre un dominio específico de la gestión académica institucional" color={C.primary} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <ModuleCard2 icon={Icon.book(C.primary)} accentBg={C.primaryLight} title="Gestión Académica" items={['Estructura de áreas, asignaturas y dimensiones', 'Períodos con ciclo de vida (abierto → cerrado → finalizado)', 'Escala de valoración y niveles configurables', 'Asignación docente por grupo y asignatura']} />
            <ModuleCard2 icon={Icon.chart(C.green)} accentBg={C.greenBg} title="Calificaciones y Evaluación" items={['Registro de notas por período con validación en tiempo real', 'Notas definitivas con cálculo automático de promedios', 'Evaluación cualitativa para preescolar (dimensiones)', 'Ventanas de calificación y recuperación']} />
            <ModuleCard2 icon={Icon.eye(C.amber)} accentBg={C.amberBg} title="Observador del Estudiante" items={['Registro de observaciones académicas y comportamentales', 'Compromisos, seguimientos y acuerdos con acudientes', 'Historial cronológico por estudiante', 'Alertas académicas automáticas']} />
            <ModuleCard2 icon={Icon.file(C.purple)} accentBg={C.purpleBg} title="Boletines Automáticos" items={['Generación de boletines con diseño institucional', 'Snapshot de notas al finalizar período (dato congelado)', 'Soporte para estructura por áreas y por asignaturas', 'Firma digital del director de grupo y rector']} />
            <ModuleCard2 icon={Icon.trending(C.blue)} accentBg={C.blueBg} title="Reportes Institucionales" items={['Consolidado académico por grupo y por áreas', 'Ranking de estudiantes, promedios por asignatura', 'Distribución de desempeño, proyección de promoción', 'Comparativo anual y estadísticas institucionales']} />
            <ModuleCard2 icon={Icon.award(C.red)} accentBg={C.redBg} title="Actas y Documentos" items={['Actas de comisión de evaluación y promoción', 'Consolidado de no promovidos', 'Certificados de recuperación', 'Exportación a Excel y PDF']} />
          </div>
          <PageFooterBar num={4} total={TOTAL_PAGES} />
        </div>

        {/* ═══════════════════ PÁGINA 5: BENEFICIOS POR ROL ═══════════════════ */}
        <div style={PAGE}>
          <SectionHeader icon={Icon.users(C.primary)} title="Beneficios por Rol" subtitle="Cada usuario del sistema obtiene ventajas específicas según sus responsabilidades" color={C.primary} />
          <RoleSection icon={Icon.book(C.primary)} role="Docente" color={C.primary} benefits={[
            'Registro de notas desde cualquier dispositivo', 'Cálculo automático de promedios ponderados',
            'Observador del estudiante integrado', 'Logros y desempeños por asignatura',
            'Ahorro de 6 a 10 horas semanales', 'Sin Excel, sin fórmulas manuales',
          ]} />
          <RoleSection icon={Icon.target(C.green)} role="Coordinación Académica" color={C.green} benefits={[
            'Panel de completitud: notas y logros faltantes', 'Reportes consolidados por grupo y área',
            'Identificación de estudiantes en riesgo', 'Control de ventanas de calificación',
            'Visibilidad completa del observador', 'Sin esperar informes del docente',
          ]} />
          <RoleSection icon={Icon.award(C.purple)} role="Rectoría / Dirección" color={C.purple} benefits={[
            'Dashboard institucional en tiempo real', 'Comparativos anuales de rendimiento',
            'Estadísticas por nivel, docente y grupo', 'Exportaciones para secretaría de educación',
            'Gestión multi-sede y multi-jornada', 'Trazabilidad académica completa',
          ]} />
          <div style={{ marginTop: '12px', padding: '12px 16px', background: C.lighter, borderRadius: '8px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {Icon.shield(C.muted)}
            <p style={{ fontSize: '11px', color: C.muted, lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
              Todos los roles acceden a la misma fuente de datos. Las diferencias están en los permisos y la vista: cada usuario ve exactamente lo que necesita.
            </p>
          </div>
          <PageFooterBar num={5} total={TOTAL_PAGES} />
        </div>

        {/* ═══════════════════ PÁGINA 6: IMPACTO ═══════════════════ */}
        <div style={PAGE}>
          <SectionHeader icon={Icon.trending(C.green)} title="Impacto Esperado" subtitle="Métricas proyectadas con base en la implementación del sistema en instituciones piloto" color={C.green} />

          {/* Metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '28px' }}>
            <MetricCard value="95%" label="Reducción de errores en boletines" icon={Icon.check(C.green)} color={C.green} bg={C.greenBg} />
            <MetricCard value="70%" label="Ahorro de tiempo en tareas administrativas" icon={Icon.clock(C.primary)} color={C.primary} bg={C.primaryLight} />
            <MetricCard value="100%" label="Trazabilidad académica completa" icon={Icon.shield(C.purple)} color={C.purple} bg={C.purpleBg} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>
            <MetricCard value="< 5 min" label="Generación de boletines para un grupo completo" icon={Icon.zap(C.amber)} color={C.amber} bg={C.amberBg} />
            <MetricCard value="24/7" label="Visibilidad en tiempo real para coordinación y rectoría" icon={Icon.eye(C.blue)} color={C.blue} bg={C.blueBg} />
          </div>

          {/* Detailed descriptions */}
          <div style={{ borderTop: `2px solid ${C.border}`, paddingTop: '18px' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: C.dark, marginBottom: '12px' }}>Detalle del impacto</p>
            {[
              { t: 'Eliminación de errores', d: 'Los cálculos automáticos eliminan errores de transcripción. Los boletines se generan directamente desde los datos registrados.' },
              { t: 'Eficiencia docente', d: 'Tareas que tomaban horas se reducen a minutos. El docente se enfoca en lo pedagógico, no en lo administrativo.' },
              { t: 'Dato confiable y auditable', d: 'Cada nota, observación y logro queda registrado con fecha, autor y contexto. Sin datos perdidos.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.primary, marginTop: '6px', flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: '11.5px', fontWeight: 600, color: C.dark }}>{item.t}: </span>
                  <span style={{ fontSize: '11.5px', color: C.sub }}>{item.d}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '16px', padding: '12px 16px', background: C.blueBg, borderRadius: '8px', border: `1px solid ${C.blueBorder}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {Icon.alert(C.blue)}
            <p style={{ fontSize: '10px', color: '#0c4a6e', lineHeight: 1.5, margin: 0 }}>
              <strong>Nota:</strong> Las métricas son estimaciones basadas en la reducción de procesos manuales observada durante el desarrollo y pruebas. Los resultados reales pueden variar según el tamaño de la institución.
            </p>
          </div>
          <PageFooterBar num={6} total={TOTAL_PAGES} />
        </div>

        {/* ═══════════════════ PÁGINA 7: CONTACTO ═══════════════════ */}
        <div style={{ ...LAST_PAGE, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: `linear-gradient(90deg, ${C.primary}, ${C.accent}, ${C.primary})` }} />

          <div style={{ marginBottom: '40px' }}>
            <EdusynLogo size={70} />
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: C.dark, margin: '20px 0 8px 0' }}>
              ¿Listo para transformar la gestión académica?
            </h2>
            <p style={{ fontSize: '13px', color: C.muted, maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
              Solicite una demostración personalizada y descubra cómo Edusyn puede optimizar los procesos de su institución educativa.
            </p>
          </div>

          {/* Contact cards */}
          <div style={{ width: '100%', maxWidth: '420px', textAlign: 'left' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { icon: Icon.user(C.primary), label: 'Desarrollador', value: 'Luis Alberto Cárdenas Pernett' },
                { icon: Icon.mail(C.primary), label: 'Correo electrónico', value: 'lcardenas7@hotmail.es' },
                { icon: Icon.phone(C.primary), label: 'Teléfono', value: '+57 310 401 9732' },
                { icon: Icon.mapPin(C.primary), label: 'Ubicación', value: 'Colombia' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', padding: '14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.light }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</div>
                  <div>
                    <p style={{ fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 2px 0' }}>{c.label}</p>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: C.text, margin: 0, wordBreak: 'break-all' }}>{c.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ marginTop: '32px', padding: '16px 32px', background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, borderRadius: '10px', display: 'inline-block' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>Solicitar Demo</p>
            <p style={{ fontSize: '10px', color: '#ffffffcc', margin: 0 }}>Escríbanos para agendar una demostración personalizada</p>
          </div>

          <div style={{ position: 'absolute', bottom: '24mm', textAlign: 'center', width: '100%' }}>
            <div style={{ width: '40px', height: '2px', background: C.primary, margin: '0 auto 10px auto', borderRadius: '1px' }} />
            <p style={{ fontSize: '10px', color: C.muted }}>Edusyn © 2025 — Todos los derechos reservados</p>
          </div>
          <PageFooterBar num={7} total={TOTAL_PAGES} />
        </div>

      </div>

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: #fff; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  )
}
