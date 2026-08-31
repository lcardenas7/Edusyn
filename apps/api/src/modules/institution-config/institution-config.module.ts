import { Module } from '@nestjs/common'
import { InstitutionConfigController } from './institution-config.controller'
import { InstitutionConfigService } from './institution-config.service'
import { PrismaModule } from '../../prisma/prisma.module'
import { ValidateTenantContextGuard } from '../../common/guards/validate-tenant-context.guard'

@Module({
  imports: [PrismaModule],
  controllers: [InstitutionConfigController],
  providers: [InstitutionConfigService, ValidateTenantContextGuard],
  exports: [InstitutionConfigService],
})
export class InstitutionConfigModule {}
