import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FileProcessingWorker } from './file-processing.worker';
import { AuthModule } from '../auth/auth.module';
import { UploadRegistryService } from './upload-registry.service';
import { ManagedUploadsService } from './managed-uploads.service';
import { FileEventsGateway } from './file-events.gateway';
import { FileLibraryService } from './file-library.service';
import { FileLibraryResolver } from './file-library.resolver';
import { FileLibraryController } from './file-library.controller';

@Module({
  imports: [AuthModule],
  controllers: [FilesController, FileLibraryController],
  providers: [FilesService, FileLibraryService, FileLibraryResolver, FileProcessingWorker, UploadRegistryService, ManagedUploadsService, FileEventsGateway],
})
export class FilesModule {}
