import { test } from '@japa/runner'
import drive from '@adonisjs/drive/services/main'
import StorageService, { attachmentDisposition } from '#services/storage_service'

test.group('StorageService', (group) => {
  group.each.setup(() => {
    const fake = drive.fake()
    return () => {
      fake.clear()
      drive.restore()
    }
  })

  test('presignUpload returns a PUT URL and the Content-Type header to send', async ({
    assert,
  }) => {
    const upload = await StorageService.presignUpload('transfers/a/1', {
      contentType: 'application/pdf',
      sizeBytes: 42,
    })
    assert.isString(upload.url)
    assert.include(upload.url, 'transfers/a/1')
    assert.equal(upload.method, 'PUT')
    assert.deepEqual(upload.headers, { 'Content-Type': 'application/pdf' })
  })

  test('presignDownload returns a URL', async ({ assert }) => {
    const url = await StorageService.presignDownload('transfers/a/1', { filename: 'a.pdf' })
    assert.isString(url)
    assert.include(url, 'transfers/a/1')
  })

  test('presignDownload encodes a filename with spaces and ü', async ({ assert }) => {
    const url = await StorageService.presignDownload('transfers/a/1', {
      filename: 'Über report (v2).pdf',
    })
    const disposition = new URL(url, 'http://local').searchParams.get('contentDisposition')
    assert.equal(
      disposition,
      `attachment; filename="_ber report (v2).pdf"; filename*=UTF-8''%C3%9Cber%20report%20%28v2%29.pdf`
    )
  })

  test('attachmentDisposition strips quotes and backslashes from the fallback', ({ assert }) => {
    assert.equal(
      attachmentDisposition('a"b\\c.txt'),
      `attachment; filename="a_b_c.txt"; filename*=UTF-8''a%22b%5Cc.txt`
    )
    assert.equal(
      attachmentDisposition('日本'),
      `attachment; filename="__"; filename*=UTF-8''%E6%97%A5%E6%9C%AC`
    )
  })

  test('delete on a missing key does not throw', async () => {
    await StorageService.delete('transfers/missing/file')
  })

  test('delete removes an object', async ({ assert }) => {
    await drive.use().put('transfers/a/1', 'hello')
    await StorageService.delete('transfers/a/1')
    assert.isNull(await StorageService.stat('transfers/a/1'))
  })

  test('stat returns the size of a stored object and null when missing', async ({ assert }) => {
    await drive.use().put('transfers/a/1', 'hello world')
    assert.deepEqual(await StorageService.stat('transfers/a/1'), { sizeBytes: 11 })
    assert.isNull(await StorageService.stat('transfers/a/2'))
  })

  test('deletePrefix removes everything under the prefix only', async ({ assert }) => {
    const disk = drive.use()
    await disk.put('transfers/x/1', 'one')
    await disk.put('transfers/x/2', 'two')
    await disk.put('transfers/y/1', 'other')

    await StorageService.deletePrefix('transfers/x/')

    assert.isNull(await StorageService.stat('transfers/x/1'))
    assert.isNull(await StorageService.stat('transfers/x/2'))
    assert.deepEqual(await StorageService.stat('transfers/y/1'), { sizeBytes: 5 })
  })

  test('deletePrefix on a missing prefix does not throw', async () => {
    await StorageService.deletePrefix('transfers/none/')
  })
})
