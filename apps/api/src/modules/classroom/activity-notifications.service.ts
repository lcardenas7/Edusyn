import { Injectable, Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Avisos de actividad nueva.
 *
 * Antes, publicar una actividad no le decía nada a nadie: el estudiante tenía que entrar al aula
 * y mirar si había algo nuevo. Ahora, al publicarse, a cada estudiante del aula le llega un aviso
 * a la misma campana donde ya recibe las circulares del colegio, y ese aviso lleva DIRECTO a la
 * actividad (`link`), sin pasar por el aula a buscarla.
 *
 * Vive aparte de `classroom.service.ts` a propósito: ese fichero tiene 3.400 líneas y lo está
 * blindando otro frente. Aquí solo se añade el aviso; publicar sigue siendo cosa suya.
 *
 * DOS REGLAS QUE NO SE PUEDEN SALTAR, y que costaron una publicación perdida al escribir esto:
 *
 * 1. **Fuera de la transacción de la petición.** `TenantContextInterceptor` mete TODA la petición
 *    dentro de una transacción interactiva. Un error de base de datos aquí —aunque se capture en
 *    JavaScript— deja esa transacción abortada en PostgreSQL, y al terminar se revierte entera:
 *    la actividad se quedaba SIN PUBLICAR por culpa de un aviso que ni siquiera hacía falta. Por
 *    eso se usa `$raw` (el cliente sin el proxy de contexto) y se difiere con `setImmediate`.
 * 2. **Nada que pueda violar una restricción única.** `sourceKey` es único a propósito, así que
 *    el mensaje se inserta con `createMany({ skipDuplicates: true })`, que no lanza. Ver la nota
 *    del proyecto sobre `create()` sobre un `@unique` dentro de una transacción.
 */
@Injectable()
export class ActivityNotificationsService {
  private readonly logger = new Logger(ActivityNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * El cliente SIN el proxy de contexto: así estas escrituras no entran en la transacción de la
   * petición y no pueden tumbarla. Ninguna de las tablas que toca tiene RLS.
   */
  private get db(): PrismaClient {
    return (this.prisma as unknown as { $raw?: PrismaClient }).$raw ?? (this.prisma as unknown as PrismaClient);
  }

  /**
   * Avisa cuando la petición ya terminó. Publicar no espera al aviso, y sobre todo: si el aviso
   * falla, la actividad se queda publicada igual.
   */
  programar(activityId: string): void {
    setImmediate(() => {
      void this.avisarActividadPublicada(activityId);
    });
  }

  /**
   * Lo que ve el estudiante como tipo de actividad, ya concordado: "Tarea nueva" pero "Quiz
   * nuevo". Con una sola etiqueta y un "nueva" pegado detrás salía "Quiz nueva".
   */
  private static readonly TIPO: Record<string, string> = {
    TASK: 'Tarea nueva',
    QUIZ: 'Quiz nuevo',
    FORUM: 'Foro nuevo',
    GAME: 'Juego nuevo',
    EXAM: 'Examen nuevo',
    LIVE_QUIZ: 'Quiz en vivo nuevo',
    HOME_QUIZ: 'Quiz en casa nuevo',
    ICFES_SIMULATOR: 'Simulacro ICFES nuevo',
    SELF_ASSESSMENT: 'Autoevaluación nueva',
    PEER_ASSESSMENT: 'Coevaluación nueva',
    LESSON: 'Lección nueva',
  };

  /** Clave del hecho, para no avisar dos veces de la misma actividad. */
  static claveDe(activityId: string): string {
    return `actividad:${activityId}:publicada`;
  }

  /** A dónde lleva el aviso: la actividad abierta, no el aula. */
  static enlaceDe(classroomId: string, activityId: string): string {
    return `/aula/${classroomId}/actividades/${activityId}`;
  }

  /**
   * Avisa a los estudiantes del aula. Devuelve a cuántos se avisó.
   *
   * Nunca lanza: publicar una actividad no puede fallar porque el aviso falle. Si algo sale mal
   * queda en el log y la actividad se publica igual.
   */
  async avisarActividadPublicada(activityId: string): Promise<number> {
    try {
      return await this.emitir(activityId);
    } catch (error) {
      this.logger.error(`No se pudo avisar de la actividad ${activityId}`, error as Error);
      return 0;
    }
  }

  /** Avisa de varias a la vez (publicación programada). */
  async avisarVarias(activityIds: string[]): Promise<number> {
    let total = 0;
    for (const id of activityIds) total += await this.avisarActividadPublicada(id);
    return total;
  }

  private async emitir(activityId: string): Promise<number> {
    const actividad = await this.db.classroomActivity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        title: true,
        type: true,
        dueDate: true,
        isPublished: true,
        isVisible: true,
        isRouteScoped: true,
        isRestrictedToAssigned: true,
        classroomId: true,
        assignedStudents: { select: { studentEnrollmentId: true } },
        classroom: {
          select: {
            institutionId: true,
            isPersonal: true,
            teacherAssignmentId: true,
            teacherAssignment: {
              select: {
                id: true,
                institutionId: true,
                teacherId: true,
                groupId: true,
                academicYearId: true,
                academicYear: { select: { institutionId: true } },
                group: { select: {
                  campus: { select: { institutionId: true } },
                  grade: { select: { institutionId: true } },
                } },
                subject: { select: { name: true, area: { select: { institutionId: true } } } },
              },
            },
          },
        },
      },
    });

    // Un borrador, una actividad escondida o una que vive dentro de una ruta no se anuncian:
    // el estudiante no puede abrirlas desde la pestaña Actividades.
    if (!actividad?.isPublished || !actividad.isVisible || actividad.isRouteScoped) return 0;

    const colegio = actividad.classroom;
    const asignacion = colegio?.teacherAssignment;
    const institutionId = colegio?.institutionId;
    // $raw no aplica el contexto del actor: la cadena completa debe acreditarse aquí antes de
    // buscar usuarios o crear un Message. Un id de grupo/año no prueba por sí solo el colegio.
    if (!institutionId || colegio.isPersonal || !asignacion ||
      colegio.teacherAssignmentId !== asignacion.id ||
      asignacion.institutionId !== institutionId ||
      asignacion.academicYear.institutionId !== institutionId ||
      asignacion.group.campus.institutionId !== institutionId ||
      asignacion.group.grade.institutionId !== institutionId ||
      asignacion.subject.area.institutionId !== institutionId) return 0;
    const soloAsignados = actividad.isRestrictedToAssigned
      ? actividad.assignedStudents.map((a) => a.studentEnrollmentId)
      : null;
    // Una actividad restringida sin nadie asignado no es para nadie.
    if (soloAsignados && soloAsignados.length === 0) return 0;

    const matriculas = await this.db.studentEnrollment.findMany({
      where: {
        institutionId,
        groupId: asignacion.groupId,
        academicYearId: asignacion.academicYearId,
        status: 'ACTIVE',
        student: { institutionId },
        academicYear: { institutionId },
        group: { campus: { institutionId }, grade: { institutionId } },
        ...(soloAsignados ? { id: { in: soloAsignados } } : {}),
      },
      select: { student: { select: { userId: true } } },
    });

    // Sin usuario no hay a quién avisar: hay estudiantes registrados que aún no entran al sistema.
    const usuarios = [...new Set(matriculas.map((m) => m.student.userId).filter((u): u is string => !!u))];
    if (usuarios.length === 0) return 0;

    const asignatura = asignacion.subject?.name?.trim() || 'Tu aula';
    const tipo = ActivityNotificationsService.TIPO[actividad.type] ?? 'Actividad nueva';
    const entrega = this.fechaLegible(actividad.dueDate);
    const sourceKey = ActivityNotificationsService.claveDe(actividad.id);

    // `skipDuplicates` en vez de `create`: si ya se avisó de esta actividad —el docente la
    // despublicó y la volvió a publicar— esto no hace nada y, sobre todo, no lanza.
    await this.db.message.createMany({
      data: [{
        institutionId,
        authorId: asignacion.teacherId,
        type: 'NOTIFICATION',
        subject: `${asignatura}: ${actividad.title}`,
        content: entrega ? `${tipo}. Entrega hasta el ${entrega}.` : `${tipo}, sin fecha de entrega.`,
        status: 'SENT',
        sentAt: new Date(),
        link: ActivityNotificationsService.enlaceDe(actividad.classroomId, actividad.id),
        origin: 'actividad-publicada',
        sourceKey,
      }],
      skipDuplicates: true,
    });

    const mensaje = await this.db.message.findUnique({ where: { sourceKey }, select: { id: true } });
    if (!mensaje) return 0;

    // Si ya tiene destinatarios, este aviso ya salió. Y si quedó a medias —el mensaje se creó
    // pero los destinatarios no—, el siguiente intento lo termina.
    const yaEnviado = await this.db.messageRecipient.count({ where: { messageId: mensaje.id } });
    if (yaEnviado > 0) return 0;

    await this.db.messageRecipient.createMany({
      data: usuarios.map((userId) => ({
        messageId: mensaje.id,
        recipientType: 'USER' as const,
        recipientId: userId,
      })),
    });

    return usuarios.length;
  }

  /** "viernes, 26 de septiembre" en hora de Colombia, no en la del servidor. */
  private fechaLegible(fecha: Date | null): string | null {
    if (!fecha) return null;
    return fecha.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
