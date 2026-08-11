import React from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { Form, FormDescription } from '@/components/ui/form'
import { SecretStringField, StringArrayField } from '@/components/base/form-field'
import { STCPProxyConfig, SUDPProxyConfig, XTCPProxyConfig } from '@/types/proxy'
import { SecretConfigSchema } from './shared/schemas'
import { isWorkerManaged, splitAnnotations } from './shared/build'
import { LocalBackendFields } from './shared/domain_fields'
import { AdvancedProxySections } from './shared/sections'
import { ProxyFormFooter, useProxyForm } from './shared/use_proxy_form'
import { ProxyFormProps } from './shared/types'

export type SecretProxyType = 'stcp' | 'xtcp' | 'sudp'

/**
 * stcp, xtcp and sudp share one config shape -- a secret key, an allow-list and a local
 * backend -- and frp's validators for all three are no-ops. One parametrized form covers
 * them; the type-specific part is only the hint about what else has to be configured.
 */
export const SecretProxyForm: React.FC<ProxyFormProps & { type: SecretProxyType }> = ({ type, ...props }) => {
  const ctx = useProxyForm({ type, props })
  const defaultConfig = ctx.defaultConfig as STCPProxyConfig | XTCPProxyConfig | SUDPProxyConfig

  const form = useForm<z.infer<typeof SecretConfigSchema>>({
    resolver: zodResolver(SecretConfigSchema),
    defaultValues: {
      localIP: defaultConfig?.localIP,
      localPort: defaultConfig?.localPort,
      secretKey: defaultConfig?.secretKey,
      allowUsers: defaultConfig?.allowUsers,
      ...ctx.commonDefaults,
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(ctx.submit)} className="space-y-4 px-0.5">
        <LocalBackendFields control={form.control} />
        <SecretStringField
          name="secretKey"
          control={form.control}
          label={ctx.t('proxy.form.secret_key') + '*'}
          placeholder="secret"
        />
        <StringArrayField
          name="allowUsers"
          control={form.control}
          label={ctx.t('proxy.form.allow_users')}
          placeholder="*"
        />
        <FormDescription>{ctx.t('proxy.form.allow_users_description')}</FormDescription>
        {/* These proxy types publish nothing reachable on their own -- something has to
            connect to them through a visitor. */}
        <FormDescription>{ctx.t('proxy.form.visitor_required_hint')}</FormDescription>
        {type === 'xtcp' && <FormDescription>{ctx.t('proxy.form.stun_hint')}</FormDescription>}
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

export const STCPProxyForm: React.FC<ProxyFormProps> = (props) => <SecretProxyForm type="stcp" {...props} />
export const XTCPProxyForm: React.FC<ProxyFormProps> = (props) => <SecretProxyForm type="xtcp" {...props} />
export const SUDPProxyForm: React.FC<ProxyFormProps> = (props) => <SecretProxyForm type="sudp" {...props} />
