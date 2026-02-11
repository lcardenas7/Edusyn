import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService, SupabaseStorageService],
  exports: [StorageService, SupabaseStorageService],
})
export class StorageModule {}
