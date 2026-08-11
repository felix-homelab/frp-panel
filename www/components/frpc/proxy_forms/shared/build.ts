import { MANAGED_LB_GROUP_PREFIX, RESERVED_PROXY_ANNOTATION_KEYS } from '@/lib/consts'
import { ProxyType, TypedProxyConfig } from '@/types/proxy'
import { TypedClientPluginOptions } from '@/types/plugin'

// frp's `enabled` (>= v0.66) is tri-state: absent or true means enabled, and only an
// explicit false disables the entry. Write `false` alone and leave the key off otherwise
// -- serializing `true` is redundant, and defaulting the field to `false` anywhere in the
// form would silently disable every proxy it touches.
//
// Note this is frp-level and independent of the panel's own ProxyConfig.Stopped flag,
// which is what the proxy list's start/stop action drives.
export const enabledToConfigValue = (enabled: boolean): false | undefined => (enabled ? undefined : false)

type AnyRecord = Record<string, any>

const pick = (src: AnyRecord | undefined, keys: string[]): AnyRecord => {
  const out: AnyRecord = {}
  if (!src) return out
  for (const k of keys) {
    if (src[k] !== undefined) out[k] = src[k]
  }
  return out
}

const omit = (src: AnyRecord | undefined, keys: string[]): AnyRecord => {
  const out: AnyRecord = {}
  if (!src) return out
  for (const k of Object.keys(src)) {
    if (!keys.includes(k)) out[k] = src[k]
  }
  return out
}

/**
 * frp writes zero values into these nested objects because `omitempty` does nothing for
 * structs in encoding/json, so almost every stored blob carries
 * `{"transport":{"bandwidthLimit":""}}`, `{"loadBalancer":{"group":""}}` and
 * `{"healthCheck":{"type":"","intervalSeconds":0}}`. Loading those straight into
 * defaultValues would show every proxy as having a health check on a 0s interval.
 */
const isBlank = (v: unknown) => v === undefined || v === null || v === '' || v === 0

const dropIfAllBlank = <T extends AnyRecord>(obj: T | undefined): T | undefined => {
  if (!obj) return undefined
  return Object.values(obj).every(isBlank) ? undefined : obj
}

/** Strip frp's zero-value sentinels so an untouched section renders as empty. */
export const sanitizeProxyDefaults = (cfg: TypedProxyConfig | undefined) => {
  if (!cfg) return {}
  const anyCfg = cfg as AnyRecord
  return {
    transport: dropIfAllBlank(anyCfg.transport),
    healthCheck: anyCfg.healthCheck?.type ? anyCfg.healthCheck : undefined,
    loadBalancer: anyCfg.loadBalancer?.group ? anyCfg.loadBalancer : undefined,
    metadatas: dropIfAllBlank(anyCfg.metadatas),
    annotations: splitAnnotations(anyCfg.annotations).user,
  }
}

/**
 * The panel stores its own keys in `annotations` -- models/proxy_config.go derives the
 * worker_id column from them, so a user overwriting them orphans the DB link to the
 * worker. Reserved keys never enter the editor and are re-applied on the way out.
 */
export const splitAnnotations = (a?: Record<string, string>) => ({
  reserved: pick(a, RESERVED_PROXY_ANNOTATION_KEYS) as Record<string, string>,
  user: (Object.keys(omit(a, RESERVED_PROXY_ANNOTATION_KEYS)).length
    ? omit(a, RESERVED_PROXY_ANNOTATION_KEYS)
    : undefined) as Record<string, string> | undefined,
})

export const mergeReservedAnnotations = (orig?: Record<string, string>, user?: Record<string, string>) => ({
  ...user,
  ...splitAnnotations(orig).reserved,
})

/** True when the panel owns this proxy's load-balancer group (worker ingress). */
export const isWorkerManaged = (cfg: TypedProxyConfig | undefined): boolean => {
  const a = (cfg as AnyRecord | undefined)?.annotations
  return !!a?.ingress && !!a?.worker_id
}

export const isManagedLoadBalancerGroup = (group?: string) => !!group?.startsWith(MANAGED_LB_GROUP_PREFIX)

const KEYS_BY_TYPE: Record<ProxyType, string[]> = {
  tcp: ['remotePort'],
  udp: ['remotePort'],
  http: [
    'locations',
    'httpUser',
    'httpPassword',
    'hostHeaderRewrite',
    'requestHeaders',
    'responseHeaders',
    'routeByHTTPUser',
    'subdomain',
    'customDomains',
  ],
  https: ['subdomain', 'customDomains'],
  tcpmux: ['httpUser', 'httpPassword', 'routeByHTTPUser', 'multiplexer', 'subdomain', 'customDomains'],
  stcp: ['secretKey', 'allowUsers'],
  xtcp: ['secretKey', 'allowUsers', 'natTraversal'],
  sudp: ['secretKey', 'allowUsers'],
}

const BASE_KEYS = [
  'name',
  'type',
  'enabled',
  'transport',
  'metadatas',
  'annotations',
  'loadBalancer',
  'healthCheck',
  'localIP',
  'localPort',
  'plugin',
]

/**
 * Changing the type in the create/edit dialog used to spread the previous config over the
 * new one, carrying type-specific keys along -- e.g. `remotePort` onto an http proxy. The
 * backend decodes with DisallowUnknownFields all the way into each proxy element, so that
 * is a hard `unknown field "remotePort"` rather than a field that is quietly ignored.
 */
export const coerceProxyConfigToType = (cfg: AnyRecord | undefined, type: ProxyType): TypedProxyConfig =>
  ({
    ...pick(cfg, [...BASE_KEYS, ...KEYS_BY_TYPE[type]]),
    type,
    // frp rejects an empty multiplexer outright, and the agent tears the tunnel down
    // when validation fails, so never leave it unset.
    ...(type === 'tcpmux' ? { multiplexer: cfg?.multiplexer ?? 'httpconnect' } : {}),
  }) as TypedProxyConfig

export interface BuildProxyConfigOptions {
  type: ProxyType
  name: string
  enabled: boolean
  plugin?: TypedClientPluginOptions
}

/**
 * Assembles the config a form submits. The nested sections are merged key-wise rather
 * than replaced: a shallow `...values` would drop raw-JSON-authored keys the zod schema
 * does not model, such as healthCheck.httpHeaders.
 */
export const buildProxyConfig = (
  defaultConfig: AnyRecord | undefined,
  values: AnyRecord,
  opts: BuildProxyConfigOptions,
): TypedProxyConfig => {
  const merged: AnyRecord = {
    ...defaultConfig,
    ...values,
    type: opts.type,
    name: opts.name,
    enabled: enabledToConfigValue(opts.enabled),
    plugin: opts.plugin,
  }

  for (const key of ['transport', 'healthCheck', 'loadBalancer'] as const) {
    const combined = { ...(defaultConfig?.[key] || {}), ...(values[key] || {}) }
    const kept = dropIfAllBlank(combined)
    if (kept) {
      merged[key] = kept
    } else {
      delete merged[key]
    }
  }

  const annotations = mergeReservedAnnotations(defaultConfig?.annotations, values.annotations)
  if (Object.keys(annotations).length) {
    merged.annotations = annotations
  } else {
    delete merged.annotations
  }

  if (!merged.metadatas || !Object.keys(merged.metadatas).length) {
    delete merged.metadatas
  }
  if (merged.plugin === undefined) {
    delete merged.plugin
  }

  return merged as TypedProxyConfig
}
