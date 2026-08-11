import React, { useEffect, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Form, FormDescription } from '@/components/ui/form'
import { SelectField, StringField } from '@/components/base/form-field'
import { TCPMultiplexers } from '@/lib/consts'
import { TCPMuxProxyConfig } from '@/types/proxy'
import { TCPMuxConfigSchema } from './shared/schemas'
import { isWorkerManaged, splitAnnotations } from './shared/build'
import { DomainFields, domainsMissing, HTTPAuthFields, LocalBackendFields } from './shared/domain_fields'
import { AdvancedProxySections } from './shared/sections'
import { ProxyFormFooter, useProxyForm } from './shared/use_proxy_form'
import { ProxyFormProps } from './shared/types'

export const TCPMuxProxyForm: React.FC<ProxyFormProps> = (props) => {
  const [useAuth, setUseAuth] = useState(false)
  const ctx = useProxyForm({
    type: 'tcpmux',
    props,
    extraValidate: (values) => (domainsMissing(values) ? 'proxy.form.domain_required' : undefined),
  })
  const defaultConfig = ctx.defaultConfig as TCPMuxProxyConfig

  const form = useForm<z.infer<typeof TCPMuxConfigSchema>>({
    resolver: zodResolver(TCPMuxConfigSchema),
    defaultValues: {
      localIP: defaultConfig?.localIP,
      localPort: defaultConfig?.localPort,
      subdomain: defaultConfig?.subdomain,
      customDomains: defaultConfig?.customDomains,
      httpUser: defaultConfig?.httpUser,
      httpPassword: defaultConfig?.httpPassword,
      routeByHTTPUser: defaultConfig?.routeByHTTPUser,
      // Never leave this empty: frp validates it against the literal 'httpconnect' and
      // a rejected config takes the client's whole tunnel set down.
      multiplexer: defaultConfig?.multiplexer || 'httpconnect',
      ...ctx.commonDefaults,
    },
  })

  useEffect(() => {
    if (defaultConfig?.httpPassword || defaultConfig?.httpUser) {
      setUseAuth(true)
    }
  }, [defaultConfig?.httpPassword, defaultConfig?.httpUser])

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(ctx.submit)} className="space-y-4 px-0.5">
        <LocalBackendFields control={form.control} />
        <DomainFields control={form.control} />
        <SelectField
          control={form.control}
          name="multiplexer"
          label={ctx.t('proxy.form.multiplexer') + '*'}
          options={TCPMultiplexers.map((v) => ({ value: v, label: v }))}
        />
        {/* The matching listener is frps tcpmuxHTTPConnectPort, set on the server. */}
        <FormDescription>{ctx.t('proxy.form.tcpmux_port_hint')}</FormDescription>
        <StringField
          control={form.control}
          name="routeByHTTPUser"
          label={ctx.t('proxy.form.http.route_by_http_user')}
          placeholder="alice"
        />
        <HTTPAuthFields control={form.control} useAuth={useAuth} setUseAuth={setUseAuth} />
        <AdvancedProxySections
          control={form.control}
          type="tcpmux"
          managedLoadBalancer={isWorkerManaged(props.defaultProxyConfig)}
          reservedAnnotations={splitAnnotations(defaultConfig.annotations).reserved}
        />
        <ProxyFormFooter {...ctx} />
      </form>
    </Form>
  )
}
