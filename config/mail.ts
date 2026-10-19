import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

/**
 * Outgoing email (recipient notifications). Sending is skipped entirely
 * unless `MAIL_ENABLED=true` (see `TransferService.complete`), so the SMTP
 * settings may stay empty where email isn't set up.
 */
const mailConfig = defineConfig({
  default: 'smtp',

  from: {
    address: env.get('MAIL_FROM_ADDRESS', 'share@localhost'),
    name: env.get('MAIL_FROM_NAME', 'CovetDrop'),
  },

  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST', 'localhost'),
      port: env.get('SMTP_PORT', 587),
      secure: env.get('SMTP_SECURE', false),
      ...(env.get('SMTP_USERNAME')
        ? {
            auth: {
              type: 'login' as const,
              user: env.get('SMTP_USERNAME')!,
              pass: env.get('SMTP_PASSWORD')?.release() ?? '',
            },
          }
        : {}),
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
