/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  session: {
    create: typeof routes['session.create']
    destroy: typeof routes['session.destroy']
  }
  iam: {
    redirect: typeof routes['iam.redirect']
    callback: typeof routes['iam.callback']
  }
  dashboard: typeof routes['dashboard']
  users: {
    search: typeof routes['users.search']
  }
  transfers: {
    index: typeof routes['transfers.index']
    create: typeof routes['transfers.create']
    store: typeof routes['transfers.store']
    show: typeof routes['transfers.show']
    destroy: typeof routes['transfers.destroy']
    complete: typeof routes['transfers.complete']
    download: typeof routes['transfers.download']
  }
}
