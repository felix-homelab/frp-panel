import React, { useState } from 'react'
import { Control } from 'react-hook-form'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import StringListInput, { KeyValueListInput, PortRangeListInput, PortsRange } from './list-input'
import { BandwidthUnit } from '@/types/common'

export const HostField = ({
  control,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  placeholder?: string
  defaultValue?: string
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <Input className='text-sm' placeholder={placeholder || '127.0.0.1'} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}
export const PortField = ({
  control,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  placeholder?: string
  defaultValue?: number
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <Input className='text-sm' placeholder={placeholder || '1234'} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}
export const SecretStringField = ({
  control,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  placeholder?: string
  defaultValue?: string
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <Input className='text-sm' placeholder={placeholder || "secret"} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}

export const StringField = ({
  control,
  name,
  label,
  placeholder,
  description,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  placeholder?: string
  description?: string
  defaultValue?: string
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <Input className='text-sm' placeholder={placeholder || '127.0.0.1'} {...field} value={field.value ?? ''} />
          </FormControl>
          {description && <FormDescription>{t(description)}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}

export const StringArrayField = ({
  control,
  name,
  label,
  placeholder,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  placeholder?: string
  defaultValue?: string[]
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <StringListInput placeholder={placeholder || '/path'} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}

/**
 * Numeric input. Coercion deliberately lives in the zod atom (see ZodOptionalIntSchema),
 * not here -- same split as PortField/ZodPortSchema, so a resolver hands handleSubmit a
 * real number and an emptied field becomes undefined rather than 0.
 */
export const NumberField = ({
  control,
  name,
  label,
  placeholder,
  description,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  placeholder?: string
  description?: string
  defaultValue?: number
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <Input
              className="text-sm"
              inputMode="numeric"
              placeholder={placeholder}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          {description && <FormDescription>{t(description)}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}

/** Boolean bound to the form, for values that get validated and serialized. */
export const SwitchField = ({
  control,
  name,
  label,
  description,
  disabled,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  description?: string
  disabled?: boolean
  defaultValue?: boolean
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="space-y-0.5">
            <FormLabel>{t(label)}</FormLabel>
            {description && <FormDescription>{t(description)}</FormDescription>}
          </div>
          <FormControl>
            <Switch checked={field.value ?? false} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}

/**
 * Toggle backed by local state rather than the form -- used for "enable this section"
 * style switches whose value is never serialized. Promoted out of proxy_form.tsx so the
 * shared field sections can use it without importing back into that module.
 */
export const SwitchWithLabel = ({
  name,
  label,
  defaultValue,
  setValue,
}: {
  name: string
  label: string
  defaultValue?: boolean
  setValue: (value: boolean) => void
}) => {
  const { t } = useTranslation()
  return (
    <div className="flex items-center space-x-2 justify-between">
      <Label htmlFor={name}>{t(label)}</Label>
      <Switch id={`switch-with-label-${name}-switch`} checked={defaultValue} onCheckedChange={setValue} />
    </div>
  )
}

// Radix throws on <SelectItem value="">, so "unset" needs a sentinel that is mapped
// back to undefined on the way into the form.
const SELECT_NONE = '__none__'

export const SelectField = ({
  control,
  name,
  label,
  options,
  placeholder,
  description,
  allowUnset,
  unsetLabel,
  disabled,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  options: { value: string; label: string }[]
  placeholder?: string
  description?: string
  allowUnset?: boolean
  unsetLabel?: string
  disabled?: boolean
  defaultValue?: string
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <Select
            value={field.value || SELECT_NONE}
            onValueChange={(v) => field.onChange(v === SELECT_NONE ? undefined : v)}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {allowUnset && <SelectItem value={SELECT_NONE}>{t(unsetLabel || 'input.select.unset')}</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{t(description)}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}

export const KeyValueField = ({
  control,
  name,
  label,
  keyPlaceholder,
  valuePlaceholder,
  description,
  keyValidator,
  reservedEntries,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  keyPlaceholder?: string
  valuePlaceholder?: string
  description?: string
  keyValidator?: (key: string) => string | undefined
  reservedEntries?: Record<string, string>
  defaultValue?: Record<string, string>
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <KeyValueListInput
              value={field.value}
              onChange={field.onChange}
              keyPlaceholder={keyPlaceholder}
              valuePlaceholder={valuePlaceholder}
              keyValidator={keyValidator}
              reservedEntries={reservedEntries}
            />
          </FormControl>
          {description && <FormDescription>{t(description)}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}

export const PortRangeField = ({
  control,
  name,
  label,
  placeholder,
  description,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  placeholder?: string
  description?: string
  defaultValue?: PortsRange[]
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(label)}</FormLabel>
          <FormControl>
            <PortRangeListInput value={field.value} onChange={field.onChange} placeholder={placeholder} />
          </FormControl>
          {description && <FormDescription>{t(description)}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
      defaultValue={defaultValue}
    />
  )
}

const BANDWIDTH_UNITS: BandwidthUnit[] = ['KB', 'MB']
const BANDWIDTH_RE = /^(\d+(?:\.\d+)?)(KB|MB)$/

/**
 * frp's BandwidthQuantity is a string carrying its own suffix, e.g. "1MB". The number
 * and the unit are edited separately and joined; an empty number clears the whole field
 * back to undefined. Stored blobs routinely hold "" because frp writes the zero value,
 * so treat that as unset too.
 */
export const BandwidthField = ({
  control,
  name,
  label,
  placeholder,
  description,
  defaultValue,
}: {
  control: Control<any>
  name: string
  label: string
  placeholder?: string
  description?: string
  defaultValue?: string
}) => {
  const { t } = useTranslation()
  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => <BandwidthControl field={field} label={label} placeholder={placeholder} description={description} t={t} />}
      defaultValue={defaultValue}
    />
  )
}

const BandwidthControl = ({
  field,
  label,
  placeholder,
  description,
  t,
}: {
  field: { value?: string; onChange: (v: string | undefined) => void }
  label: string
  placeholder?: string
  description?: string
  t: (k: string) => string
}) => {
  const parsed = BANDWIDTH_RE.exec(field.value || '')
  const [unit, setUnit] = useState<BandwidthUnit>((parsed?.[2] as BandwidthUnit) || 'MB')
  const amount = parsed?.[1] ?? ''

  const emit = (nextAmount: string, nextUnit: BandwidthUnit) => {
    const trimmed = nextAmount.trim()
    field.onChange(trimmed ? `${trimmed}${nextUnit}` : undefined)
  }

  return (
    <FormItem>
      <FormLabel>{t(label)}</FormLabel>
      <div className="flex items-center gap-2">
        <FormControl>
          <Input
            className="text-sm flex-1"
            inputMode="decimal"
            placeholder={placeholder || '1'}
            value={amount}
            onChange={(e) => emit(e.target.value, unit)}
          />
        </FormControl>
        <Select
          value={unit}
          onValueChange={(v) => {
            const next = v as BandwidthUnit
            setUnit(next)
            emit(amount, next)
          }}
        >
          <SelectTrigger className="w-24 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BANDWIDTH_UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {description && <FormDescription>{t(description)}</FormDescription>}
      <FormMessage />
    </FormItem>
  )
}
