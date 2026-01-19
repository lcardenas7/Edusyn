import React, { useState } from 'react'
import {
  FileText,
  Download,
  Printer,
  Eye,
  Search,
  Users,
  CheckCircle,
  AlertTriangle,
  GraduationCap,
  Settings,
  RefreshCw,
  Mail,
  X
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
type ReportCardStatus = 'PENDING' | 'GENERATED' | 'DELIVERED'

interface StudentReportCard {
  id: string
  studentId: string
  studentName: string
  documentNumber: string
  group: string
  period: number
  status: ReportCardStatus
  average: number
  approvedSubjects: number
  failedSubjects: number
  rank: number
  totalStudents: number
  generatedAt?: string
  deliveredAt?: string
}

interface SubjectGrade {
  subject: string
  area: string
  period1?: number
  period2?: number
  period3?: number
  period4?: number
  final?: number
  recovery1?: number // Nota de recuperación período 1
  recovery2?: number // Nota de recuperación período 2
  recovery3?: number // Nota de recuperación período 3
  recovery4?: number // Nota de recuperación período 4
  performance: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO'
  absences: number
  achievement: string // Logro del período
  recommendation?: string // Recomendación si aplica
}

// Configuración institucional para el boletín
interface InstitutionConfig {
  name: string
  nit: string
  dane: string
  resolution: string
  address: string
  phone: string
  email: string
  municipality: string
  department: string
  logoUrl?: string
  shieldUrl?: string
  rectorName: string
  rectorSignatureUrl?: string
  coordinatorName: string
  coordinatorSignatureUrl?: string
}

const defaultInstitutionConfig: InstitutionConfig = {
  name: 'INSTITUCIÓN EDUCATIVA EJEMPLO',
  nit: '900.123.456-7',
  dane: '123456789012',
  resolution: 'Resolución de Aprobación No. 1234 del 01 de Enero de 2020',
  address: 'Calle 10 # 15-20, Barrio Centro',
  phone: '(605) 123-4567',
  email: 'contacto@ieejemplo.edu.co',
  municipality: 'Sincelejo',
  department: 'Sucre',
  rectorName: 'MARÍA ELENA PÉREZ GÓMEZ',
  coordinatorName: 'CARLOS ANDRÉS MENDOZA DÍAZ',
}

const performanceConfig = {
  SUPERIOR: { label: 'Superior', color: 'text-green-700', bgColor: 'bg-green-100', min: 4.6, max: 5.0 },
  ALTO: { label: 'Alto', color: 'text-blue-700', bgColor: 'bg-blue-100', min: 4.0, max: 4.5 },
  BASICO: { label: 'Básico', color: 'text-amber-700', bgColor: 'bg-amber-100', min: 3.0, max: 3.9 },
  BAJO: { label: 'Bajo', color: 'text-red-700', bgColor: 'bg-red-100', min: 1.0, max: 2.9 },
}

const statusConfig: Record<ReportCardStatus, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  GENERATED: { label: 'Generado', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  DELIVERED: { label: 'Entregado', color: 'text-green-600', bgColor: 'bg-green-100' },
}

// Mock data
const mockReportCards: StudentReportCard[] = [
  { id: '1', studentId: 's1', studentName: 'ACOSTA GUTIERREZ ALEXANDER DAVID', documentNumber: '1.065.123.456', group: '9°A', period: 1, status: 'GENERATED', average: 4.2, approvedSubjects: 11, failedSubjects: 1, rank: 5, totalStudents: 35, generatedAt: '2025-01-15' },
  { id: '2', studentId: 's2', studentName: 'ALVAREZ LARIOS DANYER JESIT', documentNumber: '1.065.234.567', group: '9°A', period: 1, status: 'DELIVERED', average: 3.8, approvedSubjects: 10, failedSubjects: 2, rank: 12, totalStudents: 35, generatedAt: '2025-01-15', deliveredAt: '2025-01-20' },
  { id: '3', studentId: 's3', studentName: 'AMARIS CASTRO KAROLAY', documentNumber: '1.065.345.678', group: '9°A', period: 1, status: 'GENERATED', average: 4.5, approvedSubjects: 12, failedSubjects: 0, rank: 2, totalStudents: 35, generatedAt: '2025-01-15' },
  { id: '4', studentId: 's4', studentName: 'ARRIETA CARVAJALINO JHON BREINER', documentNumber: '1.065.456.789', group: '9°A', period: 1, status: 'PENDING', average: 2.8, approvedSubjects: 7, failedSubjects: 5, rank: 30, totalStudents: 35 },
  { id: '5', studentId: 's5', studentName: 'BARRIOS PADILLA LEINNER DAVID', documentNumber: '1.065.567.890', group: '9°A', period: 1, status: 'PENDING', average: 3.5, approvedSubjects: 9, failedSubjects: 3, rank: 18, totalStudents: 35 },
  { id: '6', studentId: 's6', studentName: 'BROCHERO VELÁSQUEZ SHARICK PAOLA', documentNumber: '1.065.678.901', group: '9°A', period: 1, status: 'GENERATED', average: 4.0, approvedSubjects: 11, failedSubjects: 1, rank: 8, totalStudents: 35, generatedAt: '2025-01-15' },
  { id: '7', studentId: 's7', studentName: 'CAÑAS BALMACEDA DAIMY MICHELLE', documentNumber: '1.065.789.012', group: '9°A', period: 1, status: 'DELIVERED', average: 4.7, approvedSubjects: 12, failedSubjects: 0, rank: 1, totalStudents: 35, generatedAt: '2025-01-15', deliveredAt: '2025-01-20' },
]

const mockSubjectGrades: SubjectGrade[] = [
  { subject: 'Matemáticas', area: 'Matemáticas', period1: 4.2, period2: 4.0, period3: 4.5, period4: 4.3, final: 4.3, performance: 'ALTO', absences: 2, achievement: 'Resuelve ecuaciones lineales y cuadráticas aplicando métodos algebraicos y gráficos en situaciones problema del contexto.' },
  { subject: 'Lengua Castellana', area: 'Humanidades', period1: 3.8, period2: 4.2, period3: 4.0, period4: 4.1, final: 4.0, performance: 'ALTO', absences: 1, achievement: 'Produce textos argumentativos coherentes respetando las normas gramaticales y ortográficas de la lengua castellana.' },
  { subject: 'Inglés', area: 'Humanidades', period1: 4.5, period2: 4.3, period3: 4.6, period4: 4.4, final: 4.5, performance: 'ALTO', absences: 0, achievement: 'Comprende y produce textos orales y escritos en inglés sobre temas cotidianos con fluidez y precisión gramatical.' },
  { subject: 'Ciencias Naturales', area: 'Ciencias Naturales', period1: 3.5, period2: 3.8, period3: 4.0, period4: 3.9, final: 3.8, performance: 'BASICO', absences: 3, achievement: 'Identifica los procesos biológicos celulares y su relación con las funciones vitales de los seres vivos.', recommendation: 'Reforzar conceptos de biología celular.' },
  { subject: 'Física', area: 'Ciencias Naturales', period1: 3.2, period2: 3.5, period3: 3.8, period4: 3.6, final: 3.5, performance: 'BASICO', absences: 2, achievement: 'Aplica las leyes del movimiento de Newton para analizar situaciones de la vida cotidiana.', recommendation: 'Practicar más ejercicios de aplicación.' },
  { subject: 'Química', area: 'Ciencias Naturales', period1: 4.0, period2: 4.2, period3: 4.1, period4: 4.3, final: 4.2, performance: 'ALTO', absences: 1, achievement: 'Comprende la estructura atómica y las propiedades de los elementos químicos según su ubicación en la tabla periódica.' },
  { subject: 'Ciencias Sociales', area: 'Ciencias Sociales', period1: 4.3, period2: 4.5, period3: 4.4, period4: 4.6, final: 4.5, performance: 'ALTO', absences: 0, achievement: 'Analiza críticamente los procesos históricos, políticos y económicos de Colombia y América Latina.' },
  { subject: 'Filosofía', area: 'Ciencias Sociales', period1: 3.9, period2: 4.0, period3: 4.2, period4: 4.1, final: 4.1, performance: 'ALTO', absences: 1, achievement: 'Reflexiona sobre las principales corrientes filosóficas y su influencia en el pensamiento contemporáneo.' },
  { subject: 'Educación Física', area: 'Educación Física', period1: 4.8, period2: 4.7, period3: 4.9, period4: 4.8, final: 4.8, performance: 'SUPERIOR', absences: 0, achievement: 'Demuestra habilidades motrices y deportivas con excelente condición física y trabajo en equipo.' },
  { subject: 'Educación Artística', area: 'Educación Artística', period1: 4.5, period2: 4.6, period3: 4.4, period4: 4.5, final: 4.5, performance: 'ALTO', absences: 0, achievement: 'Expresa creativamente ideas y emociones a través de diferentes técnicas artísticas y culturales.' },
  { subject: 'Ética y Valores', area: 'Ética', period1: 4.2, period2: 4.3, period3: 4.4, period4: 4.3, final: 4.3, performance: 'ALTO', absences: 1, achievement: 'Practica valores éticos y ciudadanos que contribuyen a la convivencia pacífica en su entorno.' },
  { subject: 'Tecnología e Informática', area: 'Tecnología', period1: 4.6, period2: 4.5, period3: 4.7, period4: 4.6, final: 4.6, performance: 'SUPERIOR', absences: 0, achievement: 'Utiliza herramientas tecnológicas y de programación para resolver problemas de manera creativa e innovadora.' },
]

const groups = ['9°A', '9°B', '10°A', '10°B', '11°A', '11°B']
const periods = [1, 2, 3, 4]

export default function ReportCards() {
  const [selectedYear, setSelectedYear] = useState('2025')
  const [selectedPeriod, setSelectedPeriod] = useState<number | 'FINAL'>(1)
  const [selectedGroup, setSelectedGroup] = useState('9°A')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<ReportCardStatus | 'ALL'>('ALL')
  const [reportCards, setReportCards] = useState<StudentReportCard[]>(mockReportCards)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentReportCard | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  
  // Configuración institucional
  const [institutionConfig, setInstitutionConfig] = useState<InstitutionConfig>(defaultInstitutionConfig)
  const [tutorName, setTutorName] = useState('JUAN PABLO MARTÍNEZ RUIZ') // Director de grupo
  
  // Modal de descarga masiva
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false)
  const [bulkDownloadFilter, setBulkDownloadFilter] = useState<'ALL' | 'GRADE' | 'GROUP'>('GROUP')
  const [bulkDownloadGrade, setBulkDownloadGrade] = useState('9°')
  const [bulkDownloadGroup, setBulkDownloadGroup] = useState('9°A')
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)

  // Grados disponibles
  const grades = ['9°', '10°', '11°']

  const filteredReportCards = reportCards.filter(rc => {
    const matchesSearch = rc.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          rc.documentNumber.includes(searchTerm)
    const matchesStatus = filterStatus === 'ALL' || rc.status === filterStatus
    const matchesGroup = rc.group === selectedGroup
    return matchesSearch && matchesStatus && matchesGroup
  })

  const stats = {
    total: filteredReportCards.length,
    pending: filteredReportCards.filter(rc => rc.status === 'PENDING').length,
    generated: filteredReportCards.filter(rc => rc.status === 'GENERATED').length,
    delivered: filteredReportCards.filter(rc => rc.status === 'DELIVERED').length,
    avgGrade: filteredReportCards.length > 0 
      ? (filteredReportCards.reduce((sum, rc) => sum + rc.average, 0) / filteredReportCards.length).toFixed(2)
      : '0.00',
  }

  const handleGenerateAll = () => {
    setReportCards(reportCards.map(rc => 
      rc.group === selectedGroup && rc.status === 'PENDING'
        ? { ...rc, status: 'GENERATED' as ReportCardStatus, generatedAt: new Date().toISOString().split('T')[0] }
        : rc
    ))
  }

  const handleGenerateSelected = () => {
    setReportCards(reportCards.map(rc => 
      selectedCards.includes(rc.id) && rc.status === 'PENDING'
        ? { ...rc, status: 'GENERATED' as ReportCardStatus, generatedAt: new Date().toISOString().split('T')[0] }
        : rc
    ))
    setSelectedCards([])
  }

  const handleMarkDelivered = (id: string) => {
    setReportCards(reportCards.map(rc => 
      rc.id === id
        ? { ...rc, status: 'DELIVERED' as ReportCardStatus, deliveredAt: new Date().toISOString().split('T')[0] }
        : rc
    ))
  }

  const handlePreview = (student: StudentReportCard) => {
    setSelectedStudent(student)
    setShowPreview(true)
  }

  const toggleSelectCard = (id: string) => {
    setSelectedCards(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedCards.length === filteredReportCards.length) {
      setSelectedCards([])
    } else {
      setSelectedCards(filteredReportCards.map(rc => rc.id))
    }
  }

  const getPerformanceLevel = (grade: number) => {
    if (grade >= 4.6) return 'SUPERIOR'
    if (grade >= 4.0) return 'ALTO'
    if (grade >= 3.0) return 'BASICO'
    return 'BAJO'
  }

  // Obtener boletines según filtro de descarga masiva
  const getBulkDownloadCards = () => {
    if (bulkDownloadFilter === 'ALL') {
      return reportCards.filter(rc => rc.status !== 'PENDING')
    } else if (bulkDownloadFilter === 'GRADE') {
      return reportCards.filter(rc => rc.group.startsWith(bulkDownloadGrade) && rc.status !== 'PENDING')
    } else {
      return reportCards.filter(rc => rc.group === bulkDownloadGroup && rc.status !== 'PENDING')
    }
  }

  // Generar PDF de un boletín individual
  const generateSingleReportCardPDF = (student: StudentReportCard, doc: jsPDF, isFirst: boolean) => {
    if (!isFirst) {
      doc.addPage()
    }

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    let yPos = 20

    // Encabezado institucional
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(institutionConfig.name, pageWidth / 2, yPos, { align: 'center' })
    yPos += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(institutionConfig.resolution, pageWidth / 2, yPos, { align: 'center' })
    yPos += 4
    doc.text(`NIT: ${institutionConfig.nit} - DANE: ${institutionConfig.dane}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 4
    doc.text(`${institutionConfig.address} - ${institutionConfig.municipality}, ${institutionConfig.department}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 4
    doc.text(`Tel: ${institutionConfig.phone} - ${institutionConfig.email}`, pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    // Título del informe con fondo azul
    doc.setFillColor(30, 64, 175)
    doc.rect(margin, yPos, pageWidth - (margin * 2), 14, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`INFORME ACADEMICO - ${selectedPeriod === 'FINAL' ? 'FINAL' : `PERIODO ${selectedPeriod}`}`, pageWidth / 2, yPos + 6, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`Ano Lectivo ${selectedYear}`, pageWidth / 2, yPos + 11, { align: 'center' })
    yPos += 20

    // Recuadro de datos del estudiante
    doc.setTextColor(0, 0, 0)
    doc.setDrawColor(200, 200, 200)
    doc.setFillColor(248, 250, 252)
    doc.rect(margin, yPos, pageWidth - (margin * 2), 22, 'FD')
    
    yPos += 5
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Estudiante:', margin + 3, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(student.studentName, margin + 28, yPos)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Grado:', pageWidth / 2 + 5, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(student.group, pageWidth / 2 + 22, yPos)
    
    yPos += 5
    doc.setFont('helvetica', 'bold')
    doc.text('Documento:', margin + 3, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(student.documentNumber, margin + 28, yPos)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Jornada:', pageWidth / 2 + 5, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text('Manana', pageWidth / 2 + 22, yPos)
    
    yPos += 5
    doc.setFont('helvetica', 'bold')
    doc.text('Director de Grupo:', margin + 3, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(tutorName, margin + 38, yPos)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Puesto:', pageWidth / 2 + 5, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(`${student.rank} de ${student.totalStudents}`, pageWidth / 2 + 22, yPos)
    
    yPos += 12

    // Tabla de calificaciones por área
    const areasOrder = ['Matematicas', 'Humanidades', 'Ciencias Naturales', 'Ciencias Sociales', 'Educacion Fisica', 'Educacion Artistica', 'Etica', 'Tecnologia']
    const areaMapping: Record<string, string> = {
      'Matemáticas': 'Matematicas',
      'Humanidades': 'Humanidades', 
      'Ciencias Naturales': 'Ciencias Naturales',
      'Ciencias Sociales': 'Ciencias Sociales',
      'Educación Física': 'Educacion Fisica',
      'Educación Artística': 'Educacion Artistica',
      'Ética': 'Etica',
      'Tecnología': 'Tecnologia'
    }
    
    const groupedByArea: Record<string, typeof mockSubjectGrades> = {}
    mockSubjectGrades.forEach(sg => {
      const areaKey = areaMapping[sg.area] || sg.area
      if (!groupedByArea[areaKey]) groupedByArea[areaKey] = []
      groupedByArea[areaKey].push(sg)
    })

    const tableData: any[][] = []
    areasOrder.forEach(area => {
      const subjects = groupedByArea[area]
      if (!subjects || subjects.length === 0) return
      
      // Calcular promedio del área
      const areaAvg = subjects.reduce((sum, s) => {
        const grade = selectedPeriod === 1 ? s.period1 : selectedPeriod === 2 ? s.period2 : selectedPeriod === 3 ? s.period3 : selectedPeriod === 4 ? s.period4 : s.final
        return sum + (grade || 0)
      }, 0) / subjects.length

      // Fila del área (encabezado)
      tableData.push([
        { content: area.toUpperCase(), colSpan: 3, styles: { fillColor: [226, 232, 240], fontStyle: 'bold', fontSize: 8 } },
        { content: `Promedio Area: ${areaAvg.toFixed(1)}`, colSpan: 2, styles: { fillColor: [226, 232, 240], fontStyle: 'bold', halign: 'right', fontSize: 7 } }
      ])

      // Asignaturas del área
      subjects.forEach(sg => {
        const grade = selectedPeriod === 1 ? sg.period1 : selectedPeriod === 2 ? sg.period2 : selectedPeriod === 3 ? sg.period3 : selectedPeriod === 4 ? sg.period4 : sg.final
        const recoveryGrade = selectedPeriod === 1 ? sg.recovery1 : selectedPeriod === 2 ? sg.recovery2 : selectedPeriod === 3 ? sg.recovery3 : selectedPeriod === 4 ? sg.recovery4 : undefined
        const perfLabel = performanceConfig[sg.performance].label
        
        // Logro completo con recomendación si existe
        let achievementText = sg.achievement
        if (sg.recommendation) {
          achievementText += `\n* ${sg.recommendation}`
        }
        
        // Mostrar nota con recuperación si existe
        let gradeDisplay = grade?.toFixed(1) || '-'
        if (recoveryGrade !== undefined && recoveryGrade > 0) {
          gradeDisplay = `${grade?.toFixed(1) || '-'}\nRec: ${recoveryGrade.toFixed(1)}`
        }
        
        tableData.push([
          { content: sg.subject.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u'), styles: { fontStyle: 'bold', fontSize: 8 } },
          { content: achievementText, styles: { fontSize: 7 } },
          { content: gradeDisplay, styles: { halign: 'center', fontStyle: 'bold', fontSize: recoveryGrade ? 8 : 10 } },
          { content: perfLabel, styles: { halign: 'center', fontSize: 7 } },
          { content: sg.absences.toString(), styles: { halign: 'center', fontSize: 8 } }
        ])
      })
    })

    // Calcular ancho total disponible para la tabla (igual que las demás secciones)
    const tableWidth = pageWidth - (margin * 2)
    // Distribuir columnas: Asignatura(35) + Logro(auto) + Nota(15) + Desempeño(22) + Fallas(15) = 87 fijos + resto para logro
    const col0Width = 35
    const col2Width = 15
    const col3Width = 22
    const col4Width = 15
    const col1Width = tableWidth - col0Width - col2Width - col3Width - col4Width // El resto para logro

    autoTable(doc, {
      startY: yPos,
      head: [[
        { content: 'Area / Asignatura', styles: { halign: 'left' } },
        { content: 'Logro del Periodo', styles: { halign: 'left' } },
        { content: 'Nota', styles: { halign: 'center' } },
        { content: 'Desempeno', styles: { halign: 'center' } },
        { content: 'Fallas', styles: { halign: 'center' } }
      ]],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      columnStyles: {
        0: { cellWidth: col0Width },
        1: { cellWidth: col1Width },
        2: { cellWidth: col2Width, halign: 'center' },
        3: { cellWidth: col3Width, halign: 'center' },
        4: { cellWidth: col4Width, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      tableWidth: tableWidth
    })

    // Promedio general
    const finalY = (doc as any).lastAutoTable.finalY + 3
    doc.setFillColor(219, 234, 254)
    doc.rect(margin, finalY, pageWidth - (margin * 2), 10, 'F')
    doc.setDrawColor(30, 64, 175)
    doc.rect(margin, finalY, pageWidth - (margin * 2), 10, 'S')
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('PROMEDIO GENERAL DEL PERIODO:', margin + 5, finalY + 7)
    doc.setFontSize(14)
    doc.setTextColor(30, 64, 175)
    doc.text(student.average.toFixed(1), pageWidth / 2, finalY + 7, { align: 'center' })
    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    const perfLevel = getPerformanceLevel(student.average)
    doc.text(performanceConfig[perfLevel].label, pageWidth / 2 + 20, finalY + 7)
    doc.text(`Fallas: ${mockSubjectGrades.reduce((sum, sg) => sum + sg.absences, 0)}`, pageWidth - margin - 25, finalY + 7)

    // Resumen y Escala
    let summaryY = finalY + 15
    
    // Escala de valoración
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('ESCALA DE VALORACION:', margin, summaryY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Superior: 4.6-5.0 | Alto: 4.0-4.5 | Basico: 3.0-3.9 | Bajo: 1.0-2.9', margin, summaryY + 4)
    
    // Resumen
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('RESUMEN:', pageWidth / 2, summaryY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`Aprobadas: ${student.approvedSubjects} | Reprobadas: ${student.failedSubjects} | Puesto: ${student.rank}/${student.totalStudents}`, pageWidth / 2, summaryY + 4)

    // Observaciones
    summaryY += 12
    doc.setDrawColor(200, 200, 200)
    doc.rect(margin, summaryY, pageWidth - (margin * 2), 18, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('OBSERVACIONES DEL DIRECTOR DE GRUPO:', margin + 2, summaryY + 4)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    const obsText = 'El estudiante demuestra un buen desempeno academico general. Se recomienda continuar con el esfuerzo y dedicacion mostrados durante el periodo.'
    const splitObs = doc.splitTextToSize(obsText, pageWidth - (margin * 2) - 4)
    doc.text(splitObs, margin + 2, summaryY + 9)

    // Firmas
    const sigY = summaryY + 28
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    
    const sig1X = margin + 25
    const sig2X = pageWidth / 2
    const sig3X = pageWidth - margin - 25
    
    doc.line(sig1X - 20, sigY, sig1X + 20, sigY)
    doc.text(institutionConfig.rectorName.substring(0, 25), sig1X, sigY + 3, { align: 'center' })
    doc.text('Rector(a)', sig1X, sigY + 6, { align: 'center' })

    doc.line(sig2X - 20, sigY, sig2X + 20, sigY)
    doc.text(institutionConfig.coordinatorName.substring(0, 25), sig2X, sigY + 3, { align: 'center' })
    doc.text('Coordinador(a)', sig2X, sigY + 6, { align: 'center' })

    doc.line(sig3X - 20, sigY, sig3X + 20, sigY)
    doc.text(tutorName.substring(0, 25), sig3X, sigY + 3, { align: 'center' })
    doc.text('Director(a) de Grupo', sig3X, sigY + 6, { align: 'center' })

    // Pie de página
    doc.setFontSize(6)
    doc.setTextColor(128, 128, 128)
    const footerY = doc.internal.pageSize.getHeight() - 10
    doc.text(`Documento generado el ${new Date().toLocaleDateString('es-CO')} - ${institutionConfig.name}`, pageWidth / 2, footerY, { align: 'center' })
  }

  // Descarga masiva real
  const handleBulkDownload = () => {
    const cardsToDownload = getBulkDownloadCards()
    if (cardsToDownload.length === 0) {
      alert('No hay boletines generados para descargar con los filtros seleccionados.')
      return
    }
    
    setIsGeneratingBulk(true)
    
    setTimeout(() => {
      try {
        const doc = new jsPDF('portrait', 'mm', 'letter')
        
        cardsToDownload.forEach((student, index) => {
          generateSingleReportCardPDF(student, doc, index === 0)
        })

        const fileName = `Boletines_${selectedPeriod === 'FINAL' ? 'Final' : `P${selectedPeriod}`}_${selectedYear}_${bulkDownloadFilter === 'ALL' ? 'Todos' : bulkDownloadFilter === 'GRADE' ? bulkDownloadGrade : bulkDownloadGroup}.pdf`
        doc.save(fileName)
        
        setIsGeneratingBulk(false)
        setShowBulkDownloadModal(false)
      } catch (error) {
        console.error('Error generando PDF:', error)
        alert('Error al generar el PDF. Intente nuevamente.')
        setIsGeneratingBulk(false)
      }
    }, 500)
  }

  // Descarga individual
  const handleSingleDownload = (student: StudentReportCard) => {
    const doc = new jsPDF('portrait', 'mm', 'letter')
    generateSingleReportCardPDF(student, doc, true)
    doc.save(`Boletin_${student.studentName.replace(/\s+/g, '_')}_P${selectedPeriod}_${selectedYear}.pdf`)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Boletines Académicos</h1>
          <p className="text-slate-500 mt-1">Generación y entrega de boletines de calificaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowBulkDownloadModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            <Download className="w-4 h-4" />
            Descarga Masiva
          </button>
          <button 
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </button>
          <button 
            onClick={handleGenerateAll}
            disabled={stats.pending === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            Generar Todos ({stats.pending})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Año</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Período</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value === 'FINAL' ? 'FINAL' : Number(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {periods.map(p => (
                <option key={p} value={p}>Período {p}</option>
              ))}
              <option value="FINAL">Boletín Final</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Grupo</label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {groups.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Buscar</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Nombre o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendientes</option>
              <option value="GENERATED">Generados</option>
              <option value="DELIVERED">Entregados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Estudiantes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-slate-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-600">{stats.pending}</p>
              <p className="text-xs text-slate-500">Pendientes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.generated}</p>
              <p className="text-xs text-slate-500">Generados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
              <p className="text-xs text-slate-500">Entregados</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.avgGrade}</p>
              <p className="text-xs text-slate-500">Promedio Grupo</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      {selectedCards.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {selectedCards.length} boletín(es) seleccionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleGenerateSelected}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              Generar Seleccionados
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Descargar PDF
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button 
              onClick={() => setSelectedCards([])}
              className="px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Report Cards Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedCards.length === filteredReportCards.length && filteredReportCards.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded"
                  />
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Estudiante</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Documento</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Promedio</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Desempeño</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Aprobadas</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Reprobadas</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Puesto</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Estado</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReportCards.map((rc) => {
                const performance = getPerformanceLevel(rc.average)
                return (
                  <tr key={rc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCards.includes(rc.id)}
                        onChange={() => toggleSelectCard(rc.id)}
                        className="w-4 h-4 rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{rc.studentName}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{rc.documentNumber}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-lg font-bold ${
                        rc.average >= 4.0 ? 'text-green-600' : 
                        rc.average >= 3.0 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {rc.average.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${performanceConfig[performance].bgColor} ${performanceConfig[performance].color}`}>
                        {performanceConfig[performance].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-green-600 font-medium">{rc.approvedSubjects}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${rc.failedSubjects > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {rc.failedSubjects}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm">
                        <span className="font-bold">{rc.rank}</span>
                        <span className="text-slate-400">/{rc.totalStudents}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusConfig[rc.status].bgColor} ${statusConfig[rc.status].color}`}>
                        {statusConfig[rc.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => handlePreview(rc)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600"
                          title="Vista previa"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {rc.status !== 'PENDING' && (
                          <>
                            <button 
                              onClick={() => handleSingleDownload(rc)}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-green-600"
                              title="Descargar PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                handleSingleDownload(rc)
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-700"
                              title="Imprimir"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {rc.status === 'GENERATED' && (
                          <button 
                            onClick={() => handleMarkDelivered(rc.id)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-green-600"
                            title="Marcar como entregado"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {rc.status === 'DELIVERED' && (
                          <button 
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-purple-600"
                            title="Enviar por correo"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredReportCards.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No se encontraron boletines</p>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Vista Previa del Boletín</h3>
                <p className="text-sm text-slate-500">{selectedStudent.studentName} - {selectedGroup}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleSingleDownload(selectedStudent)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button 
                  onClick={() => handleSingleDownload(selectedStudent)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir
                </button>
                <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
              {/* Boletín con formato de impresión */}
              <div className="bg-white border-2 border-slate-400 rounded-lg p-8 max-w-4xl mx-auto shadow-lg">
                
                {/* Encabezado Institucional con Escudo */}
                <div className="flex items-center justify-between border-b-2 border-slate-300 pb-4 mb-4">
                  <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50">
                    {institutionConfig.shieldUrl ? (
                      <img src={institutionConfig.shieldUrl} alt="Escudo" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center text-xs text-slate-400">
                        <GraduationCap className="w-8 h-8 mx-auto mb-1" />
                        Escudo
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-center px-4">
                    <h2 className="text-xl font-bold text-slate-900 uppercase">{institutionConfig.name}</h2>
                    <p className="text-xs text-slate-600">{institutionConfig.resolution}</p>
                    <p className="text-xs text-slate-600">NIT: {institutionConfig.nit} - DANE: {institutionConfig.dane}</p>
                    <p className="text-xs text-slate-600">{institutionConfig.address} - {institutionConfig.municipality}, {institutionConfig.department}</p>
                    <p className="text-xs text-slate-600">Tel: {institutionConfig.phone} - {institutionConfig.email}</p>
                  </div>
                  <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50">
                    {institutionConfig.logoUrl ? (
                      <img src={institutionConfig.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-center text-xs text-slate-400">
                        <FileText className="w-8 h-8 mx-auto mb-1" />
                        Logo
                      </div>
                    )}
                  </div>
                </div>

                {/* Título del Informe */}
                <div className="text-center bg-blue-800 text-white py-2 rounded mb-4">
                  <h3 className="text-lg font-bold">
                    INFORME ACADÉMICO - {selectedPeriod === 'FINAL' ? 'FINAL' : `PERÍODO ${selectedPeriod}`}
                  </h3>
                  <p className="text-sm">Año Lectivo {selectedYear}</p>
                </div>

                {/* Datos del Estudiante */}
                <div className="grid grid-cols-2 gap-4 text-sm border border-slate-300 rounded p-3 mb-4 bg-slate-50">
                  <div>
                    <p><span className="font-semibold">Estudiante:</span> {selectedStudent.studentName}</p>
                    <p><span className="font-semibold">Documento:</span> {selectedStudent.documentNumber}</p>
                    <p><span className="font-semibold">Director de Grupo:</span> {tutorName}</p>
                  </div>
                  <div>
                    <p><span className="font-semibold">Grado:</span> {selectedGroup}</p>
                    <p><span className="font-semibold">Jornada:</span> Mañana</p>
                    <p><span className="font-semibold">Puesto:</span> {selectedStudent.rank} de {selectedStudent.totalStudents}</p>
                  </div>
                </div>

                {/* Tabla de Calificaciones Organizada por Áreas */}
                <div className="border border-slate-300 rounded overflow-hidden mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-blue-800 text-white">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium w-28">Área / Asignatura</th>
                        <th className="px-2 py-2 text-left font-medium">Logro del Período</th>
                        <th className="px-1 py-2 text-center font-medium w-10">Nota</th>
                        <th className="px-1 py-2 text-center font-medium w-16">Desempeño</th>
                        <th className="px-1 py-2 text-center font-medium w-10">Fallas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Agrupar asignaturas por área */}
                      {(() => {
                        // Obtener áreas únicas en orden
                        const areasOrder = ['Matemáticas', 'Humanidades', 'Ciencias Naturales', 'Ciencias Sociales', 'Educación Física', 'Educación Artística', 'Ética', 'Tecnología']
                        const groupedByArea: Record<string, typeof mockSubjectGrades> = {}
                        
                        mockSubjectGrades.forEach(sg => {
                          if (!groupedByArea[sg.area]) {
                            groupedByArea[sg.area] = []
                          }
                          groupedByArea[sg.area].push(sg)
                        })

                        return areasOrder.map(area => {
                          const subjects = groupedByArea[area]
                          if (!subjects || subjects.length === 0) return null

                          // Calcular promedio del área
                          const areaAvg = subjects.reduce((sum, s) => {
                            const grade = selectedPeriod === 1 ? s.period1 :
                                         selectedPeriod === 2 ? s.period2 :
                                         selectedPeriod === 3 ? s.period3 :
                                         selectedPeriod === 4 ? s.period4 : s.final
                            return sum + (grade || 0)
                          }, 0) / subjects.length

                          return (
                            <React.Fragment key={area}>
                              {/* Fila del Área */}
                              <tr className="bg-slate-200">
                                <td colSpan={5} className="px-2 py-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 uppercase text-[11px]">📚 {area}</span>
                                    <span className="text-[10px] text-slate-600">
                                      Promedio Área: <span className={`font-bold ${areaAvg >= 3 ? 'text-green-700' : 'text-red-600'}`}>{areaAvg.toFixed(1)}</span>
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {/* Asignaturas del Área */}
                              {subjects.map((sg, idx) => {
                                const currentPeriodGrade = selectedPeriod === 1 ? sg.period1 :
                                                           selectedPeriod === 2 ? sg.period2 :
                                                           selectedPeriod === 3 ? sg.period3 :
                                                           selectedPeriod === 4 ? sg.period4 : sg.final
                                return (
                                  <tr key={`${area}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="px-2 py-1.5 pl-4 font-medium text-slate-900 border-l-2 border-blue-300">
                                      {sg.subject}
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-700">
                                      <p className="leading-tight">{sg.achievement}</p>
                                      {sg.recommendation && (
                                        <p className="text-red-600 italic mt-0.5">📌 {sg.recommendation}</p>
                                      )}
                                    </td>
                                    <td className={`px-1 py-1.5 text-center font-bold text-sm ${currentPeriodGrade && currentPeriodGrade < 3 ? 'text-red-600' : 'text-green-700'}`}>
                                      {currentPeriodGrade?.toFixed(1) || '-'}
                                    </td>
                                    <td className="px-1 py-1.5 text-center">
                                      <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${performanceConfig[sg.performance].bgColor} ${performanceConfig[sg.performance].color}`}>
                                        {performanceConfig[sg.performance].label}
                                      </span>
                                    </td>
                                    <td className="px-1 py-1.5 text-center">{sg.absences}</td>
                                  </tr>
                                )
                              })}
                            </React.Fragment>
                          )
                        })
                      })()}
                    </tbody>
                    <tfoot className="bg-blue-100">
                      <tr>
                        <td className="px-2 py-2 font-bold" colSpan={2}>PROMEDIO GENERAL DEL PERÍODO</td>
                        <td className="px-1 py-2 text-center font-bold text-lg text-blue-800">
                          {selectedStudent.average.toFixed(1)}
                        </td>
                        <td className="px-1 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${performanceConfig[getPerformanceLevel(selectedStudent.average)].bgColor} ${performanceConfig[getPerformanceLevel(selectedStudent.average)].color}`}>
                            {performanceConfig[getPerformanceLevel(selectedStudent.average)].label}
                          </span>
                        </td>
                        <td className="px-1 py-2 text-center font-medium">
                          {mockSubjectGrades.reduce((sum, sg) => sum + sg.absences, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Resumen y Escala */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="border border-slate-300 rounded p-3 text-xs">
                    <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">RESUMEN ACADÉMICO</h4>
                    <div className="space-y-1">
                      <p className="flex justify-between"><span>Asignaturas Aprobadas:</span> <span className="font-bold text-green-600">{selectedStudent.approvedSubjects}</span></p>
                      <p className="flex justify-between"><span>Asignaturas Reprobadas:</span> <span className={`font-bold ${selectedStudent.failedSubjects > 0 ? 'text-red-600' : 'text-slate-400'}`}>{selectedStudent.failedSubjects}</span></p>
                      <p className="flex justify-between"><span>Total Fallas del Período:</span> <span className="font-bold">{mockSubjectGrades.reduce((sum, sg) => sum + sg.absences, 0)}</span></p>
                      <p className="flex justify-between"><span>Puesto en el Grupo:</span> <span className="font-bold">{selectedStudent.rank} / {selectedStudent.totalStudents}</span></p>
                    </div>
                  </div>
                  <div className="border border-slate-300 rounded p-3 text-xs">
                    <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">ESCALA DE VALORACIÓN</h4>
                    <div className="space-y-1">
                      {Object.entries(performanceConfig).map(([key, config]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className={`px-1.5 py-0.5 rounded ${config.bgColor} ${config.color}`}>{config.label}</span>
                          <span className="text-slate-600">{config.min.toFixed(1)} - {config.max.toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Observaciones del Director */}
                <div className="border border-slate-300 rounded p-3 mb-4">
                  <h4 className="font-bold text-slate-900 mb-2 text-xs border-b pb-1">OBSERVACIONES DEL DIRECTOR DE GRUPO</h4>
                  <p className="text-xs text-slate-700 italic leading-relaxed">
                    El estudiante demuestra un buen desempeño académico general. Se recomienda continuar con el esfuerzo 
                    y dedicación mostrados durante el período. Se sugiere reforzar las áreas de Ciencias Naturales y Física 
                    para mejorar el rendimiento en el próximo período. Mantiene buenas relaciones con sus compañeros y docentes.
                  </p>
                </div>

                {/* Firmas con espacio para imagen */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs mt-8">
                  <div>
                    <div className="h-16 border-b-2 border-slate-400 mb-1 flex items-end justify-center">
                      {institutionConfig.rectorSignatureUrl ? (
                        <img src={institutionConfig.rectorSignatureUrl} alt="Firma Rector" className="h-14 object-contain" />
                      ) : (
                        <span className="text-slate-300 text-[10px] mb-1">Firma Digital</span>
                      )}
                    </div>
                    <p className="font-bold">{institutionConfig.rectorName}</p>
                    <p className="text-slate-500">Rector(a)</p>
                  </div>
                  <div>
                    <div className="h-16 border-b-2 border-slate-400 mb-1 flex items-end justify-center">
                      {institutionConfig.coordinatorSignatureUrl ? (
                        <img src={institutionConfig.coordinatorSignatureUrl} alt="Firma Coordinador" className="h-14 object-contain" />
                      ) : (
                        <span className="text-slate-300 text-[10px] mb-1">Firma Digital</span>
                      )}
                    </div>
                    <p className="font-bold">{institutionConfig.coordinatorName}</p>
                    <p className="text-slate-500">Coordinador(a)</p>
                  </div>
                  <div>
                    <div className="h-16 border-b-2 border-slate-400 mb-1 flex items-end justify-center">
                      <span className="text-slate-300 text-[10px] mb-1">Firma Digital</span>
                    </div>
                    <p className="font-bold">{tutorName}</p>
                    <p className="text-slate-500">Director(a) de Grupo</p>
                  </div>
                </div>

                {/* Pie de página */}
                <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-500">
                  <p>Documento generado el {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p>{institutionConfig.name} - {institutionConfig.municipality}, {institutionConfig.department}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Configuración de Boletines</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Información Institucional */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Información Institucional
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la Institución</label>
                    <input 
                      type="text" 
                      value={institutionConfig.name}
                      onChange={(e) => setInstitutionConfig({...institutionConfig, name: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Resolución</label>
                    <input 
                      type="text" 
                      value={institutionConfig.resolution}
                      onChange={(e) => setInstitutionConfig({...institutionConfig, resolution: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">NIT</label>
                    <input 
                      type="text" 
                      value={institutionConfig.nit}
                      onChange={(e) => setInstitutionConfig({...institutionConfig, nit: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">DANE</label>
                    <input 
                      type="text" 
                      value={institutionConfig.dane}
                      onChange={(e) => setInstitutionConfig({...institutionConfig, dane: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Dirección</label>
                    <input 
                      type="text" 
                      value={institutionConfig.address}
                      onChange={(e) => setInstitutionConfig({...institutionConfig, address: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Municipio</label>
                    <input 
                      type="text" 
                      value={institutionConfig.municipality}
                      onChange={(e) => setInstitutionConfig({...institutionConfig, municipality: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Departamento</label>
                    <input 
                      type="text" 
                      value={institutionConfig.department}
                      onChange={(e) => setInstitutionConfig({...institutionConfig, department: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Imágenes */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Imágenes del Boletín
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                    <div className="w-16 h-16 mx-auto mb-2 bg-slate-100 rounded-lg flex items-center justify-center">
                      <GraduationCap className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Escudo Institucional</p>
                    <p className="text-xs text-slate-500 mb-2">PNG o JPG, máx. 500KB</p>
                    <button className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-sm hover:bg-blue-100">
                      Subir Imagen
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                    <div className="w-16 h-16 mx-auto mb-2 bg-slate-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Logo Institucional</p>
                    <p className="text-xs text-slate-500 mb-2">PNG o JPG, máx. 500KB</p>
                    <button className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-sm hover:bg-blue-100">
                      Subir Imagen
                    </button>
                  </div>
                </div>
              </div>

              {/* Firmas */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                  ✍️ Firmas Digitales
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del Rector(a)</label>
                      <input 
                        type="text" 
                        value={institutionConfig.rectorName}
                        onChange={(e) => setInstitutionConfig({...institutionConfig, rectorName: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                      />
                      <div className="mt-2 border-2 border-dashed border-slate-300 rounded p-2 text-center">
                        <p className="text-xs text-slate-500">Firma digital</p>
                        <button className="text-xs text-blue-600 hover:underline">Subir firma</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del Coordinador(a)</label>
                      <input 
                        type="text" 
                        value={institutionConfig.coordinatorName}
                        onChange={(e) => setInstitutionConfig({...institutionConfig, coordinatorName: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                      />
                      <div className="mt-2 border-2 border-dashed border-slate-300 rounded p-2 text-center">
                        <p className="text-xs text-slate-500">Firma digital</p>
                        <button className="text-xs text-blue-600 hover:underline">Subir firma</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Director de Grupo (9°A)</label>
                      <input 
                        type="text" 
                        value={tutorName}
                        onChange={(e) => setTutorName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" 
                      />
                      <div className="mt-2 border-2 border-dashed border-slate-300 rounded p-2 text-center">
                        <p className="text-xs text-slate-500">Firma digital</p>
                        <button className="text-xs text-blue-600 hover:underline">Subir firma</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formato y Contenido */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">Formato del Boletín</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="format" defaultChecked className="w-4 h-4" />
                      <span className="text-sm">Formato estándar (carta)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="format" className="w-4 h-4" />
                      <span className="text-sm">Formato compacto (media carta)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-slate-900 mb-2">Contenido a Mostrar</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      <span className="text-sm">Mostrar logros por asignatura</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      <span className="text-sm">Mostrar puesto en el grupo</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      <span className="text-sm">Mostrar fallas por asignatura</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                      <span className="text-sm">Incluir observaciones del director</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="w-4 h-4 rounded" />
                      <span className="text-sm">Mostrar notas de recuperación</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Escala de Valoración */}
              <div>
                <h4 className="font-medium text-slate-900 mb-2">Escala de Valoración</h4>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-16 px-2 py-1 bg-green-100 text-green-700 rounded text-center text-xs">Superior</span>
                    <input type="text" defaultValue="4.6 - 5.0" className="flex-1 px-2 py-1 border border-slate-300 rounded text-center text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 px-2 py-1 bg-blue-100 text-blue-700 rounded text-center text-xs">Alto</span>
                    <input type="text" defaultValue="4.0 - 4.5" className="flex-1 px-2 py-1 border border-slate-300 rounded text-center text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 px-2 py-1 bg-amber-100 text-amber-700 rounded text-center text-xs">Básico</span>
                    <input type="text" defaultValue="3.0 - 3.9" className="flex-1 px-2 py-1 border border-slate-300 rounded text-center text-xs" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 px-2 py-1 bg-red-100 text-red-700 rounded text-center text-xs">Bajo</span>
                    <input type="text" defaultValue="1.0 - 2.9" className="flex-1 px-2 py-1 border border-slate-300 rounded text-center text-xs" />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Descarga Masiva */}
      {showBulkDownloadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-slate-900">Descarga Masiva de Boletines</h3>
              </div>
              <button onClick={() => setShowBulkDownloadModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Periodo:</strong> {selectedPeriod === 'FINAL' ? 'Boletin Final' : `Periodo ${selectedPeriod}`} - <strong>Ano:</strong> {selectedYear}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Que boletines desea descargar?</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="bulkFilter" checked={bulkDownloadFilter === 'GROUP'} onChange={() => setBulkDownloadFilter('GROUP')} className="w-4 h-4 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">Por Grupo</p>
                      <p className="text-xs text-slate-500">Descargar todos los boletines de un grupo especifico</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="bulkFilter" checked={bulkDownloadFilter === 'GRADE'} onChange={() => setBulkDownloadFilter('GRADE')} className="w-4 h-4 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">Por Grado</p>
                      <p className="text-xs text-slate-500">Descargar todos los boletines de un grado (todos los grupos)</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input type="radio" name="bulkFilter" checked={bulkDownloadFilter === 'ALL'} onChange={() => setBulkDownloadFilter('ALL')} className="w-4 h-4 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">Todos</p>
                      <p className="text-xs text-slate-500">Descargar todos los boletines de la institucion</p>
                    </div>
                  </label>
                </div>
              </div>

              {bulkDownloadFilter === 'GROUP' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Seleccionar Grupo</label>
                  <select value={bulkDownloadGroup} onChange={(e) => setBulkDownloadGroup(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    {groups.map(g => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </div>
              )}

              {bulkDownloadFilter === 'GRADE' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Seleccionar Grado</label>
                  <select value={bulkDownloadGrade} onChange={(e) => setBulkDownloadGrade(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    {grades.map(g => (<option key={g} value={g}>{g}</option>))}
                  </select>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Boletines a descargar:</span>
                  <span className="text-lg font-bold text-green-600">{getBulkDownloadCards().length}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Solo se incluyen boletines ya generados (no pendientes)</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowBulkDownloadModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={handleBulkDownload} disabled={getBulkDownloadCards().length === 0 || isGeneratingBulk} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {isGeneratingBulk ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Descargar PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
