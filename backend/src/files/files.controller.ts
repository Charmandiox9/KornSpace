import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Optional,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiBadRequestResponse, ApiConflictResponse, ApiCreatedResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiPayloadTooLargeResponse, ApiProduces, ApiProperty, ApiQuery, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse, ApiUnsupportedMediaTypeResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import type { StoredFileResponse, UploadFileResult, UploadOperationResponse } from './file.types';
import { ManagedUploadsService } from './managed-uploads.service';
import type { UploadPhase } from './upload-registry.service';
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
  @ApiProperty({ nullable: true, type: String })
  deletedAt!: string | null;
}

class UploadResponseDto implements UploadFileResult {
  @ApiProperty({ type: FileResponseDto })
  file!: StoredFileResponse;
  @ApiProperty()
  asynchronous!: boolean;
}

class UploadOperationResponseDto implements UploadOperationResponse {
  @ApiProperty({ enum: ['uploading', 'confirming', 'cancelling', 'cleanupPending', 'cancelled', 'completed', 'failed'] })
  phase!: UploadPhase;
  @ApiProperty({ type: FileResponseDto, nullable: true })
  file!: StoredFileResponse | null;
  @ApiProperty()
  asynchronous!: boolean;
}

function encodeContentDispositionFilename(name: string): string {
  return encodeURIComponent(name).replace(/[!'()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

const previewContentTypes = new Set([
  'image/avif', 'image/bmp', 'image/gif', 'image/jpeg', 'image/png', 'image/webp',
  'video/mp4', 'video/ogg', 'video/webm',
]);

@Controller('files')
@UseGuards(SessionJwtGuard)
@ApiTags('Files')
export class FilesController {
  constructor(private readonly filesService: FilesService, @Optional() private readonly uploads?: ManagedUploadsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los archivos del usuario autenticado' })
  @ApiOkResponse({ type: FileResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'La sesión está ausente o no es válida.' })
  @ApiServiceUnavailableResponse({ description: 'No fue posible consultar PostgreSQL.' })
  list(@CurrentUser() user: AuthenticatedUserContext): Promise<StoredFileResponse[]> {
    return this.filesService.list(user.userId);
  }

  @Get('trash')
  @ApiOperation({ summary: 'Lista los archivos de la papelera del usuario' })
  @ApiOkResponse({ type: FileResponseDto, isArray: true })
  listTrash(@CurrentUser() user: AuthenticatedUserContext): Promise<StoredFileResponse[]> {
    return this.filesService.listTrash(user.userId);
  }

  @Post(':id/trash')
  @ApiOperation({ summary: 'Mueve un archivo propio a la papelera durante 10 días' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Archivo enviado a la papelera.' })
  async moveToTrash(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext): Promise<void> {
    await this.filesService.moveToTrash(id, user.userId);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restaura un archivo propio de la papelera' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Archivo restaurado.' })
  async restoreFromTrash(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext): Promise<void> {
    await this.filesService.restoreFromTrash(id, user.userId);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Elimina definitivamente un archivo propio de la papelera' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Archivo eliminado.' })
  async permanentlyDelete(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext): Promise<void> {
    await this.filesService.permanentlyDelete(id, user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Sube un archivo a S3 y encola los mayores a 10 MiB' })
  @ApiQuery({ name: 'name', required: true, description: 'Nombre de 1 a 255 caracteres, sin caracteres de control.' })
  @ApiQuery({ name: 'folderId', required: false, format: 'uuid', description: 'Carpeta propia de destino; omitido para la raíz.' })
  @ApiHeader({ name: 'Content-Type', required: true, description: 'Tipo MIME válido del archivo.' })
  @ApiHeader({ name: 'Content-Length', required: true, description: 'Tamaño decimal positivo, igual a los bytes transmitidos.' })
  @ApiHeader({ name: 'X-Upload-Id', required: false, description: 'UUID único por intento. Permite consultar y cancelar la carga antes de la confirmación; no reutilizar en un reintento.' })
  @ApiCreatedResponse({ type: UploadResponseDto, description: 'Archivo pequeño guardado y disponible.' })
  @ApiAcceptedResponse({ type: UploadResponseDto, description: 'Archivo grande guardado y en procesamiento.' })
  @ApiBadRequestResponse({ description: 'Falta nombre, Content-Type o Content-Length; el archivo está vacío o sus metadatos no son válidos.' })
  @ApiPayloadTooLargeResponse({ description: 'El archivo excede el máximo configurado de 100 MiB.' })
  @ApiConflictResponse({ description: 'El identificador del intento ya fue usado o cancelado. Consulta su estado y usa uno nuevo al reintentar.' })
  @ApiServiceUnavailableResponse({ description: 'Falló el almacenamiento S3, el guardado de metadatos en PostgreSQL o el encolado.' })
  @ApiNotFoundResponse({ description: 'La carpeta de destino no existe o no pertenece al usuario.' })
  @ApiUnauthorizedResponse({ description: 'La sesión está ausente o no es válida.' })
  async upload(
    @Req() request: Request,
    @Query('name') name: string | undefined,
    @Query('folderId', new ParseUUIDPipe({ optional: true })) folderId: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Headers('content-length') contentLength: string | undefined,
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() user: AuthenticatedUserContext,
    @Headers('x-upload-id') operationId?: string,
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
    if (operationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(operationId)) {
      throw new BadRequestException('X-Upload-Id debe ser un UUID v4 válido.');
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => { if (!response.writableFinished) abort(); };
    request.once('aborted', abort);
    response.once('close', close);
    if (request.aborted) abort();
    try {
      if (operationId && !this.uploads) throw new ServiceUnavailableException('El servicio de cargas no está disponible.');
      const result = operationId && this.uploads
        ? await this.uploads.upload(request, name, contentType, sizeBytes, user.userId, operationId, controller.signal, folderId ?? null)
        : await this.filesService.upload(request, name, contentType, sizeBytes, user.userId, { signal: controller.signal, folderId: folderId ?? null });
      response.status(result.asynchronous ? 202 : 201);
      return result;
    } finally {
      request.removeListener('aborted', abort);
      response.removeListener('close', close);
    }
  }

  @Get('uploads/:operationId')
  @ApiOperation({ summary: 'Consulta el estado de un intento de carga del usuario autenticado' })
  @ApiParam({ name: 'operationId', format: 'uuid' })
  @ApiOkResponse({ type: UploadOperationResponseDto })
  @ApiNotFoundResponse({ description: 'No existe una operación con ese identificador para el usuario autenticado.' })
  @ApiUnauthorizedResponse({ description: 'La sesión no es válida.' })
  @ApiServiceUnavailableResponse({ description: 'El registro o la limpieza no están disponibles temporalmente.' })
  getUpload(@Param('operationId', new ParseUUIDPipe({ version: '4' })) operationId: string, @CurrentUser() user: AuthenticatedUserContext): Promise<UploadOperationResponse> {
    if (!this.uploads) throw new ServiceUnavailableException();
    return this.uploads.status(user.userId, operationId);
  }

  @Delete('uploads/:operationId')
  @ApiOperation({ summary: 'Solicita cancelar un intento de carga; conserva archivos que ya están confirmándose o completados' })
  @ApiParam({ name: 'operationId', format: 'uuid' })
  @ApiOkResponse({ type: UploadOperationResponseDto, description: 'Cancelación idempotente. cancelled confirma limpieza; confirming/completed significa que la confirmación ganó la carrera.' })
  @ApiUnauthorizedResponse({ description: 'La sesión no es válida.' })
  @ApiServiceUnavailableResponse({ description: 'La cancelación no se pudo confirmar; puede reintentarse con el mismo identificador.' })
  cancelUpload(@Param('operationId', new ParseUUIDPipe({ version: '4' })) operationId: string, @CurrentUser() user: AuthenticatedUserContext): Promise<UploadOperationResponse> {
    if (!this.uploads) throw new ServiceUnavailableException();
    return this.uploads.cancel(user.userId, operationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Descarga el contenido de un archivo disponible' })
  @ApiParam({ name: 'id', description: 'Identificador UUID del archivo.' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'Contenido binario; Content-Type y Content-Disposition reflejan los metadatos seguros del archivo.', schema: { type: 'string', format: 'binary' } })
  @ApiNotFoundResponse({ description: 'El archivo no existe o el usuario no tiene acceso.' })
  @ApiUnauthorizedResponse({ description: 'La sesión está ausente o no es válida.' })
  @ApiServiceUnavailableResponse({ description: 'El archivo no está disponible o el almacenamiento no pudo entregarlo.' })
  async download(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext, @Res() response: Response): Promise<void> {
    const { file, body } = await this.filesService.getDownload(id, user.userId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeContentDispositionFilename(file.name)}`);
    body.on('error', () => response.destroy());
    body.pipe(response);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Previsualiza un archivo disponible de imagen o video' })
  @ApiParam({ name: 'id', description: 'Identificador UUID del archivo.' })
  @ApiProduces('image/*', 'video/*')
  @ApiOkResponse({ description: 'Contenido en línea para previsualización.' })
  @ApiNotFoundResponse({ description: 'El archivo no existe o no pertenece al usuario.' })
  @ApiUnauthorizedResponse({ description: 'La sesión está ausente o no es válida.' })
  @ApiServiceUnavailableResponse({ description: 'El archivo no está disponible o S3 no pudo entregarlo.' })
  @ApiUnsupportedMediaTypeResponse({ description: 'El contenido no es una imagen o video admitido para previsualización.' })
  async preview(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext, @Res() response: Response): Promise<void> {
    const { file, body } = await this.filesService.getDownload(id, user.userId);
    const contentType = file.contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    if (!previewContentTypes.has(contentType)) throw new UnsupportedMediaTypeException('Este tipo de archivo no admite previsualización.');
    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeContentDispositionFilename(file.name)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', 'sandbox');
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
