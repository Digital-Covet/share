import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { errors, MailResponse } from '@adonisjs/mail'
import type { MailTransportContract, NodeMailerMessage, Recipient } from '@adonisjs/mail/types'
import { SendMailClient } from 'zeptomail'

export type ZeptoMailConfig = {
  /** Full send endpoint, e.g. `https://api.zeptomail.in/v1.1/email`. */
  url: string
  /** Send Mail token from the Mail Agent; the `Zoho-enczapikey ` prefix is optional. */
  token: string
  trackOpens?: boolean
  trackClicks?: boolean
  /** Give up on a request after this many milliseconds. */
  timeoutMs?: number
}

type ZeptoPayload = Parameters<SendMailClient['sendMail']>[0]

/** What the transport needs from the SDK; tests pass a fake. */
export type ZeptoMailClient = { sendMail(payload: ZeptoPayload): Promise<unknown> }

type Address = { address: string; name?: string }

const AUTH_SCHEME = 'Zoho-enczapikey'

/**
 * `@adonisjs/mail` transport for the ZeptoMail (Zoho) send-mail API. The
 * built-in transports don't cover ZeptoMail; this maps the compiled message
 * onto the API payload and calls the official SDK. Every failure is raised as
 * `E_MAIL_TRANSPORT_ERROR`, so queue retries behave as with SMTP.
 */
export class ZeptoMailTransport implements MailTransportContract {
  #config: ZeptoMailConfig
  #client: ZeptoMailClient

  constructor(config: ZeptoMailConfig, client?: ZeptoMailClient) {
    this.#config = config
    this.#client =
      client ??
      new SendMailClient({ url: config.url, token: ZeptoMailTransport.authHeader(config.token) })
  }

  /** The SDK sends the token verbatim as `Authorization`. */
  static authHeader(token: string) {
    const trimmed = token.trim()
    return trimmed.startsWith(AUTH_SCHEME) ? trimmed : `${AUTH_SCHEME} ${trimmed}`
  }

  async send(message: NodeMailerMessage): Promise<MailResponse<unknown>> {
    let body: unknown
    try {
      body = await this.#withTimeout(this.#client.sendMail(await this.#payload(message)))
    } catch (error) {
      throw new errors.E_MAIL_TRANSPORT_ERROR(
        `Unable to send email using the zeptomail transport: ${describe(error)}`,
        { cause: error }
      )
    }

    const from = message.from ? toAddress(message.from).address : false
    const to = [...(message.to ?? []), ...(message.cc ?? []), ...(message.bcc ?? [])].map(
      (r) => toAddress(r).address
    )
    const requestId = (body as { request_id?: unknown } | null)?.request_id
    const messageId =
      typeof requestId === 'string' ? requestId : (message.messageId ?? `<${randomUUID()}>`)
    return new MailResponse(messageId, { from, to }, body)
  }

  async #payload(message: NodeMailerMessage): Promise<ZeptoPayload> {
    if (!message.from) throw new Error('missing from address')
    const from = toAddress(message.from)
    const payload: Record<string, unknown> = {
      from: { address: from.address, name: from.name ?? '' },
      to: (message.to ?? []).map(emailAddress),
      subject: message.subject ?? '',
      track_opens: this.#config.trackOpens ?? false,
      track_clicks: this.#config.trackClicks ?? false,
    }
    if (message.cc?.length) payload.cc = message.cc.map(emailAddress)
    if (message.bcc?.length) payload.bcc = message.bcc.map(emailAddress)
    if (message.replyTo?.length) payload.reply_to = message.replyTo.map(toAddress)
    if (message.html) payload.htmlbody = await contentToString(message.html)
    if (message.text) payload.textbody = await contentToString(message.text)

    const headers = stringHeaders(message.headers)
    if (headers) payload.mime_headers = headers

    const attachments = []
    const inlineImages = []
    for (const attachment of message.attachments ?? []) {
      const bytes = await attachmentContent(attachment)
      const content = bytes.toString('base64')
      const mimeType = attachment.contentType
      if (attachment.cid) {
        inlineImages.push({ cid: attachment.cid, content, mime_type: mimeType })
      } else {
        attachments.push({
          name: attachment.filename || 'attachment',
          content,
          mime_type: mimeType,
        })
      }
    }
    if (attachments.length) payload.attachments = attachments
    if (inlineImages.length) payload.inline_images = inlineImages

    return payload as unknown as ZeptoPayload
  }

  /** The SDK can leave a promise pending (e.g. a non-JSON error body). */
  #withTimeout<T>(promise: Promise<T>): Promise<T> {
    const ms = this.#config.timeoutMs ?? 30_000
    let timer: NodeJS.Timeout
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`request timed out after ${ms}ms`)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }
}

/** Config helper, used like `transports.smtp(...)` in `config/mail.ts`. */
export function zeptomail(config: ZeptoMailConfig) {
  return () => new ZeptoMailTransport(config)
}

function toAddress(recipient: Recipient): Address {
  if (typeof recipient !== 'string') {
    return recipient.name ? recipient : { address: recipient.address }
  }
  // "Name <address>" form
  const match = recipient.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (match) return match[1] ? { address: match[2], name: match[1] } : { address: match[2] }
  return { address: recipient.trim() }
}

function emailAddress(recipient: Recipient) {
  return { email_address: toAddress(recipient) }
}

type Content = NonNullable<NodeMailerMessage['html']>
type Attachment = NonNullable<NodeMailerMessage['attachments']>[number]

async function contentToString(content: Content): Promise<string> {
  if (typeof content === 'string') return content
  if (Buffer.isBuffer(content)) return content.toString('utf8')
  if (content instanceof Readable) {
    const bytes = await streamToBuffer(content)
    return bytes.toString('utf8')
  }
  if ('path' in content && typeof content.path === 'string') return readFile(content.path, 'utf8')
  throw new Error('unsupported message body')
}

async function attachmentContent(attachment: Attachment): Promise<Buffer> {
  const { content, path, encoding } = attachment
  if (typeof content === 'string') {
    return Buffer.from(content, (encoding as BufferEncoding | undefined) ?? 'utf8')
  }
  if (Buffer.isBuffer(content)) return content
  if (content instanceof Readable) return streamToBuffer(content)
  if (typeof path === 'string' && !/^https?:\/\//.test(path)) return readFile(path)
  throw new Error(`unsupported attachment "${attachment.filename ?? 'unnamed'}"`)
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function stringHeaders(headers: NodeMailerMessage['headers']) {
  if (!headers || Array.isArray(headers)) return undefined
  const entries = Object.entries(headers).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  )
  return entries.length ? Object.fromEntries(entries) : undefined
}

/**
 * The SDK rejects with a string (validation), the API's JSON error body, or
 * a network error. Never includes the token.
 */
function describe(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  const apiError = (error as { error?: { code?: string; message?: string; details?: unknown } })
    ?.error
  if (apiError) {
    const details = Array.isArray(apiError.details)
      ? apiError.details
          .map((d: { message?: string; target?: string }) =>
            [d.target, d.message].filter(Boolean).join(': ')
          )
          .join('; ')
      : ''
    return [apiError.code, apiError.message, details].filter(Boolean).join(' - ')
  }
  return 'unknown error'
}
