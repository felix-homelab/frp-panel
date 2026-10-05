'use client'

import { Label } from '@/components/ui/label'
import { KeyValueListInput } from '@/components/base/list-input'
import { SwitchWithLabel } from '@/components/base/form-field'
import { HeaderOperations } from '@/types/common'
import { useTranslation } from 'react-i18next'

/**
 * `requestHeaders.set` for http2http, http2https, https2http and https2https (PLG-04).
 *
 * There is deliberately no response-headers counterpart: frp's plugin options have no
 * `responseHeaders` field (only HTTPProxyConfig does), and the strict decoder would
 * reject the whole client config if a form emitted one.
 */
export function PluginRequestHeadersField({
  value,
  onChange,
}: {
  value?: HeaderOperations
  onChange: (v: HeaderOperations | undefined) => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <Label>{t('frpc.plugins.request_headers')}</Label>
      <KeyValueListInput
        value={value?.set}
        onChange={(set) => onChange(set ? { ...value, set } : undefined)}
        keyPlaceholder="X-From-Where"
        valuePlaceholder="frp"
      />
    </div>
  )
}

/**
 * `enableHTTP2` for https2http and https2https. frp's Complete() turns an unset value
 * into true, so "on" is written as an absent key and only "off" is stored explicitly.
 */
export function PluginEnableHTTP2Field({
  value,
  onChange,
}: {
  value?: boolean
  onChange: (v: false | undefined) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1">
      <SwitchWithLabel
        name="enableHTTP2"
        label={t('frpc.plugins.enable_http2')}
        defaultValue={value !== false}
        setValue={(on) => onChange(on ? undefined : false)}
      />
      <p className="text-sm text-muted-foreground">{t('frpc.plugins.enable_http2_description')}</p>
    </div>
  )
}
