import type { HttpContext } from '@adonisjs/core/http'
import TransferService from '#services/transfer_service'
import DownloadService from '#services/download_service'
import TransferListService, { type TransferTab } from '#services/transfer_list_service'
import { downloadValidator } from '#validators/download'
import TransferPolicy from '#policies/transfer_policy'
import TransferTransformer from '#transformers/transfer_transformer'
import {
  completeTransferValidator,
  createTransferValidator,
  maxFileBytes,
} from '#validators/transfer'

/**
 * Transfers. `store`, `complete` and `download` are REST/JSON endpoints called with
 * `fetch` (send `Accept: application/json` and the `X-XSRF-TOKEN` header).
 */
export default class TransfersController {
  /** GET /transfers?tab=sent|received|all&page= — my transfers (admins: all), 20 per page. */
  async index({ inertia, request, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const requested = request.input('tab')
    const tab: TransferTab =
      requested === 'received' || (requested === 'all' && user.isAdmin) ? requested : 'sent'
    const page = Math.max(1, Number.parseInt(request.input('page'), 10) || 1)
    const transfers = await TransferListService.paginate(user, tab, page)

    return inertia.render('transfers/index', {
      tab,
      canSeeAll: user.isAdmin,
      transfers: TransferTransformer.transform(transfers.all()).useVariant('toListItem'),
      pagination: {
        currentPage: transfers.currentPage,
        lastPage: transfers.lastPage,
        perPage: transfers.perPage,
        total: transfers.total,
      },
    })
  }

  /** GET /transfers/new — the page uploads straight to storage, so it needs the size cap. */
  async create({ inertia }: HttpContext) {
    return inertia.render('transfers/new', { maxFileBytes: maxFileBytes() })
  }

  /** GET /transfers/:id — details for the creator and (once confirmed) recipients; 404 otherwise. */
  async show({ inertia, params, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const transfer = await TransferPolicy.findViewableOrFail(user, params.id)
    const isCreator = transfer.createdBy === user.id

    await transfer.load((loader) => {
      loader
        .load('creator')
        .load('files', (files) => files.whereNull('deleted_at').orderBy('filename'))
      if (isCreator) loader.load('recipientUsers', (users) => users.orderBy('name'))
    })
    await transfer.loadCount('downloads', (downloads) => downloads.where('success', true))

    return inertia.render('transfers/show', {
      transfer: TransferTransformer.transform(transfer),
      canDelete: await TransferPolicy.canDelete(user, transfer),
    })
  }

  /**
   * DELETE /transfers/:id — soft delete (storage objects are purged later by
   * the cleanup job). 404 when not viewable, 403 for plain recipients.
   * Inertia form submissions are redirected to the list with a flash; other
   * clients get 204.
   */
  async destroy({ request, response, params, auth, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const transfer = await TransferPolicy.findViewableOrFail(user, params.id)
    if (!(await TransferPolicy.canDelete(user, transfer))) {
      return response.forbidden({ error: 'forbidden' })
    }

    await transfer.softDelete()

    if (request.header('x-inertia')) {
      session.flash('success', 'Transfer deleted')
      return response.redirect().toRoute('transfers.index')
    }
    return response.noContent()
  }

  /** POST /transfers — create a transfer and get presigned upload URLs. */
  async store({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createTransferValidator, {
      meta: { userId: user.id },
    })
    return response.created(await TransferService.create(user, payload))
  }

  /** POST /transfers/:id/complete — confirm uploads and write the file rows. */
  async complete({ request, response, params, auth }: HttpContext) {
    const { uploadToken } = await request.validateUsing(completeTransferValidator)
    const result = await TransferService.complete(auth.getUserOrFail(), params.id, uploadToken)

    if (result.ok) {
      return { transferId: result.transferId, firstConfirmation: result.firstConfirmation }
    }
    if (result.error === 'invalid_upload_token') {
      return response.unprocessableEntity({ error: result.error })
    }
    return response.conflict({ error: result.error, fileIds: result.fileIds })
  }

  /** POST /transfers/:id/download/:fileId — check access and limits, then hand out a presigned GET. */
  async download({ request, response, params, auth }: HttpContext) {
    const { password } = await request.validateUsing(downloadValidator)
    const result = await DownloadService.authorize(
      auth.getUserOrFail(),
      params.id,
      params.fileId,
      password ?? null,
      { ip: request.ip(), userAgent: request.header('user-agent') ?? null }
    )

    if (result.ok) return { url: result.url, expiresAt: result.expiresAt }
    switch (result.error) {
      case 'not_found':
        return response.notFound({ error: result.error })
      case 'forbidden':
      case 'invalid_password':
        return response.forbidden({ error: result.error })
      case 'expired':
      case 'download_limit_reached':
        return response.gone({ error: result.error })
      case 'rate_limited':
        return response.tooManyRequests({ error: result.error })
    }
  }
}
