import { expect, describe, it } from 'vitest'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stageYarnBin } from '../src'

const VERSION = '4.99.0'

/** `stageYarnBin` with the download skipped: the cache already holds the file. */
async function fixture(rc: string | null) {
  const rootDir = await mkdtemp(join(tmpdir(), 'create-rc-'))
  const cacheDir = await mkdtemp(join(tmpdir(), 'create-cache-'))
  const tempDir = await mkdtemp(join(tmpdir(), 'create-temp-'))

  await writeFile(join(rootDir, 'package.json'), JSON.stringify({ name: 'fixture' }))
  if (rc !== null) await writeFile(join(rootDir, '.yarnrc.yml'), rc)

  await mkdir(cacheDir, { recursive: true })
  await writeFile(join(cacheDir, `yarn-${VERSION}.cjs`), '// stand-in for the binary')

  const fetcher = (async () => ({
    ok: true,
    json: async () => ({ 'dist-tags': { latest: VERSION } }),
  })) as any

  const run = () => stageYarnBin({
    rootDir,
    registry: 'https://registry.invalid',
    // yarn 1 without a yarnPath is what triggers the auto-latest path
    agent: { name: 'yarn', version: '1.22.19' } as any,
    fetcher,
    cacheDir,
    tempDir,
  })

  const rcPath = join(rootDir, '.yarnrc.yml')
  const read = () => readFile(rcPath, 'utf8').catch(() => null)

  return { run, read, rcPath }
}

describe('create-cordis: the project .yarnrc.yml', () => {
  it('leaves an unparseable rc alone instead of rewriting it', async () => {
    const broken = 'nodeLinker: pnpm\nnpmRegistryServer: [unclosed\n'
    const { run, read } = await fixture(broken)

    await run()

    // Rewriting it would discard settings the user still needs — including the
    // ones they were in the middle of editing when it stopped parsing.
    expect(await read()).to.equal(broken)
  })

  it('leaves a scalar rc alone', async () => {
    const { run, read } = await fixture('just-a-string\n')

    await run()

    expect(await read()).to.equal('just-a-string\n')
  })

  it('still writes yarnPath when there is no rc at all', async () => {
    const { run, read } = await fixture(null)

    await run()

    expect(await read()).to.contain(`yarnPath: .yarn/releases/yarn-${VERSION}.cjs`)
  })
})
