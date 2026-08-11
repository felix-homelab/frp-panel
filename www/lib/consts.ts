import * as z from 'zod'
import { Client, Server } from './pb/common'
import { GetPlatformInfoResponse } from './pb/api_user'
import { TypedProxyConfig } from '@/types/proxy'
import { TypedVisitorConfig } from '@/types/visitor'

// 延迟加载前端首选项，避免 SSR 期间引用 window/localStorage
type FrontendPreferenceLazy = {
  githubProxyUrl?: string
  useServerGithubProxyUrl?: boolean
  clientApiUrl?: string
  clientRpcUrl?: string
}

const getFrontendPreference = (): FrontendPreferenceLazy => {
  if (typeof window !== 'undefined') {
    try {
      // 动态引入避免打包时静态依赖
      // eslint-disable-next-line
      const { $frontendPreference } = require('@/store/user')
      return ($frontendPreference.get?.() ?? {}) as FrontendPreferenceLazy
    } catch {
      return {}
    }
  }
  return {}
}

export const API_PATH = '/api/v1'
export const SET_TOKEN_HEADER = 'x-set-authorization'
export const X_CLIENT_REQUEST_ID = 'x-client-request-id'
export const LOCAL_STORAGE_TOKEN_KEY = 'token'
export const ZodPortSchema = z.coerce
  .number({ required_error: 'validation.required' })
  .min(1, { message: 'validation.portRange.min' })
  .max(65535, { message: 'validation.portRange.max' })

export const ZodPortOptionalSchema = z.coerce
  .number({ required_error: 'validation.required' })
  .min(1, { message: 'validation.portRange.min' })
  .max(65535, { message: 'validation.portRange.max' })
  .optional()

// z.coerce.number().optional() turns '' into 0 rather than undefined, so clearing an
// optional numeric field would emit an explicit 0. Preprocess the empty cases away first.
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v)

export const ZodOptionalIntSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(0).optional(),
)

export const ZodOptionalSecondsSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(1).max(86400).optional(),
)

// The stored blob is always fully Complete()d by the master before it is saved, so the
// form loads concrete values the backend itself wrote -- and several of frp's timing
// fields legitimately complete to -1 ("disabled"): transport.heartbeatTimeout and
// heartbeatInterval when tcpMux is on, and transport.tcpKeepalive. Validating those with
// the min(0)/min(1) atoms above would reject a config the panel produced.
export const ZodOptionalSignedIntSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(-1).optional(),
)

// frp: pkg/config/types/types.go -- "<number><KB|MB>", empty means unset.
export const ZodBandwidthSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d+(\.\d+)?(KB|MB)$/, { message: 'validation.bandwidth' })
    .optional(),
)

// frp validation/proxy.go runs annotation keys through k8s IsQualifiedName(lowercased).
export const AnnotationKeyRegex =
  /^([a-z0-9]([-a-z0-9.]*[a-z0-9])?\/)?[A-Za-z0-9]([-A-Za-z0-9_.]{0,61}[A-Za-z0-9])?$/

// Mirrors defs/const.go. The panel writes these itself -- models/proxy_config.go derives
// the worker_id column from them, so letting a user overwrite them orphans the DB link.
export const RESERVED_PROXY_ANNOTATION_KEYS = ['ingress', 'worker_id', 'load_balancer_group']
export const MANAGED_LB_GROUP_PREFIX = 'lb-group-'

// frp visitor.go: a negative bindPort means "do not bind; only accept connections
// redirected from another visitor via fallbackTo" -- the target of an xtcp fallback.
// Only 0 is rejected. ZodPortSchema's min(1) would block that whole pattern.
export const ZodVisitorBindPortSchema = z.coerce
  .number({ required_error: 'validation.required' })
  .int()
  .min(-1, { message: 'validation.visitorBindPort' })
  .max(65535, { message: 'validation.portRange.max' })
  .refine((v) => v !== 0, { message: 'validation.visitorBindPort' })

export const ZodIPSchema = z
  .string({ required_error: 'validation.required' })
  .regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, { message: 'validation.ipAddress' })
export const ZodStringSchema = z
  .string({ required_error: 'validation.required' })
  .min(1, { message: 'validation.required' })

export const ZodStringOptionalSchema = z.string().optional()

// ZodIPSchema's dotted-quad regex rejects IPv6 and every hostname, which is wrong for
// bind addresses -- frps happily binds '::' or a resolvable name.
export const ZodHostSchema = z
  .string()
  .refine(
    (v) =>
      v === '' ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(v) ||
      /^[0-9a-fA-F:]+$/.test(v) ||
      /^[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?)*$/.test(v),
    { message: 'validation.host' },
  )

