import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClassroomActor } from '../classroom/classroom-tenant-access.service';
import { MathEventsService } from './math-events.service';

@Controller('math-events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MathEventsController {
  constructor(
    private readonly service: MathEventsService,
    private readonly prisma: PrismaService,
  ) {}
  private async actor(req: any): Promise<ClassroomActor> {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const raw = req.user?.roles;
    const roles = Array.isArray(raw)
      ? raw
          .map((x: any) =>
            typeof x === 'string' ? x : x?.role?.name || x?.name,
          )
          .filter(Boolean)
      : [];
    return {
      userId: req.user.id,
      institutionId,
      roles,
      isSuperAdmin: req.user?.isSuperAdmin === true,
    };
  }
  @Get('active') @Roles('ESTUDIANTE') active(@Request() r: any) {
    return this.actor(r).then((a) => this.service.active(a));
  }
  @Get('history') @Roles('ESTUDIANTE') history(@Request() r: any) {
    return this.actor(r).then((a) => this.service.history(a));
  }
  @Get('banks')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  banks(@Request() r: any) {
    return this.actor(r).then((a) => this.service.listMathBanks(a));
  }
  @Get('manage')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  manage(@Request() r: any) {
    return this.actor(r).then(a => this.service.manageEvents(a));
  }
  @Get(':eventId/report')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  report(@Param('eventId') id: string, @Request() r: any) {
    return this.actor(r).then(a => this.service.eventReport(a, id));
  }
  @Get(':eventId/live')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  live(@Param('eventId') id: string, @Request() r: any) {
    return this.actor(r).then(a => this.service.liveReport(a, id));
  }
  @Post(':eventId/access-check')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  accessCheck(@Param('eventId') id: string, @Body() b: any, @Request() r: any) {
    return this.actor(r).then(a => this.service.checkStudentAccess(a, id, b?.username));
  }
  @Post()
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  create(@Body() b: any, @Request() r: any) {
    return this.actor(r).then((a) => this.service.createEvent(a, b));
  }
  @Post(':eventId/banks/import')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  import(@Param('eventId') id: string, @Body() b: any, @Request() r: any) {
    return this.actor(r).then((a) =>
      this.service.importBanks(a, id, b?.collectionIds),
    );
  }
  @Post(':eventId/catalog/import')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  importEditorialCatalog(@Param('eventId') id: string, @Request() r: any) {
    return this.actor(r).then((a) =>
      this.service.importEditorialCatalog(a, id),
    );
  }
  @Get(':eventId/settings')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  settings(@Param('eventId') id: string, @Request() r: any) {
    return this.actor(r).then(a => this.service.eventSettings(a, id));
  }
  @Put(':eventId/settings')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  updateSettings(@Param('eventId') id: string, @Body() b: any, @Request() r: any) {
    return this.actor(r).then(a => this.service.updateSettings(a, id, b));
  }
  @Put(':eventId/reactions') @Roles('ESTUDIANTE')
  react(@Param('eventId') id: string, @Body() b: any, @Request() r: any) {
    return this.actor(r).then(a => this.service.react(a, id, b?.recipientEnrollmentId, b?.kind));
  }
  @Get(':eventId/recognitions') @Roles('ESTUDIANTE')
  recognitions(@Param('eventId') id: string, @Query('recipientIds') ids: string, @Request() r: any) {
    return this.actor(r).then(a => this.service.recognitions(a, id, ids));
  }
  @Post(':eventId/publish')
  @Roles('DOCENTE', 'COORDINADOR', 'RECTOR', 'ADMIN_INSTITUTIONAL')
  publish(@Param('eventId') id: string, @Request() r: any) {
    return this.actor(r).then((a) => this.service.publish(a, id));
  }
  @Post(':eventId/join') @Roles('ESTUDIANTE') join(
    @Param('eventId') id: string,
    @Body() b: any,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.join(a, id, b?.avatarCode));
  }
  @Get(':eventId') @Roles('ESTUDIANTE') dashboard(
    @Param('eventId') id: string,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.dashboard(a, id));
  }
  @Put(':eventId/presence') @Roles('ESTUDIANTE') presence(
    @Param('eventId') id: string,
    @Body() b: any,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) =>
      this.service.presence(a, id, b?.available === true, b?.online !== false),
    );
  }
  @Put(':eventId/avatar') @Roles('ESTUDIANTE') avatar(
    @Param('eventId') id: string,
    @Body() b: any,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.avatar(a, id, b?.avatarCode));
  }
  @Get(':eventId/push/config') @Roles('ESTUDIANTE') pushConfig(
    @Param('eventId') id: string,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.pushConfig(a, id));
  }
  @Post(':eventId/push/subscription') @Roles('ESTUDIANTE') savePushSubscription(
    @Param('eventId') id: string,
    @Body() b: any,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) =>
      this.service.savePushSubscription(a, id, b),
    );
  }
  @Delete(':eventId/push/subscription')
  @Roles('ESTUDIANTE')
  removePushSubscription(
    @Param('eventId') id: string,
    @Body() b: any,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) =>
      this.service.removePushSubscription(a, id, b?.endpoint),
    );
  }
  @Post(':eventId/matchmake') @Roles('ESTUDIANTE') matchmake(
    @Param('eventId') id: string,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.matchmake(a, id));
  }
  @Post(':eventId/challenges') @Roles('ESTUDIANTE') challenge(
    @Param('eventId') id: string,
    @Body() b: any,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) =>
      this.service.challenge(a, id, b?.opponentEnrollmentId, 'DIRECT'),
    );
  }
  @Post(':duelId/accept') @Roles('ESTUDIANTE') accept(
    @Param('duelId') id: string,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.respond(a, id, true));
  }
  @Post(':duelId/decline') @Roles('ESTUDIANTE') decline(
    @Param('duelId') id: string,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.respond(a, id, false));
  }
  @Post(':duelId/cancel') @Roles('ESTUDIANTE') cancel(
    @Param('duelId') id: string,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.cancelChallenge(a, id));
  }
  @Get('duels/:duelId') @Roles('ESTUDIANTE') duel(
    @Param('duelId') id: string,
    @Query('deferClock') deferClock: string,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) => this.service.getDuel(a, id, deferClock === 'true'));
  }
  @Post('duels/:duelId/question/start') @Roles('ESTUDIANTE') startQuestion(
    @Param('duelId') id: string, @Body() b: any, @Request() r: any,
  ) { return this.actor(r).then(a => this.service.startQuestion(a, id, b?.ordinal)); }
  @Post('duels/:duelId/leave') @Roles('ESTUDIANTE') leaveDuel(
    @Param('duelId') id: string, @Request() r: any,
  ) { return this.actor(r).then(a => this.service.leaveDuel(a, id)); }
  @Get('duels/:duelId/state') @Roles('ESTUDIANTE')
  duelState(@Param('duelId') id: string, @Request() r: any) {
    return this.actor(r).then(a => this.service.duelState(a, id));
  }
  @Post('duels/:duelId/answers') @Roles('ESTUDIANTE') answer(
    @Param('duelId') id: string,
    @Body() b: any,
    @Request() r: any,
  ) {
    return this.actor(r).then((a) =>
      this.service.answer(a, id, b?.ordinal, b?.answer),
    );
  }
  @Get(':eventId/ranking') @Roles('ESTUDIANTE') ranking(
    @Param('eventId') id: string,
    @Query('scope') scope: string,
    @Request() r: any,
  ) {
    const valid = scope === 'grade' || scope === 'course' ? scope : 'general';
    return this.actor(r).then((a) => this.service.ranking(a, id, valid));
  }
}
