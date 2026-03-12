import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
// Health probes are called every few seconds by Docker / Kubernetes.
// Exclude them from the global rate limiter to avoid false 429s.
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
  ) {}

  /**
   * Liveness probe
   *
   * Answers: "Is the Node.js process alive?"
   * Docker / k8s restarts the container if this returns non-2xx.
   * Should be a dead-simple check — no external dependencies.
   *
   * GET /api/health/live
   */
  @Get('live')
  @ApiOperation({ summary: 'Liveness – is the process running?' })
  liveness() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness probe
   *
   * Answers: "Is the app ready to serve traffic?"
   * Docker / k8s stops sending requests to the container if this fails.
   * Checks that MongoDB is reachable before declaring the app ready.
   *
   * GET /api/health/ready
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness – are all dependencies healthy?' })
  readiness() {
    return this.health.check([
      // Ping the active Mongoose connection
      () => this.mongoose.pingCheck('mongodb'),
    ]);
  }
}
