import React, { useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { AccordionHeader } from '@radix-ui/react-accordion'
import { Button } from '@/components/ui/button'
import { Form, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@radix-ui/react-label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  HostField,
  NumberField,
  SecretStringField,
  SelectField,
  StringField,
  SwitchField,
} from '@/components/base/form-field'
import { BaseSelector } from '@/components/base/selector'
import { listProxyConfig } from '@/api/proxy'
import {
  TypedVisitorConfigValid,
  XTCPVisitorProtocols,
  ZodStringOptionalSchema,
  ZodStringSchema,
  ZodVisitorBindPortSchema,
} from '@/lib/consts'
import { STCPProxyConfig } from '@/types/proxy'
import { TypedVisitorConfig, VisitorType, XTCPVisitorConfig } from '@/types/visitor'

const VISITOR_TYPES: VisitorType[] = ['stcp', 'xtcp', 'sudp']

/**
 * Mirrors frp's validateVisitorBaseConfig. Everything here is a real frp key -- the
 * decoder rejects the whole config on an unknown one, so no UI-only helper fields may
 * reach the emitted object.
 */
export const VisitorBaseSchema = z.object({
  serverName: ZodStringSchema,
  secretKey: ZodStringOptionalSchema,
  bindAddr: ZodStringSchema.default('127.0.0.1').optional(),
  bindPort: ZodVisitorBindPortSchema,
  transport: z
    .object({
      useEncryption: z.boolean().optional(),
      useCompression: z.boolean().optional(),
    })
    .optional(),
})

export const XTCPVisitorSchema = VisitorBaseSchema.extend({
  protocol: z.enum(['quic', 'kcp']).optional(),
  keepTunnelOpen: z.boolean().optional(),
  maxRetriesAnHour: z.coerce.number().int().min(0).optional(),
  minRetryInterval: z.coerce.number().int().min(0).optional(),
  fallbackTo: ZodStringOptionalSchema,
  fallbackTimeoutMs: z.coerce.number().int().min(0).optional(),
})

export interface VisitorFormProps {
  clientID: string
  serverID: string
  visitorName: string
  defaultVisitorConfig?: TypedVisitorConfig
  clientVisitorConfigs: TypedVisitorConfig[]
  setClientVisitorConfigs: React.Dispatch<React.SetStateAction<TypedVisitorConfig[]>>
}

/**
 * Picks a secret-type proxy on the same server and fills in what a visitor needs to
 * reach it.
 *
 * serverName is the proxy's raw, unprefixed name and serverUser stays empty: frp builds
 * the wire target as BuildTargetServerProxyName(localUser, serverUser, serverName), which
 * with an empty serverUser prefixes the visitor's own user -- and the master forces every
 * client's `user` to the panel account, so both sides always agree. serverUser only
 * matters for cross-user access, which additionally needs allowUsers on the proxy.
 */
const ProxyPairingPicker = ({
  serverID,
  visitorType,
  onPick,
}: {
  serverID: string
  visitorType: VisitorType
  onPick: (proxyName: string, secretKey?: string) => void
}) => {
  const { t } = useTranslation()

  const { data: proxies } = useQuery({
    queryKey: ['listProxyConfigs', 'pairable', serverID],
    queryFn: () => listProxyConfig({ page: 1, pageSize: 100, serverId: serverID }),
    enabled: !!serverID,
  })

  // A visitor can only reach a proxy of the same type, published to the frps its own
  // client is connected to.
  const options = (proxies?.proxyConfigs ?? []).filter((p) => p.type === visitorType)

  if (!options.length) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {t('visitor.pairing.empty', { type: visitorType })}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{t('visitor.pairing.label')}</Label>
      <BaseSelector
        dataList={options.map((p) => ({ value: p.name || '', label: p.name || '' }))}
        setValue={(name) => {
          const picked = options.find((p) => p.name === name)
          if (!picked) return
          let secretKey: string | undefined
          try {
            secretKey = (JSON.parse(picked.config || '{}') as STCPProxyConfig).secretKey
          } catch {
            secretKey = undefined
          }
          onPick(name, secretKey)
        }}
        placeholder={t('visitor.pairing.placeholder')}
      />
      <FormDescription>{t('visitor.pairing.hint_same_server')}</FormDescription>
    </div>
  )
}

const useVisitorSubmit = ({
  type,
  visitorName,
  clientVisitorConfigs,
  setClientVisitorConfigs,
}: {
  type: VisitorType
} & Pick<VisitorFormProps, 'visitorName' | 'clientVisitorConfigs' | 'setClientVisitorConfigs'>) => {
  const { t } = useTranslation()
  return (values: Record<string, any>) => {
    const cfg = { ...values, type, name: visitorName } as TypedVisitorConfig
    if (!TypedVisitorConfigValid(cfg)) {
      toast.error(t('visitor.status.invalid_config'))
      return
    }
    setClientVisitorConfigs(clientVisitorConfigs.map((v) => (v.name === visitorName ? cfg : v)))
    toast(t('visitor.status.staged'))
  }
}

