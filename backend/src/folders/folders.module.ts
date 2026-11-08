import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoldersController } from './folders.controller';
import { FoldersService } from './folders.service';
import { FoldersResolver } from './folders.resolver';

@Module({
  imports: [AuthModule],
  controllers: [FoldersController],
  providers: [FoldersService, FoldersResolver],
})
export class FoldersModule {}
