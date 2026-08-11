import React from 'react'
import { Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  HostField,
  KeyValueField,
  NumberField,
  PortField,
  SecretStringField,
  SelectField,
  StringField,
  SwitchField,
} from '@/components/base/form-field'
import { LogLevels, WireProtocols } from '@/lib/consts'

type SectionProps = { control: Control<any> }

const Section = ({ value, label, children }: { value: string; label: string; children: React.ReactNode }) => (
  <AccordionItem value={value}>
    <AccordionTrigger>{label}</AccordionTrigger>
    <AccordionContent className="space-y-4 px-1 pt-1">{children}</AccordionContent>
  </AccordionItem>
)

export const FRPCAdvancedSections = ({
  control,
  reservedMetadatas,
  allowWireProtocolV2,
}: SectionProps & {
  reservedMetadatas?: Record<string, string>
  /** False whenever the target server is not known to run frp >= v0.69. */
  allowWireProtocolV2?: boolean
}) => {
  const { t } = useTranslation()

  return (
    <Accordion type="multiple" className="w-full">
      <Section value="tls" label={t('frpc.section.tls')}>
        <SwitchField control={control} name="transport.tls.enable" label={t('frpc.form.tls.enable')} />
        <SwitchField
          control={control}
          name="transport.tls.disableCustomTLSFirstByte"
          label={t('frpc.form.tls.disable_custom_first_byte')}
        />
        <StringField control={control} name="transport.tls.certFile" label={t('frpc.form.tls.cert_file')} />
        <StringField control={control} name="transport.tls.keyFile" label={t('frpc.form.tls.key_file')} />
        <StringField control={control} name="transport.tls.trustedCaFile" label={t('frpc.form.tls.trusted_ca_file')} />
        <StringField control={control} name="transport.tls.serverName" label={t('frpc.form.tls.server_name')} />
        <SelectField
          control={control}
          name="transport.wireProtocol"
          label={t('frpc.form.wire_protocol')}
          // A v2 client cannot talk to an frps older than v0.69, and the failure mode is
          // a tunnel that silently never connects. Offer v2 only when the server is known
          // to support it; fail closed when its version is unknown or it is offline.
          options={WireProtocols.filter((v) => v === 'v1' || allowWireProtocolV2).map((v) => ({ value: v, label: v }))}
          allowUnset
          description={
            allowWireProtocolV2 ? t('frpc.form.wire_protocol_description') : t('frpc.form.wire_protocol_locked')
          }
        />
      </Section>

      <Section value="network" label={t('frpc.section.network')}>
        <StringField
          control={control}
          name="natHoleStunServer"
          label={t('frpc.form.nat_hole_stun_server')}
          description={t('frpc.form.nat_hole_stun_server_description')}
          placeholder="stun.easyvoip.com:3478"
        />
        <StringField control={control} name="dnsServer" label={t('frpc.form.dns_server')} placeholder="8.8.8.8" />
        <StringField
          control={control}
          name="transport.proxyURL"
          label={t('frpc.form.proxy_url')}
          description={t('frpc.form.proxy_url_description')}
          placeholder="http://user:pass@proxy:8080"
        />
        <HostField
          control={control}
          name="transport.connectServerLocalIP"
          label={t('frpc.form.connect_server_local_ip')}
        />
      </Section>

      <Section value="tuning" label={t('frpc.section.tuning')}>
        <NumberField control={control} name="transport.poolCount" label={t('frpc.form.pool_count')} />
        <SwitchField control={control} name="transport.tcpMux" label={t('frpc.form.tcp_mux')} />
        <NumberField
          control={control}
          name="transport.tcpMuxKeepaliveInterval"
          label={t('frpc.form.tcp_mux_keepalive_interval')}
        />
        <NumberField
          control={control}
          name="transport.heartbeatInterval"
          label={t('frpc.form.heartbeat_interval')}
          description={t('frpc.form.heartbeat_disabled_hint')}
        />
        <NumberField
          control={control}
          name="transport.heartbeatTimeout"
          label={t('frpc.form.heartbeat_timeout')}
          description={t('frpc.form.heartbeat_disabled_hint')}
        />
        <NumberField control={control} name="transport.dialServerTimeout" label={t('frpc.form.dial_server_timeout')} />
        <NumberField
          control={control}
          name="transport.dialServerKeepalive"
          label={t('frpc.form.dial_server_keepalive')}
        />
        <NumberField control={control} name="transport.quic.keepalivePeriod" label={t('frpc.form.quic_keepalive_period')} />
        <NumberField control={control} name="transport.quic.maxIdleTimeout" label={t('frpc.form.quic_max_idle_timeout')} />
        <NumberField
          control={control}
          name="transport.quic.maxIncomingStreams"
          label={t('frpc.form.quic_max_incoming_streams')}
        />
      </Section>

      <Section value="logging" label={t('frpc.section.logging')}>
        <p className="text-sm text-muted-foreground">{t('frpc.form.web_server_redundant_hint')}</p>
        <StringField control={control} name="log.to" label={t('frpc.form.log.to')} placeholder="console" />
        <SelectField
          control={control}
          name="log.level"
          label={t('frpc.form.log.level')}
          options={LogLevels.map((v) => ({ value: v, label: v }))}
          allowUnset
        />
        <NumberField control={control} name="log.maxDays" label={t('frpc.form.log.max_days')} />
        <SwitchField control={control} name="log.disablePrintColor" label={t('frpc.form.log.disable_print_color')} />
        <HostField control={control} name="webServer.addr" label={t('frpc.form.web_server.addr')} />
        <PortField control={control} name="webServer.port" label={t('frpc.form.web_server.port')} />
        <StringField control={control} name="webServer.user" label={t('frpc.form.web_server.user')} />
        <SecretStringField control={control} name="webServer.password" label={t('frpc.form.web_server.password')} />
        <SwitchField control={control} name="webServer.pprofEnable" label={t('frpc.form.web_server.pprof_enable')} />
      </Section>

      <Section value="advanced" label={t('frpc.section.advanced')}>
        <SwitchField control={control} name="loginFailExit" label={t('frpc.form.login_fail_exit')} />
        <NumberField control={control} name="udpPacketSize" label={t('frpc.form.udp_packet_size')} />
        {/* metadatas is not reserved as a whole: the master merges its two keys rather
            than replacing the map, so user-authored keys survive. */}
        <KeyValueField
          control={control}
          name="metadatas"
          label={t('frpc.form.metadatas')}
          reservedEntries={reservedMetadatas}
          description={t('frpc.form.metadatas_description')}
        />
      </Section>
    </Accordion>
  )
}