// frp's types.PortsRange has no UnmarshalJSON, so the wire form is always the object
// array. Every field is omitempty, so a 0 must never be emitted.
export const ZodPortsRangeListSchema = z
  .array(
    z.object({
      start: z.number().int().min(1).max(65535).optional(),
      end: z.number().int().min(1).max(65535).optional(),
      single: z.number().int().min(1).max(65535).optional(),
    }),
  )
  .optional()
  .superRefine((ranges, ctx) => {
    ranges?.forEach((r, i) => {
      const isSingle = r.single !== undefined
      const isSpan = r.start !== undefined && r.end !== undefined
      if (isSingle === isSpan) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i], message: 'validation.portRangeList' })
      } else if (isSpan && r.start! > r.end!) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i], message: 'validation.portRangeList' })
      }
    })
  })

export const LogLevels = ['trace', 'debug', 'info', 'warn', 'error']
export const WireProtocols = ['v1', 'v2']
export const ZodEmailSchema = z
  .string({ required_error: 'validation.required' })
  .min(1, { message: 'validation.required' })
  .email({ message: 'auth.email.invalid' })

export const ConnectionProtocols = ['tcp', 'kcp', 'quic', 'websocket', 'wss']

// Enumerations frp validates strictly. An out-of-range value is not a cosmetic problem:
// the agent's config handler is torn down before validation panics, so the client's
// whole tunnel set goes down until the next valid push. The UI is the real gate.
export const ProxyProtocolVersions = ['v1', 'v2']
export const BandwidthLimitModes = ['client', 'server']
export const HealthCheckTypes = ['tcp', 'http']
export const TCPMultiplexers = ['httpconnect']
export const XTCPVisitorProtocols = ['quic', 'kcp']

// Types frp routes by hostname; it rejects them outright without a subdomain or at
// least one custom domain.
const DOMAIN_ROUTED_TYPES = ['http', 'https', 'tcpmux']

/**
 * Values frp validates against a fixed set. These are checked here, and not only in the
 * form schemas, because this function is the sole gate on the raw-JSON path -- and an
 * out-of-range value is not cosmetic: the agent tears down the config handler before
 * validation fails, so the client's whole tunnel set stays down until the next valid push.
 */
const enumFieldsValid = (cfg: any): boolean => {
  const t = cfg.transport
  if (t?.proxyProtocolVersion && !ProxyProtocolVersions.includes(t.proxyProtocolVersion)) return false
  if (t?.bandwidthLimitMode && !BandwidthLimitModes.includes(t.bandwidthLimitMode)) return false

  const hc = cfg.healthCheck
  if (hc?.type) {
    if (!HealthCheckTypes.includes(hc.type)) return false
    if (hc.type === 'http' && !hc.path) return false
  }

  if (cfg.type === 'tcpmux' && !TCPMultiplexers.includes(cfg.multiplexer)) return false

  if (cfg.annotations && Object.keys(cfg.annotations).some((k) => !AnnotationKeyRegex.test(k))) return false

  return true
}

export const TypedProxyConfigValid = (typedProxyCfg: TypedProxyConfig | undefined): boolean => {
  if (!typedProxyCfg) {
    return false
  }

  if (!enumFieldsValid(typedProxyCfg)) {
    return false
  }

  if (DOMAIN_ROUTED_TYPES.includes(typedProxyCfg.type)) {
    const domainCfg = typedProxyCfg as { subdomain?: string; customDomains?: string[] }
    if (!domainCfg.subdomain && !domainCfg.customDomains?.length) {
      return false
    }
  }

  if (typedProxyCfg.plugin && typedProxyCfg.plugin.type) {
    if (typedProxyCfg.type === 'tcp' || typedProxyCfg.type === 'udp') {
      if (!typedProxyCfg.remotePort) {
        console.log('remotePort is undefined')
        return false
      }
    }
    return typedProxyCfg.name && typedProxyCfg.type ? true : false
  }

  if (typedProxyCfg.type === 'tcp' || typedProxyCfg.type === 'udp') {
    if (!typedProxyCfg.remotePort) {
      console.log('remotePort is undefined')
      return false
    }
  }

  return typedProxyCfg?.localPort && typedProxyCfg.localIP && typedProxyCfg.name && typedProxyCfg.type ? true : false
}

/**
 * Mirrors frp's validateVisitorBaseConfig / validateXTCPVisitorConfig.
 *
 * This is a guard, not polish: when the agent rejects a config it has already stopped and
 * deleted the previous handler, so an invalid visitor takes that client's whole tunnel set
 * down until the next valid push.
 */
export const TypedVisitorConfigValid = (visitorCfg: TypedVisitorConfig | undefined): boolean => {
  if (!visitorCfg) return false
  if (!visitorCfg.name || !visitorCfg.type) return false
  if (!visitorCfg.serverName) return false
  // frp rejects 0; negative means "do not bind, only accept redirected connections".
  if (!visitorCfg.bindPort) return false
  if (visitorCfg.type === 'xtcp' && visitorCfg.protocol && !XTCPVisitorProtocols.includes(visitorCfg.protocol)) {
    return false
  }
  return true
}

