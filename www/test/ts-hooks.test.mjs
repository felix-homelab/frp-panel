// The harness itself: the "@/" alias resolves, and app modules that import interfaces
// without `import type` (lib/consts.ts does) still load, because TypeScript elides them.
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('loads an app module through the @/ alias, type-only imports included', async () => {
  const consts = await import('@/lib/consts.ts')
  assert.equal(consts.ZodStringSchema.safeParse('x').success, true)
  assert.equal(consts.ZodStringSchema.safeParse('').success, false)
})

test('an unknown @/ module fails loudly instead of resolving to something else', async () => {
  await assert.rejects(import('@/lib/does-not-exist.ts'))
})
