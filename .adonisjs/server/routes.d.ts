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
    'users.search': { paramsTuple?: []; params?: {} }
    'transfers.index': { paramsTuple?: []; params?: {} }
    'transfers.create': { paramsTuple?: []; params?: {} }
    'transfers.store': { paramsTuple?: []; params?: {} }
    'transfers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transfers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transfers.complete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transfers.download': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'fileId': ParamValue} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'iam.redirect': { paramsTuple?: []; params?: {} }
    'iam.callback': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'users.search': { paramsTuple?: []; params?: {} }
    'transfers.index': { paramsTuple?: []; params?: {} }
    'transfers.create': { paramsTuple?: []; params?: {} }
    'transfers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'iam.redirect': { paramsTuple?: []; params?: {} }
    'iam.callback': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'users.search': { paramsTuple?: []; params?: {} }
    'transfers.index': { paramsTuple?: []; params?: {} }
    'transfers.create': { paramsTuple?: []; params?: {} }
    'transfers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  POST: {
    'session.destroy': { paramsTuple?: []; params?: {} }
    'transfers.store': { paramsTuple?: []; params?: {} }
    'transfers.complete': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'transfers.download': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'fileId': ParamValue} }
  }
  DELETE: {
    'transfers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}