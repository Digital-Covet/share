/*
|--------------------------------------------------------------------------
| Rate limiters
|--------------------------------------------------------------------------
|
| Route throttles are keyed by the signed-in user, so they must run after
| the `auth` middleware (route middleware runs after the group's).
|
*/

import type { HttpContext } from '@adonisjs/core/http'
import type { MiddlewareFn, NextFn } from '@adonisjs/core/types/http'
import limiter from '@adonisjs/limiter/services/main'
import { errors } from '@adonisjs/limiter'

/**
 * Turn the package's throttle error into the API's 429 shape
 * (`{ "error": "rate_limited" }` + `Retry-After`); the throttled routes are
 * all REST/JSON.
 */
function asJson(middleware: MiddlewareFn): MiddlewareFn {
  return async (ctx: HttpContext, next: NextFn) => {
    try {
      return await middleware(ctx, next)
    } catch (error) {
      if (!(error instanceof errors.E_TOO_MANY_REQUESTS)) throw error
      ctx.logger.info(
        { event: 'rate_limited', userId: ctx.auth.user?.id, route: ctx.route?.name },
        'rate_limited'
      )
      ctx.response.header('Retry-After', error.response.availableIn)
      return ctx.response.tooManyRequests({ error: 'rate_limited' })
    }
  }
}

/** `POST /transfers/:id/download/:fileId`: 30 per minute per user. */
export const throttleDownloads = asJson(
  limiter.define('downloads', (ctx) =>
    limiter.allowRequests(30).every('1 minute').usingKey(ctx.auth.getUserOrFail().id)
  )
)

/** `POST /transfers`: 10 per minute per user. */
export const throttleCreates = asJson(
  limiter.define('creates', (ctx) =>
    limiter.allowRequests(10).every('1 minute').usingKey(ctx.auth.getUserOrFail().id)
  )
)

/**
 * Wrong transfer passwords: 5 per 15 minutes per user and transfer. Not a
 * route throttle — only wrong guesses count, so `DownloadService` consumes
 * it itself (key `<userId>:<transferId>`).
 */
export const passwordAttempts = () => limiter.use({ requests: 5, duration: '15 mins' })
