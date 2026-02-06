import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ConceptsService } from './concepts.service';
import { ConceptsController } from './concepts.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ConceptsController],
  providers: [ConceptsService],
  exports: [ConceptsService],
})
export class ConceptsModule {}
