import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import Transfer from '#models/transfer'
import { UserFactory } from '#database/factories/user_factory'

/**
 * Unconfirmed transfers (no file rows) expiring in a week. The id is
 * assigned here because Lucid can't read generated ids back on SQLite.
 */
export const TransferFactory = factory
  .define(Transfer, ({ faker }) => {
    return {
      id: randomUUID(),
      title: faker.lorem.words(3),
      expiresAt: DateTime.now().plus({ days: 7 }),
    }
  })
  .relation('creator', () => UserFactory)
  .build()
