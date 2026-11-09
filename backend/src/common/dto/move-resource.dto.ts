import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MoveResourceDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Carpeta destino; null indica la raíz propia.' })
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsUUID()
  destinationId!: string | null;
}
