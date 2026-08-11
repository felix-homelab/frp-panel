import { ServerConfig } from '@/types/server'
import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { ServerConfigZodSchema as ServerConfigSchema } from './form/schema'
import { FRPSAdvancedSections } from './form/sections'
import { RespCode, Server } from '@/lib/pb/common'
import { updateFRPS } from '@/api/frp'
import { useMutation } from '@tanstack/react-query'
import { Label } from '@radix-ui/react-label'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ObjToUint8Array } from '@/lib/utils'
import { HostField, PortField } from '../base/form-field'

// The schema and its accordion sections live in ./form/, a fork-owned directory that
// upstream has no counterpart for, so they can never produce a rebase conflict.
export { ServerConfigZodSchema } from './form/schema'

export interface FRPSFormProps {
  serverID: string
  server: Server
  frpsUrls: string[]
}

const FRPSForm: React.FC<FRPSFormProps> = ({ serverID, server, frpsUrls }) => {
  const { t } = useTranslation()
  const form = useForm<z.infer<typeof ServerConfigSchema>>({
    resolver: zodResolver(ServerConfigSchema),
  })

  const updateFrps = useMutation({ mutationFn: updateFRPS })

  // The full stored config, kept alongside the form. zodResolver hands handleSubmit the
  // *parsed* object and zod strips unknown keys, so `values` contains only this form's
  // fields -- submitting it alone deleted every key the raw editor can author
  // (allowPorts, custom404Page, sshTunnelGateway, webServer, user httpPlugins entries).
  // Defaults survived only because the master re-materializes them via Complete().
  const [loadedConfig, setLoadedConfig] = useState<ServerConfig>({} as ServerConfig)

  useEffect(() => {
    form.reset({})
  }, [])

  useEffect(() => {
    const parsed = JSON.parse(server?.config || '{}') as ServerConfig
    setLoadedConfig(parsed)
    form.reset(parsed)
  }, [server])

  const onSubmit = async (values: z.infer<typeof ServerConfigSchema>) => {
    try {
      const { publicHost, ...rest } = values
      let resp = await updateFrps.mutateAsync({
        serverIp: publicHost,
        serverId: serverID,
        frpsUrls: frpsUrls,
        config: ObjToUint8Array({
          ...loadedConfig,
          ...rest,
        } as ServerConfig),
      })
      toast(resp.status?.code === RespCode.SUCCESS ? t('server.operation.update_success') : t('server.operation.update_failed'), {
        description: resp.status?.message,
      })
    } catch (error) {
      console.error(error)
      toast(t('server.operation.update_title'), {
        description: t('server.operation.update_failed')
      })
    }
  }

  return (
    <div className="flex flex-col w-full pt-2">
      <Label className="text-sm font-medium">{t('server.form.comment_title', { id: serverID })}</Label>
      <p className="text-sm text-muted-foreground">{t('server.form.comment_hint')}</p>
      <p className="text-sm border rounded p-2 my-2">
        {server?.comment == undefined || server?.comment === '' ? t('server.form.comment_empty') : server?.comment}
      </p>
      {serverID && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-0.5">
            <HostField name="publicHost" label={t('server.form.public_host')} placeholder='8.8.8.8' control={form.control} defaultValue={server?.ip}/>
            <PortField name="bindPort" label={t('server.form.bind_port')} control={form.control} />
            <HostField name="bindAddr" label={t('server.form.bind_addr')} control={form.control} />
            <HostField name="proxyBindAddr" label={t('server.form.proxy_bind_addr')} control={form.control} />
            <PortField name="vhostHTTPPort" label={t('server.form.vhost_http_port')} control={form.control} />
            {/* Without this, `https` is a proxy type the panel offers but frps has no
                listener for -- the proxy is dead on arrival. */}
            <PortField name="vhostHTTPSPort" label={t('server.form.vhost_https_port')} control={form.control} />
            <HostField name="subDomainHost" label={t('server.form.subdomain_host')} control={form.control} />
            <PortField name="quicBindPort" label={t('server.form.quic_bind_port')} control={form.control} />
            <PortField name="kcpBindPort" label={t('server.form.kcp_bind_port')} control={form.control} />
            <FRPSAdvancedSections control={form.control} />
            <Button type="submit">{t('common.submit')}</Button>
          </form>
        </Form>
      )}
    </div>
  )
}

export default FRPSForm
