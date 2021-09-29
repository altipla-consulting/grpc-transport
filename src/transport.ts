
import { ClientStreamingCall, Deferred, DuplexStreamingCall, mergeRpcOptions, MethodInfo, RpcMetadata, RpcOptions, RpcStatus, RpcTransport, ServerStreamingCall, UnaryCall, RpcError } from '@protobuf-ts/runtime-rpc'
import { HttpRule } from './protos/google/api/http'
import { readMethodOption } from '@protobuf-ts/runtime-rpc'
import { isFunction, isObject } from 'lodash-es'
import { StatusCode } from './status-code'
import { buildURL } from './binding'


export interface TransportConfig {
  server: string
  authorization?: string | (() => string)
}

export class Transport implements RpcTransport {
  private defaults: RpcOptions

  constructor(private config: TransportConfig) {
    this.defaults = {}
  }

  mergeOptions(options?: Partial<RpcOptions>): RpcOptions {
    return mergeRpcOptions(this.defaults, options)
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  unary<I extends object, O extends object>(method: MethodInfo<I, O>, input: I, options: RpcOptions): UnaryCall<I, O> {
    let defHeader = new Deferred<RpcMetadata>()
    let defMessage = new Deferred<O>()
    let defStatus = new Deferred<RpcStatus>()
    let defTrailer = new Deferred<RpcMetadata>()

    let rule = readMethodOption(method.service, method.localName, 'google.api.http', HttpRule)
    if (!rule?.pattern?.oneofKind) {
      throw new Error(`method is not binding to HTTP requests: ${method.service.typeName}.${method.name}`)
    }

    let path = buildURL(getPath(rule), input as any)

    // Build the full URL we will request with the host from the options
    // and the path from the replaced bindings we receive.
    // 
    // We remove the search for later add the fields we want to it.
    let endpoint = new URL(this.config.server + path)

    // Remove from body all those fields present in the URL.
    // unsetKeys.forEach(key => unset(req, key));

    let opts = {
      method: rule.pattern.oneofKind.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
      },
    } as any

    let req = method.I.toJson(input, options.jsonOptions)
    if (rule.body) {
      opts.body = JSON.stringify(req || {})
    } else {
      let qs = req ? flat({}, req) : {}
      let search = new URLSearchParams()
      for (let [key, value] of Object.entries(qs)) {
        search.set(key, value)
      }
      endpoint.search = search.toString() ? `?${search.toString()}` : ''
    }

    if (this.config.authorization) {
      opts.headers.Authorization = isFunction(this.config.authorization) ? this.config.authorization() : this.config.authorization
    }

    window.fetch(endpoint.toString(), opts)
      .then(response => {
        let meta = parseMetadataFromResponseHeaders(response.headers)
        defHeader.resolve(meta)

        if (response.status !== 200) {
          let code = response.headers.get('grpc-status')
          let message = response.headers.get('grpc-message') || ''
          if (code) {
            defStatus.resolve({ code: 'OK', detail: '' })
            throw new RpcError(message, StatusCode[parseInt(code, 10)], meta)
          }

          let err = new Error(response.statusText)
          throw err
        }

        return response.json()
      })
      .then(value => {
        defMessage.resolve(method.O.fromJson(value, options.jsonOptions))
        defStatus.resolve({ code: 'OK', detail: '' })
        defTrailer.resolve({})
      })
      .catch(err => {
        defHeader.rejectPending(err)
        defMessage.rejectPending(err)
        defStatus.rejectPending(err)
        defTrailer.rejectPending(err)
      })

    return new UnaryCall<I, O>(
      method,
      options.meta ?? {},
      input,
      defHeader.promise,
      defMessage.promise,
      defStatus.promise,
      defTrailer.promise,
    )
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  serverStreaming<I extends object, O extends object>(_method: MethodInfo<I, O>, _input: I, _options: RpcOptions): ServerStreamingCall<I, O> {
    throw new Error('unimplemented server streaming')
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  clientStreaming<I extends object, O extends object>(_method: MethodInfo<I, O>, _options: RpcOptions): ClientStreamingCall<I, O> {
    throw new Error('unimplemented client streaming')
  }
  
  // eslint-disable-next-line @typescript-eslint/ban-types
  duplex<I extends object, O extends object>(_method: MethodInfo<I, O>, _options: RpcOptions): DuplexStreamingCall<I, O> {
    throw new Error('unimplemented duplex streaming')
  }
}

function parseMetadataFromResponseHeaders(headers: Headers): RpcMetadata {
  let meta: RpcMetadata = {}
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'content-type')
      return
    if (key.toLowerCase() === 'content-length')
      return
    // eslint-disable-next-line no-prototype-builtins
    if (meta.hasOwnProperty(key))
      (meta[key] as string[]).push(value)
    else
      meta[key] = value
  })
  return meta
}

function getPath(rule: HttpRule): string {
  switch (rule.pattern.oneofKind) {
    case 'get':
      return rule.pattern.get
    case 'post':
      return rule.pattern.post
    case 'put':
      return rule.pattern.put
    case 'delete':
      return rule.pattern.delete
  }

  throw new Error(`unsupported method binding: ${rule.pattern.oneofKind}`)
}

function flat(output: { [key: string]: any }, input: any, prefix = '') {
  for (let [key, value] of Object.entries(input)) {
    if (isObject(value)) {
      flat(output, value as any, `${prefix}${key}.`)
      continue
    }
    output[`${prefix}${key}`] = value
  }
  return output
}
