import { ProxyType, TypedProxyConfig } from '@/types/proxy'
import React, { useEffect } from 'react'
import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@radix-ui/react-label'
import { TypedProxyForm } from './proxy_form'
import { Button } from '@/components/ui/button'
import { Client, RespCode } from '@/lib/pb/common'
import { ClientConfig } from '@/types/client'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { AccordionHeader } from '@radix-ui/react-accordion'
import { QueryObserverResult, RefetchOptions, useMutation } from '@tanstack/react-query'
import { updateFRPC } from '@/api/frp'
import { GetClientResponse } from '@/lib/pb/api_client'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConnectionProtocols } from '@/lib/consts'
import { ObjToUint8Array } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form } from '@/components/ui/form'
import { SelectField } from '@/components/base/form-field'
import { ClientCommonConfigSchema, ClientCommonConfigValues } from './form/schema'
import { FRPCAdvancedSections } from './form/sections'
import { VisitorSection } from './visitor_form'
import { TypedVisitorConfig } from '@/types/visitor'

export interface FRPCFormProps {
  clientID: string
  serverID: string
  client?: Client
  clientConfig: ClientConfig
  frpsUrl?: string
  refetchClient: (options?: RefetchOptions) => Promise<QueryObserverResult<GetClientResponse, Error>>
  clientProxyConfigs: TypedProxyConfig[]
  setClientProxyConfigs: React.Dispatch<React.SetStateAction<TypedProxyConfig[]>>
  // Optional so FRPCEditor, which shares this props type, needs no change.
  clientVisitorConfigs?: TypedVisitorConfig[]
  setClientVisitorConfigs?: React.Dispatch<React.SetStateAction<TypedVisitorConfig[]>>
}