export const IsIDValid = (clientID: string | undefined): boolean => {
  if (clientID == undefined) {
    return false
  }
  const regex = /^[a-zA-Z0-9-_]+$/
  return clientID.length > 0 && regex.test(clientID)
}

export const ClientConfigured = (client: Client | undefined): boolean => {
  if (client == undefined) {
    return false
  }
  return !(
    (client.config == undefined || client.config == '') &&
    (client.clientIds == undefined || client.clientIds.length == 0)
  )
}

// .refine((e) => e === "abcd@fg.com", "This email is not in our database")

// 获取最终 Github 代理 URL
const getGithubProxyUrl = (info: GetPlatformInfoResponse, applyPref = true): string => {
  const pref = getFrontendPreference()
  if (applyPref && pref.useServerGithubProxyUrl === false && pref.githubProxyUrl) {
    return pref.githubProxyUrl
  }
  // 若前端未指定或选择使用服务器，返回后端
  return info.githubProxyUrl
}

// 获取最终 API URL
const getClientApiUrl = (info: GetPlatformInfoResponse, applyPref = true): string => {
  const pref = getFrontendPreference()
  return applyPref && pref.clientApiUrl?.trim() ? pref.clientApiUrl.trim() : info.clientApiUrl
}

// 获取最终 RPC URL
const getClientRpcUrl = (info: GetPlatformInfoResponse, applyPref = true): string => {
  const pref = getFrontendPreference()
  return applyPref && pref.clientRpcUrl?.trim() ? pref.clientRpcUrl.trim() : info.clientRpcUrl
}

export const ExecCommandStr = <T extends Client | Server>(
  type: 'client' | 'server',
  item: T,
  info: GetPlatformInfoResponse,
  fileName?: string,
  applyPref = true,
) => {
  const apiUrl = getClientApiUrl(info, applyPref)
  const rpcUrl = getClientRpcUrl(info, applyPref)
  return `${fileName || 'frp-panel'} ${type} -s ${item.secret} -i ${item.id} --api-url ${apiUrl} --rpc-url ${rpcUrl}`
}

export const JoinCommandStr = (info: GetPlatformInfoResponse, token: string, fileName?: string, clientID?: string, applyPref = true) => {
  const apiUrl = getClientApiUrl(info, applyPref)
  const rpcUrl = getClientRpcUrl(info, applyPref)
  return `${fileName || 'frp-panel'} join${clientID ? ` -i ${clientID}` : ''} -j ${token} --api-url ${apiUrl} --rpc-url ${rpcUrl}`
}

export const WindowsInstallCommand = <T extends Client | Server>(
  type: 'client' | 'server',
  item: T,
  info: GetPlatformInfoResponse,
  github_proxy?: boolean,
  applyPref = true,
) => {
  const proxyUrl = getGithubProxyUrl(info, applyPref)
  return (
    `[Net.ServicePointManager]::SecurityProtocol = ` +
    `[Net.SecurityProtocolType]::Ssl3 -bor ` +
    `[Net.SecurityProtocolType]::Tls -bor ` +
    `[Net.SecurityProtocolType]::Tls11 -bor ` +
    `[Net.SecurityProtocolType]::Tls12;set-ExecutionPolicy RemoteSigned;` +
    `Invoke-WebRequest ${github_proxy ? proxyUrl : ''}https://raw.githubusercontent.com/VaalaCat/frp-panel/main/install.ps1 ` +
    `-OutFile C:\install.ps1;powershell.exe C:\install.ps1 ${ExecCommandStr(type, item, info, ' ', applyPref)}`
  )
}

export const LinuxInstallCommand = <T extends Client | Server>(
  type: 'client' | 'server',
  item: T,
  info: GetPlatformInfoResponse,
  github_proxy?: boolean,
  applyPref = true,
) => {
  const proxyUrl = getGithubProxyUrl(info, applyPref)
  return `curl -fSL ${github_proxy ? proxyUrl : ''}https://raw.githubusercontent.com/VaalaCat/frp-panel/main/install.sh | bash -s -- ${github_proxy ? `--github-proxy ${proxyUrl}` : ''
    }${ExecCommandStr(type, item, info, ' ', applyPref)}`
}

export const ClientEnvFile = <T extends Client | Server>(item: T, info: GetPlatformInfoResponse, applyPref = true) => {
  const apiUrl = getClientApiUrl(info, applyPref)
  const rpcUrl = getClientRpcUrl(info, applyPref)
  return `CLIENT_ID=${item.id}
CLIENT_SECRET=${item.secret}
CLIENT_API_URL=${apiUrl}
CLIENT_RPC_URL=${rpcUrl}`
}
