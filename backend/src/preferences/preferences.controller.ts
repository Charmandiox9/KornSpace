import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { IsBoolean, IsEnum, ValidateIf } from 'class-validator';
import { ItemColor } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { SessionJwtGuard } from '../auth/session-jwt.guard';
import { FileResponseDto } from '../files/files.controller';
import { FolderResponseDto } from '../folders/folders.controller';
import { PreferencesService } from './preferences.service';
import type { ItemPreferenceInput, ItemPreferenceResponse } from './preference.types';
class ItemPreferenceDto implements ItemPreferenceInput {
  @ApiPropertyOptional() @ValidateIf((_object: unknown, value: unknown) => value !== undefined) @IsBoolean() starred?: boolean;
  @ApiPropertyOptional() @ValidateIf((_object: unknown, value: unknown) => value !== undefined) @IsBoolean() shortcut?: boolean;
  @ApiPropertyOptional({ enum: ItemColor }) @ValidateIf((_object: unknown, value: unknown) => value !== undefined) @IsEnum(ItemColor) color?: ItemColor;
}
class ItemPreferenceResponseDto implements ItemPreferenceResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['files', 'folders'] }) kind!: 'files' | 'folders';
  @ApiProperty() starred!: boolean;
  @ApiProperty() shortcut!: boolean;
  @ApiProperty({ enum: ItemColor }) color!: ItemColor;
  @ApiPropertyOptional({ type: FileResponseDto }) file?: FileResponseDto;
  @ApiPropertyOptional({ type: FolderResponseDto }) folder?: FolderResponseDto;
}
@Controller('preferences/items') @UseGuards(SessionJwtGuard) @ApiTags('Preferences')
@ApiUnauthorizedResponse({ description: 'Sesión ausente o inválida.' })
@ApiBadRequestResponse({ description: 'Identificador, color o cuerpo inválido.' })
@ApiNotFoundResponse({ description: 'Elemento inexistente o sin acceso.' })
@ApiServiceUnavailableResponse({ description: 'No fue posible guardar o consultar las preferencias.' })
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}
  @Get() @ApiOperation({ summary: 'Lista organización personal de elementos accesibles; no concede acceso adicional' }) @ApiOkResponse({ type: ItemPreferenceResponseDto, isArray: true })
  list(@CurrentUser() user: AuthenticatedUserContext) { return this.preferences.list(user.userId); }
  @Put('files/:id') @HttpCode(204) @ApiOperation({ summary: 'Guarda destacados, accesos rápidos y color personales de un archivo' }) @ApiNoContentResponse()
  file(@Param('id', new ParseUUIDPipe()) id: string, @Body() data: ItemPreferenceDto, @CurrentUser() user: AuthenticatedUserContext) { return this.preferences.update(user.userId, 'files', id, data); }
  @Put('folders/:id') @HttpCode(204) @ApiOperation({ summary: 'Guarda destacados, accesos rápidos y color personales de una carpeta' }) @ApiNoContentResponse()
  folder(@Param('id', new ParseUUIDPipe()) id: string, @Body() data: ItemPreferenceDto, @CurrentUser() user: AuthenticatedUserContext) { return this.preferences.update(user.userId, 'folders', id, data); }
}
