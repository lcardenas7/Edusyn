import { Module } from '@nestjs/common';
import { TallerController } from './taller.controller';
import { TallerService } from './taller.service';

// EL TALLER — núcleo del Sistema Operativo de Colaboración (Objetos + Grafo +
// Eventos) y motores. Capa-plataforma independiente del ABP legacy.
@Module({
  controllers: [TallerController],
  providers: [TallerService],
  exports: [TallerService],
})
export class TallerModule {}
