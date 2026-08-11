import React from 'react'
import { Control, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  BandwidthField,
  KeyValueField,
  NumberField,
  SelectField,
  StringField,
  SwitchField,
} from '@/components/base/form-field'
import { AnnotationKeyRegex, BandwidthLimitModes, HealthCheckTypes, ProxyProtocolVersions } from '@/lib/consts'
import { ProxyType } from '@/types/proxy'

// Types frps can put into a load-balancing group. The others have no server-side
// listener to balance across, so the section would be a field that does nothing.
const LOAD_BALANCED_TYPES: ProxyType[] = ['tcp', 'http', 'https', 'tcpmux']

type SectionProps = { control: Control<any> }

export const TransportSection = ({ control }: SectionProps) => {
  const { t } = useTranslation()
  return (
    <AccordionItem value="transport">
      <AccordionTrigger>{t('proxy.form.transport.title')}</AccordionTrigger>
      <AccordionContent className="space-y-4 px-1 pt-1">
        <SwitchField
          control={control}
          name="transport.useEncryption"
          label={t('proxy.form.transport.use_encryption')}
          description={t('proxy.form.transport.use_encryption_description')}
        />
        <SwitchField
          control={control}
          name="transport.useCompression"
          label={t('proxy.form.transport.use_compression')}
          description={t('proxy.form.transport.use_compression_description')}
        />
        <BandwidthField
          control={control}
          name="transport.bandwidthLimit"
          label={t('proxy.form.transport.bandwidth_limit')}
        />
        <SelectField
          control={control}
          name="transport.bandwidthLimitMode"
          label={t('proxy.form.transport.bandwidth_limit_mode')}
          options={BandwidthLimitModes.map((v) => ({ value: v, label: v }))}
          allowUnset
          unsetLabel={t('proxy.form.transport.bandwidth_limit_mode_default')}
        />
        <SelectField
          control={control}
          name="transport.proxyProtocolVersion"
          label={t('proxy.form.transport.proxy_protocol_version')}
          options={ProxyProtocolVersions.map((v) => ({ value: v, label: v }))}
          allowUnset
          unsetLabel={t('proxy.form.transport.proxy_protocol_off')}
          description={t('proxy.form.transport.proxy_protocol_description')}
        />
      </AccordionContent>
    </AccordionItem>
  )
}

export const HealthCheckSection = ({ control }: SectionProps) => {
  const { t } = useTranslation()
  const checkType = useWatch({ control, name: 'healthCheck.type' })

  return (
    <AccordionItem value="healthCheck">
      <AccordionTrigger>{t('proxy.form.health_check.title')}</AccordionTrigger>
      <AccordionContent className="space-y-4 px-1 pt-1">
        <SelectField
          control={control}
          name="healthCheck.type"
          label={t('proxy.form.health_check.type')}
          options={HealthCheckTypes.map((v) => ({ value: v, label: v.toUpperCase() }))}
          allowUnset
          unsetLabel={t('proxy.form.health_check.off')}
        />
        {checkType && (
          <>
            {checkType === 'http' && (
              <StringField
                control={control}
                name="healthCheck.path"
                label={t('proxy.form.health_check.path') + '*'}
                placeholder="/healthz"
              />
            )}
            <NumberField
              control={control}
              name="healthCheck.intervalSeconds"
              label={t('proxy.form.health_check.interval_seconds')}
              placeholder="10"
            />
            <NumberField
              control={control}
              name="healthCheck.timeoutSeconds"
              label={t('proxy.form.health_check.timeout_seconds')}
              placeholder="3"
            />
            <NumberField
              control={control}
              name="healthCheck.maxFailed"
              label={t('proxy.form.health_check.max_failed')}
              placeholder="1"
            />
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

export const LoadBalancerSection = ({ control, managed }: SectionProps & { managed?: boolean }) => {
  const { t } = useTranslation()
  return (
    <AccordionItem value="loadBalancer">
      <AccordionTrigger>{t('proxy.form.load_balancer.title')}</AccordionTrigger>
      <AccordionContent className="space-y-4 px-1 pt-1">
        {managed && <p className="text-sm text-muted-foreground">{t('proxy.form.load_balancer.managed_hint')}</p>}
        <StringField
          control={control}
          name="loadBalancer.group"
          label={t('proxy.form.load_balancer.group')}
          placeholder="web"
        />
        <StringField
          control={control}
          name="loadBalancer.groupKey"
          label={t('proxy.form.load_balancer.group_key')}
          placeholder="secret"
        />
      </AccordionContent>
    </AccordionItem>
  )
}

export const HTTPSection = ({ control }: SectionProps) => {
  const { t } = useTranslation()
  return (
    <AccordionItem value="http">
      <AccordionTrigger>{t('proxy.form.http.title')}</AccordionTrigger>
      <AccordionContent className="space-y-4 px-1 pt-1">
        <StringField
          control={control}
          name="hostHeaderRewrite"
          label={t('proxy.form.http.host_header_rewrite')}
          placeholder="example.com"
        />
        <StringField
          control={control}
          name="routeByHTTPUser"
          label={t('proxy.form.http.route_by_http_user')}
          placeholder="alice"
        />
        <KeyValueField
          control={control}
          name="requestHeaders.set"
          label={t('proxy.form.http.request_headers')}
          keyPlaceholder="X-From-Where"
          valuePlaceholder="frp"
        />
      </AccordionContent>
    </AccordionItem>
  )
}

export const MetadataSection = ({
  control,
  reservedAnnotations,
}: SectionProps & { reservedAnnotations?: Record<string, string> }) => {
  const { t } = useTranslation()
  const annotationKeyValidator = (key: string) =>
    AnnotationKeyRegex.test(key) ? undefined : t('validation.annotationKey')

  return (
    <AccordionItem value="metadata">
      <AccordionTrigger>{t('proxy.form.metadata.title')}</AccordionTrigger>
      <AccordionContent className="space-y-4 px-1 pt-1">
        <KeyValueField control={control} name="metadatas" label={t('proxy.form.metadata.metadatas')} />
        <KeyValueField
          control={control}
          name="annotations"
          label={t('proxy.form.metadata.annotations')}
          keyValidator={annotationKeyValidator}
          reservedEntries={reservedAnnotations}
          description={
            reservedAnnotations && Object.keys(reservedAnnotations).length
              ? t('proxy.form.metadata.reserved_hint')
              : undefined
          }
        />
      </AccordionContent>
    </AccordionItem>
  )
}

/**
 * Every per-type form composes the advanced groups with a single line. Fields common to
 * all proxy types live here; the flat, always-visible fields stay in the type form.
 */
export const AdvancedProxySections = ({
  control,
  type,
  managedLoadBalancer,
  reservedAnnotations,
}: SectionProps & {
  type: ProxyType
  managedLoadBalancer?: boolean
  reservedAnnotations?: Record<string, string>
}) => (
  <Accordion type="multiple" className="w-full">
    <TransportSection control={control} />
    <HealthCheckSection control={control} />
    {LOAD_BALANCED_TYPES.includes(type) && <LoadBalancerSection control={control} managed={managedLoadBalancer} />}
    {type === 'http' && <HTTPSection control={control} />}
    <MetadataSection control={control} reservedAnnotations={reservedAnnotations} />
  </Accordion>
)
