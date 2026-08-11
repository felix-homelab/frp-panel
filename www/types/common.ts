export interface QUICOptions {
  keepalivePeriod?: number
  maxIdleTimeout?: number
  maxIncomingStreams?: number
}

export interface WebServerConfig {
  addr?: string
  port?: number
  user?: string
  password?: string
  assetsDir?: string
  pprofEnable?: boolean
  tls?: TLSConfig
}

export interface TLSConfig {
  certFile?: string
  keyFile?: string
  trustedCaFile?: string
  serverName?: string
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

export interface LogConfig {
  to?: string
  // frp validates this against a fixed set; anything else fails config validation.
  level?: LogLevel
  maxDays?: number
  disablePrintColor?: boolean
}

export interface HTTPPluginOptions {
  name: string
  addr: string
  path: string
  ops: string[]
  tlsVerify?: boolean
}

export interface HeaderOperations {
  set?: { [key: string]: string }
}

export type AuthMethod = 'token' | 'oidc'

export const AuthMethodToken: AuthMethod = 'token'
export const AuthMethodOIDC: AuthMethod = 'oidc'

export type AuthScope = 'HeartBeats' | 'NewWorkConns'

export const AuthScopeHeartBeats: AuthScope = 'HeartBeats'
export const AuthScopeNewWorkConns: AuthScope = 'NewWorkConns'

export interface PortsRange {
  start?: number
  end?: number
  single?: number
}

export type BandwidthUnit = 'MB' | 'KB'

// frp marshals BandwidthQuantity as a bare JSON string carrying the suffix, e.g. "1MB"
// (pkg/config/types/types.go). It is NOT an object -- emitting {s, i} is a hard failure
// at the strict decoder. Empty string means unset.
export type BandwidthQuantity = string
