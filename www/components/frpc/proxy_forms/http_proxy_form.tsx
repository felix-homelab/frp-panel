import React, { useEffect, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Form } from '@/components/ui/form'
import { StringArrayField, SwitchWithLabel } from '@/components/base/form-field'
import { HTTPProxyConfig } from '@/types/proxy'
import { HTTPConfigSchema } from './shared/schemas'
import { isWorkerManaged, splitAnnotations } from './shared/build'
import { DomainFields, domainsMissing, HTTPAuthFields, LocalBackendFields } from './shared/domain_fields'
import { AdvancedProxySections } from './shared/sections'
import { ProxyFormFooter, ProxyPreview, useProxyForm } from './shared/use_proxy_form'
import { ProxyFormProps } from './shared/types'

export const HTTPProxyForm: React.FC<ProxyFormProps> = (props) => {
  const [moreSettings, setMoreSettings] = useState(false)
  const [useAuth, setUseAuth] = useState(false)

  const ctx = useProxyForm({
    type: 'http',
    props,
    extraValidate: (values) => (domainsMissing(values) ? 'proxy.form.domain_required' : undefined),
  })
  const defaultConfig = ctx.defaultConfig as HTTPProxyConfig

  const form = useForm<z.infer<typeof HTTPConfigSchema>>({
    resolver: zodResolver(HTTPConfigSchema),
    defaultValues: {
      localIP: defaultConfig?.localIP,
      localPort: defaultConfig?.localPort,
      subdomain: defaultConfig?.subdomain,
      locations: defaultConfig?.locations,
      customDomains: defaultConfig?.customDomains,
      httpUser: defaultConfig?.httpUser,
      httpPassword: defaultConfig?.httpPassword,
      hostHeaderRewrite: defaultConfig?.hostHeaderRewrite,
      requestHeaders: defaultConfig?.requestHeaders,
      routeByHTTPUser: defaultConfig?.routeByHTTPUser,
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
        <ProxyPreview
          server={ctx.server}
          config={defaultConfig}
          show={
            props.enablePreview &&
            !!ctx.server?.ip &&
            !!defaultConfig.localIP &&
            !!defaultConfig.localPort &&
            !!defaultConfig.subdomain
          }
        />
        <LocalBackendFields control={form.control} />
        <DomainFields control={form.control} />
        <AdvancedProxySections
          control={form.control}
          type="http"
          managedLoadBalancer={isWorkerManaged(props.defaultProxyConfig)}
          reservedAnnotations={splitAnnotations(defaultConfig.annotations).reserved}
        />
        <ProxyFormFooter {...ctx}>
          <SwitchWithLabel
            name="moreSettings"
            label={ctx.t('proxy.form.more_settings')}
            defaultValue={moreSettings}
            setValue={setMoreSettings}
          />
          {moreSettings && (
            <div className="p-4 space-y-4 border rounded-md">
              <StringArrayField
                name="locations"
                control={form.control}
                label={ctx.t('proxy.form.route')}
                placeholder={'/path'}
              />
              <HTTPAuthFields control={form.control} useAuth={useAuth} setUseAuth={setUseAuth} />
            </div>
          )}
        </ProxyFormFooter>
      </form>
    </Form>
  )
}
