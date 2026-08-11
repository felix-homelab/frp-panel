import React from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Form, FormDescription } from '@/components/ui/form'
import { HTTPSProxyConfig } from '@/types/proxy'
import { HTTPSConfigSchema } from './shared/schemas'
import { isWorkerManaged, splitAnnotations } from './shared/build'
import { DomainFields, domainsMissing, LocalBackendFields } from './shared/domain_fields'
import { AdvancedProxySections } from './shared/sections'
import { ProxyFormFooter, ProxyPreview, useProxyForm } from './shared/use_proxy_form'
import { ProxyFormProps } from './shared/types'

/** HTTPSProxyConfig is ProxyBaseConfig + DomainConfig and nothing else. */
export const HTTPSProxyForm: React.FC<ProxyFormProps> = (props) => {
  const ctx = useProxyForm({
    type: 'https',
    props,
    extraValidate: (values) => (domainsMissing(values) ? 'proxy.form.domain_required' : undefined),
  })
  const defaultConfig = ctx.defaultConfig as HTTPSProxyConfig

  const form = useForm<z.infer<typeof HTTPSConfigSchema>>({
    resolver: zodResolver(HTTPSConfigSchema),
    defaultValues: {
      localIP: defaultConfig?.localIP,
      localPort: defaultConfig?.localPort,
      subdomain: defaultConfig?.subdomain,
      customDomains: defaultConfig?.customDomains,
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
            props.enablePreview && !!ctx.server?.ip && !!defaultConfig.localPort && !!defaultConfig.subdomain
          }
        />
        <LocalBackendFields control={form.control} />
        <DomainFields control={form.control} />
        {/* frps only listens for https proxies when vhostHTTPSPort is set, and that is
            configured on the server, not here. Without it the proxy is dead on arrival. */}
        <FormDescription>{ctx.t('proxy.form.https_port_hint')}</FormDescription>
        <AdvancedProxySections
          control={form.control}
          type="https"
          managedLoadBalancer={isWorkerManaged(props.defaultProxyConfig)}
          reservedAnnotations={splitAnnotations(defaultConfig.annotations).reserved}
        />
        <ProxyFormFooter {...ctx} />
      </form>
    </Form>
  )
}
