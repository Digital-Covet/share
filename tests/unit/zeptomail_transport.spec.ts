import { test } from '@japa/runner'
import { errors } from '@adonisjs/mail'
import { ZeptoMailTransport, type ZeptoMailClient } from '#mails/transports/zeptomail'

const config = { url: 'https://api.zeptomail.in/v1.1/email', token: 'secret-token' }

/** A client that records payloads and answers with `reply` (or rejects with it). */
function fakeClient(reply: unknown = { request_id: 'req-123', message: 'OK' }, fail = false) {
  const payloads: any[] = []
  const client: ZeptoMailClient = {
    async sendMail(payload) {
      payloads.push(payload)
      if (fail) throw reply
      return reply
    },
  }
  return { client, payloads }
}

test.group('ZeptoMailTransport', () => {
  test('maps the message onto the ZeptoMail payload', async ({ assert }) => {
    const { client, payloads } = fakeClient()
    const transport = new ZeptoMailTransport(config, client)

    await transport.send({
      from: { address: 'share@digitalcovet.com', name: 'CovetDrop' },
      to: [{ address: 'ada@example.com', name: 'Ada' }, 'bob@example.com'],
      cc: ['Carol <carol@example.com>'],
      bcc: ['dan@example.com'],
      replyTo: ['help@example.com'],
      subject: 'Hello',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: { 'X-Transfer': 'abc' },
      attachments: [
        { filename: 'a.txt', content: 'hello', contentType: 'text/plain' },
        { filename: 'logo.png', content: Buffer.from([1, 2, 3]), cid: 'logo' },
      ],
    })

    assert.deepEqual(payloads[0], {
      from: { address: 'share@digitalcovet.com', name: 'CovetDrop' },
      to: [
        { email_address: { address: 'ada@example.com', name: 'Ada' } },
        { email_address: { address: 'bob@example.com' } },
      ],
      cc: [{ email_address: { address: 'carol@example.com', name: 'Carol' } }],
      bcc: [{ email_address: { address: 'dan@example.com' } }],
      reply_to: [{ address: 'help@example.com' }],
      subject: 'Hello',
      htmlbody: '<p>Hi</p>',
      textbody: 'Hi',
      track_opens: false,
      track_clicks: false,
      mime_headers: { 'X-Transfer': 'abc' },
      attachments: [
        {
          name: 'a.txt',
          content: Buffer.from('hello').toString('base64'),
          mime_type: 'text/plain',
        },
      ],
      inline_images: [
        { cid: 'logo', content: Buffer.from([1, 2, 3]).toString('base64'), mime_type: undefined },
      ],
    })
  })

  test('returns the request id as the message id, with the envelope', async ({ assert }) => {
    const { client } = fakeClient()
    const transport = new ZeptoMailTransport(config, client)

    const response = await transport.send({
      from: 'share@digitalcovet.com',
      to: ['ada@example.com'],
      bcc: ['dan@example.com'],
      subject: 'Hello',
    })

    assert.equal(response.messageId, 'req-123')
    assert.deepEqual(response.envelope, {
      from: 'share@digitalcovet.com',
      to: ['ada@example.com', 'dan@example.com'],
    })
  })

  test('adds the Zoho-enczapikey scheme to the token once', ({ assert }) => {
    assert.equal(ZeptoMailTransport.authHeader('abc'), 'Zoho-enczapikey abc')
    assert.equal(ZeptoMailTransport.authHeader(' Zoho-enczapikey abc '), 'Zoho-enczapikey abc')
  })

  test('API errors become E_MAIL_TRANSPORT_ERROR with the API message', async ({ assert }) => {
    const apiError = {
      error: {
        code: 'TM_3201',
        message: 'Mandatory Field missing',
        details: [{ target: 'subject', message: 'This field is required' }],
      },
    }
    const { client } = fakeClient(apiError, true)
    const transport = new ZeptoMailTransport(config, client)

    const error = await transport
      .send({ from: 'share@digitalcovet.com', to: ['ada@example.com'], subject: 'x' })
      .catch((e) => e)

    assert.instanceOf(error, errors.E_MAIL_TRANSPORT_ERROR)
    assert.include(error.message, 'TM_3201')
    assert.include(error.message, 'subject: This field is required')
    assert.notInclude(error.message, 'secret-token')
    assert.equal(error.cause, apiError)
  })

  test('a request that never settles times out', async ({ assert }) => {
    const client: ZeptoMailClient = { sendMail: () => new Promise(() => {}) }
    const transport = new ZeptoMailTransport({ ...config, timeoutMs: 20 }, client)

    const error = await transport
      .send({ from: 'share@digitalcovet.com', to: ['ada@example.com'], subject: 'x' })
      .catch((e) => e)

    assert.instanceOf(error, errors.E_MAIL_TRANSPORT_ERROR)
    assert.include(error.message, 'timed out')
  })
})
