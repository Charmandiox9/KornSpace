import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { FileRole } from '@prisma/client';
import type { ResourcePermission } from './folder-policy';
export class PermissionRoleDto {
  @ApiProperty({ enum: ['READER', 'EDITOR'] }) @IsIn(['READER', 'EDITOR']) role!: FileRole;
}
export class ResourcePermissionDto extends PermissionRoleDto implements ResourcePermission {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) name?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) pictureUrl?: string | null;
  @ApiProperty() email!: string;
  @ApiProperty({ type: String, nullable: true }) username!: string | null;
  @ApiProperty() inherited!: boolean;
  @ApiProperty({ format: 'uuid' }) sourceId!: string;
  @ApiProperty() sourceName!: string;
}
