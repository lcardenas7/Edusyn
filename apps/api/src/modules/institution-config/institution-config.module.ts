import { Module } from '@nestjs/common'
import { InstitutionConfigController } from './institution-config.controller'
import { InstitutionConfigService } from './institution-config.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [InstitutionConfigController],
  providers: [InstitutionConfigService],
  exports: [InstitutionConfigService],
})
export class InstitutionConfigModule {}
