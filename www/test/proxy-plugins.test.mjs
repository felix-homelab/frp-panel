// PLG-05: which client plugins each proxy type is offered.
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { pluginChoices, PLUGINS_BY_PROXY_TYPE } = await import('@/components/frpc/proxy_forms/shared/plugins.ts')

test('https is offered only TLS terminators and passthrough', () => {
  assert.deepEqual(pluginChoices('https'), ['https2http', 'https2https', 'tls2raw', 'unix_domain_socket'])
})

test('http is not offered http_proxy, socks5 or TLS terminators', () => {
  const choices = pluginChoices('http')
  for (const p of ['http_proxy', 'socks5', 'https2http', 'https2https', 'tls2raw']) {
    assert.ok(!choices.includes(p), p)
  }
})

test('udp and sudp are offered nothing, because frp ignores plugins there', () => {
  assert.deepEqual(pluginChoices('udp'), [])
  assert.deepEqual(pluginChoices('sudp'), [])
})

test('stream types are offered all nine plugins', () => {
  for (const type of ['tcp', 'stcp', 'xtcp', 'tcpmux']) {
    assert.equal(pluginChoices(type).length, 9, type)
  }
})

test('a stored plugin stays selectable even where unsupported, exactly once', () => {
  assert.deepEqual(pluginChoices('udp', 'socks5'), ['socks5'])
  assert.equal(pluginChoices('https', 'static_file').at(-1), 'static_file')
  assert.equal(pluginChoices('https', 'tls2raw').filter((p) => p === 'tls2raw').length, 1)
  assert.equal(pluginChoices('tcp', 'virtual_net').at(-1), 'virtual_net')
})

test('adding a stored plugin does not mutate the shared table', () => {
  pluginChoices('tcp', 'virtual_net')
  assert.ok(!PLUGINS_BY_PROXY_TYPE.tcp.includes('virtual_net'))
})
