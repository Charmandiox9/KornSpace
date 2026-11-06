import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { SessionJwtGuard } from '../auth/session-jwt.guard';
import { FileLibraryService } from './file-library.service';
import { PermissionRoleDto, ResourcePermissionDto } from '../folders/permission.dto';
import { FilesService } from './files.service';
import type { ShareRecipient } from './file.types';

class FileNameDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'ID de la colisión confirmada por el usuario. El archivo anterior pasa a la papelera.' }) @IsOptional() @IsUUID() replaceFileId?: string;
}
class CheckFileNameDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() folderId?: string | null;
}
class GrantFileDto {
  @ApiPropertyOptional({ description: 'Correo o nombre de usuario exacto; admite @usuario.' }) @IsOptional() @IsString() @MinLength(3) @MaxLength(255) identifier?: string;
  @ApiPropertyOptional({ description: 'Alias compatible con clientes anteriores. Usar email o identifier, no ambos.' }) @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Destinatario mostrado al confirmar; evita compartir con una cuenta distinta si cambió el identificador.' }) @IsOptional() @IsUUID() recipientId?: string;
  @ApiProperty({ enum: ['READER', 'EDITOR'] }) @IsIn(['READER', 'EDITOR']) role!: 'READER' | 'EDITOR';
}
class RecipientLookupDto {
  @ApiProperty({ description: 'Correo o nombre de usuario exacto; no devuelve listados ni coincidencias parciales.' }) @IsString() @MinLength(3) @MaxLength(255) identifier!: string;
}
class ShareRecipientDto implements ShareRecipient {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ type: String, nullable: true }) username!: string | null;
  @ApiProperty() email!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
}
class RenameResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
class NameAvailabilityDto { @ApiProperty() available!: boolean; }
class PermissionResponseDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ enum: ['READER', 'EDITOR'] }) role!: string;
}
class EmptyTrashResponseDto {
  @ApiProperty() deleted!: number;
  @ApiProperty({ description: 'Borrados pendientes de reintento.' }) pending!: number;
}

@Controller('files')
@UseGuards(SessionJwtGuard)
@ApiTags('Files')
@ApiUnauthorizedResponse({ description: 'Sesión no válida.' })
@ApiBadRequestResponse({ description: 'Nombre, identificadores o cuerpo no válidos.' })
@ApiNotFoundResponse({ description: 'Recurso inexistente o no accesible.' })
@ApiForbiddenResponse({ description: 'Un lector no puede modificar archivos.' })
@ApiConflictResponse({ description: 'FILE_NAME_CONFLICT: el nombre ya existe. Cancelar o repetir con replaceFileId confirmado; nunca se reemplaza silenciosamente.' })
@ApiServiceUnavailableResponse({ description: 'La operación no pudo completarse; el borrado conserva metadatos para reintento.' })
export class FileLibraryController {
  constructor(private readonly library: FileLibraryService, private readonly files: FilesService) {}

  @Patch(':id') @ApiOperation({ summary: 'Renombra un archivo como propietario o editor' }) @ApiOkResponse({ type: RenameResponseDto })
  rename(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: FileNameDto, @CurrentUser() user: AuthenticatedUserContext) {
    return this.library.rename(id, user.userId, body.name, body.replaceFileId);
  }
  @Post('name-conflict') @HttpCode(200) @ApiOperation({ summary: 'Comprueba el nombre antes de subir a una carpeta propia' }) @ApiOkResponse({ type: NameAvailabilityDto })
  checkName(@Body() body: CheckFileNameDto, @CurrentUser() user: AuthenticatedUserContext) { return this.library.checkName(user.userId, body.name, body.folderId ?? null); }

  @Post(':id/access') @HttpCode(204) @ApiOperation({ summary: 'Registra una apertura explícita para los recientes personales' }) @ApiNoContentResponse()
  access(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext) { return this.library.recordAccess(id, user.userId); }

  @Get(':id/recipients') @ApiOperation({ summary: 'Resuelve correo o usuario exacto para confirmar el destinatario; sólo el propietario' }) @ApiOkResponse({ type: ShareRecipientDto })
  recipient(@Param('id', new ParseUUIDPipe()) id: string, @Query() query: RecipientLookupDto, @CurrentUser() user: AuthenticatedUserContext) { return this.library.resolveRecipient(id, user.userId, query.identifier); }

  @Get(':id/permissions') @ApiOperation({ summary: 'Lista permisos directos y heredados; sólo propietario' }) @ApiOkResponse({ type: ResourcePermissionDto, isArray: true })
  listPermissions(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext) { return this.library.listPermissions(id, user.userId); }

  @Patch(':id/permissions/:userId') @HttpCode(204) @ApiOperation({ summary: 'Actualiza un permiso directo; la herencia se modifica en la carpeta de origen' }) @ApiNoContentResponse()
  updatePermission(@Param('id', new ParseUUIDPipe()) id: string, @Param('userId', new ParseUUIDPipe()) target: string, @Body() body: PermissionRoleDto, @CurrentUser() user: AuthenticatedUserContext) { return this.library.updatePermission(id, user.userId, target, body.role); }

  @Put(':id/permissions') @ApiOperation({ summary: 'Concede lectura o edición por correo o usuario; sólo el propietario' }) @ApiOkResponse({ type: PermissionResponseDto })
  @ApiConflictResponse({ description: 'El destinatario ya no coincide con recipientId. Resolver de nuevo antes de confirmar.' })
  grant(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: GrantFileDto, @CurrentUser() user: AuthenticatedUserContext) {
    if (Boolean(body.identifier) === Boolean(body.email)) throw new BadRequestException('Indica correo o usuario en identifier, o email, de forma exclusiva.');
    return this.library.grant(id, user.userId, body.identifier ?? body.email!, body.role, body.recipientId);
  }

  @Delete(':id/permissions/:userId') @HttpCode(204) @ApiOperation({ summary: 'Revoca un permiso; sólo el propietario' }) @ApiNoContentResponse()
  revoke(@Param('id', new ParseUUIDPipe()) id: string, @Param('userId', new ParseUUIDPipe()) target: string, @CurrentUser() user: AuthenticatedUserContext) { return this.library.revoke(id, user.userId, target); }

  @Delete('trash') @ApiOperation({ summary: 'Vacía la papelera propia; admite reintentos' }) @ApiOkResponse({ type: EmptyTrashResponseDto })
  empty(@CurrentUser() user: AuthenticatedUserContext) { return this.files.emptyTrash(user.userId); }
}
