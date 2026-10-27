import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

interface HealthResponse {
  status: 'ok';
  service: string;
  database: 'connected';
}

class HealthResponseDto implements HealthResponse {
  @ApiProperty({ example: 'ok' })
  status: 'ok' = 'ok';

  @ApiProperty({ example: 'kornspace-api' })
  service = 'kornspace-api';

  @ApiProperty({ example: 'connected' })
  database: 'connected' = 'connected';
}

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Comprueba la disponibilidad de la API y PostgreSQL' })
  @ApiOkResponse({
    description: 'La API y PostgreSQL están disponibles.',
    type: HealthResponseDto,
  })
  async getHealth(): Promise<HealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`;

    return { status: 'ok', service: 'kornspace-api', database: 'connected' };
  }
}
