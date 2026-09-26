import { Context, Fiber } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Logger from '@cordisjs/plugin-logger-console'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, describe, it, afterEach } from 'vitest'

const testDir = dirname(fileURLToPath(import.meta.url))

function waitFor(condFn: () => any, timeout = 8000, interval = 100): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const check = setInterval(() => {
      if (condFn()) { clearInterval(check); resolve() }
    }, interval)
    setTimeout(() => { clearInterval(check); reject(new Error('waitFor timed out')) }, timeout)
  })
}

describe('HMR: a host with no main module', () => {
  let fiber: Fiber<Context> | undefined

  afterEach(async () => {
    await fiber?.dispose()
    fiber = undefined
    await new Promise(r => setTimeout(r, 200))
  })

  it('starts when process.argv[1] is absent', async () => {
    // The REPL, `node -e`, and some packed binaries have no main entry.
    const saved = process.argv[1]
    ;(process.argv as any)[1] = undefined
    try {
      const ctx = new Context()
      await ctx.plugin(Logger)
      fiber = await ctx.plugin(Loader)
      await ctx.loader.create({
        name: '@cordisjs/plugin-include',
        config: { path: pathToFileURL(resolve(testDir, 'cordis.yml')).href },
      })
      await waitFor(() => ctx.hmr, 6000)
      expect(ctx.hmr).toBeTruthy()
    } finally {
      ;(process.argv as any)[1] = saved
    }
  }, 20000)
})
