import * as XLSX from 'xlsx'

// Plantilla para Estudiantes
export const studentTemplateColumns = [
  { header: 'Tipo Documento', key: 'documentType', example: 'TI', required: true, options: 'TI, CC, RC, CE' },
  { header: 'Numero Documento', key: 'documentNumber', example: '1001234567', required: true },
  { header: 'Primer Nombre', key: 'firstName', example: 'JUAN', required: true },
  { header: 'Segundo Nombre', key: 'secondName', example: 'CARLOS', required: false },
  { header: 'Primer Apellido', key: 'lastName', example: 'PEREZ', required: true },
  { header: 'Segundo Apellido', key: 'secondLastName', example: 'GARCIA', required: false },
  { header: 'Fecha Nacimiento', key: 'birthDate', example: '2010-05-15', required: true, format: 'YYYY-MM-DD' },
  { header: 'Genero', key: 'gender', example: 'M', required: true, options: 'M, F' },
  { header: 'Direccion', key: 'address', example: 'Calle 10 # 15-20', required: false },
  { header: 'Telefono', key: 'phone', example: '3001234567', required: false },
  { header: 'Email', key: 'email', example: 'estudiante@email.com', required: false },
  { header: 'Grupo', key: 'group', example: '9A', required: true },
  { header: 'Nombre Acudiente', key: 'parentName', example: 'MARIA GARCIA', required: true },
  { header: 'Telefono Acudiente', key: 'parentPhone', example: '3009876543', required: true },
  { header: 'Email Acudiente', key: 'parentEmail', example: 'acudiente@email.com', required: false },
  { header: 'EPS', key: 'eps', example: 'SURA', required: false },
  { header: 'Tipo Sangre', key: 'bloodType', example: 'O+', required: false, options: 'O+, O-, A+, A-, B+, B-, AB+, AB-' },
]

// Plantilla para Docentes
export const teacherTemplateColumns = [
  { header: 'Tipo Documento', key: 'documentType', example: 'CC', required: true, options: 'CC, CE, TI, PP' },
  { header: 'Numero Documento', key: 'documentNumber', example: '12345678', required: true },
  { header: 'Primer Nombre', key: 'firstName', example: 'CARLOS', required: true },
  { header: 'Segundo Nombre', key: 'secondName', example: 'ANDRES', required: false },
  { header: 'Primer Apellido', key: 'firstLastName', example: 'MARTINEZ', required: true },
  { header: 'Segundo Apellido', key: 'secondLastName', example: 'LOPEZ', required: false },
  { header: 'Fecha Nacimiento', key: 'birthDate', example: '1985-03-15', required: true, format: 'YYYY-MM-DD' },
  { header: 'Genero', key: 'gender', example: 'M', required: true, options: 'M, F, O' },
  { header: 'Lugar Nacimiento', key: 'birthPlace', example: 'Barranquilla', required: false },
  { header: 'Direccion', key: 'address', example: 'Carrera 5 # 20-30', required: false },
  { header: 'Telefono Fijo', key: 'phone', example: '6051234567', required: false },
  { header: 'Celular', key: 'mobile', example: '3001234567', required: true },
  { header: 'Email Personal', key: 'email', example: 'docente@email.com', required: true },
  { header: 'Email Institucional', key: 'institutionalEmail', example: 'docente@colegio.edu.co', required: false },
  { header: 'Tipo Contrato', key: 'contractType', example: 'PLANTA', required: true, options: 'PLANTA, PROVISIONAL, CONTRATO, HORA_CATEDRA' },
  { header: 'Especialidad', key: 'specialty', example: 'Matematicas', required: false },
  { header: 'Titulo Profesional', key: 'title', example: 'Licenciado en Matematicas', required: false },
]

export interface ImportResult {
  success: boolean
  data: any[]
  errors: { row: number; field: string; message: string }[]
  totalRows: number
  validRows: number
}

// Generar plantilla Excel para descargar
export function generateTemplate(type: 'students' | 'teachers'): void {
  const columns = type === 'students' ? studentTemplateColumns : teacherTemplateColumns
  
  // Crear hoja de datos con encabezados y ejemplo
  const headers = columns.map(c => c.header)
  const exampleRow = columns.map(c => c.example)
  
  // Crear hoja de instrucciones
  const instructions = [
    ['INSTRUCCIONES PARA IMPORTACION DE ' + (type === 'students' ? 'ESTUDIANTES' : 'DOCENTES')],
    [''],
    ['1. Complete los datos en la hoja "Datos" siguiendo el formato indicado'],
    ['2. Los campos marcados con (*) son obligatorios'],
    ['3. No modifique los encabezados de las columnas'],
    ['4. Las fechas deben estar en formato YYYY-MM-DD (ej: 2010-05-15)'],
    ['5. Elimine la fila de ejemplo antes de importar'],
    [''],
    ['CAMPOS Y FORMATOS:'],
    [''],
  ]
  
  columns.forEach(col => {
    let info = `${col.header}${col.required ? ' (*)' : ''}`
    if (col.options) info += ` - Opciones: ${col.options}`
    if (col.format) info += ` - Formato: ${col.format}`
    instructions.push([info])
  })

  // Crear workbook
  const wb = XLSX.utils.book_new()
  
  // Hoja de datos
  const wsData = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  
  // Ajustar anchos de columna
  const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 15) }))
  wsData['!cols'] = colWidths
  
  XLSX.utils.book_append_sheet(wb, wsData, 'Datos')
  
  // Hoja de instrucciones
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions)
  wsInstructions['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones')
  
  // Descargar archivo
  const fileName = type === 'students' 
    ? 'Plantilla_Importacion_Estudiantes.xlsx' 
    : 'Plantilla_Importacion_Docentes.xlsx'
  
  XLSX.writeFile(wb, fileName)
}

