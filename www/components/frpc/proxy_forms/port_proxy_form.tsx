import React from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Form } from '@/components/ui/form'
import { PortField } from '@/components/base/form-field'
import { TCPProxyConfig, UDPProxyConfig } from '@/types/proxy'
import { TCPConfigSchema, UDPConfigSchema } from './shared/schemas'
import { isWorkerManaged, splitAnnotations } from './shared/build'
import { LocalBackendFields } from './shared/domain_fields'
import { AdvancedProxySections } from './shared/sections'
import { ProxyFormFooter, ProxyPreview, useProxyForm } from './shared/use_proxy_form'
import { ProxyFormProps } from './shared/types'

/** tcp and udp differ only in the literal they write into `type`. */
const PortProxyForm: React.FC<ProxyFormProps & { type: 'tcp' | 'udp' }> = ({ type, ...props }) => {
  const schema = type === 'tcp' ? TCPConfigSchema : UDPConfigSchema
  const ctx = useProxyForm({ type, props })
  const defaultConfig = ctx.defaultConfig as TCPProxyConfig | UDPProxyConfig

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      remotePort: defaultConfig?.remotePort,
      localIP: defaultConfig?.localIP,
      localPort: defaultConfig?.localPort,
      ...ctx.commonDefaults,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(ctx.submit)} className="space-y-4 px-0.5">
        <ProxyPreview
          server={ctx.server}
          config={defaultConfig}
          show={
            props.enablePreview &&
            !!ctx.server?.ip &&
            !!defaultConfig.remotePort &&
            !!defaultConfig.localIP &&
            !!defaultConfig.localPort
          }
        />
        <LocalBackendFields control={form.control} />
        <PortField
          name="remotePort"
          control={form.control}
          label={ctx.t('proxy.form.remote_port') + '*'}
          placeholder="4321"
        />
        <AdvancedProxySections
          control={form.control}
          type={type}
          managedLoadBalancer={isWorkerManaged(props.defaultProxyConfig)}
          reservedAnnotations={splitAnnotations(defaultConfig.annotations).reserved}
        />
        <ProxyFormFooter {...ctx} />
      </form>
    </Form>
  )
}

export const TCPProxyForm: React.FC<ProxyFormProps> = (props) => <PortProxyForm type="tcp" {...props} />
export const UDPProxyForm: React.FC<ProxyFormProps> = (props) => <PortProxyForm type="udp" {...props} />
