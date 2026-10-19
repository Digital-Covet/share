import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'iam.redirect': { paramsTuple?: []; params?: {} }
    'iam.callback': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'iam.redirect': { paramsTuple?: []; params?: {} }
    'iam.callback': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'iam.redirect': { paramsTuple?: []; params?: {} }
    'iam.callback': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'session.destroy': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}