export const FRPCForm: React.FC<FRPCFormProps> = ({ clientID, serverID, clientConfig, client, refetchClient, clientProxyConfigs, setClientProxyConfigs, clientVisitorConfigs = [], setClientVisitorConfigs, frpsUrl }) => {
  const { t } = useTranslation()
  const [proxyType, setProxyType] = useState<ProxyType>('http')
  const [proxyName, setProxyName] = useState<string | undefined>()

  const form = useForm<ClientCommonConfigValues>({
    resolver: zodResolver(ClientCommonConfigSchema),
    defaultValues: { transport: { protocol: 'tcp' } },
  })

  useEffect(() => {
    form.reset(clientConfig as ClientCommonConfigValues)
  }, [clientConfig])

  const handleTypeChange = (value: string) => {
    setProxyType(value as ProxyType)
  }

  const handleAddProxy = () => {
    console.log('add proxy', proxyName, proxyType)
    if (!proxyName) return
    if (!proxyType) return
    if (clientProxyConfigs.findIndex((proxy) => proxy.name === proxyName) !== -1) {
      toast(t('proxy.status.create'), {
        description: t('proxy.status.name_exists')
      })
      return
    }
    const newProxy = {
      name: proxyName,
      type: proxyType,
    } as TypedProxyConfig
    setClientProxyConfigs([...clientProxyConfigs, newProxy])
  }

  const handleDeleteProxy = (proxyName: string) => {
    const newProxies = clientProxyConfigs.filter((proxy) => proxy.name !== proxyName)
    setClientProxyConfigs(newProxies)
  }

  const updateFrpc = useMutation({ mutationFn: updateFRPC })

  const handleUpdate = async (values: ClientCommonConfigValues) => {
    // The client query is keyed on (clientID, serverID) and has no placeholderData, so
    // right after the server selector changes `client` is undefined and clientConfig
    // falls back to {} -- while clientProxyConfigs still holds the previous client's
    // list. Submitting in that window would write a config built from nothing. Gate on
    // `client` rather than client.config: a freshly created client legitimately has an
    // empty config and must stay submittable.
    if (!client) {
      toast(t('proxy.status.update'), { description: t('frpc.form.not_loaded') })
      return
    }
    try {
      const res = await updateFrpc.mutateAsync({
        // Spread the whole stored config: this endpoint replaces it wholesale, so
        // sending only {proxies, transport} silently erased everything the raw editor
        // can author (visitors, log, webServer, auth, dnsServer, start, ...). Replace
        // semantics are deliberate -- they are how the raw editor deletes keys -- so the
        // fix belongs here, not in a backend merge.
        config: ObjToUint8Array({
          ...clientConfig,
          ...values,
          proxies: clientProxyConfigs,
          visitors: clientVisitorConfigs,
          // Merge rather than replace: `values.transport` is the resolver's output and
          // carries only the keys this schema declares.
          transport: { ...clientConfig.transport, ...values.transport },
        } as ClientConfig),
        serverId: serverID,
        clientId: clientID,
        frpsUrl: frpsUrl,
      })
      await refetchClient()
      toast(t('proxy.status.update'), {
        description: res.status?.code === RespCode.SUCCESS ? t('proxy.status.success') : t('proxy.status.error')
      })
    } catch (error) {
      console.error(error)
      toast(t('proxy.status.update'), {
        description: t('proxy.status.error') + JSON.stringify(error)
      })
    }
  }

  return (
    <div className='flex flex-col space-y-2'>
      <Popover>
        <PopoverTrigger asChild>
          <Button className="my-2">{t('proxy.form.add')}</Button>
        </PopoverTrigger>
        <PopoverContent>
          <Label className="text-sm font-medium">{t('proxy.form.name')}</Label>
          <Input
            onChange={(e) => {
              setProxyName(e.target.value)
            }}
          />
          <Select onValueChange={handleTypeChange} defaultValue={proxyType}>
            <Label className="text-sm font-medium">{t('proxy.form.protocol')}</Label>
            <SelectTrigger className="my-2">
              <SelectValue placeholder={t('proxy.form.type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="http">{t('proxy.type.http')}</SelectItem>
              <SelectItem value="https">{t('proxy.type.https')}</SelectItem>
              <SelectItem value="tcp">{t('proxy.type.tcp')}</SelectItem>
              <SelectItem value="udp">{t('proxy.type.udp')}</SelectItem>
              <SelectItem value="tcpmux">{t('proxy.type.tcpmux')}</SelectItem>
              <SelectItem value="stcp">{t('proxy.type.stcp')}</SelectItem>
              <SelectItem value="xtcp">{t('proxy.type.xtcp')}</SelectItem>
              <SelectItem value="sudp">{t('proxy.type.sudp')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={'outline'} onClick={handleAddProxy}>
            {t('proxy.form.confirm')}
          </Button>
        </PopoverContent>
      </Popover>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4 px-0.5">
          <SelectField
            control={form.control}
            name="transport.protocol"
            label={t('proxy.form.protocol')}
            options={ConnectionProtocols.map((item) => ({ label: item, value: item }))}
            // Exposed but mediated: the master derives serverPort from this, and the
            // frpsUrl path overwrites it from the URL scheme. Do not add a serverPort field.
            description={t('frpc.form.protocol_description')}
          />
          <FRPCAdvancedSections
            control={form.control}
            reservedMetadatas={{ token: '••••', 'x-vaala-frp-client-id': clientID }}
            // Fail closed: without a reliable frp version for the target server, a v2
            // client that cannot reach it fails silently, which is worse than a missing option.
            allowWireProtocolV2={false}
          />
        </form>
      </Form>
      <Accordion type="single" defaultValue="proxies" collapsible key={clientID + serverID + client}>
        <AccordionItem value="proxies">
          <AccordionTrigger>
            <AccordionHeader className="flex flex-row justify-between w-full">
              <p>{t('proxy.form.config')}</p>
              <p>{t('proxy.form.expand', { count: clientProxyConfigs.length })}</p>
            </AccordionHeader>
          </AccordionTrigger>
          <AccordionContent className="grid gap-2 grid-cols-1">
            {clientProxyConfigs.map((item, index) => {
              return (
                <Accordion type="single" collapsible key={index}>
                  <AccordionItem value={item.name}>
                    <AccordionTrigger>
                      <div className='flex flex-row justify-start items-center w-full gap-4'>
                        <Button variant={'outline'} onClick={() => { handleDeleteProxy(item.name) }}>
                          {t('proxy.form.delete')}
                        </Button>
                        <div>{t('proxy.form.tunnel_name')}: {item.name}</div>
                        <div>{t('proxy.form.type_label', { type: item.type })}</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className='border rounded-xl p-4'>
                      {serverID && clientID && (
                        <TypedProxyForm
                          enablePreview
                          defaultProxyConfig={item}
                          proxyName={item.name}
                          serverID={serverID}
                          clientID={clientID}
                          clientProxyConfigs={clientProxyConfigs}
                          setClientProxyConfigs={setClientProxyConfigs}
                        />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {setClientVisitorConfigs && (
        <VisitorSection
          clientID={clientID}
          serverID={serverID}
          clientVisitorConfigs={clientVisitorConfigs}
          setClientVisitorConfigs={setClientVisitorConfigs}
        />
      )}
      <Button className="mt-2" onClick={form.handleSubmit(handleUpdate)}>
        {t('proxy.form.submit')}
      </Button>
    </div>
  )
}
