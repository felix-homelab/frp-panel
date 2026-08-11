'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TLS2RawPluginOptions } from '@/types/plugin'
import { useTranslation } from 'react-i18next'

interface Props {
  config: TLS2RawPluginOptions
  setConfig: (c: TLS2RawPluginOptions) => void
}

export function TLS2RawPluginForm({ config, setConfig }: Props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="localAddr">{t('frpc.plugins.local_addr')}</Label>
        <Input
          id="localAddr"
          value={config.localAddr ?? ''}
          onChange={(e) => setConfig({ ...config, localAddr: e.target.value })}
          placeholder="127.0.0.1:8080"
        />
      </div>
      <div>
        <Label htmlFor="crtPath">{t('frpc.plugins.crt_path')}</Label>
        <Input
          id="crtPath"
          value={config.crtPath ?? ''}
          onChange={(e) => setConfig({ ...config, crtPath: e.target.value })}
          placeholder="/path/to/cert.pem"
        />
      </div>
      <div>
        <Label htmlFor="keyPath">{t('frpc.plugins.key_path')}</Label>
        <Input
          id="keyPath"
          value={config.keyPath ?? ''}
          onChange={(e) => setConfig({ ...config, keyPath: e.target.value })}
          placeholder="/path/to/key.pem"
        />
      </div>
    </div>
  )
}
