import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResourceActivityDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() actorName!: string;
  @ApiProperty({ example: 'OPENED' }) action!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) detail!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
