import type { HttpContext } from '@adonisjs/core/http'
import TransferListService from '#services/transfer_list_service'
import TransferTransformer from '#transformers/transfer_transformer'

/** The signed-in landing page: the latest sent and received transfers. */
export default class DashboardController {
  /** GET /dashboard */
  async show({ inertia, auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const [sent, received] = await Promise.all([
      TransferListService.latest(user, 'sent'),
      TransferListService.latest(user, 'received'),
    ])

    return inertia.render('dashboard', {
      sent: TransferTransformer.transform(sent).useVariant('toListItem'),
      received: TransferTransformer.transform(received).useVariant('toListItem'),
    })
  }
}
