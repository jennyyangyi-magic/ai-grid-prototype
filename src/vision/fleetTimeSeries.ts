export type TimeSeriesPoint = {
  ts: number
  value: number
}

export type ClusterTimeSeries = {
  gpuUtil: TimeSeriesPoint[]
  tokensPerSec: TimeSeriesPoint[]
  queueDepth: TimeSeriesPoint[]
  requestsPerSec: TimeSeriesPoint[]
}

export type FleetTimeSeries = {
  gpuUtil: TimeSeriesPoint[]
  tokensPerSec: TimeSeriesPoint[]
  queueDepth: TimeSeriesPoint[]
}

export type HealthReason = {
  metric: string
  value: number
  threshold: number
  message: string
}

export type ClusterHealthDetail = {
  level: 'green' | 'yellow' | 'red'
  reasons: HealthReason[]
}

const GPU_WARN = 90
const QUEUE_WARN = 50
const LATENCY_WARN_MS = 5000

export function deriveClusterHealth(
  gpuUtil: number,
  queueDepth: number,
  p50LatencyMs: number,
  readyEndpoints: number,
): ClusterHealthDetail {
  const reasons: HealthReason[] = []

  if (readyEndpoints === 0) {
    return {
      level: 'red',
      reasons: [{ metric: 'Ready endpoints', value: 0, threshold: 1, message: 'No ready inference endpoints' }],
    }
  }

  if (gpuUtil >= GPU_WARN) {
    reasons.push({
      metric: 'GPU utilization',
      value: gpuUtil,
      threshold: GPU_WARN,
      message: `GPU utilization ${gpuUtil}% ≥ ${GPU_WARN}%`,
    })
  }
  if (queueDepth >= QUEUE_WARN) {
    reasons.push({
      metric: 'Queue depth',
      value: queueDepth,
      threshold: QUEUE_WARN,
      message: `Queue depth ${queueDepth} ≥ ${QUEUE_WARN}`,
    })
  }
  if (p50LatencyMs >= LATENCY_WARN_MS) {
    reasons.push({
      metric: 'P50 latency',
      value: p50LatencyMs,
      threshold: LATENCY_WARN_MS,
      message: `P50 latency ${p50LatencyMs}ms ≥ ${LATENCY_WARN_MS}ms`,
    })
  }

  return {
    level: reasons.length > 0 ? 'yellow' : 'green',
    reasons,
  }
}

function generateSeries(
  points: number,
  intervalMs: number,
  baseFn: (i: number, total: number) => number,
  noise: number,
): TimeSeriesPoint[] {
  const now = Date.now()
  const start = now - points * intervalMs
  return Array.from({ length: points }, (_, i) => ({
    ts: start + i * intervalMs,
    value: Math.max(0, Math.round((baseFn(i, points) + (Math.random() - 0.5) * noise) * 10) / 10),
  }))
}

const CLUSTER_SERIES_CACHE = new Map<string, ClusterTimeSeries>()

export function getClusterTimeSeries(clusterId: string, gpuUtil: number, tokensPerSec: number): ClusterTimeSeries {
  const cached = CLUSTER_SERIES_CACHE.get(clusterId)
  if (cached) return cached

  const points = 20
  const interval = 60_000

  const series: ClusterTimeSeries = {
    gpuUtil: generateSeries(points, interval, (i, total) => gpuUtil + Math.sin(i / total * Math.PI * 3) * 8, 5),
    tokensPerSec: generateSeries(points, interval, (i, total) => tokensPerSec + Math.cos(i / total * Math.PI * 2) * tokensPerSec * 0.15, tokensPerSec * 0.08),
    queueDepth: generateSeries(points, interval, (i, total) => {
      const base = gpuUtil > 85 ? 30 + Math.sin(i / total * Math.PI * 4) * 20 : 5 + Math.sin(i / total * Math.PI * 2) * 4
      return Math.max(0, base)
    }, 3),
    requestsPerSec: generateSeries(points, interval, (i, total) => {
      const base = tokensPerSec * 0.06
      return base + Math.sin(i / total * Math.PI * 3) * base * 0.2
    }, 2),
  }

  CLUSTER_SERIES_CACHE.set(clusterId, series)
  return series
}

const FLEET_SERIES_CACHE: { data: FleetTimeSeries | null } = { data: null }

export function getFleetTimeSeries(fleetGpuUtil: number, fleetTokensPerSec: number): FleetTimeSeries {
  if (FLEET_SERIES_CACHE.data) return FLEET_SERIES_CACHE.data

  const points = 60
  const interval = 60_000

  const data: FleetTimeSeries = {
    gpuUtil: generateSeries(points, interval, (i, total) => fleetGpuUtil + Math.sin(i / total * Math.PI * 4) * 6, 3),
    tokensPerSec: generateSeries(points, interval, (i, total) => fleetTokensPerSec + Math.cos(i / total * Math.PI * 3) * fleetTokensPerSec * 0.12, fleetTokensPerSec * 0.05),
    queueDepth: generateSeries(points, interval, (i, total) => 15 + Math.sin(i / total * Math.PI * 5) * 10, 4),
  }

  FLEET_SERIES_CACHE.data = data
  return data
}

export type FleetSummaryTile = {
  label: string
  value: string
  delta?: string
  deltaDirection?: 'up' | 'down' | 'flat'
  warn?: boolean
  sub?: string
}

export function buildFleetSummaryTiles(
  totalGpus: number,
  gpuUtil: number,
  tokensPerSec: number,
  activeModels: number,
  activeClusters: number,
  totalClusters: number,
  requestsPerMin: number,
  queueDepth: number,
  greenSites: number,
  yellowSites: number,
  redSites: number,
): FleetSummaryTile[] {
  const gpuDelta = Math.round((Math.random() - 0.4) * 6)
  const tpsDelta = Math.round((Math.random() - 0.3) * 8)

  return [
    {
      label: 'GPUs',
      value: `${totalGpus}`,
      sub: `${greenSites} healthy · ${yellowSites} warn · ${redSites} critical`,
    },
    {
      label: 'Utilization',
      value: `${gpuUtil}%`,
      delta: `${gpuDelta > 0 ? '+' : ''}${gpuDelta}%`,
      deltaDirection: gpuDelta > 0 ? 'up' : gpuDelta < 0 ? 'down' : 'flat',
      warn: gpuUtil >= 90,
    },
    {
      label: 'Tokens/sec',
      value: `${tokensPerSec}`,
      delta: `${tpsDelta > 0 ? '+' : ''}${tpsDelta}%`,
      deltaDirection: tpsDelta > 0 ? 'up' : tpsDelta < 0 ? 'down' : 'flat',
    },
    {
      label: 'Requests/min',
      value: `${requestsPerMin}`,
      sub: `fleet p50: 180ms`,
    },
    {
      label: 'Queue depth',
      value: `${queueDepth}`,
      warn: queueDepth >= 50,
      sub: queueDepth > 20 ? `top: cluster with ${queueDepth + 12}` : undefined,
    },
    {
      label: 'Models',
      value: `${activeModels}`,
      sub: `${activeModels} running`,
    },
    {
      label: 'Clusters',
      value: `${activeClusters}/${totalClusters}`,
      sub: `${totalClusters - activeClusters} unavailable`,
    },
  ]
}
