import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 10

/** Escape LIKE wildcards so `%` and `_` in the query match literally. */
const likePattern = (q: string) => `%${q.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`

/**
 * Colleague lookup for the recipient picker. Searches the local `user`
 * mirror only, so people who never signed in to Share can't be picked yet
 * (Open question 4).
 */
export default class UsersController {
  /** GET /users/search?q= — up to 10 users matching name or email. */
  async search({ request, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const q = String(request.input('q', '')).trim()
    if (q.length < MIN_QUERY_LENGTH) return []

    // lower() + LIKE rather than ILIKE so the same SQL runs on SQLite in tests.
    const pattern = likePattern(q)
    const users = await User.query()
      .whereNot('id', user.id)
      .where((query) => {
        query
          .whereRaw(`lower(coalesce(name, '')) like ? escape '\\'`, [pattern])
          .orWhereRaw(`lower(email) like ? escape '\\'`, [pattern])
      })
      .orderBy('name')
      .orderBy('email')
      .limit(MAX_RESULTS)

    return users.map((u) => ({ id: u.id, name: u.name, email: u.email, initials: u.initials }))
  }
}
