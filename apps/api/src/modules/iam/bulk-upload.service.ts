import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';

interface TeacherRow {
  firstName: string;
  lastName: string;
  email: string;
  documentType?: string;
  documentNumber?: string;
  phone?: string;
}

interface StudentRow {
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  birthDate?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  groupCode?: string; // Para matricular automáticamente
}

interface StaffRow {
  firstName: string;
  lastName: string;
  email: string;
  role: string; // COORDINADOR, SECRETARIA, ORIENTADOR, etc.
  documentType?: string;
  documentNumber?: string;
  phone?: string;
}

export interface UploadResult {
  success: number;
  errors: Array<{ row: number; message: string; data?: any }>;
  created: Array<{ id: string; name: string; email?: string }>;
}

@Injectable()
export class BulkUploadService {
  constructor(private prisma: PrismaService) {}

  /**
   * Genera plantilla Excel para docentes
   */
  async generateTeacherTemplate(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Docentes');

    // Definir columnas
    sheet.columns = [
      { header: 'Nombres *', key: 'firstName', width: 25 },
      { header: 'Apellidos *', key: 'lastName', width: 25 },
      { header: 'Correo Electrónico *', key: 'email', width: 35 },
      { header: 'Tipo Documento', key: 'documentType', width: 15 },
      { header: 'Número Documento', key: 'documentNumber', width: 20 },
      { header: 'Teléfono', key: 'phone', width: 15 },
    ];

    // Estilo del encabezado
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo
    };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    // Agregar filas de ejemplo
    sheet.addRow({
      firstName: 'Juan Carlos',
      lastName: 'Pérez García',
      email: 'jperez@ejemplo.com',
      documentType: 'CC',
      documentNumber: '12345678',
      phone: '3001234567',
    });
    sheet.addRow({
      firstName: 'María',
      lastName: 'López Rodríguez',
      email: 'mlopez@ejemplo.com',
      documentType: 'CC',
      documentNumber: '87654321',
      phone: '3009876543',
    });

    // Agregar nota
    sheet.addRow([]);
    sheet.addRow(['* Campos obligatorios']);
    sheet.addRow(['Tipos de documento válidos: CC, TI, CE, PASAPORTE, NIT, OTRO']);

