import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../../prisma/prisma.module';
import { ApdModule } from '../apd/apd.module';

// Services
import { PlayWorkspaceService } from './services/play-workspace.service';
import { GuestTokenService } from './services/guest-token.service';
import { AuthPlayService } from './services/auth-play.service';
import { PlayService } from './services/play.service';
import { PlayStreamService } from './services/play-stream.service';
import { GuestService } from './services/guest.service';
import { LiveLessonService } from './services/live-lesson.service';
import { ConversionService } from './services/conversion.service';
import { PlayCronService } from './play.cron';

// Guards
import { GuestGuard } from './guards/guest.guard';

// Controllers
import { AuthPlayController } from './controllers/auth-play.controller';
import { PlayController } from './controllers/play.controller';
import { GuestPublicController } from './controllers/guest-public.controller';
import { LiveLessonController, LiveLessonPublicController } from './controllers/live-lesson.controller';
import { ConversionController } from './controllers/conversion.controller';

@Module({
  imports: [
    PrismaModule,
    ApdModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [
    AuthPlayController,
    PlayController,
    GuestPublicController,
    LiveLessonController,
    LiveLessonPublicController,
    ConversionController,
  ],
  providers: [
    PlayWorkspaceService,
    GuestTokenService,
    AuthPlayService,
    PlayService,
    PlayStreamService,
    GuestService,
    LiveLessonService,
    ConversionService,
    GuestGuard,
    PlayCronService,
  ],
  exports: [PlayWorkspaceService, GuestTokenService, GuestService, PlayStreamService],
})
export class EdusynPlayModule {}
