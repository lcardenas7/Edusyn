import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle,
  ClipboardList,
  Clock,
  Download,
  FileText,
  Shield,
  TrendingUp,
  Users,
  AlertTriangle,
  ChevronLeft,
} from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { useReportsData } from '../../hooks/useReportsData'
import { observerApi, reportsApi } from '../../lib/api'

interface GradeOption {
  id: string
  name: string
}

interface PerformanceBucket {
  label: string
  count: number
}

interface GroupRankingData {
  groupId: string
  groupName: string
  results: Array<{
    position: number
    studentName: string
    group: string
    average: number
    subjectCount: number
    performance: string
  }>
}

interface CommissionData {
  gradeId: string
  gradeName: string
  yearLabel: string
  termLabel: string
  institutionName?: string
  dateLabel: string
  actaNumber: string
  timeLabel: string
  placeLabel: string
  coursesLabel: string
  academicSummary: {
    totalStudents: number
    generalAverage: number
    approvedCount: number
    riskCount: number
    bestStudent?: string
    bestAverage?: number
    worstStudent?: string
    worstAverage?: number
  }
  performanceBuckets: PerformanceBucket[]
  groupRankings: GroupRankingData[]
  subjectLevelSections: Array<{
    subjectName: string
    groupName: string
    totalStudents: number
    buckets: PerformanceBucket[]
  }>
  convivencia: any
  analysisNotes: string[]
  agenda: string[]
  assistants: Array<{ name: string; role: string; courses: string }>
}

type ViewKey = 'academic' | 'top5' | 'convivencia' | 'acta'

const viewButtons: Array<{ key: ViewKey; label: string; icon: any }> = [
  { key: 'academic', label: 'Resumen académico', icon: BarChart3 },
  { key: 'top5', label: 'Top 5 por curso', icon: TrendingUp },
  { key: 'convivencia', label: 'Situación convivencial', icon: Shield },
  { key: 'acta', label: 'Acta consolidada', icon: FileText },
]

