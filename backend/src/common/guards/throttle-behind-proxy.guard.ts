import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Proxy-aware throttler guard.
 *
 * The default ThrottlerGuard keys rate-limit buckets by the TCP socket IP,
 * which is always the NGINX container when running behind a reverse proxy.
 * This override reads the real client IP from the X-Forwarded-For header
 * so each actual user gets their own independent bucket.
 *
 * Usage: swap APP_GUARD in app.module.ts from ThrottlerGuard to this class.
 *
 *   { provide: APP_GUARD, useClass: ThrottleBehindProxyGuard }
 */
@Injectable()
export class ThrottleBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // X-Forwarded-For may contain a comma-separated list; take the first entry
    const forwarded = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : (forwarded?.split(',')[0] ?? req.ip ?? 'unknown');

    return ip.trim();
  }
}
