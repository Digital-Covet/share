import type { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Random UUID v4 as a SQLite expression (SQLite has no uuid function).
 */
const SQLITE_UUID_V4 = `(lower(
  hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
  substr(hex(randomblob(2)), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' ||
  hex(randomblob(6))
))`

/**
 * Column default for generated uuid primary keys. Postgres uses
 * `gen_random_uuid()`; the SQLite test connection gets an equivalent
 * expression. Lucid doesn't read generated ids back on SQLite (no
 * RETURNING), so code that needs the id must assign `randomUUID()` itself.
 */
export function uuidDefault(schema: BaseSchema) {
  if (schema.db.dialect.name === 'postgres') {
    return schema.raw('gen_random_uuid()')
  }
  return schema.raw(SQLITE_UUID_V4)
}
