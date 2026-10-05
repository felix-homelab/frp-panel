import { ClientPluginType } from '@/types/plugin'
import { ProxyType } from '@/types/proxy'

const ALL_STREAM_PLUGINS: ClientPluginType[] = [
  'http_proxy',
  'http2http',
  'http2https',
  'https2http',
  'https2https',
  'socks5',
  'static_file',
  'tls2raw',
  'unix_domain_socket',
]

/**
 * Which client plugins can actually work behind each proxy type (PLG-05).
 *
 * A plugin replaces the local backend and receives whatever byte stream frps hands the
 * proxy, so the type decides what that stream is:
 *
 * - tcp, stcp, xtcp, tcpmux: an opaque TCP stream -- every plugin applies.
 * - http: plain HTTP requests routed by Host. Only plugins that speak HTTP server-side.
 *   `http_proxy` is excluded on purpose: it forwards to `req.URL`, which is relative
 *   for vhost-routed requests.
 * - https: an undecrypted TLS stream routed by SNI. Only plugins that terminate TLS,
 *   plus `unix_domain_socket`, which passes bytes through untouched.
 * - udp, sudp: frp's UDP proxies never consult the plugin, so offering one would only
 *   produce a config that is accepted and silently ignored.
 *
 * This narrows the form only. The raw-JSON editor still accepts any combination.
 */
export const PLUGINS_BY_PROXY_TYPE: Record<ProxyType, ClientPluginType[]> = {
  tcp: ALL_STREAM_PLUGINS,
  stcp: ALL_STREAM_PLUGINS,
  xtcp: ALL_STREAM_PLUGINS,
  tcpmux: ALL_STREAM_PLUGINS,
  http: ['http2http', 'http2https', 'static_file', 'unix_domain_socket'],
  https: ['https2http', 'https2https', 'tls2raw', 'unix_domain_socket'],
  udp: [],
  sudp: [],
}

/**
 * The plugin choices to offer. A plugin already stored on the proxy stays selectable
 * even when it is not supported, so opening the form never blanks the select or
 * silently swaps the plugin out.
 */
export const pluginChoices = (type: ProxyType, current?: string): ClientPluginType[] => {
  const supported = PLUGINS_BY_PROXY_TYPE[type] ?? ALL_STREAM_PLUGINS
  if (current && !supported.includes(current as ClientPluginType)) {
    return [...supported, current as ClientPluginType]
  }
  return supported
}
