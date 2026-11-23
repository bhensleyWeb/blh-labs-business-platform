import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Store } from './store.ts'

describe('Store', () => {
  it('seeds Cedar & Stone as the clearly flagged first demo customer', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'blh-store-'))
    const store = await new Store(join(directory, 'platform.json')).init()
    const [client] = store.snapshot().clients
    assert.deepEqual(
      { customerNumber: client.customerNumber, name: client.name, email: client.email, tierId: client.tierId, isDemo: client.isDemo },
      { customerNumber: 'BLH-0001', name: 'Cedar & Stone Landscaping', email: 'demo@blhlabs.com', tierId: 'starter', isDemo: true },
    )
  })

  it('assigns sequential customer numbers and persists changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'blh-store-'))
    const path = join(directory, 'platform.json')
    const store = await new Store(path).init()
    const client = await store.createClient({ name: 'Acme', email: 'owner@example.com', phone: '', tierId: 'starter', status: 'lead', notes: '' })
    assert.equal(client.customerNumber, 'BLH-0002')
    const saved = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(saved.clients.length, 2)
  })
})
