import { type HttpContext } from '@adonisjs/core/http'
import { type NextFn } from '@adonisjs/core/types/http'

/**
 * Share is private, so every response asks crawlers not to index it. The
 * header also covers what the layout's robots meta tag can't: redirects,
 * JSON, downloads and error pages.
 */
export default class NoIndexMiddleware {
  handle({ response }: HttpContext, next: NextFn) {
    response.header('X-Robots-Tag', 'noindex, nofollow')

    return next()
  }
}
