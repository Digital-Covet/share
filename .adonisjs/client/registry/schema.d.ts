/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractRawResponse, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'session.create': {
    methods: ["GET","HEAD"]
    pattern: '/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/session_controller').default['create']>>>
    }
  }
  'iam.redirect': {
    methods: ["GET","HEAD"]
    pattern: '/auth/iam/redirect'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/iam_controller').default['redirect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/iam_controller').default['redirect']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/iam_controller').default['redirect']>>>
    }
  }
  'iam.callback': {
    methods: ["GET","HEAD"]
    pattern: '/auth/iam/callback'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/iam_controller').default['callback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/iam_controller').default['callback']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/iam_controller').default['callback']>>>
    }
  }
  'dashboard': {
    methods: ["GET","HEAD"]
    pattern: '/dashboard'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['show']>>>
    }
  }
  'session.destroy': {
    methods: ["POST"]
    pattern: '/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/session_controller').default['destroy']>>>
    }
  }
  'users.search': {
    methods: ["GET","HEAD"]
    pattern: '/users/search'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/users_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/users_controller').default['search']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/users_controller').default['search']>>>
    }
  }
  'transfers.index': {
    methods: ["GET","HEAD"]
    pattern: '/transfers'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['index']>>>
    }
  }
  'transfers.create': {
    methods: ["GET","HEAD"]
    pattern: '/transfers/new'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['create']>>>
    }
  }
  'transfers.store': {
    methods: ["POST"]
    pattern: '/transfers'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/transfer').createTransferValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/transfer').createTransferValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'transfers.show': {
    methods: ["GET","HEAD"]
    pattern: '/transfers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['show']>>>
    }
  }
  'transfers.destroy': {
    methods: ["DELETE"]
    pattern: '/transfers/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['destroy']>>>
    }
  }
  'transfers.complete': {
    methods: ["POST"]
    pattern: '/transfers/:id/complete'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/transfer').completeTransferValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/transfer').completeTransferValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['complete']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['complete']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['complete']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'transfers.download': {
    methods: ["POST"]
    pattern: '/transfers/:id/download/:fileId'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/download').downloadValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { id: ParamValue; fileId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/download').downloadValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['download']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['download']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/transfers_controller').default['download']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
}
