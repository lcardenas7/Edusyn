import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { StorageController } from './storage.controller';
import { StoragePublicController } from './storage-public.controller';

@Global()
@Module({
  controllers: [StorageController, StoragePublicController],
  providers: [StorageService, SupabaseStorageService],
  exports: [StorageService, SupabaseStorageService],
})
export class StorageModule {}
