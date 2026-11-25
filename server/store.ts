import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Activity, Client, Opportunity, PlatformData, Theme, Tier } from './types.ts'

const now = () => new Date().toISOString()

export const initialData = (): PlatformData => ({
  version: 1,
  nextCustomerNumber: 2,
  clients: [
    {
      id: randomUUID(),
      customerNumber: 'BLH-0001',
      name: 'Cedar & Stone Landscaping',
      email: 'demo@blhlabs.com',
      phone: '',
      tierId: 'starter',
      status: 'active',
      isDemo: true,
      notes: 'Demo customer seeded for product evaluation. Replace or archive before production onboarding.',
<<<<<<< HEAD
      service: 'Landscape Design',
      city: '',
      source: 'BLH Labs demo',
      followUpDate: null,
=======
>>>>>>> 6c5bc3096047e3b6e90d82fabffca3eb5bc68371
      createdAt: now(),
      updatedAt: now(),
    },
  ],
  opportunities: [],
  activities: [],
  tiers: [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Core CRM, scheduling, files, and proposals.',
      features: ['crm', 'calendar', 'drive', 'documents'],
      active: true,
    },
  ],
  theme: {
    brandName: 'BLH Labs',
    logoUrl: '',
    primary: '#16271f',
    accent: '#d9a85f',
    surface: '#f4f0e7',
  },
})

export class Store {
  private data!: PlatformData
  private readonly path: string
  private writeQueue = Promise.resolve()

  constructor(path = process.env.DATA_FILE || './data/platform.json') {
    this.path = resolve(path)
  }

  async init() {
    await mkdir(dirname(this.path), { recursive: true })
    try {
      this.data = JSON.parse(await readFile(this.path, 'utf8')) as PlatformData
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.data = initialData()
      await this.persist()
    }
    return this
  }

  snapshot() {
    return structuredClone(this.data)
  }

  private persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const temporary = `${this.path}.tmp`
      await writeFile(temporary, JSON.stringify(this.data, null, 2), 'utf8')
      await rename(temporary, this.path)
    })
    return this.writeQueue
  }

<<<<<<< HEAD
  async createClient(input: Pick<Client, 'name' | 'email' | 'phone' | 'tierId' | 'status' | 'notes' | 'service' | 'city' | 'source' | 'followUpDate'>) {
=======
  async createClient(input: Pick<Client, 'name' | 'email' | 'phone' | 'tierId' | 'status' | 'notes'>) {
>>>>>>> 6c5bc3096047e3b6e90d82fabffca3eb5bc68371
    const stamp = now()
    const client: Client = {
      ...input,
      id: randomUUID(),
      customerNumber: `BLH-${String(this.data.nextCustomerNumber).padStart(4, '0')}`,
      isDemo: false,
      createdAt: stamp,
      updatedAt: stamp,
    }
    this.data.nextCustomerNumber += 1
    this.data.clients.push(client)
    await this.persist()
    return client
  }

  async updateClient(id: string, patch: Partial<Omit<Client, 'id' | 'customerNumber' | 'isDemo' | 'createdAt'>>) {
    const client = this.data.clients.find((item) => item.id === id)
    if (!client) return null
    Object.assign(client, patch, { updatedAt: now() })
    await this.persist()
    return client
  }

<<<<<<< HEAD
  async deleteClient(id: string) {
    const index = this.data.clients.findIndex((item) => item.id === id)
    if (index < 0) return false
    this.data.clients.splice(index, 1)
    this.data.activities = this.data.activities.filter((item) => item.clientId !== id)
    this.data.opportunities = this.data.opportunities.filter((item) => item.clientId !== id)
    await this.persist()
    return true
  }

=======
>>>>>>> 6c5bc3096047e3b6e90d82fabffca3eb5bc68371
  async addActivity(input: Omit<Activity, 'id' | 'occurredAt'>) {
    const activity = { ...input, id: randomUUID(), occurredAt: now() }
    this.data.activities.unshift(activity)
    await this.persist()
    return activity
  }

  async createOpportunity(input: Omit<Opportunity, 'id' | 'updatedAt'>) {
    const opportunity = { ...input, id: randomUUID(), updatedAt: now() }
    this.data.opportunities.push(opportunity)
    await this.persist()
    return opportunity
  }

  async updateTheme(theme: Theme) {
    this.data.theme = theme
    await this.persist()
    return theme
  }

  async addTier(tier: Tier) {
    const index = this.data.tiers.findIndex((item) => item.id === tier.id)
    if (index >= 0) this.data.tiers[index] = tier
    else this.data.tiers.push(tier)
    await this.persist()
    return tier
  }

  async saveGoogleTokens(encrypted: string | undefined) {
    this.data.googleTokens = encrypted
    await this.persist()
  }
}
