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
})

export const ServerConfigZodSchema = ServerConfigSchema
