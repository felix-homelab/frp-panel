// Node module hooks that let `node --test` import the app's TypeScript directly, with no
// test framework dependency: the "@/..." alias from tsconfig.json is resolved here, and
// .ts/.tsx files are transpiled with the TypeScript compiler the project already has.
//
// transpileModule rather than Node's own type stripping, because app code imports
// interfaces without `import type` (e.g. lib/consts.ts), which only TypeScript elides.
// Only pure modules are meant to be tested this way -- there is no DOM.
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const WWW = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ts = createRequire(path.join(WWW, 'package.json'))('typescript')

const candidates = (p) => [p, `${p}.ts`, `${p}.tsx`, path.join(p, 'index.ts')]

export async function resolve(specifier, context, nextResolve) {
  let base
  if (specifier.startsWith('@/')) {
    base = path.join(WWW, specifier.slice(2))
  } else if (/^\.\.?\//.test(specifier) && context.parentURL?.startsWith('file:')) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
  }
  if (base) {
    const file = candidates(base).find((c) => existsSync(c) && !c.endsWith(path.sep))
    if (file && /\.tsx?$/.test(file)) {
      return nextResolve(pathToFileURL(file).href, context)
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
    const fileName = fileURLToPath(url)
    const { outputText } = ts.transpileModule(readFileSync(fileName, 'utf8'), {
      fileName,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    })
    return { format: 'module', source: outputText, shortCircuit: true }
  }
  return nextLoad(url, context)
}
