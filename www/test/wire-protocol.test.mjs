// BUMP-07: must agree with frpx.SupportsWireProtocolV2 (internal/frpx/version_test.go).
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { SupportsWireProtocolV2 } = await import('@/config/notify.ts')

test('frp >= v0.69 supports wireProtocol v2', () => {
  for (const v of ['0.70.1', '0.69.0', '0.69', 'v0.69.0', '1.0.0', '0.69.0-rc1', ' 0.70.1 ']) {
    assert.equal(SupportsWireProtocolV2(v), true, v)
  }
})

test('older, unknown or unparsable versions fail closed', () => {
  for (const v of ['', undefined, '0.68.9', '0.9.0', 'dev-build', '0.x.1', '0.69.0.1']) {
    assert.equal(SupportsWireProtocolV2(v), false, String(v))
  }
})
