import { Body, Controller, Delete, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { SessionJwtGuard } from '../auth/session-jwt.guard';
import { FileLibraryService } from './file-library.service';
import { FilesService } from './files.service';

class FileNameDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'ID de la colisión confirmada por el usuario. El archivo anterior pasa a la papelera.' }) @IsOptional() @IsUUID() replaceFileId?: string;
}
class CheckFileNameDto {
  @ApiProperty({ maxLength: 255 }) @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) @IsOptional() @IsUUID() folderId?: string | null;
}
class GrantFileDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ enum: ['READER', 'EDITOR'] }) @IsIn(['READER', 'EDITOR']) role!: 'READER' | 'EDITOR';
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

  @Put(':id/permissions') @ApiOperation({ summary: 'Concede lectura o edición a un usuario registrado; sólo el propietario' }) @ApiOkResponse({ type: PermissionResponseDto })
  grant(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: GrantFileDto, @CurrentUser() user: AuthenticatedUserContext) { return this.library.grant(id, user.userId, body.email, body.role); }

  @Delete(':id/permissions/:userId') @HttpCode(204) @ApiOperation({ summary: 'Revoca un permiso; sólo el propietario' }) @ApiNoContentResponse()
  revoke(@Param('id', new ParseUUIDPipe()) id: string, @Param('userId', new ParseUUIDPipe()) target: string, @CurrentUser() user: AuthenticatedUserContext) { return this.library.revoke(id, user.userId, target); }

  @Delete('trash') @ApiOperation({ summary: 'Vacía la papelera propia; admite reintentos' }) @ApiOkResponse({ type: EmptyTrashResponseDto })
  empty(@CurrentUser() user: AuthenticatedUserContext) { return this.files.emptyTrash(user.userId); }
}
