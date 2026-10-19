import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'
import { zeptomail } from '#mails/transports/zeptomail'

/**
 * Outgoing email (recipient notifications, download receipts, expiry
 * reminders). Sending is skipped entirely unless `MAIL_ENABLED=true`, so the
 * mailer settings may stay empty where email isn't set up. `MAIL_MAILER`
 * picks the delivery path: `zeptomail` (ZeptoMail HTTP API, production) or
 * `smtp` (local relays such as Mailpit).
 */
const mailer = env.get('MAIL_MAILER', 'smtp')
const zeptomailToken = env.get('ZEPTOMAIL_TOKEN')?.release() ?? ''

if (env.get('MAIL_ENABLED', false) && mailer === 'zeptomail' && !zeptomailToken) {
  throw new Error('MAIL_MAILER=zeptomail needs ZEPTOMAIL_TOKEN (the Mail Agent send-mail token)')
}

const mailConfig = defineConfig({
  default: mailer,

  from: {
    address: env.get('MAIL_FROM_ADDRESS', 'share@localhost'),
    name: env.get('MAIL_FROM_NAME', 'CovetDrop'),
  },

  mailers: {
    zeptomail: zeptomail({
      url: env.get('ZEPTOMAIL_URL', 'https://cpaas.zoho.in/v1.1/email'),
      token: zeptomailToken,
      // Internal notices: no open/click tracking.
      trackOpens: false,
      trackClicks: false,
    }),

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
