import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import IamGrant from '#models/iam_grant'
import { UserFactory } from '#database/factories/user_factory'

/** A just-checked grant holding a random (fake) refresh token. */
export const IamGrantFactory = factory
  .define(IamGrant, () => {
    return {
      id: randomUUID(),
      refreshTokenEncrypted: IamGrant.seal(`rt-${randomUUID()}`),
      checkedAt: DateTime.now(),
    }
  })
  .relation('user', () => UserFactory)
  .build()
