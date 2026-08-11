import * as z from 'zod'
import {
  AnnotationKeyRegex,
  MANAGED_LB_GROUP_PREFIX,
  ZodBandwidthSchema,
  ZodOptionalIntSchema,
  ZodOptionalSecondsSchema,
  ZodPortSchema,
  ZodStringOptionalSchema,
  ZodStringSchema,
} from '@/lib/consts'

export const TransportSchema = z
  .object({
    useEncryption: z.boolean().optional(),
    useCompression: z.boolean().optional(),
    bandwidthLimit: ZodBandwidthSchema,
    bandwidthLimitMode: z.enum(['client', 'server']).optional(),
    proxyProtocolVersion: z.enum(['v1', 'v2']).optional(),
  })
  .optional()

export const HealthCheckSchema = z
  .object({
    type: z.enum(['tcp', 'http']).optional(),
    timeoutSeconds: ZodOptionalSecondsSchema,
    maxFailed: ZodOptionalIntSchema,
    intervalSeconds: ZodOptionalSecondsSchema,
    path: ZodStringOptionalSchema,
  })
  .optional()
  // frp rejects an http health check without a path, and a rejected config takes the
  // client's whole tunnel set down until the next valid push.
  .superRefine((v, ctx) => {
    if (v?.type === 'http' && !v.path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['path'],
        message: 'validation.healthCheckPathRequired',
      })
    }
  })

export const LoadBalancerSchema = z
  .object({
    group: ZodStringOptionalSchema.refine((g) => !g?.startsWith(MANAGED_LB_GROUP_PREFIX), {
      message: 'validation.reservedLoadBalancerGroup',
    }),
    groupKey: ZodStringOptionalSchema,
  })
  .optional()

export const KeyValueMapSchema = z.record(z.string(), z.string()).optional()

export const AnnotationMapSchema = z
  .record(z.string().regex(AnnotationKeyRegex, { message: 'validation.annotationKey' }), z.string())
  .optional()

/**
 * Spread into every per-type schema.
 *
 * These must stay in lockstep with the JSX: zod objects strip unknown keys by default and
 * zodResolver hands handleSubmit the *parsed* object, so a field rendered under a name the
 * schema does not declare is dropped at submit with no error at all.
 */
export const ProxyCommonFields = {
  transport: TransportSchema,
  healthCheck: HealthCheckSchema,
  loadBalancer: LoadBalancerSchema,
  metadatas: KeyValueMapSchema,
  annotations: AnnotationMapSchema,
}

const LocalBackendFields = {
  localIP: ZodStringSchema.default('127.0.0.1').optional(),
  localPort: ZodPortSchema.optional(),
}

const DomainFields = {
  subdomain: ZodStringOptionalSchema,
  customDomains: z.array(ZodStringSchema).optional(),
}

const HTTPAuthFields = {
  httpUser: ZodStringOptionalSchema,
  httpPassword: ZodStringOptionalSchema,
}

export const TCPConfigSchema = z.object({
  remotePort: ZodPortSchema.optional(),
  ...LocalBackendFields,
  ...ProxyCommonFields,
})

export const UDPConfigSchema = z.object({
  remotePort: ZodPortSchema.optional(),
  ...LocalBackendFields,
  ...ProxyCommonFields,
})

export const HTTPConfigSchema = z.object({
  ...LocalBackendFields,
  ...DomainFields,
  ...HTTPAuthFields,
  locations: z.array(ZodStringSchema).optional(),
  hostHeaderRewrite: ZodStringOptionalSchema,
  requestHeaders: z.object({ set: KeyValueMapSchema }).optional(),
  routeByHTTPUser: ZodStringOptionalSchema,
  ...ProxyCommonFields,
})

export const HTTPSConfigSchema = z.object({
  ...LocalBackendFields,
  ...DomainFields,
  ...ProxyCommonFields,
})

export const TCPMuxConfigSchema = z.object({
  ...LocalBackendFields,
  ...DomainFields,
  ...HTTPAuthFields,
  routeByHTTPUser: ZodStringOptionalSchema,
  // 'httpconnect' is the only value frp accepts, and empty is a hard validation failure.
  multiplexer: z.enum(['httpconnect']).default('httpconnect'),
  ...ProxyCommonFields,
})

/** stcp, xtcp and sudp are identical at the config layer: a secret plus an allow-list. */
export const SecretConfigSchema = z.object({
  ...LocalBackendFields,
  secretKey: ZodStringSchema,
  allowUsers: z.array(ZodStringSchema).optional(),
  ...ProxyCommonFields,
})

// Kept for backwards compatibility with the pre-split module layout.
export const STCPConfigSchema = SecretConfigSchema
