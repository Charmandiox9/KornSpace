import { Body, Controller, Delete, HttpCode, Param, Patch, Put, Get, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiForbiddenResponse, ApiNoContentResponse, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiBadRequestResponse, ApiTags, ApiUnauthorizedResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { SessionJwtGuard } from '../auth/session-jwt.guard';
import type { StoredFileResponse } from '../files/file.types';
import type { FolderContentsResponse, FolderResponse } from './folder.types';
import { PermissionRoleDto, ResourcePermissionDto } from './permission.dto';
import { FoldersService } from './folders.service';

export class RenameFolderDto {
  @ApiProperty({ maxLength: 255, example: 'Invoices' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[^\\/\u0000-\u001f\u007f]+$/u)
  name!: string;

}

export class CreateFolderDto {
  @ApiProperty({ maxLength: 255, example: 'Invoices' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[^\\/\u0000-\u001f\u007f]+$/u)
  name!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Carpeta padre. Omitido o null crea en la raíz.' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

class FolderResponseDto implements FolderResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'uuid' }) ownerId!: string;
  @ApiPropertyOptional({ enum: ['OWNER', 'READER', 'EDITOR'] }) permission?: 'OWNER' | 'READER' | 'EDITOR';
  @ApiProperty({ format: 'uuid', nullable: true }) parentId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

class FolderFileResponseDto implements StoredFileResponse {
  @ApiPropertyOptional({ enum: ['OWNER', 'READER', 'EDITOR'] }) permission?: 'OWNER' | 'READER' | 'EDITOR';
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) ownerId?: string | null;
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() contentType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({ enum: ['PROCESSING', 'AVAILABLE', 'FAILED'] }) status!: 'PROCESSING' | 'AVAILABLE' | 'FAILED';
  @ApiProperty({ nullable: true }) checksum!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) deletedAt!: string | null;
}

class FolderContentsResponseDto implements FolderContentsResponse {
  @ApiProperty({ type: FolderResponseDto, nullable: true }) folder!: FolderResponse | null;
  @ApiProperty({ type: FolderResponseDto, isArray: true }) breadcrumbs!: FolderResponse[];
  @ApiProperty({ type: FolderResponseDto, isArray: true }) folders!: FolderResponse[];
  @ApiProperty({ type: FolderFileResponseDto, isArray: true }) files!: StoredFileResponse[];
}

class FolderEditorDto extends PermissionRoleDto {
  @IsOptional() role: 'READER' | 'EDITOR' = 'EDITOR';
  @ApiProperty({ description: 'Correo o usuario exacto del editor.' })
  @IsString() @MinLength(3) @MaxLength(255) identifier!: string;
}
class FolderEditorResponseDto {
  @ApiProperty({ format: 'uuid' }) userId!: string;
}

