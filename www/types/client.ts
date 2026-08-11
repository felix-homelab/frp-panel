import { AuthMethod, AuthScope, LogConfig, QUICOptions, TLSConfig, WebServerConfig } from './common'
import { TypedProxyConfig } from './proxy'
import { TypedVisitorConfig } from './visitor'

export interface AuthOIDCClientConfig {
  clientID?: string
  clientSecret?: string
  audience?: string
  scope?: string
  tokenEndpointURL?: string
  additionalEndpointParams?: { [key: string]: string }
}

export interface AuthClientConfig {
  method?: AuthMethod
  additionalScopes?: AuthScope[]
  token?: string
  oidc?: AuthOIDCClientConfig
}

export interface ClientTransportConfig {
  protocol?: string
  dialServerTimeout?: number
  // frp's JSON tag is lowercase-a `dialServerKeepalive` even though the Go field is
  // DialServerKeepAlive. The loader runs strict, so the tag spelling is the only one
  // that decodes.
  dialServerKeepalive?: number
  connectServerLocalIP?: string
  proxyURL?: string
  poolCount?: number
  tcpMux?: boolean
  tcpMuxKeepaliveInterval?: number
  quic?: QUICOptions
  heartbeatInterval?: number
  heartbeatTimeout?: number
  tls?: TLSClientConfig
  // frp >= v0.69. Selects the frpc/frps internal wire protocol; defaults to 'v1'.
  // Leave unset unless every frps in the fleet has been upgraded first -- a 'v2' frpc
  // cannot connect to an frps that predates v0.69.
  wireProtocol?: 'v1' | 'v2'
}

// frp embeds TLSConfig with no JSON tag, so its fields are inlined here rather than
// nested under a `tls` key. `transport.tls.tls.certFile` is an unknown field and the
// strict loader rejects the whole config.
export interface TLSClientConfig {
  enable?: boolean
  disableCustomTLSFirstByte?: boolean
  certFile?: string
  keyFile?: string
  trustedCaFile?: string
  serverName?: string
}

export interface CompleteTLSClientConfig extends TLSClientConfig {
  enable: boolean
  disableCustomTLSFirstByte: boolean
}

export interface ClientConfig extends ClientCommonConfig {
  proxies?: TypedProxyConfig[]
  visitors?: TypedVisitorConfig[]
}

// Mirrors frp v0.70.1 pkg/config/v1.ClientCommonConfig. Auth lives nested under `auth`
// -- it must NOT extend AuthClientConfig, because the strict loader rejects `method`,
// `token`, `oidc` and `additionalScopes` at the top level.
export interface ClientCommonConfig {
  auth?: AuthClientConfig
  user?: string
  // frp >= v0.67. Native client identity; frp-panel still uses
  // metadatas['x-vaala-frp-client-id'] and has not migrated.
  clientID?: string
  serverAddr: string
  serverPort: number
  natHoleStunServer?: string
  dnsServer?: string
  loginFailExit?: boolean
  start?: string[]
  log?: LogConfig
  webServer?: WebServerConfig
  transport?: ClientTransportConfig
  // frp >= v0.65, alpha and gated off by default. Applied process-globally by the
  // agent (services/client/frpc_service.go), so one client's gates affect every frpc
  // in that agent -- documented here, deliberately not exposed as a per-client field.
  featureGates?: { [key: string]: boolean }
  virtualNet?: VirtualNetConfig
  udpPacketSize?: number
  metadatas?: { [key: string]: string }
  // Resolves filesystem paths on the agent host. Meaningless for frp-panel, whose
  // model is DB-sourced config pushed to the agent.
  includes?: string[]
  // frp >= v0.68. Agent-local persisted config source; deliberately disabled by the
  // panel (see internal/frpx/client.go) because it would resurrect deleted proxies.
  store?: unknown
}

export interface VirtualNetConfig {
  address?: string
}
