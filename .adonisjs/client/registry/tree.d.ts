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
}