// Parsear archivo Excel
export function parseExcelFile(file: File, type: 'students' | 'teachers'): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Leer primera hoja
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Convertir a JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
        
        if (jsonData.length < 2) {
          resolve({
            success: false,
            data: [],
            errors: [{ row: 0, field: '', message: 'El archivo no contiene datos' }],
            totalRows: 0,
            validRows: 0
          })
          return
        }
        
        const columns = type === 'students' ? studentTemplateColumns : teacherTemplateColumns
        const headers = jsonData[0] as string[]
        const rows = jsonData.slice(1)
        
        const result: ImportResult = {
          success: true,
          data: [],
          errors: [],
          totalRows: rows.length,
          validRows: 0
        }
        
        // Mapear encabezados a índices
        const headerMap: Record<string, number> = {}
        headers.forEach((h, i) => {
          const col = columns.find(c => c.header.toLowerCase() === h?.toString().toLowerCase())
          if (col) headerMap[col.key] = i
        })
        
        // Validar y procesar cada fila
        rows.forEach((row, rowIndex) => {
          if (!row || row.every(cell => !cell)) return // Saltar filas vacías
          
          const record: Record<string, any> = {}
          let rowValid = true
          
          columns.forEach(col => {
            const cellIndex = headerMap[col.key]
            let value = cellIndex !== undefined ? row[cellIndex] : undefined
            
            // Convertir a string si es necesario
            if (value !== undefined && value !== null) {
              value = String(value).trim()
            }
            
            // Validar campos requeridos
            if (col.required && (!value || value === '')) {
              result.errors.push({
                row: rowIndex + 2, // +2 porque Excel es 1-indexed y hay encabezado
                field: col.header,
                message: `El campo "${col.header}" es obligatorio`
              })
              rowValid = false
            }
            
            // Validar opciones si aplica
            if (value && col.options) {
              const validOptions = col.options.split(',').map(o => o.trim().toUpperCase())
              if (!validOptions.includes(value.toUpperCase())) {
                result.errors.push({
                  row: rowIndex + 2,
                  field: col.header,
                  message: `Valor invalido para "${col.header}". Opciones: ${col.options}`
                })
                rowValid = false
              }
            }
            
            // Validar formato de fecha
            if (value && col.format === 'YYYY-MM-DD') {
              const dateRegex = /^\d{4}-\d{2}-\d{2}$/
              if (!dateRegex.test(value)) {
                // Intentar parsear otros formatos comunes
                const parsed = parseDate(value)
                if (parsed) {
                  value = parsed
                } else {
                  result.errors.push({
                    row: rowIndex + 2,
                    field: col.header,
                    message: `Formato de fecha invalido. Use YYYY-MM-DD (ej: 2010-05-15)`
                  })
                  rowValid = false
                }
              }
            }
            
            record[col.key] = value || ''
          })
          
          if (rowValid) {
            result.data.push(record)
            result.validRows++
          }
        })
        
        result.success = result.errors.length === 0
        resolve(result)
        
      } catch (error) {
        reject(new Error('Error al procesar el archivo Excel'))
      }
    }
    
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

// Intentar parsear diferentes formatos de fecha
function parseDate(value: string): string | null {
  // Formato DD/MM/YYYY
  let match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  // Formato DD-MM-YYYY
  match = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  
  // Número de Excel (días desde 1900)
  const num = parseFloat(value)
  if (!isNaN(num) && num > 1000 && num < 100000) {
    const date = new Date((num - 25569) * 86400 * 1000)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }
  
  return null
}

// Exportar datos a Excel
export function exportToExcel(data: any[], columns: { header: string; key: string }[], fileName: string): void {
  const headers = columns.map(c => c.header)
  const rows = data.map(item => columns.map(c => item[c.key] || ''))
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  
  // Ajustar anchos
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 5, 15) }))
  
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  
  XLSX.writeFile(wb, fileName)
}
