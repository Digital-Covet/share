import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

export default {
  types: {
    /** Postgres `inet` is returned by `pg` as a string. */
    inet: { tsType: 'string', decorators: [{ name: '@column' }] },
  },
  tables: {
    transfer: {
      columns: {
        /** Never expose the password hash when serializing. */
        password_hash: {
          tsType: 'string',
          decorators: [{ name: '@column', args: { serializeAs: null } }],
        },
      },
    },
    transfer_file: {
      columns: {
        /** BIGINT parsed to number (see config/database.ts); capped at 5 GiB. */
        size_bytes: { tsType: 'number', decorators: [{ name: '@column' }] },
      },
    },
    transfer_download: {
      columns: {
        /** Set on insert so the model holds the timestamp without a refresh. */
        downloaded_at: {
          tsType: 'DateTime',
          decorators: [{ name: '@column.dateTime', args: { autoCreate: true } }],
        },
      },
    },
  },
} satisfies SchemaRules
