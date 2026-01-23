import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentDocType, DocumentStatus } from '@prisma/client';

export class CreateDocumentDto {
  studentId: string;
  type: EnrollmentDocType;
  name: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  observations?: string;
  expirationDate?: string;
}

export class UpdateDocumentDto {
  name?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  observations?: string;
  expirationDate?: string;
}

export class ValidateDocumentDto {
  documentId: string;
  status: 'VALIDATED' | 'REJECTED';
  rejectionReason?: string;
  validatedById: string;
}

@Injectable()
export class StudentDocumentsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  async create(dto: CreateDocumentDto) {
    // Verificar que el estudiante existe
    const student = await this.prisma.student.findUnique({
      where: { id: dto.studentId },
    });

    if (!student) {
      throw new NotFoundException('Estudiante no encontrado');
    }

    // Verificar si ya existe un documento del mismo tipo
    const existingDoc = await this.prisma.studentDocument.findFirst({
      where: {
        studentId: dto.studentId,
        type: dto.type,
      },
    });

    if (existingDoc) {
      throw new BadRequestException(
        `Ya existe un documento de tipo ${dto.type} para este estudiante`
      );
    }

    return this.prisma.studentDocument.create({
      data: {
        studentId: dto.studentId,
        type: dto.type,
        name: dto.name,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        status: dto.fileUrl ? 'DELIVERED' : 'PENDING',
        observations: dto.observations,
        expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : null,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentNumber: true,
          },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  async update(documentId: string, dto: UpdateDocumentDto) {
    const document = await this.prisma.studentDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    // Si se sube archivo, cambiar estado a DELIVERED
    const newStatus = dto.fileUrl && !document.fileUrl ? 'DELIVERED' : undefined;

    return this.prisma.studentDocument.update({
      where: { id: documentId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.fileUrl && { fileUrl: dto.fileUrl }),
        ...(dto.fileName && { fileName: dto.fileName }),
        ...(dto.fileSize && { fileSize: dto.fileSize }),
        ...(dto.mimeType && { mimeType: dto.mimeType }),
        ...(dto.observations !== undefined && { observations: dto.observations }),
        ...(dto.expirationDate && { expirationDate: new Date(dto.expirationDate) }),
        ...(newStatus && { status: newStatus }),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentNumber: true,
          },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAR O RECHAZAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  async validate(dto: ValidateDocumentDto) {
    const document = await this.prisma.studentDocument.findUnique({
      where: { id: dto.documentId },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    if (document.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Solo se pueden validar documentos en estado DELIVERED'
      );
    }

    if (dto.status === 'REJECTED' && !dto.rejectionReason) {
      throw new BadRequestException(
        'Debe proporcionar un motivo de rechazo'
      );
    }

    return this.prisma.studentDocument.update({
      where: { id: dto.documentId },
      data: {
        status: dto.status,
        validatedById: dto.validatedById,
        validatedAt: new Date(),
        rejectionReason: dto.status === 'REJECTED' ? dto.rejectionReason : null,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            documentNumber: true,
          },
        },
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER DOCUMENTOS DE UN ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  async getByStudent(studentId: string) {
    return this.prisma.studentDocument.findMany({
      where: { studentId },
      include: {
        validatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { type: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER CHECKLIST DE DOCUMENTOS
  // ═══════════════════════════════════════════════════════════════════════════

  async getDocumentChecklist(studentId: string) {
    // Lista de documentos requeridos
    const requiredDocs: EnrollmentDocType[] = [
      'REGISTRO_CIVIL',
      'TARJETA_IDENTIDAD',
      'FOTO',
      'EPS',
      'CERTIFICADO_ESTUDIO',
    ];

    const existingDocs = await this.prisma.studentDocument.findMany({
      where: { studentId },
    });

    const docMap = new Map(existingDocs.map(d => [d.type, d]));

    return requiredDocs.map(type => {
      const doc = docMap.get(type);
      return {
        type,
        typeName: this.getDocTypeName(type),
        required: true,
        document: doc || null,
        status: doc?.status || 'PENDING',
        isComplete: doc?.status === 'VALIDATED',
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS DE DOCUMENTOS POR INSTITUCIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async getDocumentStats(institutionId: string) {
    const stats = await this.prisma.studentDocument.groupBy({
      by: ['status'],
      where: {
        student: { institutionId },
      },
      _count: true,
    });

    const total = await this.prisma.studentDocument.count({
      where: {
        student: { institutionId },
      },
    });

    return {
      total,
      byStatus: stats.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ELIMINAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  async delete(documentId: string) {
    const document = await this.prisma.studentDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    return this.prisma.studentDocument.delete({
      where: { id: documentId },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER: NOMBRE DEL TIPO DE DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  private getDocTypeName(type: EnrollmentDocType): string {
    const names: Record<EnrollmentDocType, string> = {
      REGISTRO_CIVIL: 'Registro Civil',
      TARJETA_IDENTIDAD: 'Tarjeta de Identidad',
      CEDULA: 'Cédula de Ciudadanía',
      FOTO: 'Fotografía',
      BOLETIN_ANTERIOR: 'Boletín Año Anterior',
      CERTIFICADO_ESTUDIO: 'Certificado de Estudios',
      CERTIFICADO_CONDUCTA: 'Certificado de Conducta',
      EPS: 'Carnet EPS',
      SISBEN: 'Certificado SISBEN',
      CARNET_VACUNACION: 'Carnet de Vacunación',
      PAZ_Y_SALVO: 'Paz y Salvo',
      OTRO: 'Otro Documento',
    };
    return names[type] || type;
  }
}
