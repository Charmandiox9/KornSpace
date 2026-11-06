import { Body, Controller, Get, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiBadRequestResponse, ApiTags, ApiUnauthorizedResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { SessionJwtGuard } from '../auth/session-jwt.guard';
import type { StoredFileResponse } from './file.types';
import type { FolderContentsResponse, FolderResponse } from './folder.types';
import { FoldersService } from './folders.service';

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
  @ApiProperty({ format: 'uuid', nullable: true }) parentId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

class FolderFileResponseDto implements StoredFileResponse {
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

@Controller('folders')
@UseGuards(SessionJwtGuard)
@ApiTags('Folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

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
