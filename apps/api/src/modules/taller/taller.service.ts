import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — núcleo del Sistema Operativo de Colaboración (Fase 1 del plan
// OS-first) + Motor Board (Fase 2, primer motor). Contratos:
// docs/OBJECT_SCHEMA_BIBLE.md · docs/EVENT_BIBLE.md · docs/PRODUCT_BIBLE_EXPEDICION.md
//
// Reglas de oro de este backend (aprendidas con sangre):
// - Todo request autenticado corre DENTRO de una transacción por-request (RLS).
//   NUNCA create()/upsert que pueda violar un unique: createMany + skipDuplicates
//   y ramificar por count. Un catch{} NO salva la transacción.
// - Nada desaparece: borrado suave (deletedAt). El log de eventos es append-only.
// - Escrituras de objetos con CAS por `version` (anti lost-update).
// ═══════════════════════════════════════════════════════════════════════════

type Ctx = { institutionId: string; userId: string };

// Colores canónicos de post-it (gramática visual de la Biblia).
const STICKY_COLORS = 5;

@Injectable()
export class TallerService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Permisos: miembro del equipo o docente dueño del proyecto ─────────────

  /** Resuelve el actor frente a un equipo del Aula: miembro (enrollmentId) o docente dueño. */
  private async resolveActor(teamId: string, ctx: Ctx): Promise<{ enrollmentId: string | null; name: string; role: 'student' | 'teacher' }> {
    const team = await this.prisma.abpTeam.findFirst({
      where: { id: teamId, institutionId: ctx.institutionId },
      include: {
        project: { select: { classroomId: true } },
        members: { include: { studentEnrollment: { include: { student: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } } } } } },
      },
    });
    if (!team) throw new NotFoundException('Equipo no encontrado');
    const m = team.members.find(x => x.studentEnrollment.student.userId === ctx.userId);
    if (m) {
      const u = m.studentEnrollment.student.user;
      return { enrollmentId: m.studentEnrollmentId, name: `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || 'Estudiante', role: 'student' };
    }
    // ¿docente dueño del aula del proyecto?
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: team.project.classroomId, institutionId: ctx.institutionId },
      select: { teacherAssignment: { select: { teacherId: true } } },
    });
    if (classroom?.teacherAssignment?.teacherId === ctx.userId) return { enrollmentId: null, name: 'Docente', role: 'teacher' };
    throw new ForbiddenException('No perteneces a este equipo');
  }

  // ─── Sistema de Eventos (append-only; nunca rompe el flujo) ────────────────

  private async emit(ctx: Ctx, e: {
    type: string; actorRole: string;
    teamId?: string | null; expeditionId?: string | null; instrumentId?: string | null;
    objectType?: string | null; objectId?: string | null; payload?: any;
  }) {
    await this.prisma.tallerEvent.create({
      data: {
        institutionId: ctx.institutionId,
        type: e.type,
        actorUserId: ctx.userId,
        actorRole: e.actorRole,
        teamId: e.teamId ?? null,
        expeditionId: e.expeditionId ?? null,
        instrumentId: e.instrumentId ?? null,
        objectType: e.objectType ?? null,
        objectId: e.objectId ?? null,
        payload: e.payload ?? {},
      },
    });
  }

  // ─── Instrumentos (Motor + Dinámica) ───────────────────────────────────────

  /** Devuelve el instrumento del equipo para (motor, dynamic, stationId), creándolo la
   * primera vez. Idempotente frente a carreras: re-consulta tras crear. */
  async resolveInstrument(ctx: Ctx, dto: { teamId: string; motor: string; dynamic?: string; stationId?: string; title?: string }) {
    const actor = await this.resolveActor(dto.teamId, ctx);
    const motor = String(dto.motor || 'BOARD').toUpperCase();
    const dynamic = dto.dynamic ? String(dto.dynamic).toUpperCase() : null;
    const stationId = dto.stationId ?? null;

    const where = { teamId: dto.teamId, institutionId: ctx.institutionId, motor, dynamic, stationId };
    let inst = await this.prisma.tallerInstrument.findFirst({ where });
    if (!inst) {
      const team = await this.prisma.abpTeam.findFirst({ where: { id: dto.teamId }, select: { projectId: true, project: { select: { classroomId: true } } } });
      inst = await this.prisma.tallerInstrument.create({
        data: {
          institutionId: ctx.institutionId,
          courseId: team?.project?.classroomId ?? null,
          expeditionId: team?.projectId ?? null,
          teamId: dto.teamId,
          stationId,
          motor, dynamic,
          title: (dto.title || '').trim() || (dynamic === 'BRAINSTORM' ? 'Tormenta de ideas' : motor),
        },
      });
      // carrera: si otro request creó a la vez, quédate con el más antiguo
      const canonical = await this.prisma.tallerInstrument.findFirst({ where, orderBy: { createdAt: 'asc' } });
      if (canonical && canonical.id !== inst.id) {
        await this.prisma.tallerInstrument.delete({ where: { id: inst.id } }).catch(() => {});
        inst = canonical;
      } else {
        await this.emit(ctx, { type: 'instrument.Created', actorRole: actor.role, teamId: dto.teamId, expeditionId: inst.expeditionId, instrumentId: inst.id, payload: { motor, dynamic } });
      }
    }
    return inst;
  }

  /** Estado completo de un instrumento: objetos vivos + relaciones + mis votos. */
  async getInstrumentState(ctx: Ctx, instrumentId: string) {
    const inst = await this.prisma.tallerInstrument.findFirst({ where: { id: instrumentId, institutionId: ctx.institutionId } });
    if (!inst) throw new NotFoundException('Instrumento no encontrado');
    const actor = inst.teamId ? await this.resolveActor(inst.teamId, ctx) : { enrollmentId: null, name: 'Docente', role: 'teacher' as const };

    const objects = await this.prisma.tallerObject.findMany({
      where: { instrumentId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const ids = objects.map(o => o.id);
    const relations = ids.length ? await this.prisma.tallerRelation.findMany({
      where: { institutionId: ctx.institutionId, OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] },
    }) : [];

    // votos: objetos Vote agrupados por target (relación 'vota')
    const votes = objects.filter(o => o.type === 'Vote');
    const voteRel = relations.filter(r => r.relType === 'vota');
    const votesByTarget = new Map<string, { count: number; mine: boolean }>();
    for (const r of voteRel) {
      const vote = votes.find(v => v.id === r.fromId);
      if (!vote) continue;
      const cur = votesByTarget.get(r.toId) || { count: 0, mine: false };
      cur.count += 1;
      if (actor.enrollmentId && vote.authorId === actor.enrollmentId) cur.mine = true;
      votesByTarget.set(r.toId, cur);
    }

    const comments = objects.filter(o => o.type === 'Comment');
    const commentRel = relations.filter(r => r.relType === 'responde-a');

    const items = objects
      .filter(o => o.type !== 'Vote' && o.type !== 'Comment')
      .map(o => ({
        ...o,
        votes: votesByTarget.get(o.id)?.count ?? 0,
        iVoted: votesByTarget.get(o.id)?.mine ?? false,
        comments: commentRel.filter(r => r.toId === o.id)
          .map(r => comments.find(c => c.id === r.fromId)).filter(Boolean)
          .sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime()),
      }));

    // Aristas del grafo entre objetos visibles (deriva-de, genera…), sin votos/comentarios.
    const itemIds = new Set(items.map(o => o.id));
    const edges = relations
      .filter(r => r.relType !== 'vota' && r.relType !== 'responde-a' && itemIds.has(r.fromId) && itemIds.has(r.toId))
      .map(r => ({ fromId: r.fromId, toId: r.toId, relType: r.relType }));

    return { instrument: inst, objects: items, edges, me: { enrollmentId: actor.enrollmentId, name: actor.name, role: actor.role } };
  }

  // ─── Objetos Universales ───────────────────────────────────────────────────

  /** Crea un objeto en un instrumento (post-it, idea, nota…). Si trae `parentId`,
   * lo cuelga del padre con la arista 'deriva-de' (Árbol de Ideas / motor Graph).
   * Emite object.Created. */
  async createObject(ctx: Ctx, instrumentId: string, dto: { type?: string; text?: string; colorId?: number; x?: number; y?: number; parentId?: string; date?: string }) {
    const inst = await this.prisma.tallerInstrument.findFirst({ where: { id: instrumentId, institutionId: ctx.institutionId } });
    if (!inst) throw new NotFoundException('Instrumento no encontrado');
    if (!inst.teamId) throw new BadRequestException('Instrumento sin equipo');
    const actor = await this.resolveActor(inst.teamId, ctx);
    const text = String(dto.text || '').trim();
    if (!text) throw new BadRequestException('El texto no puede estar vacío');

    // padre (opcional): debe ser un objeto vivo del MISMO instrumento
    let parent: { id: string } | null = null;
    if (dto.parentId) {
      parent = await this.prisma.tallerObject.findFirst({
        where: { id: dto.parentId, instrumentId, institutionId: ctx.institutionId, deletedAt: null }, select: { id: true },
      });
      if (!parent) throw new BadRequestException('La rama de la que cuelga ya no existe');
    }

    const validTypes = ['PostIt', 'Idea', 'Note', 'Question'];
    const obj = await this.prisma.tallerObject.create({
      data: {
        institutionId: ctx.institutionId,
        courseId: inst.courseId, expeditionId: inst.expeditionId, teamId: inst.teamId, stationId: inst.stationId,
        instrumentId,
        type: (validTypes.includes(dto.type || '') ? dto.type : 'PostIt') as any,
        authorId: actor.enrollmentId,
        authorName: actor.name,
        data: {
          text: text.slice(0, 500),
          colorId: Math.abs(Math.trunc(dto.colorId ?? 0)) % STICKY_COLORS,
          x: clampPos(dto.x), y: clampPos(dto.y),
          ...(cleanDate(dto.date) ? { date: cleanDate(dto.date) } : {}),
        },
      },
    });
    if (parent) await this.link(ctx, inst.teamId, obj.id, parent.id, 'deriva-de');
    await this.emit(ctx, {
      type: 'object.Created', actorRole: actor.role,
      teamId: inst.teamId, expeditionId: inst.expeditionId, instrumentId,
      objectType: obj.type, objectId: obj.id, payload: { text: text.slice(0, 120), parentId: parent?.id ?? null },
    });
    return obj;
  }

  /** Actualiza texto/posición/color con CAS por versión. version=-1 omite el chequeo
   * (drag: la posición del último drop gana). Emite object.Updated (con throttle
   * implícito: el front solo llama al soltar/confirmar, no por pixel). */
  async updateObject(ctx: Ctx, objectId: string, dto: { text?: string; colorId?: number; x?: number; y?: number; version?: number; date?: string }) {
    const obj = await this.prisma.tallerObject.findFirst({ where: { id: objectId, institutionId: ctx.institutionId, deletedAt: null } });
    if (!obj) throw new NotFoundException('Objeto no encontrado');
    if (!obj.teamId) throw new BadRequestException('Objeto sin equipo');
    const actor = await this.resolveActor(obj.teamId, ctx);
    // permisos: el autor edita su texto; cualquiera del equipo puede mover; docente todo
    const editingText = dto.text !== undefined;
    if (editingText && actor.role === 'student' && obj.authorId && obj.authorId !== actor.enrollmentId) {
      throw new ForbiddenException('Solo el autor puede editar el texto');
    }

    const data: any = { ...(obj.data as any) };
    if (dto.text !== undefined) {
      const t = String(dto.text).trim();
      if (!t) throw new BadRequestException('El texto no puede estar vacío');
      data.text = t.slice(0, 500);
    }
    if (dto.colorId !== undefined) data.colorId = Math.abs(Math.trunc(dto.colorId)) % STICKY_COLORS;
    if (dto.x !== undefined) data.x = clampPos(dto.x);
    if (dto.y !== undefined) data.y = clampPos(dto.y);
    if (dto.date !== undefined) { const d = cleanDate(dto.date); if (d) data.date = d; }

    const expected = dto.version ?? -1;
    const res = await this.prisma.tallerObject.updateMany({
      where: expected >= 0 ? { id: objectId, version: expected } : { id: objectId },
      data: { data, version: { increment: 1 } },
    });
    if (res.count === 0) throw new BadRequestException('CONFLICTO: el objeto cambió, recarga');
    if (editingText) {
      await this.emit(ctx, {
        type: 'object.Updated', actorRole: actor.role,
        teamId: obj.teamId, expeditionId: obj.expeditionId, instrumentId: obj.instrumentId,
        objectType: obj.type, objectId, payload: { text: data.text?.slice(0, 120) },
      });
    }
    return this.prisma.tallerObject.findUnique({ where: { id: objectId } });
  }

  /** Borrado SUAVE (nada desaparece). Autor o docente. Emite object.Deleted. */
  async deleteObject(ctx: Ctx, objectId: string) {
    const obj = await this.prisma.tallerObject.findFirst({ where: { id: objectId, institutionId: ctx.institutionId, deletedAt: null } });
    if (!obj) throw new NotFoundException('Objeto no encontrado');
    if (!obj.teamId) throw new BadRequestException('Objeto sin equipo');
    const actor = await this.resolveActor(obj.teamId, ctx);
    if (actor.role === 'student' && obj.authorId !== actor.enrollmentId) {
      throw new ForbiddenException('Solo el autor (o el docente) puede eliminarlo');
    }
    await this.prisma.tallerObject.update({ where: { id: objectId }, data: { deletedAt: new Date() } });
    await this.emit(ctx, {
      type: 'object.Deleted', actorRole: actor.role,
      teamId: obj.teamId, expeditionId: obj.expeditionId, instrumentId: obj.instrumentId,
      objectType: obj.type, objectId,
    });
    return { ok: true };
  }

  // ─── Grafo: relaciones ─────────────────────────────────────────────────────

  /** Crea una arista tipada (idempotente vía unique(from,to,type) + skipDuplicates). */
  private async link(ctx: Ctx, teamId: string | null, fromId: string, toId: string, relType: string): Promise<boolean> {
    const r = await this.prisma.tallerRelation.createMany({
      data: [{ institutionId: ctx.institutionId, teamId, fromId, toId, relType }],
      skipDuplicates: true,
    });
    return r.count > 0;
  }

  // ─── Votos (objeto Vote + arista 'vota') ───────────────────────────────────

  /** Vota/des-vota un objeto. El voto ES un objeto (Vote) + relación 'vota' → target.
   * Idempotente por (autor, target): re-votar quita el voto (toggle). */
  async toggleVote(ctx: Ctx, targetId: string) {
    const target = await this.prisma.tallerObject.findFirst({ where: { id: targetId, institutionId: ctx.institutionId, deletedAt: null } });
    if (!target) throw new NotFoundException('Objeto no encontrado');
    if (!target.teamId) throw new BadRequestException('Objeto sin equipo');
    const actor = await this.resolveActor(target.teamId, ctx);
    if (!actor.enrollmentId) throw new ForbiddenException('Solo los integrantes votan');
    if (target.authorId === actor.enrollmentId) throw new BadRequestException('No puedes votar tu propio aporte');

    // ¿ya voté? (mi objeto Vote relacionado con el target)
    const myVotes = await this.prisma.tallerObject.findMany({
      where: { institutionId: ctx.institutionId, type: 'Vote', authorId: actor.enrollmentId, teamId: target.teamId, deletedAt: null },
      select: { id: true },
    });
    const rel = myVotes.length ? await this.prisma.tallerRelation.findFirst({
      where: { toId: targetId, relType: 'vota', fromId: { in: myVotes.map(v => v.id) } },
    }) : null;

    if (rel) {
      // des-votar: borrado suave del Vote + quitar la arista
      await this.prisma.tallerObject.update({ where: { id: rel.fromId }, data: { deletedAt: new Date() } });
      await this.prisma.tallerRelation.delete({ where: { id: rel.id } });
      await this.emit(ctx, { type: 'vote.Removed', actorRole: actor.role, teamId: target.teamId, expeditionId: target.expeditionId, instrumentId: target.instrumentId, objectType: target.type, objectId: targetId });
      return { voted: false };
    }
    const vote = await this.prisma.tallerObject.create({
      data: {
        institutionId: ctx.institutionId,
        courseId: target.courseId, expeditionId: target.expeditionId, teamId: target.teamId, stationId: target.stationId,
        instrumentId: target.instrumentId,
        type: 'Vote', authorId: actor.enrollmentId, authorName: actor.name, data: { targetId },
      },
    });
    await this.link(ctx, target.teamId, vote.id, targetId, 'vota');
    await this.emit(ctx, { type: 'vote.Cast', actorRole: actor.role, teamId: target.teamId, expeditionId: target.expeditionId, instrumentId: target.instrumentId, objectType: target.type, objectId: targetId });
    return { voted: true };
  }

  // ─── Comentarios (objeto Comment + arista 'responde-a') ────────────────────

  async addComment(ctx: Ctx, targetId: string, text: string) {
    const t = String(text || '').trim();
    if (!t) throw new BadRequestException('El comentario no puede estar vacío');
    const target = await this.prisma.tallerObject.findFirst({ where: { id: targetId, institutionId: ctx.institutionId, deletedAt: null } });
    if (!target) throw new NotFoundException('Objeto no encontrado');
    if (!target.teamId) throw new BadRequestException('Objeto sin equipo');
    const actor = await this.resolveActor(target.teamId, ctx);

    const comment = await this.prisma.tallerObject.create({
      data: {
        institutionId: ctx.institutionId,
        courseId: target.courseId, expeditionId: target.expeditionId, teamId: target.teamId, stationId: target.stationId,
        instrumentId: target.instrumentId,
        type: 'Comment', authorId: actor.enrollmentId, authorName: actor.name, data: { text: t.slice(0, 400), targetId },
      },
    });
    await this.link(ctx, target.teamId, comment.id, targetId, 'responde-a');
    await this.emit(ctx, { type: 'comment.Added', actorRole: actor.role, teamId: target.teamId, expeditionId: target.expeditionId, instrumentId: target.instrumentId, objectType: target.type, objectId: targetId, payload: { text: t.slice(0, 120) } });
    return comment;
  }

  // ─── Timeline (la memoria narrativa del equipo) ────────────────────────────

  async teamTimeline(ctx: Ctx, teamId: string, limit = 50) {
    await this.resolveActor(teamId, ctx);
    return this.prisma.tallerEvent.findMany({
      where: { institutionId: ctx.institutionId, teamId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }
}

function clampPos(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(10000, Math.round(n)));
}

/** Fecha "YYYY-MM-DD" válida o null (para la Línea de Tiempo y afines). */
function cleanDate(v: any): string | null {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return Number.isNaN(new Date(s + 'T00:00:00Z').getTime()) ? null : s;
}
