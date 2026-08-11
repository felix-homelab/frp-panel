export interface VisitorTransport {
  useEncryption?: boolean
  useCompression?: boolean
}

export interface VisitorBaseConfig {
  name: string
  type: string
  // frp >= v0.66. See ProxyBaseConfig.enabled -- omitted or true means enabled.
  enabled?: boolean
  transport?: VisitorTransport
  secretKey?: string
  serverUser?: string
  serverName?: string
  bindAddr?: string
  bindPort?: number
}

export type VisitorType = 'stcp' | 'xtcp' | 'sudp'

export type TypedVisitorConfig = STCPVisitorConfig | SUDPVisitorConfig | XTCPVisitorConfig

export interface STCPVisitorConfig extends VisitorBaseConfig {
  type: 'stcp'
}

export interface SUDPVisitorConfig extends VisitorBaseConfig {
  type: 'sudp'
}

export interface XTCPVisitorConfig extends VisitorBaseConfig {
  type: 'xtcp'
  // frp rejects anything other than 'quic' or 'kcp' after Complete() defaults it to 'quic'.
  protocol?: 'quic' | 'kcp'
  keepTunnelOpen?: boolean
  maxRetriesAnHour?: number
  minRetryInterval?: number
  // Names a sibling *visitor* on the same client, not a proxy -- frp hands the
  // connection to it via TransferConn when hole-punching does not succeed in time.
  // The idiomatic target is an stcp visitor with bindPort: -1.
  fallbackTo?: string
  fallbackTimeoutMs?: number
  natTraversal?: XTCPNatTraversalConfig
}

export interface XTCPNatTraversalConfig {
  disableAssistedAddrs?: boolean
}
