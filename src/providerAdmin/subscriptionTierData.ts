import { VISION_MODEL_PRESETS, type VisionModelPreset } from '../vision/fleetWorld'

export type TokenRateLimit = {
  limit: number
  window: string
}

export type TierModelRef = {
  modelId: string
  displayName: string
  tokenRateLimits: TokenRateLimit[]
}

export type SubscriptionTier = {
  id: string
  name: string
  description: string
  priority: number
  modelRefs: TierModelRef[]
  assignedTenantIds: string[]
  createdAt: string
}

const STORAGE_KEY = 'bmaas-provider-subscription-tiers'

const DEMO_TIERS: SubscriptionTier[] = [
  {
    id: 'tier-free',
    name: 'Free Tier',
    description: 'Basic access to smaller models with conservative rate limits. Suitable for evaluation and development.',
    priority: 0,
    modelRefs: [
      {
        modelId: 'granite-3b',
        displayName: 'Granite 3B instruct',
        tokenRateLimits: [{ limit: 500000, window: 'month' }],
      },
      {
        modelId: 'gemma-3-4b',
        displayName: 'Gemma 3 4B',
        tokenRateLimits: [{ limit: 200000, window: 'month' }],
      },
    ],
    assignedTenantIds: ['org-northsummit', 'org-bluesolace'],
    createdAt: '2026-09-15T10:30:00Z',
  },
  {
    id: 'tier-standard',
    name: 'Standard',
    description: 'Production access to mid-range models with moderate quotas.',
    priority: 10,
    modelRefs: [
      {
        modelId: 'granite-3b',
        displayName: 'Granite 3B instruct',
        tokenRateLimits: [{ limit: 2000000, window: 'month' }],
      },
      {
        modelId: 'granite-8b',
        displayName: 'Granite 8B instruct',
        tokenRateLimits: [{ limit: 1000000, window: 'month' }],
      },
      {
        modelId: 'mistral-7b',
        displayName: 'Mistral 7B',
        tokenRateLimits: [{ limit: 1000000, window: 'month' }],
      },
      {
        modelId: 'gemma-3-4b',
        displayName: 'Gemma 3 4B',
        tokenRateLimits: [{ limit: 1000000, window: 'month' }],
      },
    ],
    assignedTenantIds: ['org-northsummit'],
    createdAt: '2026-09-15T10:35:00Z',
  },
  {
    id: 'tier-premium',
    name: 'Premium',
    description: 'Full access to all models including frontier. High quotas for production workloads.',
    priority: 100,
    modelRefs: [
      {
        modelId: 'granite-3b',
        displayName: 'Granite 3B instruct',
        tokenRateLimits: [{ limit: 10000000, window: 'month' }],
      },
      {
        modelId: 'granite-8b',
        displayName: 'Granite 8B instruct',
        tokenRateLimits: [{ limit: 5000000, window: 'month' }],
      },
      {
        modelId: 'llama-4-scout',
        displayName: 'Llama 4 Scout',
        tokenRateLimits: [{ limit: 5000000, window: 'month' }],
      },
      {
        modelId: 'mistral-7b',
        displayName: 'Mistral 7B',
        tokenRateLimits: [{ limit: 5000000, window: 'month' }],
      },
      {
        modelId: 'gemma-3-4b',
        displayName: 'Gemma 3 4B',
        tokenRateLimits: [{ limit: 5000000, window: 'month' }],
      },
    ],
    assignedTenantIds: ['org-bluesolace'],
    createdAt: '2026-09-20T14:00:00Z',
  },
]

export function getSubscriptionTiers(): SubscriptionTier[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    return JSON.parse(raw) as SubscriptionTier[]
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_TIERS))
  return DEMO_TIERS
}

export function ensureSubscriptionTiersDemoData(): SubscriptionTier[] {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) {
    return JSON.parse(existing) as SubscriptionTier[]
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_TIERS))
  return DEMO_TIERS
}

export function addSubscriptionTier(tier: SubscriptionTier): void {
  const tiers = getSubscriptionTiers()
  tiers.push(tier)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers))
}

export function updateSubscriptionTier(tierId: string, updates: Partial<SubscriptionTier>): void {
  const tiers = getSubscriptionTiers()
  const index = tiers.findIndex((t) => t.id === tierId)
  if (index >= 0) {
    tiers[index] = { ...tiers[index], ...updates }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers))
  }
}

export function removeSubscriptionTier(tierId: string): void {
  const tiers = getSubscriptionTiers().filter((t) => t.id !== tierId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers))
}

export function getAvailableModelsForTier(): VisionModelPreset[] {
  return VISION_MODEL_PRESETS
}

export function formatTokenLimit(limit: number): string {
  if (limit >= 1000000) return `${(limit / 1000000).toFixed(limit % 1000000 === 0 ? 0 : 1)}M`
  if (limit >= 1000) return `${(limit / 1000).toFixed(limit % 1000 === 0 ? 0 : 1)}K`
  return `${limit}`
}

export function generateTierId(): string {
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}
