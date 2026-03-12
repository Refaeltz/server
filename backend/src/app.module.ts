import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { ThrottleBehindProxyGuard } from './common/guards/throttle-behind-proxy.guard';

@Module({
  imports: [
    // ── Rate limiting ─────────────────────────────────────────────────────
    // Applied globally via APP_GUARD below.
    // Two tiers:
    //   • short  – 20 req / 10 s  (burst protection)
    //   • long   – 100 req / 60 s (sustained traffic)
    // Health endpoints opt out via @SkipThrottle().
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 10_000, limit: 20 },
      { name: 'long',  ttl: 60_000, limit: 100 },
    ]),

    // ── MongoDB ───────────────────────────────────────────────────────────
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://localhost:27017/app',
      {
        serverSelectionTimeoutMS: 5_000,  // fail fast if mongo is unreachable
        socketTimeoutMS: 45_000,
      },
    ),

    HealthModule,
  ],

  providers: [
    // Register ThrottlerGuard globally so every controller is rate-limited
    // without needing per-controller decoration.
    {
      provide: APP_GUARD,
      useClass: ThrottleBehindProxyGuard,
    },
  ],
})
export class AppModule {}
