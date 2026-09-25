import { expect, describe, it, beforeAll } from 'vitest'
import { Context } from 'cordis'
import MockLoader from './utils'

describe('EntryTree: entry id validation', () => {
  const root = new Context()

  let loader!: MockLoader

  beforeAll(async () => {
    await root.plugin(MockLoader)
    loader = root.loader as any
    loader.mock('foo', () => {})
  })

  it('rejects an id containing the tree separator', async () => {
    await expect(loader.create({
      id: 'parent:child',
      name: 'foo',
    })).rejects.toThrow('entry id must not contain ":": parent:child')
  })

  it('names the offending id, not a downstream lookup', async () => {
    // Before the guard, the separator id was stored and only failed later at
    // resolve(), which reported the *resolved* path instead of what was written.
    await expect(loader.create({
      id: 'a:b:c',
      name: 'foo',
    })).rejects.toThrow(/must not contain/)
  })

  it('generates an id when none is given, without a separator', async () => {
    const id = await loader.create({ name: 'foo' })
    expect(id).to.be.a('string')
    expect(id).to.not.include(':')
  })

  it('still creates a nested entry under a group', async () => {
    // Control: the full id of a nested entry is composed by the Entry.id
    // getter, never handed to ensureId, so nesting stays unaffected.
    const group = await loader.create({
      name: '@cordisjs/plugin-group',
      group: true,
      config: [],
    })
    await expect(loader.create({ name: 'foo' }, group)).resolves.to.be.a('string')
  })
})
