import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiBadRequestResponse, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiParam, ApiPayloadTooLargeResponse, ApiProperty, ApiQuery, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import type { StoredFileResponse, UploadFileResult } from './file.types';
import { SessionJwtGuard } from '../auth/session-jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUserContext } from '../auth/auth.types';

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
@UseGuards(SessionJwtGuard)
@ApiTags('Files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los archivos del usuario autenticado' })
  @ApiOkResponse({ type: FileResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'La sesión está ausente o no es válida.' })
  @ApiServiceUnavailableResponse({ description: 'No fue posible consultar PostgreSQL.' })
  list(@CurrentUser() user: AuthenticatedUserContext): Promise<StoredFileResponse[]> {
    return this.filesService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Sube un archivo a S3 y encola los mayores a 10 MiB' })
  @ApiQuery({ name: 'name', required: true, description: 'Nombre de 1 a 255 caracteres, sin caracteres de control.' })
  @ApiHeader({ name: 'Content-Type', required: true, description: 'Tipo MIME válido del archivo.' })
  @ApiHeader({ name: 'Content-Length', required: true, description: 'Tamaño decimal positivo, igual a los bytes transmitidos.' })
  @ApiCreatedResponse({ type: UploadResponseDto, description: 'Archivo pequeño guardado y disponible.' })
  @ApiAcceptedResponse({ type: UploadResponseDto, description: 'Archivo grande guardado y en procesamiento.' })
  @ApiBadRequestResponse({ description: 'Falta nombre, Content-Type o Content-Length; el archivo está vacío o sus metadatos no son válidos.' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo excede el máximo configurado de 100 MiB.' })
  @ApiServiceUnavailableResponse({ description: 'Falló el almacenamiento S3, el guardado de metadatos en PostgreSQL o el encolado.' })
  @ApiUnauthorizedResponse({ description: 'La sesión está ausente o no es válida.' })
  async upload(
    @Req() request: Request,
    @Query('name') name: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Headers('content-length') contentLength: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user: AuthenticatedUserContext,
  ): Promise<UploadFileResult> {
    if (contentLength === undefined || !/^\d+$/u.test(contentLength)) {
      throw new BadRequestException('La solicitud debe incluir Content-Length decimal válido.');
    }
    const sizeBytes = Number(contentLength);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
      throw new BadRequestException('La solicitud debe incluir Content-Length válido para un archivo no vacío.');
    }
    if (!name) {
      throw new BadRequestException('El parámetro name es obligatorio.');
    }
    if (!contentType) {
      throw new BadRequestException('La solicitud debe incluir Content-Type válido.');
    }
    const result = await this.filesService.upload(
      request,
      name,
      contentType,
      sizeBytes,
      user.userId,
    );
    response.status(result.asynchronous ? 202 : 201);
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Descarga el contenido de un archivo disponible' })
  @ApiParam({ name: 'id', description: 'Identificador UUID del archivo.' })
  async download(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext, @Res() response: Response): Promise<void> {
    const { file, body } = await this.filesService.getDownload(id, user.userId);
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
  getStatus(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext): Promise<StoredFileResponse> {
    return this.filesService.getStatus(id, user.userId);
  }
}
