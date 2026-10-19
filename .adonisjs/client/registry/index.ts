/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [[0,"/"]],
    types: placeholder as Registry['home']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [[0,"login"]],
    types: placeholder as Registry['session.create']['types'],
  },
  'iam.redirect': {
    methods: ["GET","HEAD"],
    pattern: '/auth/iam/redirect',
    tokens: [[0,"auth"],[0,"iam"],[0,"redirect"]],
    types: placeholder as Registry['iam.redirect']['types'],
  },
  'iam.callback': {
    methods: ["GET","HEAD"],
    pattern: '/auth/iam/callback',
    tokens: [[0,"auth"],[0,"iam"],[0,"callback"]],
    types: placeholder as Registry['iam.callback']['types'],
  },
  'dashboard': {
    methods: ["GET","HEAD"],
    pattern: '/dashboard',
    tokens: [[0,"dashboard"]],
    types: placeholder as Registry['dashboard']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [[0,"logout"]],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'users.search': {
    methods: ["GET","HEAD"],
    pattern: '/users/search',
    tokens: [[0,"users"],[0,"search"]],
    types: placeholder as Registry['users.search']['types'],
  },
  'transfers.index': {
    methods: ["GET","HEAD"],
    pattern: '/transfers',
    tokens: [[0,"transfers"]],
    types: placeholder as Registry['transfers.index']['types'],
  },
  'transfers.create': {
    methods: ["GET","HEAD"],
    pattern: '/transfers/new',
    tokens: [[0,"transfers"],[0,"new"]],
    types: placeholder as Registry['transfers.create']['types'],
  },
  'transfers.store': {
    methods: ["POST"],
    pattern: '/transfers',
    tokens: [[0,"transfers"]],
    types: placeholder as Registry['transfers.store']['types'],
  },
  'transfers.show': {
    methods: ["GET","HEAD"],
    pattern: '/transfers/:id',
    tokens: [[0,"transfers"],[1,"id"]],
    types: placeholder as Registry['transfers.show']['types'],
  },
  'transfers.destroy': {
    methods: ["DELETE"],
    pattern: '/transfers/:id',
    tokens: [[0,"transfers"],[1,"id"]],
    types: placeholder as Registry['transfers.destroy']['types'],
  },
  'transfers.complete': {
    methods: ["POST"],
    pattern: '/transfers/:id/complete',
    tokens: [[0,"transfers"],[1,"id"],[0,"complete"]],
    types: placeholder as Registry['transfers.complete']['types'],
  },
  'transfers.download': {
    methods: ["POST"],
    pattern: '/transfers/:id/download/:fileId',
    tokens: [[0,"transfers"],[1,"id"],[0,"download"],[1,"fileId"]],
    types: placeholder as Registry['transfers.download']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
