import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileProcessingWorker } from './file-processing.worker';

@Module({
  controllers: [FilesController],
  providers: [FilesService, FileProcessingWorker],
})
export class FilesModule {}
