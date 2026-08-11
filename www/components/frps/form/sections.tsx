import React from 'react'
import { Control, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import {
  HostField,
  NumberField,
  PortField,
  PortRangeField,
  SecretStringField,
  SelectField,
  StringField,
  SwitchField,
} from '@/components/base/form-field'
import { LogLevels } from '@/lib/consts'

type SectionProps = { control: Control<any> }

const Section = ({ value, label, children }: { value: string; label: string; children: React.ReactNode }) => (
  <AccordionItem value={value}>
    <AccordionTrigger>{label}</AccordionTrigger>
    <AccordionContent className="space-y-4 px-1 pt-1">{children}</AccordionContent>
  </AccordionItem>
)

export const FRPSAdvancedSections = ({ control }: SectionProps) => {
  const { t } = useTranslation()
  // frps only serves /metrics from its own web server, so enabling Prometheus without a
  // webServer.port produces nothing. (The panel's own stats do not go through it.)
  const webServerPort = useWatch({ control, name: 'webServer.port' })

  return (
    <Accordion type="multiple" className="w-full">
      <Section value="vhost" label={t('server.section.vhost')}>
        <NumberField
          control={control}
          name="vhostHTTPTimeout"
          label={t('server.form.vhost_http_timeout')}
          placeholder="60"
        />
        <PortField control={control} name="tcpmuxHTTPConnectPort" label={t('server.form.tcpmux_http_connect_port')} />
        <SwitchField control={control} name="tcpmuxPassthrough" label={t('server.form.tcpmux_passthrough')} />
        <StringField
          control={control}
          name="custom404Page"
          label={t('server.form.custom_404_page')}
          placeholder="/var/www/404.html"
        />
      </Section>

      <Section value="security" label={t('server.section.security')}>
        <PortRangeField
          control={control}
          name="allowPorts"
          label={t('server.form.allow_ports')}
          description={t('server.form.allow_ports_description')}
        />
        <NumberField
          control={control}
          name="maxPortsPerClient"
          label={t('server.form.max_ports_per_client')}
          description={t('server.form.max_ports_per_client_description')}
          placeholder="0"
        />
        <NumberField control={control} name="userConnTimeout" label={t('server.form.user_conn_timeout')} />
        <NumberField control={control} name="udpPacketSize" label={t('server.form.udp_packet_size')} />
        <NumberField
          control={control}
          name="natholeAnalysisDataReserveHours"
          label={t('server.form.nathole_reserve_hours')}
        />
        <SwitchField
          control={control}
          name="detailedErrorsToClient"
          label={t('server.form.detailed_errors_to_client')}
        />
      </Section>

      <Section value="transport" label={t('server.section.transport')}>
        <SwitchField control={control} name="transport.tcpMux" label={t('server.form.transport.tcp_mux')} />
        <NumberField
          control={control}
          name="transport.tcpMuxKeepaliveInterval"
          label={t('server.form.transport.tcp_mux_keepalive_interval')}
        />
        <NumberField
          control={control}
          name="transport.tcpKeepalive"
          label={t('server.form.transport.tcp_keepalive')}
          description={t('server.form.transport.disabled_hint')}
        />
        <NumberField control={control} name="transport.maxPoolCount" label={t('server.form.transport.max_pool_count')} />
        <NumberField
          control={control}
          name="transport.heartbeatTimeout"
          label={t('server.form.transport.heartbeat_timeout')}
          description={t('server.form.transport.heartbeat_timeout_description')}
        />
        <NumberField
          control={control}
          name="transport.quic.keepalivePeriod"
          label={t('server.form.transport.quic_keepalive_period')}
        />
        <NumberField
          control={control}
          name="transport.quic.maxIdleTimeout"
          label={t('server.form.transport.quic_max_idle_timeout')}
        />
        <NumberField
          control={control}
          name="transport.quic.maxIncomingStreams"
          label={t('server.form.transport.quic_max_incoming_streams')}
        />
        <SwitchField
          control={control}
          name="transport.tls.force"
          label={t('server.form.transport.tls_force')}
          description={t('server.form.transport.tls_force_description')}
        />
        <StringField control={control} name="transport.tls.certFile" label={t('server.form.transport.tls_cert_file')} />
        <StringField control={control} name="transport.tls.keyFile" label={t('server.form.transport.tls_key_file')} />
        <StringField
          control={control}
          name="transport.tls.trustedCaFile"
          label={t('server.form.transport.tls_trusted_ca_file')}
        />
        <StringField
          control={control}
          name="transport.tls.serverName"
          label={t('server.form.transport.tls_server_name')}
        />
      </Section>

      <Section value="ssh" label={t('server.section.ssh_gateway')}>
        <p className="text-sm text-muted-foreground">{t('server.form.ssh.paths_hint')}</p>
        <PortField control={control} name="sshTunnelGateway.bindPort" label={t('server.form.ssh.bind_port')} />
        <StringField
          control={control}
          name="sshTunnelGateway.privateKeyFile"
          label={t('server.form.ssh.private_key_file')}
        />
        <StringField
          control={control}
          name="sshTunnelGateway.autoGenPrivateKeyPath"
          label={t('server.form.ssh.auto_gen_private_key_path')}
        />
        <StringField
          control={control}
          name="sshTunnelGateway.authorizedKeysFile"
          label={t('server.form.ssh.authorized_keys_file')}
        />
      </Section>

      <Section value="dashboard" label={t('server.section.dashboard')}>
        <p className="text-sm text-muted-foreground">{t('server.form.web_server.port_conflict_hint')}</p>
        <HostField control={control} name="webServer.addr" label={t('server.form.web_server.addr')} />
        <PortField control={control} name="webServer.port" label={t('server.form.web_server.port')} />
        <StringField control={control} name="webServer.user" label={t('server.form.web_server.user')} />
        <SecretStringField control={control} name="webServer.password" label={t('server.form.web_server.password')} />
        <StringField control={control} name="webServer.assetsDir" label={t('server.form.web_server.assets_dir')} />
        <SwitchField control={control} name="webServer.pprofEnable" label={t('server.form.web_server.pprof_enable')} />
        <SwitchField
          control={control}
          name="enablePrometheus"
          label={t('server.form.enable_prometheus')}
          disabled={!webServerPort}
          description={
            webServerPort
              ? t('server.form.enable_prometheus_description')
              : t('server.form.enable_prometheus_needs_port')
          }
        />
      </Section>

      <Section value="logging" label={t('server.section.logging')}>
        <StringField control={control} name="log.to" label={t('server.form.log.to')} placeholder="console" />
        <SelectField
          control={control}
          name="log.level"
          label={t('server.form.log.level')}
          options={LogLevels.map((v) => ({ value: v, label: v }))}
          allowUnset
        />
        <NumberField control={control} name="log.maxDays" label={t('server.form.log.max_days')} />
        <SwitchField
          control={control}
          name="log.disablePrintColor"
          label={t('server.form.log.disable_print_color')}
        />
      </Section>
    </Accordion>
  )
}
