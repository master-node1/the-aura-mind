import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma.service';

const SERVICE = 'analytics-service';
const CHECK_TIMEOUT_MS = 2000;

type CheckStatus = 'up' | 'down';

/** Unauthenticated so Docker and the gateway can probe it. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check including database connectivity' })
  @ApiResponse({ status: 200, description: 'Service and dependencies are reachable' })
  @ApiResponse({ status: 503, description: 'A dependency is unreachable' })
  async health() {
    const checks = {
      database: await this.probe('database', () => this.prisma.$queryRaw`SELECT 1`),
    };
    const body = { status: 'ok', service: SERVICE, checks };
    if (Object.values(checks).some((status) => status === 'down')) {
      throw new ServiceUnavailableException({ ...body, status: 'error' });
    }
    return body;
  }

  private async probe(name: string, check: () => Promise<unknown>): Promise<CheckStatus> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${CHECK_TIMEOUT_MS}ms`)), CHECK_TIMEOUT_MS);
    });
    try {
      await Promise.race([check(), timeout]);
      return 'up';
    } catch (error) {
      this.logger.warn(`Health check "${name}" failed: ${(error as Error).message.trim().split('\n').pop()}`);
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
