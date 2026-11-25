export type Tier = {
  id: string
  name: string
  description: string
  features: string[]
  active: boolean
}

export type Client = {
  id: string
  customerNumber: string
  name: string
  email: string
  phone: string
  tierId: string
  status: 'new' | 'contacted' | 'consultation' | 'estimate' | 'won' | 'lost' | 'lead' | 'active' | 'paused' | 'archived'
  isDemo: boolean
  driveFolderId?: string
  notes: string
  service?: string
  city?: string
  source?: string
  followUpDate?: string | null
  createdAt: string
  updatedAt: string
}

export type Opportunity = {
  id: string
  clientId: string
  title: string
  value: number
  stage: 'lead' | 'qualified' | 'proposal' | 'won' | 'lost'
  updatedAt: string
}

export type Activity = {
  id: string
  clientId: string
  type: 'note' | 'call' | 'email' | 'meeting'
  summary: string
  occurredAt: string
}

export type Theme = {
  brandName: string
  logoUrl: string
  primary: string
  accent: string
  surface: string
}

export type PlatformData = {
  version: number
  nextCustomerNumber: number
  clients: Client[]
  opportunities: Opportunity[]
  activities: Activity[]
  tiers: Tier[]
  theme: Theme
  googleTokens?: string
}
