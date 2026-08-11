import React from 'react'
import { Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { FormDescription } from '@/components/ui/form'
import { HostField, PortField, StringArrayField, StringField, SwitchWithLabel } from '@/components/base/form-field'

type FieldProps = { control: Control<any> }

/** localIP + localPort -- the backend every proxy type points at. */
export const LocalBackendFields = ({ control }: FieldProps) => {
  const { t } = useTranslation()
  return (
    <>
      <PortField name="localPort" control={control} label={t('proxy.form.local_port') + '*'} />
      <HostField name="localIP" control={control} label={t('proxy.form.local_ip') + '*'} />
    </>
  )
}

/** subdomain + customDomains, shared by http, https and tcpmux. */
export const DomainFields = ({ control }: FieldProps) => {
  const { t } = useTranslation()
  return (
    <>
      <StringField
        name="subdomain"
        control={control}
        label={t('proxy.form.subdomain')}
        placeholder={'your_sub_domain'}
      />
      <StringArrayField
        name="customDomains"
        control={control}
        label={t('proxy.form.custom_domains')}
        placeholder={'your.example.com'}
      />
      <FormDescription>{t('proxy.form.domain_description')}</FormDescription>
    </>
  )
}

/** frp requires a subdomain or at least one custom domain for domain-routed types. */
export const domainsMissing = (values: { subdomain?: string; customDomains?: string[] }) =>
  !values.subdomain && !values.customDomains?.length

/** httpUser + httpPassword behind a toggle, shared by http and tcpmux. */
export const HTTPAuthFields = ({
  control,
  useAuth,
  setUseAuth,
}: FieldProps & { useAuth: boolean; setUseAuth: (v: boolean) => void }) => {
  const { t } = useTranslation()
  return (
    <>
      <SwitchWithLabel
        name="enableHttpAuth"
        label={t('proxy.form.enable_http_auth')}
        defaultValue={useAuth}
        setValue={setUseAuth}
      />
      {useAuth && (
        <div className="p-4 space-y-4 border rounded-md">
          <StringField
            name="httpUser"
            control={control}
            label={t('proxy.form.username')}
            placeholder={'username'}
          />
          <StringField
            name="httpPassword"
            control={control}
            label={t('proxy.form.password')}
            placeholder={'password'}
          />
        </div>
      )}
    </>
  )
}
