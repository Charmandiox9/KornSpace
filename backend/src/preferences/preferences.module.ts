import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';
@Module({ imports: [AuthModule], controllers: [PreferencesController], providers: [PreferencesService] })
export class PreferencesModule {}
