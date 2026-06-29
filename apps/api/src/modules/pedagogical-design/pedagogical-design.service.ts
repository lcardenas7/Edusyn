import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApdAiService } from '../apd/ai/apd-ai.service';
import { GenerateDesignDto, UpdateDesignDto } from './dto/pedagogical-design.dto';
import { PedagogicalExperienceType, Prisma } from '@prisma/client';

const EXPERIENCE_TYPES = new Set<string>([
  'LESSON_PLAN', 'SEQUENCE', 'PBL', 'STEAM', 'FLIPPED', 'CHALLENGE',
  'WORKSHOP', 'LAB', 'EVALUATION', 'INTERACTIVE_LESSON', 'UNIT',
]);

/**
 * Diseño Pedagógico IA ("Estudio") — E1.
 * Genera un Activo Pedagógico Vivo estructurado vía la IA (Valeria), lo guarda
 * en el curso del docente con su ADN, y permite listarlo, verlo, editarlo y borrarlo.
 * No toca el core académico.
 */
@Injectable()
export class PedagogicalDesignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: ApdAiService,
  ) {}

  private coerceType(t?: string): PedagogicalExperienceType {
    const up = (t || '').toUpperCase();
    return (EXPERIENCE_TYPES.has(up) ? up : 'LESSON_PLAN') as PedagogicalExperienceType;
  }

  private deriveTitle(prompt: string, content: any): string {
    const fromContent = content?.identification?.subject || content?.dna?.topic;
    if (fromContent && String(fromContent).trim()) return String(fromContent).trim().slice(0, 200);
    const cleaned = (prompt || '')
      .replace(/^necesito\s+(un|una)?\s*(plan|gu[ií]a|secuencia|proyecto|unidad|taller)\s*(de\s*clase[s]?)?\s*(sobre|de|del|para)?\s*/i, '')
      .trim();
    return (cleaned || prompt || 'Diseño pedagógico').slice(0, 200);
  }

  // ── Generar (idea → activo guardado en borrador) ──────────────────────────
  async generate(teacherId: string, institutionId: string, dto: GenerateDesignDto) {
    // Si hay board, valida que sea del docente y toma su contexto
    let gradeName = dto.gradeName;
    let subjectName = dto.subjectName;
    if (dto.boardId) {
      const board = await this.prisma.workspaceBoard.findFirst({
        where: { id: dto.boardId, teacherId, institutionId },
        include: { group: { select: { name: true, grade: { select: { name: true } } } } },
      });
      if (!board) throw new ForbiddenException('Curso no encontrado');
      if (!gradeName && board.group?.grade?.name) {
        gradeName = [board.group.grade.name, board.group.name].filter(Boolean).join(' ');
      }
    }

    const ai = await this.ai.generatePedagogicalDesign({
      prompt: dto.prompt,
      experienceType: this.coerceType(dto.experienceType),
      gradeName,
      subjectName,
      sessions: dto.sessions,
    });

    const title = this.deriveTitle(dto.prompt, { ...ai.content, dna: ai.dna });

    const design = await this.prisma.pedagogicalDesign.create({
      data: {
        teacherId,
        institutionId,
        boardId: dto.boardId || null,
        experienceType: this.coerceType(dto.experienceType),
        title,
        summary: ai.content?.learning?.objectives?.[0] ?? null,
        status: 'DRAFT',
        dna: ai.dna ?? Prisma.JsonNull,
        aiProviderUsed: ai.provider,
        aiModelUsed: ai.model,
        currentVersionNumber: 1,
        versions: {
          create: {
            versionNumber: 1,
            content: ai.content ?? {},
            createdByAi: true,
            changeNote: 'Generado por Valeria',
          },
        },
      },
    });

    return this.getOne(design.id, teacherId, institutionId);
  }

  // ── Listar ────────────────────────────────────────────────────────────────
  async list(teacherId: string, institutionId: string, boardId?: string) {
    return this.prisma.pedagogicalDesign.findMany({
      where: { teacherId, institutionId, isArchived: false, ...(boardId ? { boardId } : {}) },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, title: true, summary: true, experienceType: true, status: true,
        boardId: true, dna: true, currentVersionNumber: true, updatedAt: true, createdAt: true,
      },
    });
  }

  // ── Ver uno (con el contenido de la versión actual) ────────────────────────
  async getOne(id: string, teacherId: string, institutionId: string) {
    const design = await this.prisma.pedagogicalDesign.findUnique({ where: { id } });
    if (!design || design.isArchived) throw new NotFoundException('Diseño no encontrado');
    if (design.teacherId !== teacherId || design.institutionId !== institutionId) {
      throw new ForbiddenException('No tienes acceso a este diseño');
    }
    const version = await this.prisma.pedagogicalDesignVersion.findFirst({
      where: { designId: id, versionNumber: design.currentVersionNumber },
    });
    return { ...design, content: version?.content ?? {} };
  }

  private async loadOwned(id: string, teacherId: string, institutionId: string) {
    const design = await this.prisma.pedagogicalDesign.findUnique({ where: { id } });
    if (!design) throw new NotFoundException('Diseño no encontrado');
    if (design.teacherId !== teacherId || design.institutionId !== institutionId) {
      throw new ForbiddenException('No tienes acceso a este diseño');
    }
    return design;
  }

  // ── Editar (metadatos y/o contenido de la versión actual) ──────────────────
  async update(id: string, teacherId: string, institutionId: string, dto: UpdateDesignDto) {
    const design = await this.loadOwned(id, teacherId, institutionId);

    if (dto.content !== undefined) {
      await this.prisma.pedagogicalDesignVersion.updateMany({
        where: { designId: id, versionNumber: design.currentVersionNumber },
        data: { content: dto.content },
      });
    }

    await this.prisma.pedagogicalDesign.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.experienceType !== undefined && { experienceType: this.coerceType(dto.experienceType) }),
        ...(dto.dna !== undefined && { dna: dto.dna ?? Prisma.JsonNull }),
      },
    });

    return this.getOne(id, teacherId, institutionId);
  }

  // ── Eliminar (borra el diseño y sus versiones) ─────────────────────────────
  async remove(id: string, teacherId: string, institutionId: string) {
    await this.loadOwned(id, teacherId, institutionId);
    await this.prisma.pedagogicalDesign.delete({ where: { id } });
    return { deleted: true };
  }
}
