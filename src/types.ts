export type Client = {
  id: string
  customerNumber: string
  name: string
  email: string
  phone: string
  tierId: string
  status: 'lead' | 'active' | 'paused' | 'archived'
  isDemo: boolean
  driveFolderId?: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type Tier = { id: string; name: string; description: string; features: string[]; active: boolean }
export type Activity = { id: string; clientId: string; type: string; summary: string; occurredAt: string }
export type Opportunity = { id: string; clientId: string; title: string; value: number; stage: string; updatedAt: string }
export type Theme = { brandName: string; logoUrl: string; primary: string; accent: string; surface: string }
export type Platform = {
  clients: Client[]
  tiers: Tier[]
  activities: Activity[]
  opportunities: Opportunity[]
  theme: Theme
  google: { configured: boolean; connected: boolean }
}
