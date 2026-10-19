/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import { throttleCreates, throttleDownloads } from '#start/limiter'

router.on('/').renderInertia('home', {}).as('home')

router
  .group(() => {
    router.get('login', [controllers.Session, 'create'])
    router.get('auth/iam/redirect', [controllers.Iam, 'redirect'])
    router.get('auth/iam/callback', [controllers.Iam, 'callback'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.get('dashboard', [controllers.Dashboard, 'show']).as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])

    router.get('users/search', [controllers.Users, 'search']).as('users.search')

    router.get('transfers', [controllers.Transfers, 'index']).as('transfers.index')
    router.get('transfers/new', [controllers.Transfers, 'create']).as('transfers.create')
    router
      .post('transfers', [controllers.Transfers, 'store'])
      .use(throttleCreates)
      .as('transfers.store')
    router
      .get('transfers/:id', [controllers.Transfers, 'show'])
      .where('id', router.matchers.uuid())
      .as('transfers.show')
    router
      .delete('transfers/:id', [controllers.Transfers, 'destroy'])
      .where('id', router.matchers.uuid())
      .as('transfers.destroy')
    router
      .post('transfers/:id/complete', [controllers.Transfers, 'complete'])
      .where('id', router.matchers.uuid())
      .as('transfers.complete')
    router
      .post('transfers/:id/download/:fileId', [controllers.Transfers, 'download'])
      .where('id', router.matchers.uuid())
      .where('fileId', router.matchers.uuid())
      .use(throttleDownloads)
      .as('transfers.download')
  })
  .use([middleware.auth(), middleware.iamRecheck()])