@Controller('folders')
@UseGuards(SessionJwtGuard)
@ApiTags('Folders')
@ApiForbiddenResponse({ description: 'Los lectores no pueden modificar carpetas ni su contenido.' })
@ApiUnauthorizedResponse({ description: 'Sesión ausente o inválida.' })
@ApiBadRequestResponse({ description: 'Identificadores o cuerpo inválidos.' })
@ApiServiceUnavailableResponse({ description: 'Operación fallida; se puede reintentar.' })
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Renombra como propietario o editor; no permite mover la carpeta' })
  @ApiOkResponse({ type: FolderResponseDto })
  @ApiBadRequestResponse({ description: 'Nombre inválido o campos adicionales como parentId.' })
  @ApiNotFoundResponse({ description: 'Carpeta inexistente o sin permiso.' })
  @ApiConflictResponse({ description: 'Nombre duplicado en la misma ubicación.' })
  @ApiServiceUnavailableResponse({ description: 'Operación fallida; se puede reintentar.' })
  rename(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: RenameFolderDto, @CurrentUser() user: AuthenticatedUserContext) {
    return this.foldersService.rename(id, user.userId, input.name);
  }

  @Delete(':id') @HttpCode(204)
  @ApiNoContentResponse({ description: 'Carpeta eliminada.' })
  @ApiOperation({ summary: 'Elimina una carpeta vacía como propietario o editor; incluye papelera al comprobar contenido' })
  @ApiNotFoundResponse({ description: 'Carpeta inexistente o sin permiso.' })
  @ApiConflictResponse({ description: 'Contiene archivos o descendientes; no se modifica S3 ni contenido.' })
  @ApiServiceUnavailableResponse({ description: 'Operación atómica fallida; se puede reintentar.' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext) {
    return this.foldersService.remove(id, user.userId);
  }

  @Get([':id/editors', ':id/permissions'])
  @ApiOperation({ summary: 'Lista editores de una carpeta propia' })
  @ApiOkResponse({ type: ResourcePermissionDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Carpeta inexistente o no propia.' })
  listEditors(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUserContext) {
    return this.foldersService.listEditors(id, user.userId);
  }

  @Put([':id/editors', ':id/permissions'])
  @ApiOperation({ summary: 'Concede lectura o edición a la carpeta y sus descendientes; sólo propietario' })
  @ApiOkResponse({ type: FolderEditorResponseDto })
  @ApiNotFoundResponse({ description: 'Carpeta no propia o destinatario no único.' })
  grant(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: FolderEditorDto, @CurrentUser() user: AuthenticatedUserContext) {
    return this.foldersService.grantEditor(id, user.userId, input.identifier, input.role);
  }

  @Patch(':id/permissions/:userId') @HttpCode(204)
  @ApiOperation({ summary: 'Cambia un permiso directo de carpeta; afecta sus descendientes' })
  @ApiNoContentResponse() @ApiNotFoundResponse({ description: 'Carpeta no propia o permiso directo inexistente.' })
  updatePermission(@Param('id', new ParseUUIDPipe()) id: string, @Param('userId', new ParseUUIDPipe()) targetId: string, @Body() input: PermissionRoleDto, @CurrentUser() user: AuthenticatedUserContext) {
    return this.foldersService.updatePermission(id, user.userId, targetId, input.role);
  }

  @Delete([':id/editors/:userId', ':id/permissions/:userId']) @HttpCode(204)
  @ApiNoContentResponse({ description: 'Permiso revocado.' })
  @ApiOperation({ summary: 'Revoca editor de carpeta; sólo propietario' })
  @ApiNotFoundResponse({ description: 'Carpeta no propia.' })
  revoke(@Param('id', new ParseUUIDPipe()) id: string, @Param('userId', new ParseUUIDPipe()) targetId: string, @CurrentUser() user: AuthenticatedUserContext) {
    return this.foldersService.revokeEditor(id, user.userId, targetId);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una carpeta en la raíz o dentro de una carpeta propia' })
  @ApiCreatedResponse({ type: FolderResponseDto })
  @ApiBadRequestResponse({ description: 'El nombre, UUID del padre o cuerpo no es válido.' })
  @ApiNotFoundResponse({ description: 'La carpeta padre no existe o no pertenece al usuario.' })
  @ApiConflictResponse({ description: 'Ya existe una carpeta con ese nombre en la ubicación.' })
  @ApiUnauthorizedResponse({ description: 'La sesión está ausente o no es válida.' })
  @ApiServiceUnavailableResponse({ description: 'No fue posible guardar la carpeta.' })
  create(@Body() input: CreateFolderDto, @CurrentUser() user: AuthenticatedUserContext): Promise<FolderResponse> {
    return this.foldersService.create(user.userId, input.name, input.parentId ?? null);
  }

  @Get()
  @ApiOperation({ summary: 'Lista carpetas y archivos directos de la raíz o una carpeta propia' })
  @ApiQuery({ name: 'parentId', required: false, format: 'uuid', description: 'Omitido para consultar la raíz.' })
  @ApiOkResponse({ type: FolderContentsResponseDto })
  @ApiBadRequestResponse({ description: 'parentId no es un UUID válido.' })
  @ApiNotFoundResponse({ description: 'La carpeta no existe o no pertenece al usuario.' })
  @ApiUnauthorizedResponse({ description: 'La sesión está ausente o no es válida.' })
  @ApiServiceUnavailableResponse({ description: 'No fue posible consultar el contenido.' })
  listContents(
    @Query('parentId', new ParseUUIDPipe({ optional: true })) parentId: string | undefined,
    @CurrentUser() user: AuthenticatedUserContext,
  ): Promise<FolderContentsResponse> {
    return this.foldersService.listContents(user.userId, parentId ?? null);
  }
}
