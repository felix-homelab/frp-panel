// FS-11: the frps form's httpPlugins rules.
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { ServerConfigSchema, splitHTTPPlugins, PANEL_AUTH_PLUGIN_NAME } = await import('@/components/frps/form/schema.ts')

const entry = (overrides) => ({ name: 'audit', addr: '127.0.0.1:9001', path: '/h', ops: ['NewProxy'], ...overrides })
const parse = (httpPlugins) => ServerConfigSchema.safeParse({ bindPort: 7000, httpPlugins })
const issues = (result) => result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`)

test('valid user entries pass, and keys the form does not model survive', () => {
  const result = parse([entry({ futureField: 1 }), entry({ name: 'quota', ops: ['Login', 'Ping'] })])
  assert.ok(result.success, JSON.stringify(result.error?.issues))
  assert.equal(result.data.httpPlugins[0].futureField, 1)
})

test('an absent or empty list passes', () => {
  assert.ok(parse(undefined).success)
  assert.ok(parse([]).success)
})

test('the panel auth plugin name is reserved', () => {
  assert.deepEqual(issues(parse([entry({ name: PANEL_AUTH_PLUGIN_NAME })])), [
    'httpPlugins.0.name:server.form.http_plugins.reserved_name',
  ])
})

test('duplicate names are flagged on the later entry', () => {
  assert.deepEqual(issues(parse([entry(), entry({ ops: ['Ping'] })])), [
    'httpPlugins.1.name:server.form.http_plugins.duplicate_name',
  ])
})

test('ops must be non-empty and from frp\'s supported set', () => {
  assert.deepEqual(issues(parse([entry({ ops: [] })])), ['httpPlugins.0.ops:server.form.http_plugins.ops_required'])
  assert.equal(parse([entry({ ops: ['Logout'] })]).success, false)
})

test('name and addr are required, path is optional', () => {
  assert.equal(parse([entry({ name: '' })]).success, false)
  assert.equal(parse([entry({ addr: '' })]).success, false)
  assert.ok(parse([entry({ path: '' })]).success)
  assert.ok(parse([entry({ path: undefined })]).success)
})

test('splitHTTPPlugins separates the panel entry from user entries', () => {
  const panel = { name: 'multiuser', addr: '127.0.0.1:8999', path: '/auth', ops: ['Login'] }
  const user = entry()
  assert.deepEqual(splitHTTPPlugins([user, panel]), { user: [user], panel })
  assert.deepEqual(splitHTTPPlugins(undefined), { user: [], panel: undefined })
})
