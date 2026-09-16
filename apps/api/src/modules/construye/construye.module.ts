import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConstruyeController } from './construye.controller';
import { ConstruyeService } from './construye.service';

@Module({ imports: [PrismaModule], controllers: [ConstruyeController], providers: [ConstruyeService] })
export class ConstruyeModule {}
