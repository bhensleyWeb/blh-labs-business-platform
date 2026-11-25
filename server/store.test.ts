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

  it('updates and removes editable CRM lead fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'blh-store-'))
    const store = await new Store(join(directory, 'platform.json')).init()
    const client = await store.createClient({ name: 'Editable Lead', email: 'lead@example.com', phone: '', tierId: 'starter', status: 'new', notes: '', service: 'Landscape Design', city: 'Miami', source: 'Website form', followUpDate: '2026-11-30' })
    const updated = await store.updateClient(client.id, { status: 'contacted', notes: 'Called and left a message.', followUpDate: '2026-12-02' })
    assert.equal(updated?.status, 'contacted')
    assert.equal(updated?.followUpDate, '2026-12-02')
    assert.equal(await store.deleteClient(client.id), true)
    assert.equal(store.snapshot().clients.some((item) => item.id === client.id), false)
  })
})
