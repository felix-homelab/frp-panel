import { BandwidthQuantity, HeaderOperations } from './common'
import { TypedClientPluginOptions } from './plugin'

export type BandwidthLimitMode = 'client' | 'server'
export type ProxyProtocolVersion = 'v1' | 'v2'
export type HealthCheckType = 'tcp' | 'http'

export interface ProxyTransport {
  useEncryption?: boolean
  useCompression?: boolean
  bandwidthLimit?: BandwidthQuantity
  bandwidthLimitMode?: BandwidthLimitMode
  proxyProtocolVersion?: ProxyProtocolVersion
}

export interface LoadBalancerConfig {
  // Optional: frp omits `group` without omitempty, so stored blobs routinely carry
  // `{"group": ""}`. Treat the empty string as unset.
  group?: string
  groupKey?: string
}

export interface ProxyBackend {
  localIP?: string
  localPort?: number
  plugin?: TypedClientPluginOptions
}

export interface HealthCheckConfig {
  // Optional for the same reason as LoadBalancerConfig.group: frp emits
  // `{"type": "", "intervalSeconds": 0}` into every stored blob.
  type?: HealthCheckType
  timeoutSeconds?: number
  maxFailed?: number
  intervalSeconds?: number
  // Required by frp when type is 'http'.
  path?: string
  httpHeaders?: { name: string; value: string }[]
}

export interface DomainConfig {
  customDomains?: string[]
  subdomain?: string
}

export interface ProxyBaseConfig {
  name: string
  type: string
  // frp >= v0.66. Omitted or true means enabled; only an explicit false disables the
  // proxy. Never serialize `false` as a default -- that would disable every proxy.
  enabled?: boolean
  transport?: ProxyTransport
  metadatas?: { [key: string]: string }
  annotations?: { [key: string]: string }
  loadBalancer?: LoadBalancerConfig
  healthCheck?: HealthCheckConfig
  localIP?: string
  localPort?: number
  plugin?: TypedClientPluginOptions
}

export type TypedProxyConfig =
  | TCPProxyConfig
  | UDPProxyConfig
  | HTTPProxyConfig
  | HTTPSProxyConfig
  | TCPMuxProxyConfig
  | STCPProxyConfig
  | XTCPProxyConfig
  | SUDPProxyConfig

export type ProxyType = 'tcp' | 'udp' | 'tcpmux' | 'http' | 'https' | 'stcp' | 'xtcp' | 'sudp'

export interface TCPProxyConfig extends ProxyBaseConfig {
  type: 'tcp'
  remotePort?: number
}

export interface UDPProxyConfig extends ProxyBaseConfig {
  type: 'udp'
  remotePort?: number
}

export interface HTTPProxyConfig extends ProxyBaseConfig, DomainConfig {
  type: 'http'
  locations?: string[]
  httpUser?: string
  httpPassword?: string
  hostHeaderRewrite?: string
  requestHeaders?: HeaderOperations
  responseHeaders?: HeaderOperations
  routeByHTTPUser?: string
}

export interface HTTPSProxyConfig extends ProxyBaseConfig, DomainConfig {
  type: 'https'
}

export type TCPMultiplexerType = 'httpconnect'

export interface TCPMuxProxyConfig extends ProxyBaseConfig, DomainConfig {
  type: 'tcpmux'
  httpUser?: string
  httpPassword?: string
  routeByHTTPUser?: string
  // frp rejects an empty multiplexer -- 'httpconnect' is the only accepted value.
  multiplexer?: TCPMultiplexerType
}

export interface STCPProxyConfig extends ProxyBaseConfig {
  type: 'stcp'
  secretKey?: string
  allowUsers?: string[]
}

export interface XTCPProxyConfig extends ProxyBaseConfig {
  type: 'xtcp'
  secretKey?: string
  allowUsers?: string[]
  natTraversal?: { disableAssistedAddrs?: boolean }
}

export interface SUDPProxyConfig extends ProxyBaseConfig {
  type: 'sudp'
  secretKey?: string
  allowUsers?: string[]
}
