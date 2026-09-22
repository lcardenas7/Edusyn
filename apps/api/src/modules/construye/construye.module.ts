import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConstruyeController } from './construye.controller';
import { ConstruyeService } from './construye.service';
import { ConstruyePublicationService } from './construye-publication.service';
import { ConstruyePublicController } from './construye-public.controller';

@Module({ imports: [PrismaModule], controllers: [ConstruyeController, ConstruyePublicController], providers: [ConstruyeService, ConstruyePublicationService] })
export class ConstruyeModule {}
