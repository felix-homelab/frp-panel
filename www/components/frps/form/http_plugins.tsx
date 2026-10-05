import React from 'react'
import { Control, useFieldArray } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { StringField, SwitchField } from '@/components/base/form-field'
import { HTTPPluginOptions } from '@/types/common'
import { HTTPPluginOps } from './schema'

/**
 * frps `httpPlugins[]` (FS-11). Edits the user's entries only; the panel's own auth
 * entry is shown read-only and re-attached by the backend on every save.
 */
export const HTTPPluginsFields = ({
  control,
  panelPlugin,
}: {
  control: Control<any>
  panelPlugin?: HTTPPluginOptions
}) => {
  const { t } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control, name: 'httpPlugins' })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('server.form.http_plugins.description')}</p>
      {panelPlugin && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="opacity-60" title={t('input.kv.reserved')}>
            {panelPlugin.name}: {panelPlugin.addr}
            {panelPlugin.path} ({panelPlugin.ops?.join(', ')})
          </Badge>
          <span className="text-sm text-muted-foreground">{t('server.form.http_plugins.panel_entry')}</span>
        </div>
      )}
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-3 border rounded-md p-3">
          <StringField
            control={control}
            name={`httpPlugins.${index}.name`}
            label={t('server.form.http_plugins.name')}
            placeholder="user-manager"
          />
          <StringField
            control={control}
            name={`httpPlugins.${index}.addr`}
            label={t('server.form.http_plugins.addr')}
            placeholder="127.0.0.1:9000"
          />
          <StringField
            control={control}
            name={`httpPlugins.${index}.path`}
            label={t('server.form.http_plugins.path')}
            placeholder="/handler"
          />
          <FormField
            control={control}
            name={`httpPlugins.${index}.ops`}
            render={({ field: opsField }) => {
              const selected: string[] = opsField.value || []
              return (
                <FormItem>
                  <FormLabel>{t('server.form.http_plugins.ops')}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-4">
                      {HTTPPluginOps.map((op) => (
                        <label key={op} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selected.includes(op)}
                            onCheckedChange={(checked) =>
                              opsField.onChange(
                                checked ? [...selected, op] : selected.filter((v) => v !== op),
                              )
                            }
                          />
                          {op}
                        </label>
                      ))}
                    </div>
                  </FormControl>
                  {selected.includes('Login') && (
                    <p className="text-sm text-muted-foreground">{t('server.form.http_plugins.login_warning')}</p>
                  )}
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <SwitchField
            control={control}
            name={`httpPlugins.${index}.tlsVerify`}
            label={t('server.form.http_plugins.tls_verify')}
          />
          <Button type="button" variant="outline" onClick={() => remove(index)}>
            {t('server.form.http_plugins.remove')}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={() => append({ name: '', addr: '', path: '', ops: [] })}>
        {t('server.form.http_plugins.add')}
      </Button>
    </div>
  )
}
