import { DateTime } from 'luxon'
import { scope, type BaseModel } from '@adonisjs/lucid/orm'
import type { NormalizeConstructor } from '@adonisjs/core/types/helpers'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

/**
 * Soft deletes backed by a nullable `deleted_at` column. Rows are never
 * filtered implicitly; use the `active` / `trashed` scopes in queries.
 *
 * ```ts
 * Transfer.query().withScopes((s) => s.active())
 * ```
 */
export function withSoftDeletes<Model extends NormalizeConstructor<typeof BaseModel>>(
  superclass: Model
) {
  class SoftDeletes extends superclass {
    declare deletedAt: DateTime | null

    /** Rows that are not soft deleted. */
    static active = scope((query: ModelQueryBuilderContract<typeof BaseModel>) => {
      query.whereNull(`${query.model.table}.deleted_at`)
    })

    /** Soft-deleted rows only. */
    static trashed = scope((query: ModelQueryBuilderContract<typeof BaseModel>) => {
      query.whereNotNull(`${query.model.table}.deleted_at`)
    })

    get isDeleted() {
      return this.deletedAt !== null
    }

    async softDelete() {
      this.deletedAt = DateTime.now()
      await this.save()
    }

    async restore() {
      this.deletedAt = null
      await this.save()
    }
  }

  return SoftDeletes
}
