export type TenantUsageRow = {
  tenantId: string
  tenantName: string
  rhaigTenantId: string
  modelsConsumed: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  quotaPercent: number
}

export type FleetHealthSummary = {
  gpuUtilPercent: number
  throughputTps: number
  activeClusters: number
  totalClusters: number
  requestsPerMin: number
  p99LatencyMs: number
  queueDepth: number
  deployedModels: number
}

export const MOCK_FLEET_HEALTH: FleetHealthSummary = {
  gpuUtilPercent: 72,
  throughputTps: 4850,
  activeClusters: 6,
  totalClusters: 7,
  requestsPerMin: 312,
  p99LatencyMs: 180,
  queueDepth: 18,
  deployedModels: 10,
}

export const MOCK_TENANT_USAGE: TenantUsageRow[] = [
  {
    tenantId: 'org-northsummit',
    tenantName: 'NorthSummit Bank',
    rhaigTenantId: '42c3e46f',
    modelsConsumed: 4,
    inputTokens: 12500000,
    outputTokens: 8200000,
    cachedTokens: 3100000,
    quotaPercent: 68,
  },
  {
    tenantId: 'org-bluesolace',
    tenantName: 'BlueSolace Health',
    rhaigTenantId: 'a91bc2d7',
    modelsConsumed: 3,
    inputTokens: 5800000,
    outputTokens: 3400000,
    cachedTokens: 1200000,
    quotaPercent: 34,
  },
]

export function formatLargeNumber(n: number): string {
  if (n >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return `${n}`
}

export const MOCK_MODELS = [
  'granite-3b-instruct',
  'llama-3.1-70b',
  'mistral-7b-instruct',
] as const

export type ModelMetricPoint = {
  ts: number
  value: number
}

export type ModelTokenPoint = {
  ts: number
  prompt: number
  generation: number
}

export type ModelTimeSeries = {
  ttft: ModelMetricPoint[]
  tpot: ModelMetricPoint[]
  kvCacheUsage: ModelMetricPoint[]
  currentRequests: ModelMetricPoint[]
  requestCount: ModelMetricPoint[]
  tokenCount: ModelTokenPoint[]
}

function generateMetricSeries(
  points: number,
  intervalMs: number,
  baseFn: (i: number, total: number) => number,
  noise: number,
): ModelMetricPoint[] {
  const now = Date.now()
  const start = now - points * intervalMs
  return Array.from({ length: points }, (_, i) => ({
    ts: start + i * intervalMs,
    value: Math.max(0, Math.round((baseFn(i, points) + (Math.random() - 0.5) * noise) * 10) / 10),
  }))
}

function generateTokenSeries(
  points: number,
  intervalMs: number,
  promptBase: number,
  genBase: number,
): ModelTokenPoint[] {
  const now = Date.now()
  const start = now - points * intervalMs
  return Array.from({ length: points }, (_, i) => ({
    ts: start + i * intervalMs,
    prompt: Math.max(0, Math.round(promptBase + Math.sin(i / points * Math.PI * 3) * promptBase * 0.2 + (Math.random() - 0.5) * promptBase * 0.1)),
    generation: Math.max(0, Math.round(genBase + Math.cos(i / points * Math.PI * 2) * genBase * 0.15 + (Math.random() - 0.5) * genBase * 0.1)),
  }))
}

const MODEL_PROFILES: Record<string, { ttftBase: number; tpotBase: number; kvBase: number; reqBase: number; promptBase: number; genBase: number }> = {
  'granite-3b-instruct': { ttftBase: 65, tpotBase: 12, kvBase: 42, reqBase: 25, promptBase: 3200, genBase: 1800 },
  'llama-3.1-70b': { ttftBase: 145, tpotBase: 32, kvBase: 72, reqBase: 12, promptBase: 1800, genBase: 1200 },
  'mistral-7b-instruct': { ttftBase: 85, tpotBase: 18, kvBase: 55, reqBase: 20, promptBase: 2600, genBase: 1500 },
}

const MODEL_SERIES_CACHE = new Map<string, ModelTimeSeries>()

export function getModelTimeSeries(modelName: string): ModelTimeSeries {
  const cached = MODEL_SERIES_CACHE.get(modelName)
  if (cached) return cached

  const profile = MODEL_PROFILES[modelName] ?? MODEL_PROFILES['granite-3b-instruct']
  const points = 20
  const interval = 60_000

  const series: ModelTimeSeries = {
    ttft: generateMetricSeries(points, interval, (i, total) => profile.ttftBase + Math.sin(i / total * Math.PI * 3) * 25, 15),
    tpot: generateMetricSeries(points, interval, (i, total) => profile.tpotBase + Math.cos(i / total * Math.PI * 2) * 5, 3),
    kvCacheUsage: generateMetricSeries(points, interval, (i, total) => profile.kvBase + Math.sin(i / total * Math.PI * 4) * 12, 5),
    currentRequests: generateMetricSeries(points, interval, (i, total) => profile.reqBase + Math.sin(i / total * Math.PI * 3) * 8, 4),
    requestCount: generateMetricSeries(points, interval, (i, total) => {
      const base = 1000 + (i / total) * 4000
      return base + Math.sin(i / total * Math.PI * 2) * 300
    }, 100),
    tokenCount: generateTokenSeries(points, interval, profile.promptBase, profile.genBase),
  }

  MODEL_SERIES_CACHE.set(modelName, series)
  return series
}
