import React from 'react'
import { useTranslation } from 'react-i18next'

import { TCPProxyForm, UDPProxyForm } from './proxy_forms/port_proxy_form'
import { HTTPProxyForm } from './proxy_forms/http_proxy_form'
import { HTTPSProxyForm } from './proxy_forms/https_proxy_form'
import { TCPMuxProxyForm } from './proxy_forms/tcpmux_proxy_form'
import { STCPProxyForm, SUDPProxyForm, XTCPProxyForm } from './proxy_forms/secret_proxy_form'
import { ProxyFormProps } from './proxy_forms/shared/types'

// The per-type forms live in ./proxy_forms/. Keeping this module small and at its
// original path means an upstream change to it merges as content rather than colliding
// with a file that was deleted and replaced by a directory.
export type { ProxyFormProps }
export { TCPProxyForm, UDPProxyForm, HTTPProxyForm, HTTPSProxyForm, TCPMuxProxyForm }
export { STCPProxyForm, SUDPProxyForm, XTCPProxyForm }
export { SecretProxyForm } from './proxy_forms/secret_proxy_form'

export const TypedProxyForm: React.FC<ProxyFormProps> = (props) => {
  const { serverID, clientID, defaultProxyConfig } = props

  if (!defaultProxyConfig || !serverID || !clientID) {
    return <></>
  }

  // A switch rather than a module-level Record<ProxyType, FC>: the default branch means
  // a proxy type with no form -- including any type a future frp adds -- explains itself
  // instead of rendering an empty panel.
  switch (defaultProxyConfig.type) {
    case 'tcp':
      return <TCPProxyForm {...props} />
    case 'udp':
      return <UDPProxyForm {...props} />
    case 'http':
      return <HTTPProxyForm {...props} />
    case 'https':
      return <HTTPSProxyForm {...props} />
    case 'tcpmux':
      return <TCPMuxProxyForm {...props} />
    case 'stcp':
      return <STCPProxyForm {...props} />
    case 'xtcp':
      return <XTCPProxyForm {...props} />
    case 'sudp':
      return <SUDPProxyForm {...props} />
    default:
      return <UnsupportedProxyTypeNotice type={(defaultProxyConfig as { type: string }).type} />
  }
}

const UnsupportedProxyTypeNotice: React.FC<{ type: string }> = ({ type }) => {
  const { t } = useTranslation()
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{t('proxy.form.unsupported_type.title', { type })}</p>
      <p className="mt-1">{t('proxy.form.unsupported_type.description')}</p>
    </div>
  )
}
