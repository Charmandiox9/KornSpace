import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import type { StoredFileResponse, UploadFileResult } from './file.types';

class FileResponseDto implements StoredFileResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  contentType!: string;
  @ApiProperty()
  sizeBytes!: number;
  @ApiProperty({ enum: ['PROCESSING', 'AVAILABLE', 'FAILED'] })
  status!: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
  @ApiProperty({ nullable: true })
  checksum!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

class UploadResponseDto implements UploadFileResult {
  @ApiProperty({ type: FileResponseDto })
  file!: StoredFileResponse;
  @ApiProperty()
  asynchronous!: boolean;
}

@Controller('files')
@ApiTags('Files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los archivos del prototipo local' })
  @ApiOkResponse({ type: FileResponseDto, isArray: true })
  list(): Promise<StoredFileResponse[]> {
    return this.filesService.list();
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Sube un archivo a S3 y encola los mayores a 10 MiB' })
  @ApiQuery({ name: 'name', required: true, description: 'Nombre original del archivo.' })
  @ApiCreatedResponse({ type: UploadResponseDto, description: 'Archivo pequeño guardado y disponible.' })
  @ApiAcceptedResponse({ type: UploadResponseDto, description: 'Archivo grande guardado y en procesamiento.' })
  async upload(
    @Req() request: Request,
    @Query('name') name: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Headers('content-length') contentLength: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UploadFileResult> {
    const sizeBytes = Number(contentLength);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
      throw new BadRequestException('La solicitud debe incluir Content-Length válido.');
    }
    if (!name) {
      throw new BadRequestException('El parámetro name es obligatorio.');
    }
    const result = await this.filesService.upload(
      request,
      name,
      contentType ?? 'application/octet-stream',
      sizeBytes,
    );
    response.status(result.asynchronous ? 202 : 201);
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Descarga el contenido de un archivo disponible' })
  @ApiParam({ name: 'id', description: 'Identificador UUID del archivo.' })
  async download(@Param('id', new ParseUUIDPipe()) id: string, @Res() response: Response): Promise<void> {
    const { file, body } = await this.filesService.getDownload(id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    body.on('error', () => response.destroy());
    body.pipe(response);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Consulta el estado del procesamiento de un archivo' })
  @ApiParam({ name: 'id', description: 'Identificador UUID del archivo.' })
  @ApiOkResponse({ type: FileResponseDto })
  getStatus(@Param('id', new ParseUUIDPipe()) id: string): Promise<StoredFileResponse> {
    return this.filesService.getStatus(id);
  }
}
