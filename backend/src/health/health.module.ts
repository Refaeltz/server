import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // TerminusModule provides HealthCheckService and all built-in indicators
    // (MongooseHealthIndicator, HttpHealthIndicator, etc.)
    TerminusModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
