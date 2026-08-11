import * as z from 'zod'
import {
  ZodHostSchema,
  ZodOptionalIntSchema,
  ZodOptionalSignedIntSchema,
  ZodPortOptionalSchema,
  ZodStringOptionalSchema,
} from '@/lib/consts'

const TLSClientFields = z.object({
  enable: z.boolean().optional(),
  disableCustomTLSFirstByte: z.boolean().optional(),
  // frp embeds TLSConfig with no JSON tag, so these are siblings, not nested under `tls`.
  certFile: ZodStringOptionalSchema,
  keyFile: ZodStringOptionalSchema,
  trustedCaFile: ZodStringOptionalSchema,
  serverName: ZodStringOptionalSchema,
})

export const ClientTransportSchema = z
  .object({
    protocol: ZodStringOptionalSchema,
    // frp >= v0.69. A v2 frpc cannot connect to an frps older than v0.69, so this is
    // guarded at the field, the schema and the backend rather than offered freely.
    wireProtocol: z.enum(['v1', 'v2']).optional(),
    dialServerTimeout: ZodOptionalIntSchema,
    dialServerKeepalive: ZodOptionalSignedIntSchema,
    connectServerLocalIP: ZodHostSchema.optional(),
    proxyURL: ZodStringOptionalSchema,
    poolCount: ZodOptionalIntSchema,
    tcpMux: z.boolean().optional(),
    tcpMuxKeepaliveInterval: ZodOptionalSignedIntSchema,
    // Both complete to -1 ("disabled") when tcpMux is on.
    heartbeatInterval: ZodOptionalSignedIntSchema,
    heartbeatTimeout: ZodOptionalSignedIntSchema,
    quic: z
      .object({
        keepalivePeriod: ZodOptionalIntSchema,
        maxIdleTimeout: ZodOptionalIntSchema,
        maxIncomingStreams: ZodOptionalIntSchema,
      })
      .optional(),
    tls: TLSClientFields.optional(),
  })
  .optional()

export const ClientCommonConfigSchema = z.object({
  transport: ClientTransportSchema,
  natHoleStunServer: ZodStringOptionalSchema,
  dnsServer: ZodStringOptionalSchema,
  loginFailExit: z.boolean().optional(),
  udpPacketSize: ZodOptionalIntSchema,
  metadatas: z.record(z.string(), z.string()).optional(),
  log: z
    .object({
      to: ZodStringOptionalSchema,
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).optional(),
      maxDays: ZodOptionalIntSchema,
      disablePrintColor: z.boolean().optional(),
    })
    .optional(),
  webServer: z
    .object({
      addr: ZodHostSchema.optional(),
      port: ZodPortOptionalSchema,
      user: ZodStringOptionalSchema,
      password: ZodStringOptionalSchema,
      pprofEnable: z.boolean().optional(),
    })
    .optional(),
})

export type ClientCommonConfigValues = z.infer<typeof ClientCommonConfigSchema>
