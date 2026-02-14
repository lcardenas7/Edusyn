import { Module, Global } from '@nestjs/common'
import { InstitutionContextService } from './institution-context.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Global()
@Module({
  imports: [PrismaModule],
  providers: [InstitutionContextService],
  exports: [InstitutionContextService],
})
export class InstitutionContextModule {}
