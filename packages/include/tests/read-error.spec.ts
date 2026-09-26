import { expect, describe, it, beforeAll, afterAll, afterEach } from 'vitest'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { harness, plugin } from './utils'

/** Failure injection for `readFile`, aimed at one filename at a time. */
const reads = { armed: false, code: 'EACCES', target: '', calls: 0 }

const fsp = createRequire(import.meta.url)('node:fs/promises') as typeof import('node:fs/promises')
const actualReadFile = fsp.readFile

describe('Include: the pre-rename staleness read', () => {
  const { setup } = harness()

  beforeAll(() => {
    fsp.readFile = async (path: any, ...rest: any[]) => {
      if (reads.armed && String(path) === reads.target) {
        reads.calls++
        throw Object.assign(new Error(`${reads.code}: permission denied`), { code: reads.code })
      }
      return (actualReadFile as any)(path, ...rest)
    }
    syncBuiltinESMExports()
  })

  afterAll(() => {
    fsp.readFile = actualReadFile
    syncBuiltinESMExports()
  })

  afterEach(() => {
    Object.assign(reads, { armed: false, code: 'EACCES', target: '', calls: 0 })
  })

  it('only treats a missing file as a reason to call the write stale', async () => {
    const app = await setup('tmp-write-readerr.yml', [plugin('a', 1)])
    const include = app.include() as any
    const before = await app.text()

    // A read that fails for any reason other than ENOENT means the pre-check
    // could not run at all. Reporting that as "the file moved on" hides the
    // real problem behind a code path that defers the write and stays quiet.
    reads.target = app.filename
    reads.armed = true
    let error: any
    try {
      await include._writeText('id: replaced\n', before)
    } catch (e) {
      error = e
    }
    reads.armed = false

    expect(reads.calls).toBeGreaterThan(0)
    expect(error).toBeTruthy()
    expect(error.name).not.toBe('StaleWriteError')
    expect(error.code).toBe('EACCES')

    // the target file is untouched
    expect(await app.text()).toBe(before)
  }, 10000)
})
