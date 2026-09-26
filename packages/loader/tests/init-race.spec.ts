import { expect, describe, it, beforeAll } from 'vitest'
import { Context } from 'cordis'
import MockLoader, { sleep } from './utils'

describe('Loader: a concurrent init initializes once', () => {
  const root = new Context()

  let loader!: MockLoader
  let foo!: ReturnType<MockLoader['mock']>

  beforeAll(async () => {
    await root.plugin(MockLoader)
    loader = root.loader as any
    foo = loader.mock('foo', () => {})
  })

  it('applies the plugin once when init() is re-entered mid-flight', async () => {
    const id = await loader.create({ name: 'foo' })
    await sleep()
    const entry = loader.store[id]
    const before = foo.mock.calls.length

    // `_init()` keeps going after its import settles — unwrapExports, then
    // `_patchContext`, then registering the fiber. Widening that stretch makes
    // the window in which `_initTask` must stay set observable.
    entry.ctx.on('loader/patch-context', async (_entry, next) => {
      await sleep(30)
      return next()
    })

    const first = entry.init()
    await sleep(10)
    const second = entry.init()
    await Promise.allSettled([first, second])
    await sleep(80)

    expect(foo.mock.calls.length - before).to.equal(1)
  })
})
