import React, { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getServer } from '@/api/server'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { YesIcon } from '@/components/ui/icon'
import { TypedProxyConfigValid } from '@/lib/consts'
import { ProxyType, TypedProxyConfig } from '@/types/proxy'
import { TypedClientPluginOptions } from '@/types/plugin'
import { VisitPreview } from '@/components/base/visit-preview'
import { SwitchWithLabel } from '@/components/base/form-field'
import PluginConfigForm from '../../client_plugins'
import { buildProxyConfig, sanitizeProxyDefaults } from './build'
import { ProxyFormProps } from './types'

/**
 * The per-type forms all shared the same ~40 lines of state, debounce and server-query
 * boilerplate. Extracting it here is what keeps adding four more proxy types from
 * quadrupling that duplication.
 */
export function useProxyForm({
  type,
  props,
  extraValidate,
}: {
  type: ProxyType
  props: ProxyFormProps
  /** Return an i18n key to block the save, or undefined to accept it. */
  extraValidate?: (values: Record<string, any>) => string | undefined
}) {
  const { proxyName, serverID, defaultProxyConfig, clientProxyConfigs, setClientProxyConfigs } = props
  const { t } = useTranslation()
  const defaultConfig = (defaultProxyConfig || {}) as Record<string, any>

  const [enabled, setEnabled] = useState<boolean>(defaultConfig.enabled !== false)
  const [usePlugin, setUsePlugin] = useState<boolean>(!!defaultConfig.plugin?.type?.length)
  const [pluginConfig, setPluginConfig] = useState<TypedClientPluginOptions | undefined>(defaultConfig.plugin)
  const [isSaveDisabled, setSaveDisabled] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>()

  useEffect(() => () => timeoutRef.current && clearTimeout(timeoutRef.current), [])

  const flashSaved = () => {
    setSaveDisabled(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setSaveDisabled(false), 3000)
  }

  const { data: server } = useQuery({
    queryKey: ['getServer', serverID],
    queryFn: () => getServer({ serverId: serverID }),
  })

  const submit = (values: Record<string, any>) => {
    const blocked = extraValidate?.(values)
    if (blocked) {
      toast.error(t(blocked))
      return
    }
    const cfgToSubmit = buildProxyConfig(defaultConfig, values, {
      type,
      name: proxyName,
      enabled,
      plugin: usePlugin ? pluginConfig : undefined,
    })
    if (!TypedProxyConfigValid(cfgToSubmit)) {
      toast.error(t('proxy.config.invalid_config'))
      return
    }
    flashSaved()
    setClientProxyConfigs(
      clientProxyConfigs.map((proxyCfg) => (proxyCfg.name === proxyName ? cfgToSubmit : proxyCfg)),
    )
  }

  return {
    t,
    defaultConfig,
    /** Sanitized nested defaults; spread into useForm's defaultValues. */
    commonDefaults: sanitizeProxyDefaults(defaultProxyConfig),
    enabled,
    setEnabled,
    usePlugin,
    setUsePlugin,
    pluginConfig,
    setPluginConfig,
    isSaveDisabled,
    server: server?.server,
    submit,
  }
}

/** Server-side access preview, shown above the fields when the caller asks for it. */
export const ProxyPreview = ({
  server,
  config,
  show,
}: {
  server?: Parameters<typeof VisitPreview>[0]['server']
  config: TypedProxyConfig
  show?: boolean
}) => {
  const { t } = useTranslation()
  if (!show || !server) return null
  return (
    <div className="flex items-center space-x-2 flex-col justify-start w-full">
      <Label className="text-sm font-medium text-start w-full">{t('proxy.form.access_method')}</Label>
      <div className="w-full justify-start overflow-x-scroll">
        <VisitPreview server={server} typedProxyConfig={config} />
      </div>
    </div>
  )
}

/** The enabled / plugin toggles and the save button every proxy form ends with. */
export const ProxyFormFooter = ({
  enabled,
  setEnabled,
  usePlugin,
  setUsePlugin,
  pluginConfig,
  setPluginConfig,
  isSaveDisabled,
  children,
}: {
  enabled: boolean
  setEnabled: (v: boolean) => void
  usePlugin: boolean
  setUsePlugin: (v: boolean) => void
  pluginConfig?: TypedClientPluginOptions
  setPluginConfig: (c: TypedClientPluginOptions) => void
  isSaveDisabled: boolean
  children?: React.ReactNode
}) => {
  const { t } = useTranslation()
  return (
    <>
      <SwitchWithLabel name="enabled" label={t('proxy.form.enabled')} defaultValue={enabled} setValue={setEnabled} />
      <SwitchWithLabel
        name="usePlugin"
        label={t('proxy.form.use_plugin')}
        defaultValue={usePlugin}
        setValue={(value) => {
          setUsePlugin(value)
          if (!value) setPluginConfig(undefined as unknown as TypedClientPluginOptions)
        }}
      />
      {usePlugin ? <PluginConfigForm defaultPluginConfig={pluginConfig} setPluginConfig={setPluginConfig} /> : null}
      {children}
      <Button type="submit" disabled={isSaveDisabled} variant={'outline'} className="w-full">
        <YesIcon className={`mr-2 h-4 w-4 ${isSaveDisabled ? '' : 'hidden'}`}></YesIcon>
        {t('proxy.form.save_changes')}
      </Button>
    </>
  )
}