/** stcp and sudp visitors are structurally identical: a bare VisitorBaseConfig. */
export const SecretVisitorForm: React.FC<VisitorFormProps & { type: 'stcp' | 'sudp' }> = ({ type, ...props }) => {
  const { t } = useTranslation()
  const defaultConfig = (props.defaultVisitorConfig || {}) as TypedVisitorConfig
  const submit = useVisitorSubmit({ type, ...props })

  const form = useForm<z.infer<typeof VisitorBaseSchema>>({
    resolver: zodResolver(VisitorBaseSchema),
    defaultValues: {
      serverName: defaultConfig.serverName,
      secretKey: defaultConfig.secretKey,
      bindAddr: defaultConfig.bindAddr,
      bindPort: defaultConfig.bindPort,
      transport: defaultConfig.transport,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4 px-0.5">
        <ProxyPairingPicker
          serverID={props.serverID}
          visitorType={type}
          onPick={(name, secretKey) => {
            form.setValue('serverName', name)
            if (secretKey) form.setValue('secretKey', secretKey)
          }}
        />
        <VisitorCommonFields control={form.control} />
        <Button type="submit" variant="outline" className="w-full">
          {t('visitor.form.save_changes')}
        </Button>
      </form>
    </Form>
  )
}

export const XTCPVisitorForm: React.FC<VisitorFormProps> = (props) => {
  const { t } = useTranslation()
  const defaultConfig = (props.defaultVisitorConfig || {}) as XTCPVisitorConfig
  const submit = useVisitorSubmit({ type: 'xtcp', ...props })

  const form = useForm<z.infer<typeof XTCPVisitorSchema>>({
    resolver: zodResolver(XTCPVisitorSchema),
    defaultValues: {
      serverName: defaultConfig.serverName,
      secretKey: defaultConfig.secretKey,
      bindAddr: defaultConfig.bindAddr,
      bindPort: defaultConfig.bindPort,
      transport: defaultConfig.transport,
      // Write these only when the user sets them -- frp's Complete() fills its own
      // defaults on the agent, and serializing them here would freeze today's values.
      protocol: defaultConfig.protocol,
      keepTunnelOpen: defaultConfig.keepTunnelOpen,
      maxRetriesAnHour: defaultConfig.maxRetriesAnHour,
      minRetryInterval: defaultConfig.minRetryInterval,
      fallbackTo: defaultConfig.fallbackTo,
      fallbackTimeoutMs: defaultConfig.fallbackTimeoutMs,
    },
  })

  // fallbackTo names a sibling *visitor*, not a proxy: frp hands the connection to it
  // via TransferConn when hole punching does not succeed in time.
  const fallbackTargets = props.clientVisitorConfigs
    .filter((v) => v.name !== props.visitorName)
    .map((v) => ({ value: v.name, label: v.name }))

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4 px-0.5">
        <ProxyPairingPicker
          serverID={props.serverID}
          visitorType="xtcp"
          onPick={(name, secretKey) => {
            form.setValue('serverName', name)
            if (secretKey) form.setValue('secretKey', secretKey)
          }}
        />
        <VisitorCommonFields control={form.control} />
        <SelectField
          control={form.control}
          name="protocol"
          label={t('visitor.form.protocol')}
          options={XTCPVisitorProtocols.map((v) => ({ value: v, label: v.toUpperCase() }))}
          allowUnset
          unsetLabel={t('visitor.form.protocol_default')}
        />
        <SwitchField control={form.control} name="keepTunnelOpen" label={t('visitor.form.keep_tunnel_open')} />
        <NumberField control={form.control} name="maxRetriesAnHour" label={t('visitor.form.max_retries_an_hour')} />
        <NumberField control={form.control} name="minRetryInterval" label={t('visitor.form.min_retry_interval')} />
        <SelectField
          control={form.control}
          name="fallbackTo"
          label={t('visitor.form.fallback_to')}
          options={fallbackTargets}
          allowUnset
          description={t('visitor.form.fallback_to_description')}
        />
        <NumberField control={form.control} name="fallbackTimeoutMs" label={t('visitor.form.fallback_timeout_ms')} />
        <Button type="submit" variant="outline" className="w-full">
          {t('visitor.form.save_changes')}
        </Button>
      </form>
    </Form>
  )
}

const VisitorCommonFields = ({ control }: { control: any }) => {
  const { t } = useTranslation()
  return (
    <>
      <StringField control={control} name="serverName" label={t('visitor.form.server_name') + '*'} />
      <SecretStringField control={control} name="secretKey" label={t('visitor.form.secret_key')} />
      <HostField control={control} name="bindAddr" label={t('visitor.form.bind_addr')} />
      <NumberField
        control={control}
        name="bindPort"
        label={t('visitor.form.bind_port') + '*'}
        description={t('visitor.form.bind_port_hint')}
      />
      <SwitchField control={control} name="transport.useEncryption" label={t('visitor.form.use_encryption')} />
      <SwitchField control={control} name="transport.useCompression" label={t('visitor.form.use_compression')} />
    </>
  )
}

export const TypedVisitorForm: React.FC<VisitorFormProps> = (props) => {
  const { t } = useTranslation()
  const { defaultVisitorConfig, serverID, clientID } = props

  if (!defaultVisitorConfig || !serverID || !clientID) return <></>

  switch (defaultVisitorConfig.type) {
    case 'stcp':
      return <SecretVisitorForm type="stcp" {...props} />
    case 'sudp':
      return <SecretVisitorForm type="sudp" {...props} />
    case 'xtcp':
      return <XTCPVisitorForm {...props} />
    default:
      return (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {t('visitor.form.unsupported_type', { type: (defaultVisitorConfig as { type: string }).type })}
        </div>
      )
  }
}

/**
 * Add-popover plus the list of visitors on this client. Visitors ride inside the client
 * config blob, so this stages into the parent array and the single FRPCForm submit pushes
 * everything -- there is no separate visitor endpoint and none is needed.
 */
export const VisitorSection: React.FC<{
  clientID: string
  serverID: string
  clientVisitorConfigs: TypedVisitorConfig[]
  setClientVisitorConfigs: React.Dispatch<React.SetStateAction<TypedVisitorConfig[]>>
}> = ({ clientID, serverID, clientVisitorConfigs, setClientVisitorConfigs }) => {
  const { t } = useTranslation()
  const [visitorName, setVisitorName] = useState<string>('')
  const [visitorType, setVisitorType] = useState<VisitorType>('stcp')

  const handleAdd = () => {
    if (!visitorName) return
    // frp >= v0.70 rejects duplicate visitor names outright, so catch it here rather
    // than letting the agent fail the whole config push.
    if (clientVisitorConfigs.some((v) => v.name === visitorName)) {
      toast(t('visitor.status.create'), { description: t('visitor.status.name_exists') })
      return
    }
    setClientVisitorConfigs([...clientVisitorConfigs, { name: visitorName, type: visitorType } as TypedVisitorConfig])
    setVisitorName('')
  }

  const handleDelete = (name: string) =>
    setClientVisitorConfigs(clientVisitorConfigs.filter((v) => v.name !== name))

  return (
    <div className="flex flex-col space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button className="my-2">{t('visitor.form.add')}</Button>
        </PopoverTrigger>
        <PopoverContent>
          <Label className="text-sm font-medium">{t('visitor.form.name')}</Label>
          <Input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} />
          <Select onValueChange={(v) => setVisitorType(v as VisitorType)} defaultValue={visitorType}>
            <Label className="text-sm font-medium">{t('visitor.form.type')}</Label>
            <SelectTrigger className="my-2">
              <SelectValue placeholder={t('visitor.form.type')} />
            </SelectTrigger>
            <SelectContent>
              {VISITOR_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`visitor.type.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleAdd}>
            {t('visitor.form.confirm')}
          </Button>
        </PopoverContent>
      </Popover>

      <Accordion type="single" collapsible defaultValue="visitors">
        <AccordionItem value="visitors">
          <AccordionTrigger>
            <AccordionHeader className="flex flex-row justify-between w-full">
              <p>{t('visitor.form.config')}</p>
              <p>{t('visitor.form.expand', { count: clientVisitorConfigs.length })}</p>
            </AccordionHeader>
          </AccordionTrigger>
          <AccordionContent className="grid gap-2 grid-cols-1">
            {clientVisitorConfigs.map((item, index) => (
              <Accordion type="single" collapsible key={`${item.name}-${index}`}>
                <AccordionItem value={item.name}>
                  <AccordionTrigger>
                    <div className="flex flex-row justify-start items-center w-full gap-4">
                      <Button variant="outline" onClick={() => handleDelete(item.name)}>
                        {t('visitor.form.delete')}
                      </Button>
                      <div>
                        {t('visitor.form.name')}: {item.name}
                      </div>
                      <div>{t('visitor.form.type_label', { type: item.type })}</div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border rounded-xl p-4">
                    <TypedVisitorForm
                      clientID={clientID}
                      serverID={serverID}
                      visitorName={item.name}
                      defaultVisitorConfig={item}
                      clientVisitorConfigs={clientVisitorConfigs}
                      setClientVisitorConfigs={setClientVisitorConfigs}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
