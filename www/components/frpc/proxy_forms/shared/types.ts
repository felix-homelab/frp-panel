import React from 'react'
import { TypedProxyConfig } from '@/types/proxy'

export interface ProxyFormProps {
  clientID: string
  serverID: string
  proxyName: string
  enablePreview?: boolean
  defaultProxyConfig?: TypedProxyConfig
  clientProxyConfigs: TypedProxyConfig[]
  setClientProxyConfigs: React.Dispatch<React.SetStateAction<TypedProxyConfig[]>>
}