    return workbook;
  }

  /**
   * Genera plantilla Excel para estudiantes
   */
  async generateStudentTemplate(institutionId: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Estudiantes');

    // Definir columnas
    sheet.columns = [
      { header: 'Nombres *', key: 'firstName', width: 25 },
      { header: 'Apellidos *', key: 'lastName', width: 25 },
      { header: 'Tipo Documento *', key: 'documentType', width: 15 },
      { header: 'Número Documento *', key: 'documentNumber', width: 20 },
      { header: 'Fecha Nacimiento', key: 'birthDate', width: 15 },
      { header: 'Género', key: 'gender', width: 12 },
      { header: 'Correo', key: 'email', width: 30 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'Dirección', key: 'address', width: 35 },
      { header: 'Código Grupo', key: 'groupCode', width: 15 },
    ];

    // Estilo del encabezado
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' }, // Emerald
    };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    // Agregar filas de ejemplo
    sheet.addRow({
      firstName: 'Pedro',
      lastName: 'Martínez Silva',
      documentType: 'TI',
      documentNumber: '1234567890',
      birthDate: '2010-05-15',
      gender: 'M',
      email: 'pmartinez@ejemplo.com',
      phone: '3001112233',
      address: 'Calle 123 # 45-67',
      groupCode: '6A',
    });
    sheet.addRow({
      firstName: 'Ana María',
      lastName: 'González Ruiz',
      documentType: 'TI',
      documentNumber: '0987654321',
      birthDate: '2011-08-22',
      gender: 'F',
      email: '',
      phone: '',
      address: 'Carrera 89 # 12-34',
      groupCode: '6B',
    });

    // Obtener grupos disponibles para referencia
    const groups = await this.prisma.group.findMany({
      where: {
        campus: { institutionId },
      },
      include: {
        grade: true,
      },
      orderBy: [{ grade: { stage: 'asc' } }, { grade: { number: 'asc' } }, { name: 'asc' }],
    });

    // Agregar hoja de referencia con grupos
    const refSheet = workbook.addWorksheet('Grupos Disponibles');
    refSheet.columns = [
      { header: 'Código', key: 'code', width: 15 },
      { header: 'Nombre', key: 'name', width: 25 },
      { header: 'Grado', key: 'grade', width: 20 },
    ];
    refSheet.getRow(1).font = { bold: true };

    groups.forEach((g) => {
      refSheet.addRow({
        code: g.code || g.name,
        name: g.name,
        grade: g.grade.name,
      });
    });

    // Notas en la hoja principal
    sheet.addRow([]);
    sheet.addRow(['* Campos obligatorios']);
    sheet.addRow(['Tipos de documento: TI (Tarjeta Identidad), RC (Registro Civil), CC, CE, PASAPORTE']);
    sheet.addRow(['Género: M (Masculino), F (Femenino), O (Otro)']);
    sheet.addRow(['Fecha formato: YYYY-MM-DD (ej: 2010-05-15)']);
    sheet.addRow(['Ver hoja "Grupos Disponibles" para códigos de grupo válidos']);

    return workbook;
  }

  /**
   * Genera plantilla Excel para otros usuarios (staff)
   */
  async generateStaffTemplate(): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Edusyn';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Personal');

    // Definir columnas
    sheet.columns = [
      { header: 'Nombres *', key: 'firstName', width: 25 },
      { header: 'Apellidos *', key: 'lastName', width: 25 },
      { header: 'Correo Electrónico *', key: 'email', width: 35 },
      { header: 'Rol *', key: 'role', width: 20 },
      { header: 'Tipo Documento', key: 'documentType', width: 15 },
      { header: 'Número Documento', key: 'documentNumber', width: 20 },
      { header: 'Teléfono', key: 'phone', width: 15 },
    ];

    // Estilo del encabezado
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' }, // Violet
    };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    // Agregar filas de ejemplo
    sheet.addRow({
      firstName: 'Laura',
      lastName: 'Sánchez Mora',
      email: 'lsanchez@ejemplo.com',
      role: 'COORDINADOR',
      documentType: 'CC',
      documentNumber: '11223344',
      phone: '3005556677',
    });
    sheet.addRow({
      firstName: 'Carmen',
      lastName: 'Díaz Torres',
      email: 'cdiaz@ejemplo.com',
      role: 'SECRETARIA',
      documentType: 'CC',
      documentNumber: '55667788',
      phone: '3008889900',
    });

    // Agregar notas
    sheet.addRow([]);
    sheet.addRow(['* Campos obligatorios']);
    sheet.addRow(['Roles válidos: COORDINADOR, SECRETARIA, ORIENTADOR, BIBLIOTECARIO, AUXILIAR']);
    sheet.addRow(['Tipos de documento: CC, TI, CE, PASAPORTE, NIT, OTRO']);

    return workbook;
  }

  /**
   * Procesa archivo Excel de docentes
   */
  async processTeacherUpload(
    institutionId: string,
    buffer: Buffer,
  ): Promise<UploadResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
      throw new BadRequestException('El archivo no contiene hojas de cálculo');
    }

    const result: UploadResult = { success: 0, errors: [], created: [] };
    const rows: TeacherRow[] = [];

    // Mapear encabezados dinámicamente
    const headerRow = sheet.getRow(1);
    const columnMap: Record<string, number> = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const header = cell.value?.toString()?.toLowerCase()?.trim() || '';
      // Mapear diferentes nombres posibles de columnas
      if (header.includes('nombre') && !header.includes('segundo') && !header.includes('apellido')) {
        columnMap.firstName = colNumber;
      } else if (header.includes('segundo nombre')) {
        columnMap.secondName = colNumber;
      } else if (header.includes('primer apellido') || (header.includes('apellido') && !header.includes('segundo'))) {
        columnMap.lastName = colNumber;
      } else if (header.includes('segundo apellido')) {
        columnMap.secondLastName = colNumber;
      } else if (header.includes('email') || header.includes('correo')) {
        if (!columnMap.email) columnMap.email = colNumber; // Tomar el primero (email personal)
      } else if (header.includes('tipo') && header.includes('doc')) {
        columnMap.documentType = colNumber;
      } else if (header.includes('documento') || header.includes('número doc') || header.includes('numero doc')) {
        columnMap.documentNumber = colNumber;
      } else if (header.includes('teléfono') || header.includes('telefono') || header.includes('celular') || header.includes('móvil') || header.includes('movil')) {
        if (!columnMap.phone) columnMap.phone = colNumber;
      }
    });

    console.log('[BulkUpload] Column mapping:', columnMap);

    // Fallback a posiciones fijas si no se encontraron encabezados
    if (!columnMap.firstName) columnMap.firstName = 1;
    if (!columnMap.lastName) columnMap.lastName = 2;
    if (!columnMap.email) columnMap.email = 3;

    // Leer filas (saltando encabezado)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const firstName = row.getCell(columnMap.firstName || 1).value?.toString()?.trim();
      const secondName = columnMap.secondName ? row.getCell(columnMap.secondName).value?.toString()?.trim() : '';
      const lastName = row.getCell(columnMap.lastName || 2).value?.toString()?.trim();
      const email = row.getCell(columnMap.email || 3).value?.toString()?.trim()?.toLowerCase();

      // Ignorar filas vacías o de notas
      if (!firstName || firstName.startsWith('*') || firstName.startsWith('Tipos')) return;

      // Combinar nombre si hay segundo nombre
      const fullFirstName = secondName ? `${firstName} ${secondName}` : firstName;

      rows.push({
        firstName: fullFirstName || '',
        lastName: lastName || '',
        email: email || '',
        documentType: columnMap.documentType ? row.getCell(columnMap.documentType).value?.toString()?.trim() : undefined,
        documentNumber: columnMap.documentNumber ? row.getCell(columnMap.documentNumber).value?.toString()?.trim() : undefined,
        phone: columnMap.phone ? row.getCell(columnMap.phone).value?.toString()?.trim() : undefined,
      });
    });

    // Obtener rol DOCENTE
    let docenteRole = await this.prisma.role.findUnique({
      where: { name: 'DOCENTE' },
    });
    if (!docenteRole) {
      docenteRole = await this.prisma.role.create({
        data: { name: 'DOCENTE' },
      });
    }

    // Procesar cada fila
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 porque empezamos en fila 2 (después del header)

      try {
        // Validaciones
        if (!row.firstName) {
          result.errors.push({ row: rowNum, message: 'Nombre es obligatorio' });
          continue;
        }
        if (!row.lastName) {
          result.errors.push({ row: rowNum, message: 'Apellido es obligatorio' });
          continue;
        }
        if (!row.email) {
          result.errors.push({ row: rowNum, message: 'Correo es obligatorio' });
          continue;
        }
        if (!this.isValidEmail(row.email)) {
          result.errors.push({ row: rowNum, message: `Correo inválido: ${row.email}` });
          continue;
        }

        // Verificar si ya existe
        const existing = await this.prisma.user.findUnique({
          where: { email: row.email },
        });
        if (existing) {
          result.errors.push({ row: rowNum, message: `El correo ${row.email} ya está registrado` });
          continue;
        }

        // Generar username con regla consistente y contraseña = documento
        const username = await this.generateUsernameWithRole(row.firstName, row.lastName, row.documentNumber, 'DOCENTE');
        const initialPassword = row.documentNumber || 'temporal123';
        const passwordHash = await bcrypt.hash(initialPassword, 10);

        // Crear usuario
        const user = await this.prisma.user.create({
          data: {
            email: row.email,
            username,
            firstName: row.firstName,
            lastName: row.lastName,
            passwordHash,
            documentType: row.documentType as any,
            documentNumber: row.documentNumber,
            phone: row.phone,
            isActive: true,
            mustChangePassword: true,
            roles: {
              create: {
                roleId: docenteRole.id,
              },
            },
            institutionUsers: {
              create: {
                institutionId,
                isAdmin: false,
              },
            },
          } as any,
        });

        result.success++;
        result.created.push({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        });
      } catch (error: any) {
        result.errors.push({
          row: rowNum,
          message: error.message || 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }

  /**
   * Procesa archivo Excel de estudiantes
   */
  async processStudentUpload(
    institutionId: string,
    buffer: Buffer,
    academicYearId?: string,
  ): Promise<UploadResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
      throw new BadRequestException('El archivo no contiene hojas de cálculo');
    }

    const result: UploadResult = { success: 0, errors: [], created: [] };
    const rows: StudentRow[] = [];

    // Leer filas
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const firstName = row.getCell(1).value?.toString()?.trim();
      const lastName = row.getCell(2).value?.toString()?.trim();
      const documentType = row.getCell(3).value?.toString()?.trim();
      const documentNumber = row.getCell(4).value?.toString()?.trim();

      if (!firstName || firstName.startsWith('*') || firstName.startsWith('Tipos')) return;

      rows.push({
        firstName,
        lastName: lastName || '',
        documentType: documentType || 'TI',
        documentNumber: documentNumber || '',
        birthDate: row.getCell(5).value?.toString()?.trim(),
        gender: row.getCell(6).value?.toString()?.trim()?.toUpperCase(),
        email: row.getCell(7).value?.toString()?.trim()?.toLowerCase(),
        phone: row.getCell(8).value?.toString()?.trim(),
        address: row.getCell(9).value?.toString()?.trim(),
        groupCode: row.getCell(10).value?.toString()?.trim(),
      });
    });

    // Obtener año académico actual si no se especifica
    if (!academicYearId) {
      const currentYear = await this.prisma.academicYear.findFirst({
        where: { institutionId },
        orderBy: { year: 'desc' },
      });
      academicYearId = currentYear?.id;
    }

    // Cargar grupos para mapeo
    const groups = await this.prisma.group.findMany({
      where: { campus: { institutionId } },
    });
    const groupMap = new Map(groups.map((g) => [g.code || g.name, g.id]));

    // Obtener o crear rol ESTUDIANTE
    let estudianteRole = await this.prisma.role.findUnique({
      where: { name: 'ESTUDIANTE' },
    });
    if (!estudianteRole) {
      estudianteRole = await this.prisma.role.create({
        data: { name: 'ESTUDIANTE' },
      });
    }

    // Procesar cada fila
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Validaciones
        if (!row.firstName) {
          result.errors.push({ row: rowNum, message: 'Nombre es obligatorio' });
          continue;
        }
        if (!row.lastName) {
          result.errors.push({ row: rowNum, message: 'Apellido es obligatorio' });
          continue;
        }
        if (!row.documentNumber) {
          result.errors.push({ row: rowNum, message: 'Número de documento es obligatorio' });
          continue;
        }

        // Verificar si ya existe estudiante
        const existingStudent = await this.prisma.student.findUnique({
          where: {
            institutionId_documentNumber: {
              institutionId,
              documentNumber: row.documentNumber,
            },
          },
        });
        if (existingStudent) {
          result.errors.push({
            row: rowNum,
            message: `Estudiante con documento ${row.documentNumber} ya existe`,
          });
          continue;
        }

        // Parsear fecha de nacimiento
        let birthDate: Date | undefined;
        if (row.birthDate) {
          birthDate = new Date(row.birthDate);
          if (isNaN(birthDate.getTime())) {
            birthDate = undefined;
          }
        }

        // Generar username y contraseña para el usuario
        const username = await this.generateUsernameWithRole(row.firstName, row.lastName, row.documentNumber, 'ESTUDIANTE');
        const initialPassword = row.documentNumber;
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        
        // Generar email si no tiene (requerido para User)
        const email = row.email || `${username}@estudiante.local`;

        // Verificar que el email no exista
        const existingUser = await this.prisma.user.findUnique({
          where: { email },
        });
        if (existingUser) {
          result.errors.push({
            row: rowNum,
            message: `El correo ${email} ya está registrado`,
          });
          continue;
        }

        // Crear usuario primero
        const user = await this.prisma.user.create({
          data: {
            email,
            username,
            firstName: row.firstName,
            lastName: row.lastName,
            passwordHash,
            documentType: row.documentType as any,
            documentNumber: row.documentNumber,
            phone: row.phone,
            isActive: true,
            mustChangePassword: true,
            roles: {
              create: {
                roleId: estudianteRole.id,
              },
            },
            institutionUsers: {
              create: {
                institutionId,
                isAdmin: false,
              },
            },
          } as any,
        });

        // Crear estudiante vinculado al usuario
        const student = await this.prisma.student.create({
          data: {
            institutionId,
            userId: user.id,
            firstName: row.firstName,
            lastName: row.lastName,
            documentType: row.documentType,
            documentNumber: row.documentNumber,
            birthDate,
            gender: row.gender,
            email: row.email || undefined,
            phone: row.phone,
            address: row.address,
          },
        });

        // Matricular si se especificó grupo y hay año académico
        if (row.groupCode && academicYearId) {
          const groupId = groupMap.get(row.groupCode);
          if (groupId) {
            await this.prisma.studentEnrollment.create({
              data: {
                studentId: student.id,
                academicYearId,
                groupId,
                status: 'ACTIVE',
              },
            });
          }
        }

        result.success++;
        result.created.push({
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          email: user.email,
        });
      } catch (error: any) {
        result.errors.push({
          row: rowNum,
          message: error.message || 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }

  /**
   * Procesa archivo Excel de personal (staff)
   */
  async processStaffUpload(
    institutionId: string,
    buffer: Buffer,
  ): Promise<UploadResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheet = workbook.getWorksheet(1);
    if (!sheet) {
      throw new BadRequestException('El archivo no contiene hojas de cálculo');
    }

    const result: UploadResult = { success: 0, errors: [], created: [] };
    const rows: StaffRow[] = [];

    // Roles válidos para staff
    const validRoles = ['COORDINADOR', 'SECRETARIA', 'ORIENTADOR', 'BIBLIOTECARIO', 'AUXILIAR'];

    // Leer filas
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const firstName = row.getCell(1).value?.toString()?.trim();
      const lastName = row.getCell(2).value?.toString()?.trim();
      const email = row.getCell(3).value?.toString()?.trim()?.toLowerCase();
      const role = row.getCell(4).value?.toString()?.trim()?.toUpperCase();

      if (!firstName || firstName.startsWith('*') || firstName.startsWith('Roles')) return;

      rows.push({
        firstName,
        lastName: lastName || '',
        email: email || '',
        role: role || '',
        documentType: row.getCell(5).value?.toString()?.trim(),
        documentNumber: row.getCell(6).value?.toString()?.trim(),
        phone: row.getCell(7).value?.toString()?.trim(),
      });
    });

    // Procesar cada fila
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Validaciones
        if (!row.firstName) {
          result.errors.push({ row: rowNum, message: 'Nombre es obligatorio' });
          continue;
        }
        if (!row.lastName) {
          result.errors.push({ row: rowNum, message: 'Apellido es obligatorio' });
          continue;
        }
        if (!row.email) {
          result.errors.push({ row: rowNum, message: 'Correo es obligatorio' });
          continue;
        }
        if (!this.isValidEmail(row.email)) {
          result.errors.push({ row: rowNum, message: `Correo inválido: ${row.email}` });
          continue;
        }
        if (!row.role || !validRoles.includes(row.role)) {
          result.errors.push({
            row: rowNum,
            message: `Rol inválido: ${row.role}. Válidos: ${validRoles.join(', ')}`,
          });
          continue;
        }

        // Verificar si ya existe
        const existing = await this.prisma.user.findUnique({
          where: { email: row.email },
        });
        if (existing) {
          result.errors.push({ row: rowNum, message: `El correo ${row.email} ya está registrado` });
          continue;
        }

        // Obtener o crear rol
        let role = await this.prisma.role.findUnique({
          where: { name: row.role },
        });
        if (!role) {
          role = await this.prisma.role.create({
            data: { name: row.role },
          });
        }

        // Generar username con regla consistente y contraseña = documento
        const username = await this.generateUsernameWithRole(row.firstName, row.lastName, row.documentNumber, row.role);
        const initialPassword = row.documentNumber || 'temporal123';
        const passwordHash = await bcrypt.hash(initialPassword, 10);

        // Crear usuario
        const user = await this.prisma.user.create({
          data: {
            email: row.email,
            username,
            firstName: row.firstName,
            lastName: row.lastName,
            passwordHash,
            documentType: row.documentType as any,
            documentNumber: row.documentNumber,
            phone: row.phone,
            isActive: true,
            mustChangePassword: true,
            roles: {
              create: {
                roleId: role.id,
              },
            },
            institutionUsers: {
              create: {
                institutionId,
                isAdmin: false,
              },
            },
          } as any,
        });

        result.success++;
        result.created.push({
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        });
      } catch (error: any) {
        result.errors.push({
          row: rowNum,
          message: error.message || 'Error desconocido',
          data: row,
        });
      }
    }

    return result;
  }

  // Helpers
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  private async generateUsername(firstName: string, lastName: string): Promise<string> {
    const baseUsername = `${firstName.toLowerCase().charAt(0)}${lastName.toLowerCase().replace(/\s+/g, '')}`;
    const cleanUsername = baseUsername
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    let username = cleanUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${cleanUsername}${counter}`;
      counter++;
    }

    return username;
  }

  // Generar username con regla consistente: primeraLetra + apellido + 4digitos + letraRol
  private async generateUsernameWithRole(firstName: string, lastName: string, documentNumber?: string, roleName?: string): Promise<string> {
    const firstLetter = firstName.toLowerCase().charAt(0);
    const cleanLastName = lastName.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '');
    const last4Digits = (documentNumber || '0000').slice(-4);
    
    // Determinar letra del rol
    let roleLetter = 'u';
    if (roleName === 'DOCENTE') roleLetter = 'd';
    else if (roleName === 'ESTUDIANTE') roleLetter = 'e';
    else if (roleName === 'COORDINADOR') roleLetter = 'c';
    else if (roleName === 'SECRETARIA') roleLetter = 's';
    else if (roleName === 'ORIENTADOR') roleLetter = 'o';
    else if (roleName === 'BIBLIOTECARIO') roleLetter = 'b';
    else if (roleName === 'AUXILIAR') roleLetter = 'x';
    
    const baseUsername = `${firstLetter}${cleanLastName}${last4Digits}${roleLetter}`;

    let username = baseUsername;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }
}
