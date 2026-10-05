import * as z from 'zod'
import {
  ZodHostSchema,
  ZodOptionalIntSchema,
  ZodOptionalSignedIntSchema,
  ZodPortOptionalSchema,
  ZodPortSchema,
  ZodPortsRangeListSchema,
  ZodStringOptionalSchema,
  ZodStringSchema,
} from '@/lib/consts'

const TLSFields = z.object({
  // frp embeds TLSConfig without a JSON tag, so these are siblings of `force`, not
  // nested under another `tls` key.
  force: z.boolean().optional(),
  certFile: ZodStringOptionalSchema,
  keyFile: ZodStringOptionalSchema,
  trustedCaFile: ZodStringOptionalSchema,
  serverName: ZodStringOptionalSchema,
})

const QUICFields = z.object({
  keepalivePeriod: ZodOptionalIntSchema,
  maxIdleTimeout: ZodOptionalIntSchema,
  // Completes to 100000, so this cannot use the seconds atom's 86400 ceiling.
  maxIncomingStreams: ZodOptionalIntSchema,
})

const WebServerFields = z.object({
  addr: ZodHostSchema.optional(),
  port: ZodPortOptionalSchema,
  user: ZodStringOptionalSchema,
  password: ZodStringOptionalSchema,
  assetsDir: ZodStringOptionalSchema,
  pprofEnable: z.boolean().optional(),
  tls: z
    .object({
      certFile: ZodStringOptionalSchema,
      keyFile: ZodStringOptionalSchema,
      trustedCaFile: ZodStringOptionalSchema,
      serverName: ZodStringOptionalSchema,
    })
    .optional(),
})

const LogFields = z.object({
  to: ZodStringOptionalSchema,
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).optional(),
  maxDays: ZodOptionalIntSchema,
  disablePrintColor: z.boolean().optional(),
})

// frp's SupportedHTTPPluginOps (pkg/config/v1/validation/validation.go). frp rejects
// any other value, and the master validates before storing (BUG-11).
export const HTTPPluginOps = ['Login', 'NewProxy', 'CloseProxy', 'Ping', 'NewWorkConn', 'NewUserConn'] as const

// The panel's own frps auth plugin (defs.FRP_Plugin_Multiuser). The backend drops any
// entry by this name and appends its own (conf.WithFRPsAuthPlugin), so the form never
// edits it and must not let a user entry take the name.
export const PANEL_AUTH_PLUGIN_NAME = 'multiuser'

const HTTPPluginEntrySchema = z
  .object({
    name: ZodStringSchema.refine((v) => v !== PANEL_AUTH_PLUGIN_NAME, {
      message: 'server.form.http_plugins.reserved_name',
    }),
    addr: ZodStringSchema,
    path: ZodStringOptionalSchema,
    ops: z.array(z.enum(HTTPPluginOps)).min(1, { message: 'server.form.http_plugins.ops_required' }),
    tlsVerify: z.boolean().optional(),
  })
  // Keep keys a newer frp may add, the same reason the form merges over loadedConfig.
  .passthrough()

const HTTPPluginListSchema = z
  .array(HTTPPluginEntrySchema)
  .optional()
  .superRefine((plugins, ctx) => {
    const seen = new Set<string>()
    plugins?.forEach((p, i) => {
      if (seen.has(p.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'name'],
          message: 'server.form.http_plugins.duplicate_name',
        })
      }
      seen.add(p.name)
    })
  })

export const ServerConfigSchema = z.object({
  // publicHost is a panel-level value, not an frp field: it is stripped before submit
  // and sent as the server_ip request param.
  publicHost: ZodStringSchema.optional(),

  bindAddr: ZodHostSchema.default('0.0.0.0').optional(),
  bindPort: ZodPortSchema.default(7000),
  proxyBindAddr: ZodHostSchema.optional(),
  quicBindPort: ZodPortOptionalSchema,
  kcpBindPort: ZodPortOptionalSchema,

  // Virtual hosts
  vhostHTTPPort: ZodPortOptionalSchema,
  vhostHTTPSPort: ZodPortOptionalSchema,
  vhostHTTPTimeout: ZodOptionalIntSchema,
  subDomainHost: ZodStringOptionalSchema,
  tcpmuxHTTPConnectPort: ZodPortOptionalSchema,
  tcpmuxPassthrough: z.boolean().optional(),
  custom404Page: ZodStringOptionalSchema,

  // Security and limits
  allowPorts: ZodPortsRangeListSchema,
  maxPortsPerClient: ZodOptionalIntSchema,
  userConnTimeout: ZodOptionalIntSchema,
  udpPacketSize: ZodOptionalIntSchema,
  natholeAnalysisDataReserveHours: ZodOptionalIntSchema,
  detailedErrorsToClient: z.boolean().optional(),

  transport: z
    .object({
      tcpMux: z.boolean().optional(),
      tcpMuxKeepaliveInterval: ZodOptionalSignedIntSchema,
      // Completes to -1 ("disabled"), as does heartbeatTimeout when tcpMux is on.
      tcpKeepalive: ZodOptionalSignedIntSchema,
      maxPoolCount: ZodOptionalIntSchema,
      heartbeatTimeout: ZodOptionalSignedIntSchema,
      quic: QUICFields.optional(),
      tls: TLSFields.optional(),
    })
    .optional(),

  sshTunnelGateway: z
    .object({
      bindPort: ZodPortOptionalSchema,
      privateKeyFile: ZodStringOptionalSchema,
      autoGenPrivateKeyPath: ZodStringOptionalSchema,
      authorizedKeysFile: ZodStringOptionalSchema,
    })
    .optional(),

  webServer: WebServerFields.optional(),
  enablePrometheus: z.boolean().optional(),
  log: LogFields.optional(),

  // User entries only; see splitHTTPPlugins.
  httpPlugins: HTTPPluginListSchema,
})

/**
 * Splits a stored httpPlugins list into the user's entries (editable) and the panel's
 * own auth entry (display only). The stored list normally ends with the panel entry,
 * because the master appends it before saving.
 */
export const splitHTTPPlugins = <T extends { name: string }>(plugins?: T[]) => ({
  user: (plugins || []).filter((p) => p.name !== PANEL_AUTH_PLUGIN_NAME),
  panel: (plugins || []).find((p) => p.name === PANEL_AUTH_PLUGIN_NAME),
})

export const ServerConfigZodSchema = ServerConfigSchema