export default function CommissionReports() {
  const { institution } = useAuth()
  const location = useLocation()
  const {
    academicYears,
    terms,
    groups,
    gradingScale,
    filterYear,
    setFilterYear,
    filterPeriod,
    setFilterPeriod,
  } = useReportsData()

  const [selectedGradeId, setSelectedGradeId] = useState('')
  const initialView = useMemo<ViewKey>(() => {
    const report = new URLSearchParams(location.search).get('report')
    if (report === 'commission-academic') return 'academic'
    if (report === 'commission-top5') return 'top5'
    if (report === 'commission-convivencia') return 'convivencia'
    return 'acta'
  }, [location.search])
  const [activeView, setActiveView] = useState<ViewKey>(initialView)
  const [loadingData, setLoadingData] = useState(false)
  const [downloading, setDownloading] = useState<ViewKey | null>(null)
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null)

  const gradeOptions = useMemo<GradeOption[]>(() => {
    const map = new Map<string, GradeOption>()
    groups.forEach(group => {
      const grade = group.grade
      if (grade?.id && !map.has(grade.id)) {
        map.set(grade.id, {
          id: grade.id,
          name: grade.name || 'Sin grado',
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [groups])

  const selectedGradeName = useMemo(() => {
    return gradeOptions.find(g => g.id === selectedGradeId)?.name || 'Sin grado'
  }, [gradeOptions, selectedGradeId])

  const selectedYearLabel = useMemo(() => {
    return academicYears.find(y => y.id === filterYear)?.year?.toString() || ''
  }, [academicYears, filterYear])

  const selectedTermLabel = useMemo(() => {
    return terms.find(t => t.id === filterPeriod)?.name || 'Todos los períodos'
  }, [terms, filterPeriod])

  const selectedGradeGroups = useMemo(() => {
    if (!selectedGradeId) return []
    return groups.filter(group => group.grade?.id === selectedGradeId)
  }, [groups, selectedGradeId])

  useEffect(() => {
    if (!selectedGradeId && gradeOptions.length > 0) {
      setSelectedGradeId(gradeOptions[0].id)
    }
  }, [gradeOptions, selectedGradeId])

  useEffect(() => {
    setCommissionData(null)
  }, [filterYear, filterPeriod, selectedGradeId])

  useEffect(() => {
    setActiveView(initialView)
  }, [initialView])

  const buildCommissionData = async (): Promise<CommissionData | null> => {
    if (!filterYear) {
      alert('Seleccione un año académico')
      return null
    }
    if (!selectedGradeId) {
      alert('Seleccione un grado')
      return null
    }
    if (selectedGradeGroups.length === 0) {
      alert('No se encontraron cursos para el grado seleccionado')
      return null
    }

    setLoadingData(true)
    try {
      const [gradeRankingRes, convivenciaRes, groupRankings] = await Promise.all([
        reportsApi.getInstitutionalRanking(filterYear, {
          gradeId: selectedGradeId,
          termId: filterPeriod || undefined,
        }),
        observerApi.getConvivencialStats(filterYear, {
          gradeId: selectedGradeId,
        }),
        Promise.all(
          selectedGradeGroups.map(async group => {
            const res = await reportsApi.getStudentRanking(filterYear, group.id, filterPeriod || undefined)
            return {
              groupId: group.id,
              groupName: `${group.grade?.name || ''} ${group.name}`.trim(),
              results: res.data?.results || [],
            }
          }),
        ),
      ])

      const rankingResults = gradeRankingRes.data?.results || []
      const passingGrade = gradingScale.minPassingGrade
      const generalAverage = rankingResults.length > 0
        ? rankingResults.reduce((sum: number, item: any) => sum + (Number(item.average) || 0), 0) / rankingResults.length
        : 0

      const bestStudent = rankingResults[0]
      const worstStudent = rankingResults[rankingResults.length - 1]
      const approvedCount = rankingResults.filter((item: any) => Number(item.average) >= passingGrade).length
      const riskCount = rankingResults.filter((item: any) => Number(item.average) < passingGrade).length

      const performanceOrder: string[] = gradingScale.performanceLevels.length > 0
        ? [...gradingScale.performanceLevels].sort((a, b) => a.order - b.order).map(level => level.name)
        : ['Bajo', 'Básico', 'Alto', 'Superior']

      const lowerLabel = (label: string) => label.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      const performanceBuckets = performanceOrder.map(label => ({
        label,
        count: rankingResults.filter((item: any) => lowerLabel(String(item.performance)) === lowerLabel(label)).length,
      }))

      const extraLabels: string[] = Array.from(new Set<string>(rankingResults.map((item: any) => String(item.performance))))
        .filter(label => !performanceOrder.some(orderLabel => lowerLabel(orderLabel) === lowerLabel(label)))
        .sort()

      extraLabels.forEach(label => {
        performanceBuckets.push({
          label,
          count: rankingResults.filter((item: any) => String(item.performance) === label).length,
        })
      })

      const analysisNotes = [
        rankingResults.length > 0
          ? `El grado ${selectedGradeName} presenta un promedio general de ${generalAverage.toFixed(2)} en el período ${selectedTermLabel}.`
          : `No se encontraron registros académicos para el grado ${selectedGradeName} en el período seleccionado.`,
        approvedCount > 0
          ? `${approvedCount} estudiante${approvedCount === 1 ? '' : 's'} se encuentran en desempeño aprobatorio o superior según la escala institucional.`
          : 'No se identificaron estudiantes en rango aprobatorio dentro del corte seleccionado.',
        riskCount > 0
          ? `${riskCount} estudiante${riskCount === 1 ? '' : 's'} presentan desempeño por debajo de la nota mínima aprobatoria.`
          : 'No se observaron estudiantes por debajo de la nota mínima aprobatoria.',
        convivenciaRes.data?.total > 0
          ? `Se registraron ${convivenciaRes.data.total} situaciones convivenciales en el grado seleccionado.`
          : 'No se registraron situaciones convivenciales en el corte aplicado.',
      ]

      const agenda = [
        'Verificación de quórum y apertura de la sesión.',
        'Lectura y aprobación del acta anterior.',
        'Análisis del desempeño académico por niveles.',
        'Revisión del top 5 por curso dentro del grado.',
        'Revisión de situaciones convivenciales, actas y remisiones.',
        'Análisis general académico y cognitivo del grado.',
        'Definición de compromisos y cierre.',
      ]

      const assistants = [
        { name: 'Coordinación académica', role: 'Coordinador(a)', courses: selectedGradeGroups.map(group => group.name).join(' · ') },
        { name: 'Dirección de grupo', role: 'Director(a) de grupo', courses: selectedGradeGroups.map(group => group.name).join(' · ') },
        { name: 'Docentes del grado', role: 'Docente(s)', courses: selectedGradeGroups.map(group => group.name).join(' · ') },
        { name: 'Psicoorientación', role: 'Psicoorientador(a)', courses: '—' },
      ]

      const subjectLevelSections = selectedGradeGroups.flatMap(group => {
        const groupRanking = groupRankings.find(item => item.groupId === group.id)
        const results = groupRanking?.results || []
        return (results.length > 0 ? results.slice(0, 5) : []).map((_row: unknown, index: number) => ({
          subjectName: `Resultado académico ${index + 1}`,
          groupName: group.name,
          totalStudents: results.length,
          buckets: performanceBuckets,
        }))
      })

      const data: CommissionData = {
        gradeId: selectedGradeId,
        gradeName: selectedGradeName,
        yearLabel: selectedYearLabel,
        termLabel: selectedTermLabel,
        institutionName: institution?.name,
        dateLabel: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }),
        actaNumber: `CEP-${selectedGradeName.replace(/\s+/g, '')}-${selectedYearLabel || new Date().getFullYear()}-${selectedTermLabel.replace(/\s+/g, '').toUpperCase() || 'TT'}`,
        timeLabel: '8:00 a.m. – 10:30 a.m.',
        placeLabel: 'Sala de profesores / comisión académica',
        coursesLabel: selectedGradeGroups.map(group => `${group.grade?.name || selectedGradeName} ${group.name}`).join(' · '),
        academicSummary: {
          totalStudents: rankingResults.length,
          generalAverage,
          approvedCount,
          riskCount,
          bestStudent: bestStudent?.studentName,
          bestAverage: bestStudent?.average,
          worstStudent: worstStudent?.studentName,
          worstAverage: worstStudent?.average,
        },
        performanceBuckets,
        groupRankings,
        subjectLevelSections,
        convivencia: convivenciaRes.data,
        analysisNotes,
        agenda,
        assistants,
      }

      setCommissionData(data)
      return data
    } catch (err) {
      console.error('Error loading commission data:', err)
      alert('No fue posible cargar la información para la comisión')
      return null
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (!filterYear || !selectedGradeId || selectedGradeGroups.length === 0) return
    if (commissionData || loadingData) return
    void buildCommissionData()
  }, [buildCommissionData, commissionData, filterYear, loadingData, selectedGradeGroups.length, selectedGradeId])

  const ensureData = async () => {
    if (commissionData) return commissionData
    return buildCommissionData()
  }

  const createPdf = (orientation: 'portrait' | 'landscape' = 'landscape') => {
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 12
    const contentWidth = pageWidth - margin * 2

    const addHeader = (title: string, subtitleLines: string[] = []) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text(title, margin, 16)
      if (subtitleLines.length > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        subtitleLines.forEach((line, idx) => {
          doc.text(line, margin, 22 + idx * 4)
        })
        return 24 + subtitleLines.length * 4
      }
      return 24
    }

    const addSectionTitle = (title: string, y: number) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(24, 95, 165)
      doc.text(title, margin, y)
      doc.setTextColor(0, 0, 0)
      return y + 6
    }

    const addMetaGrid = (items: Array<{ label: string; value: string }>, startY: number) => {
      const cols = 3
      const cellWidth = contentWidth / cols - 2
      items.forEach((item, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = margin + col * (cellWidth + 2)
        const y = startY + row * 16
        doc.setDrawColor(229, 231, 235)
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(x, y, cellWidth, 14, 2, 2, 'FD')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text(item.label.toUpperCase(), x + 2, y + 5)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(15)
        doc.text(item.value || '-', x + 2, y + 10)
      })
      return startY + Math.ceil(items.length / cols) * 16 + 2
    }

    const addFooter = () => {
      const totalPages = doc.getNumberOfPages()
      for (let page = 1; page <= totalPages; page++) {
        doc.setPage(page)
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text(`${institution?.name || 'Edusyn'} • Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
        doc.setTextColor(0)
      }
    }

    const addTable = (head: string[][], body: Array<Array<string | number>>, startY: number) => {
      autoTable(doc, {
        head,
        body,
        startY,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 1.3, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      })
      return (doc as any).lastAutoTable?.finalY || startY
    }

    return { doc, addHeader, addFooter, addTable, contentWidth, margin, addSectionTitle, addMetaGrid }
  }

  const savePdf = (doc: jsPDF, filename: string) => {
    doc.save(`${filename}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const downloadAcademicSummary = async () => {
    setDownloading('academic')
    try {
      const data = await ensureData()
      if (!data) return

      const { doc, addHeader, addFooter, addTable, margin, contentWidth, addSectionTitle, addMetaGrid } = createPdf('landscape')
      let startY = addHeader('Acta de Comisión de Evaluación y Promoción', [
        `Institución: ${data.institutionName || 'Edusyn'}`,
        `Grado: ${data.gradeName}`,
        `Período: ${data.termLabel}`,
      ])

      startY = addMetaGrid([
        { label: 'Fecha', value: data.dateLabel },
        { label: 'Hora', value: data.timeLabel },
        { label: 'Lugar', value: data.placeLabel },
        { label: 'Grado / cursos', value: data.coursesLabel || data.gradeName },
        { label: 'Período evaluado', value: data.termLabel },
        { label: 'N.° de acta', value: data.actaNumber },
      ], startY)

      startY = addSectionTitle('1. Orden del día', startY + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      data.agenda.forEach((item, index) => {
        const lines = doc.splitTextToSize(`${index + 1}. ${item}`, contentWidth - 6)
        doc.text(lines, margin + 3, startY)
        startY += lines.length * 4 + 2
      })

      startY = addSectionTitle('2. Asistentes', startY + 2)
      addTable([
        ['Nombre completo', 'Cargo / Asignatura', 'Curso(s)'],
      ], data.assistants.map(person => [person.name, person.role, person.courses]), startY)

      startY = (doc as any).lastAutoTable?.finalY || startY
      startY = addSectionTitle('3. Desempeño académico por niveles', startY + 6)
      addTable([
        ['Nivel de desempeño', 'Total estudiantes'],
      ], data.performanceBuckets.map(bucket => [bucket.label, bucket.count]), startY)

      startY = (doc as any).lastAutoTable?.finalY || startY
      startY = addSectionTitle('4. Top 5 estudiantes por curso', startY + 6)
      data.groupRankings.forEach((group, index) => {
        if (index > 0) {
          doc.addPage()
          startY = 22
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(group.groupName, margin, startY)
        const rows = (group.results || []).slice(0, 5).map((student, idx) => [
          String(idx + 1),
          student.studentName,
          student.average.toFixed(2),
          student.performance,
        ])
        addTable([
          ['#', 'Estudiante', 'Promedio', 'Nivel'],
        ], rows.length > 0 ? rows : [['-', 'Sin estudiantes', '-', '-']], startY + 4)
      })

      addFooter()
      savePdf(doc, `comision_resumen_academico_${data.gradeName.replace(/\s+/g, '_')}`)
    } finally {
      setDownloading(null)
    }
  }

  const downloadTop5ByCourse = async () => {
    setDownloading('top5')
    try {
      const data = await ensureData()
      if (!data) return

      const { doc, addHeader, addFooter, addTable } = createPdf('landscape')
      let startY = addHeader('Top 5 estudiantes por curso', [
        `Grado: ${data.gradeName}`,
        `Año: ${data.yearLabel}`,
        `Período: ${data.termLabel}`,
      ])

      for (let i = 0; i < data.groupRankings.length; i++) {
        const group = data.groupRankings[i]
        if (i > 0) {
          doc.addPage()
          startY = 24
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text(group.groupName, 12, startY)

        const rows = (group.results || []).slice(0, 5).map((student, idx) => [
          String(idx + 1),
          student.studentName,
          student.average.toFixed(2),
          String(student.subjectCount),
          student.performance,
        ])

        addTable([
          ['Puesto', 'Estudiante', 'Promedio', 'Asignaturas', 'Desempeño'],
        ], rows.length > 0 ? rows : [['-', 'Sin estudiantes', '-', '-', '-']], startY + 4)
      }

      addFooter()
      savePdf(doc, `comision_top5_por_curso_${data.gradeName.replace(/\s+/g, '_')}`)
    } finally {
      setDownloading(null)
    }
  }

  const downloadConvivenceReport = async () => {
    setDownloading('convivencia')
    try {
      const data = await ensureData()
      if (!data) return

      const convivencia = data.convivencia || {}
      const { doc, addHeader, addFooter, addTable } = createPdf('portrait')
      let startY = addHeader('Situación convivencial para comisión', [
        `Grado: ${data.gradeName}`,
        `Año: ${data.yearLabel}`,
        `Período: ${data.termLabel}`,
      ])

      addTable([
        ['Indicador', 'Valor'],
      ], [
        ['Total de situaciones', String(convivencia.total || 0)],
        ['Estudiantes únicos involucrados', String(convivencia.uniqueStudents || 0)],
        ['Situaciones positivas', String(convivencia.positiveCount || 0)],
        ['Situaciones negativas', String(convivencia.negativeCount || 0)],
        ['Actas formales', String(convivencia.actasSummary?.total || 0)],
        ['Citaciones', String(convivencia.processIndicators?.citations?.total || 0)],
        ['Remisiones', String(convivencia.processIndicators?.referrals?.total || 0)],
        ['Compromisos', String(convivencia.processIndicators?.commitments?.total || 0)],
      ], startY)

      const summaryY = (doc as any).lastAutoTable?.finalY || startY
      const byTypeRows = Object.entries(convivencia.byType || {}).map(([key, value]) => [key, value as number])
      addTable([
        ['Tipo de situación', 'Cantidad'],
      ], byTypeRows.length > 0 ? byTypeRows : [['Sin datos', 0]], summaryY + 8)

      const processY = (doc as any).lastAutoTable?.finalY || summaryY
      const referralRows = Object.entries(convivencia.processIndicators?.referrals?.byRole || {}).map(([key, value]) => [key, value as number])
      addTable([
        ['Remisiones por destino', 'Cantidad'],
      ], referralRows.length > 0 ? referralRows : [['Sin datos', 0]], processY + 8)

      addFooter()
      savePdf(doc, `comision_situacion_convivencial_${data.gradeName.replace(/\s+/g, '_')}`)
    } finally {
      setDownloading(null)
    }
  }

  const downloadCommissionActa = async () => {
    setDownloading('acta')
    try {
      const data = await ensureData()
      if (!data) return

      const { doc, addHeader, addFooter, addTable, margin, contentWidth, addSectionTitle, addMetaGrid } = createPdf('landscape')
      let startY = addHeader('Acta de Comisión de Evaluación y Promoción', [
        `Institución: ${data.institutionName || institution?.name || 'Edusyn'}`,
        `Grado: ${data.gradeName} | Período: ${data.termLabel} | Año: ${data.yearLabel}`,
        `Acta N.° ${data.actaNumber}`,
      ])

      startY = addMetaGrid([
        { label: 'Fecha', value: data.dateLabel },
        { label: 'Hora', value: data.timeLabel },
        { label: 'Lugar', value: data.placeLabel },
        { label: 'Cursos', value: data.coursesLabel || data.gradeName },
        { label: 'Año lectivo', value: data.yearLabel },
        { label: 'Período evaluado', value: data.termLabel },
      ], startY)

      startY = addSectionTitle('1. Orden del día', startY + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      data.agenda.forEach((item, index) => {
        const lines = doc.splitTextToSize(`${index + 1}. ${item}`, contentWidth - 6)
        doc.text(lines, margin + 3, startY)
        startY += lines.length * 4 + 2
      })

      startY = addSectionTitle('2. Asistentes', startY + 2)
      addTable([
        ['Nombre completo', 'Cargo / Asignatura', 'Curso(s)', 'Firma'],
      ], data.assistants.map(person => [person.name, person.role, person.courses, '']), startY)

      startY = (doc as any).lastAutoTable?.finalY || startY
      startY = addSectionTitle('3. Desempeño académico por niveles', startY + 6)
      data.subjectLevelSections.length > 0
        ? data.subjectLevelSections.forEach((section, index) => {
            if (index > 0) {
              doc.addPage()
              startY = 22
            }
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.text(`${section.subjectName} — ${section.groupName}`, margin, startY)
            startY += 4
            addTable([
              ['Nivel', 'Cantidad'],
            ], section.buckets.map(bucket => [bucket.label, bucket.count]), startY)
            startY = (doc as any).lastAutoTable?.finalY || startY
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
            doc.text(`Total estudiantes del curso: ${section.totalStudents}`, margin, startY + 5)
            startY += 10
          })
        : addTable([
            ['Nivel', 'Cantidad'],
          ], data.performanceBuckets.map(bucket => [bucket.label, bucket.count]), startY)

      doc.addPage()
      startY = addHeader('4. Top 5 estudiantes por curso', [
        `Grado: ${data.gradeName}`,
        `Año: ${data.yearLabel}`,
        `Período: ${data.termLabel}`,
      ])

      data.groupRankings.forEach((group, index) => {
        if (index > 0) {
          doc.addPage()
          startY = 22
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(group.groupName, margin, startY)
        const rows = (group.results || []).slice(0, 5).map((student, idx) => [
          String(idx + 1),
          student.studentName,
          student.average.toFixed(2),
          String(student.subjectCount),
          student.performance,
        ])
        addTable([
          ['#', 'Estudiante', 'Promedio', 'Asignaturas', 'Nivel'],
        ], rows.length > 0 ? rows : [['-', 'Sin estudiantes', '-', '-', '-']], startY + 4)
      })

      doc.addPage()
      startY = addHeader('5. Situaciones convivenciales y psicoorientación', [
        `Grado: ${data.gradeName}`,
        `Año: ${data.yearLabel}`,
        `Período: ${data.termLabel}`,
      ])

      const convivencia = data.convivencia || {}
      addTable([
        ['Indicador', 'Valor'],
      ], [
        ['Total de situaciones', String(convivencia.total || 0)],
        ['Estudiantes únicos involucrados', String(convivencia.uniqueStudents || 0)],
        ['Situaciones positivas', String(convivencia.positiveCount || 0)],
        ['Situaciones negativas', String(convivencia.negativeCount || 0)],
        ['Actas formales', String(convivencia.actasSummary?.total || 0)],
        ['Citaciones', String(convivencia.processIndicators?.citations?.total || 0)],
        ['Remisiones', String(convivencia.processIndicators?.referrals?.total || 0)],
        ['Compromisos', String(convivencia.processIndicators?.commitments?.total || 0)],
      ], startY)

      const byTypeY = (doc as any).lastAutoTable?.finalY || startY
      addTable([
        ['Tipo de situación', 'Cantidad'],
      ], Object.entries(convivencia.byType || {}).length > 0
        ? Object.entries(convivencia.byType || {}).map(([key, value]) => [key, value as number])
        : [['Sin datos', 0]], byTypeY + 6)

      const noteY = (doc as any).lastAutoTable?.finalY || byTypeY
      const notes = data.analysisNotes.length > 0 ? data.analysisNotes : ['Sin observaciones adicionales.']
      startY = noteY + 8
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('6. Análisis general del grado', margin, startY)
      startY += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      notes.forEach((note, index) => {
        const lines = doc.splitTextToSize(`• ${note}`, contentWidth - 4)
        doc.text(lines, margin + 2, startY)
        startY += lines.length * 4 + 2
      })

      doc.addPage()
      startY = addHeader('7. Compromisos y acuerdos', [
        `Acta consolidada del grado ${data.gradeName}`,
        `Año: ${data.yearLabel}`,
      ])
      addTable([
        ['Acuerdo', 'Responsable', 'Fecha de seguimiento'],
      ], [
        ['Implementar refuerzo académico para estudiantes en bajo desempeño.', 'Docentes del grado', 'Próxima comisión'],
        ['Hacer seguimiento a estudiantes remitidos a psicoorientación.', 'Psicoorientación', 'Semanal'],
        ['Citar acudientes cuando aplique.', 'Dirección de grupo / coordinación', 'Según caso'],
        ['Presentar informe de avance en la siguiente comisión.', 'Coordinación académica', 'Siguiente sesión'],
      ], startY)

      startY = (doc as any).lastAutoTable?.finalY || startY
      startY += 10
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('8. Firmas', margin, startY)
      startY += 6
      addTable([
        ['Cargo', 'Nombre', 'Firma'],
      ], [
        ['Rector(a)', '', '______________________'],
        ['Coordinador(a)', '', '______________________'],
        ['Director(a) de grupo', '', '______________________'],
        ['Docente(s)', '', '______________________'],
        ['Psicoorientador(a)', '', '______________________'],
      ], startY)

      addFooter()
      savePdf(doc, `acta_comision_${data.gradeName.replace(/\s+/g, '_')}`)
    } finally {
      setDownloading(null)
    }
  }

  const loadAndDownload = async (view: ViewKey) => {
    setActiveView(view)
    if (view === 'academic') return downloadAcademicSummary()
    if (view === 'top5') return downloadTop5ByCourse()
    if (view === 'convivencia') return downloadConvivenceReport()
    return downloadCommissionActa()
  }

  const summaryCards = commissionData ? [
    { label: 'Total estudiantes', value: commissionData.academicSummary.totalStudents, icon: Users, color: 'blue' },
    { label: 'Promedio general', value: commissionData.academicSummary.generalAverage.toFixed(2), icon: BarChart3, color: 'green' },
    { label: 'Aprobados / superiores', value: commissionData.academicSummary.approvedCount, icon: CheckCircle, color: 'emerald' },
    { label: 'Por debajo del mínimo', value: commissionData.academicSummary.riskCount, icon: AlertTriangle, color: 'red' },
    { label: 'Situaciones convivenciales', value: commissionData.convivencia?.total || 0, icon: Shield, color: 'amber' },
    { label: 'Actas formales', value: commissionData.convivencia?.actasSummary?.total || 0, icon: FileText, color: 'purple' },
  ] : []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link to="/reports" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Acta de Comisión de Evaluación y Promoción</h1>
              <p className="text-sm text-slate-500">Formato formal por grado con resumen académico, top 5, convivencia y firmas</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => loadAndDownload('academic')} disabled={loadingData || downloading !== null} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-60">
            <Download className="w-4 h-4" /> {downloading === 'academic' ? 'Generando...' : 'Resumen académico'}
          </button>
          <button onClick={() => loadAndDownload('top5')} disabled={loadingData || downloading !== null} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-60">
            <Download className="w-4 h-4" /> {downloading === 'top5' ? 'Generando...' : 'Top 5 por curso'}
          </button>
          <button onClick={() => loadAndDownload('convivencia')} disabled={loadingData || downloading !== null} className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm disabled:opacity-60">
            <Download className="w-4 h-4" /> {downloading === 'convivencia' ? 'Generando...' : 'Convivencia'}
          </button>
          <button onClick={() => loadAndDownload('acta')} disabled={loadingData || downloading !== null} className="flex items-center gap-2 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm disabled:opacity-60">
            <FileText className="w-4 h-4" /> {downloading === 'acta' ? 'Generando...' : 'Acta consolidada'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año académico</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Seleccionar...</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' · Activo' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todos los períodos</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Grado</label>
            <select value={selectedGradeId} onChange={(e) => setSelectedGradeId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Seleccionar...</option>
              {gradeOptions.map(grade => (
                <option key={grade.id} value={grade.id}>{grade.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            El acta consolidada incluirá encabezado formal, orden del día, asistentes, análisis académico, convivencia, compromisos y firmas.
          </p>
          <button
            onClick={async () => {
              await buildCommissionData()
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
          >
            <ClipboardList className="w-4 h-4" /> Cargar información
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {viewButtons.map(btn => {
          const Icon = btn.icon
          return (
            <button
              key={btn.key}
              onClick={() => setActiveView(btn.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${activeView === btn.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}
            >
              <Icon className="w-4 h-4" />
              {btn.label}
            </button>
          )
        })}
      </div>

      {loadingData && !commissionData ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Cargando información de comisión...</p>
        </div>
      ) : commissionData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {summaryCards.map(card => {
              const Icon = card.icon
              const colorClassMap: Record<string, string> = {
                blue: 'text-blue-700 bg-blue-50 border-blue-200',
                green: 'text-green-700 bg-green-50 border-green-200',
                emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                red: 'text-red-700 bg-red-50 border-red-200',
                amber: 'text-amber-700 bg-amber-50 border-amber-200',
                purple: 'text-purple-700 bg-purple-50 border-purple-200',
              }
              const colorClass = colorClassMap[card.color] || 'text-slate-700 bg-slate-50 border-slate-200'
              return (
                <div key={card.label} className={`rounded-xl border p-3 ${colorClass}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] uppercase font-medium text-slate-500">{card.label}</span>
                  </div>
                  <div className="text-lg font-bold">{card.value}</div>
                </div>
              )
            })}
          </div>

          {activeView === 'academic' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold text-slate-900 mb-3">Resumen académico del grado</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Nivel</th>
                      <th className="px-3 py-2 text-center">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionData.performanceBuckets.map(bucket => (
                      <tr key={bucket.label} className="border-t">
                        <td className="px-3 py-2">{bucket.label}</td>
                        <td className="px-3 py-2 text-center font-medium">{bucket.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'top5' && (
            <div className="space-y-4">
              {commissionData.groupRankings.map(group => (
                <div key={group.groupId} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="font-semibold text-slate-900">{group.groupName}</h2>
                      <p className="text-xs text-slate-500">Top 5 estudiantes por promedio</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Puesto</th>
                          <th className="px-3 py-2 text-left">Estudiante</th>
                          <th className="px-3 py-2 text-center">Promedio</th>
                          <th className="px-3 py-2 text-center">Asignaturas</th>
                          <th className="px-3 py-2 text-center">Desempeño</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(group.results || []).slice(0, 5).map(row => (
                          <tr key={`${group.groupId}-${row.position}`} className="border-t">
                            <td className="px-3 py-2">{row.position}</td>
                            <td className="px-3 py-2 font-medium">{row.studentName}</td>
                            <td className="px-3 py-2 text-center">{row.average.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center">{row.subjectCount}</td>
                            <td className="px-3 py-2 text-center">{row.performance}</td>
                          </tr>
                        ))}
                        {(group.results || []).length === 0 && (
                          <tr>
                            <td className="px-3 py-3 text-center text-slate-400" colSpan={5}>No hay datos para este curso</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'convivencia' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="font-semibold text-slate-900 mb-3">Resumen convivencial</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Total de situaciones</span><strong>{commissionData.convivencia?.total || 0}</strong></div>
                  <div className="flex justify-between"><span>Estudiantes únicos</span><strong>{commissionData.convivencia?.uniqueStudents || 0}</strong></div>
                  <div className="flex justify-between"><span>Actas formales</span><strong>{commissionData.convivencia?.actasSummary?.total || 0}</strong></div>
                  <div className="flex justify-between"><span>Remisiones</span><strong>{commissionData.convivencia?.processIndicators?.referrals?.total || 0}</strong></div>
                  <div className="flex justify-between"><span>Citaciones</span><strong>{commissionData.convivencia?.processIndicators?.citations?.total || 0}</strong></div>
                  <div className="flex justify-between"><span>Compromisos</span><strong>{commissionData.convivencia?.processIndicators?.commitments?.total || 0}</strong></div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h2 className="font-semibold text-slate-900 mb-3">Niveles de desempeño</h2>
                <div className="space-y-2 text-sm">
                  {commissionData.performanceBuckets.map(bucket => (
                    <div key={bucket.label} className="flex justify-between"><span>{bucket.label}</span><strong>{bucket.count}</strong></div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === 'acta' && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              <div>
                <h2 className="font-semibold text-slate-900">Acta consolidada</h2>
                <p className="text-sm text-slate-500">Incluye resumen académico, top 5 por curso, situación convivencial y firmas.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {commissionData.analysisNotes.map((note, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    {note}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={() => loadAndDownload('academic')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                  Descargar resumen académico
                </button>
                <button onClick={() => loadAndDownload('top5')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                  Descargar top 5 por curso
                </button>
                <button onClick={() => loadAndDownload('convivencia')} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">
                  Descargar convivencia
                </button>
                <button onClick={() => loadAndDownload('acta')} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm">
                  Descargar acta consolidada
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-teal-100 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Prepara la comisión</h3>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Selecciona el año, período y grado. Luego carga la información para generar los reportes individuales o el acta consolidada.
          </p>
        </div>
      )}
    </div>
  )
}
