export type VisionOrgId = 'nsb' | 'bluesolace'
export type VisionGatewayId = 'nsb-retail' | 'nsb-markets' | 'nsb-west' | 'nsb-east' | 'bsfg-us'
export type VisionSiteId = 'us-west-1-dc-a' | 'us-east-1-dc-b' | 'us-central-1-dc-a' | 'eu-west-1-dc-a'
export type VisionClusterHealth = 'available' | 'unavailable'
export type VisionEnrollmentStatus = 'active' | 'frozen' | 'enrolling'
export type VisionOrgFilter = 'all' | VisionOrgId
export type VisionGatewayFilter = 'all' | VisionGatewayId

export type VisionOrg = {
  id: VisionOrgId
  label: string
}

export type VisionGateway = {
  id: VisionGatewayId
  orgId: VisionOrgId
  clusterId: string
  label: string
  hostname: string
}

export type VisionSite = {
  id: VisionSiteId
  label: string
  regionLabel: string
  lat: number
  lng: number
  x: number
  y: number
}

export type VisionCluster = {
  id: string
  name: string
  siteId: VisionSiteId
  orgId: VisionOrgId
  gatewayId: VisionGatewayId
  platform: string
  region: string
  health: VisionClusterHealth
  enrollmentStatus: VisionEnrollmentStatus
  nodeCount: number
  nodesReady: number
  gpuCount: number
  gpuType: string
  gpuUtilPercent: number
  openshiftVersion: string
  x: number
  y: number
}

export type VisionModelPreset = {
  id: string
  displayName: string
  /** Same field as RHOAI model id — the identifier used in API calls. */
  modelId: string
  catalogItemId: string | null
  gpuRequirement: string
}

export type VisionClusterOffering = {
  id: string
  name: string
  summary: string
  nodeCount: number
  gpuCount: number
  platformHint: string
}

export type VisionDeployment = {
  id: string
  presetId: string
  clusterId: string
  orgId: VisionOrgId
  projectName: string
  attachedGatewayId: VisionGatewayId | null
  maasGatewayIds: VisionGatewayId[]
  status: 'Ready' | 'Starting'
  replicas: string
  reqPerMin: number
}

/** External model CR. Lives in a project on a cluster; serving is a remote provider. */
export type VisionOffPlatformModel = {
  id: string
  displayName: string
  modelId: string
  servedBy: string
  orgId: VisionOrgId
  projectName: string
  clusterId: string
  gatewayIds: VisionGatewayId[]
}

export type VisionMaasOrigin = 'this-cluster' | 'other-cluster'

export const visionProjectForOrg = (orgId: VisionOrgId): string =>
  orgId === 'nsb' ? 'ml-project' : 'bsfg-models'

export type VisionServingPath = {
  id: string
  fromClusterId: string
  toClusterId: string
  presetId: string
  reqPerMin: number
  isLive: boolean
}

export const VISION_ORGS: VisionOrg[] = [
  { id: 'nsb', label: 'North Summit Bank' },
  { id: 'bluesolace', label: 'BlueSolace Financial Group' },
]

export const VISION_GATEWAYS: VisionGateway[] = [
  {
    id: 'nsb-retail',
    orgId: 'nsb',
    clusterId: 'ocp-eu-west-1',
    label: 'nsb-retail',
    hostname: 'nsb.eu-west.vertexa.example',
  },
  {
    id: 'nsb-markets',
    orgId: 'nsb',
    clusterId: 'ocp-us-east-1',
    label: 'nsb-markets',
    hostname: 'nsb.us-east.vertexa.example',
  },
  {
    id: 'nsb-east',
    orgId: 'nsb',
    clusterId: 'ocp-us-east-1',
    label: 'nsb-east',
    hostname: 'nsb.us-east-edge.vertexa.example',
  },
  {
    id: 'nsb-west',
    orgId: 'nsb',
    clusterId: 'ocp-us-west-1',
    label: 'nsb-west',
    hostname: 'nsb.us-west.vertexa.example',
  },
  {
    id: 'bsfg-us',
    orgId: 'bluesolace',
    clusterId: 'ocp-us-central-1',
    label: 'bsfg-us',
    hostname: 'bsfg.us-central.vertexa.example',
  },
]

export const VISION_SITES: VisionSite[] = [
  {
    id: 'us-west-1-dc-a',
    label: 'us-west-1-dc-a',
    regionLabel: 'US West',
    lat: 37.3382,
    lng: -121.8863,
    x: 16,
    y: 40,
  },
  {
    id: 'us-east-1-dc-b',
    label: 'us-east-1-dc-b',
    regionLabel: 'US East',
    lat: 39.0438,
    lng: -77.4874,
    x: 34,
    y: 38,
  },
  {
    id: 'us-central-1-dc-a',
    label: 'us-central-1-dc-a',
    regionLabel: 'US Central',
    lat: 41.8781,
    lng: -87.6298,
    x: 26,
    y: 36,
  },
  {
    id: 'eu-west-1-dc-a',
    label: 'eu-west-1-dc-a',
    regionLabel: 'EU West',
    lat: 53.3498,
    lng: -6.2603,
    x: 58,
    y: 34,
  },
]

export const VISION_MODEL_PRESETS: VisionModelPreset[] = [
  {
    id: 'granite-3b',
    displayName: 'Granite 3B instruct',
    modelId: 'granite-3b',
    catalogItemId: 'cat-granite-3b-instruct',
    gpuRequirement: '1 GPU',
  },
  {
    id: 'granite-8b',
    displayName: 'Granite 8B instruct',
    modelId: 'granite-8b',
    catalogItemId: null,
    gpuRequirement: '1 GPU',
  },
  {
    id: 'llama-4-scout',
    displayName: 'Llama 4 Scout',
    modelId: 'llama-4-scout',
    catalogItemId: null,
    gpuRequirement: '4 GPU',
  },
  {
    id: 'mistral-7b',
    displayName: 'Mistral 7B',
    modelId: 'mistral-7b',
    catalogItemId: null,
    gpuRequirement: '1 GPU',
  },
  {
    id: 'gemma-3-4b',
    displayName: 'Gemma 3 4B',
    modelId: 'gemma-3-4b',
    catalogItemId: null,
    gpuRequirement: '1 GPU',
  },
]

export const VISION_CLUSTER_OFFERINGS: VisionClusterOffering[] = [
  {
    id: 'gpu-inference',
    name: 'GPU inference cluster',
    summary: '3 workers · NVIDIA T4',
    nodeCount: 3,
    gpuCount: 3,
    platformHint: 'GPU',
  },
  {
    id: 'cpu-serving',
    name: 'CPU serving cluster',
    summary: '6 workers · CPU only',
    nodeCount: 6,
    gpuCount: 0,
    platformHint: 'CPU',
  },
  {
    id: 'high-memory',
    name: 'High-memory cluster',
    summary: '3 workers · 1× H100',
    nodeCount: 3,
    gpuCount: 1,
    platformHint: 'H100',
  },
]

const SITE_PLATFORM: Record<VisionSiteId, { platform: string; region: string }> = {
  'us-west-1-dc-a': { platform: 'Azure', region: 'westus' },
  'us-east-1-dc-b': { platform: 'AWS', region: 'us-east-1' },
  'us-central-1-dc-a': { platform: 'On-prem', region: 'us-central-1' },
  'eu-west-1-dc-a': { platform: 'Azure', region: 'westeurope' },
}

export const createInitialClusters = (): VisionCluster[] => [
  {
    id: 'ocp-us-west-1',
    name: 'ocp-us-west-1',
    siteId: 'us-west-1-dc-a',
    orgId: 'nsb',
    gatewayId: 'nsb-west',
    platform: 'Azure',
    region: 'westus',
    health: 'available',
    enrollmentStatus: 'active',
    nodeCount: 3,
    nodesReady: 3,
    gpuCount: 3,
    gpuType: 'NVIDIA T4',
    gpuUtilPercent: 12,
    openshiftVersion: '4.21.20',
    x: 16,
    y: 40,
  },
  {
    id: 'ocp-us-west-gpu',
    name: 'ocp-us-west-gpu',
    siteId: 'us-west-1-dc-a',
    orgId: 'nsb',
    gatewayId: 'nsb-west',
    platform: 'Azure',
    region: 'westus',
    health: 'unavailable',
    enrollmentStatus: 'frozen',
    nodeCount: 3,
    nodesReady: 0,
    gpuCount: 3,
    gpuType: 'NVIDIA A100',
    gpuUtilPercent: 0,
    openshiftVersion: '4.21.20',
    x: 18.5,
    y: 45,
  },
  {
    id: 'ocp-us-east-1',
    name: 'ocp-us-east-1',
    siteId: 'us-east-1-dc-b',
    orgId: 'nsb',
    gatewayId: 'nsb-markets',
    platform: 'AWS',
    region: 'us-east-1',
    health: 'available',
    enrollmentStatus: 'active',
    nodeCount: 3,
    nodesReady: 3,
    gpuCount: 4,
    gpuType: 'NVIDIA T4',
    gpuUtilPercent: 41,
    openshiftVersion: '4.21.20',
    x: 34,
    y: 38,
  },
  {
    id: 'ocp-us-east-gpu',
    name: 'ocp-us-east-gpu',
    siteId: 'us-east-1-dc-b',
    orgId: 'nsb',
    gatewayId: 'nsb-markets',
    platform: 'AWS',
    region: 'us-east-1',
    health: 'unavailable',
    enrollmentStatus: 'enrolling',
    nodeCount: 2,
    nodesReady: 0,
    gpuCount: 4,
    gpuType: 'NVIDIA H100',
    gpuUtilPercent: 0,
    openshiftVersion: '4.21.20',
    x: 36.5,
    y: 43,
  },
  {
    id: 'ocp-us-central-1',
    name: 'ocp-us-central-1',
    siteId: 'us-central-1-dc-a',
    orgId: 'bluesolace',
    gatewayId: 'bsfg-us',
    platform: 'On-prem',
    region: 'us-central-1',
    health: 'available',
    enrollmentStatus: 'active',
    nodeCount: 4,
    nodesReady: 4,
    gpuCount: 8,
    gpuType: 'NVIDIA A100',
    gpuUtilPercent: 22,
    openshiftVersion: '4.21.18',
    x: 26,
    y: 36,
  },
  {
    id: 'ocp-eu-west-1',
    name: 'ocp-eu-west-1',
    siteId: 'eu-west-1-dc-a',
    orgId: 'nsb',
    gatewayId: 'nsb-retail',
    platform: 'Azure',
    region: 'westeurope',
    health: 'available',
    enrollmentStatus: 'active',
    nodeCount: 3,
    nodesReady: 3,
    gpuCount: 2,
    gpuType: 'NVIDIA T4',
    gpuUtilPercent: 18,
    openshiftVersion: '4.21.20',
    x: 56,
    y: 34,
  },
  {
    id: 'ocp-eu-west-2',
    name: 'ocp-eu-west-2',
    siteId: 'eu-west-1-dc-a',
    orgId: 'bluesolace',
    gatewayId: 'bsfg-us',
    platform: 'Azure',
    region: 'westeurope',
    health: 'available',
    enrollmentStatus: 'active',
    nodeCount: 3,
    nodesReady: 3,
    gpuCount: 2,
    gpuType: 'NVIDIA T4',
    gpuUtilPercent: 9,
    openshiftVersion: '4.21.18',
    x: 59.5,
    y: 39,
  },
]

export const createInitialDeployments = (): VisionDeployment[] => [
  {
    id: 'dep-granite-east',
    presetId: 'granite-3b',
    clusterId: 'ocp-us-east-1',
    orgId: 'nsb',
    projectName: visionProjectForOrg('nsb'),
    attachedGatewayId: 'nsb-markets',
    maasGatewayIds: ['nsb-markets', 'nsb-retail'],
    status: 'Ready',
    replicas: '2× · 1 GPU',
    reqPerMin: 16.4,
  },
  {
    id: 'dep-granite-eu',
    presetId: 'granite-3b',
    clusterId: 'ocp-eu-west-1',
    orgId: 'nsb',
    projectName: visionProjectForOrg('nsb'),
    attachedGatewayId: 'nsb-retail',
    maasGatewayIds: ['nsb-retail'],
    status: 'Ready',
    replicas: '2× · 1 GPU',
    reqPerMin: 9.3,
  },
  {
    id: 'dep-mistral-west',
    presetId: 'mistral-7b',
    clusterId: 'ocp-us-west-1',
    orgId: 'nsb',
    projectName: visionProjectForOrg('nsb'),
    attachedGatewayId: 'nsb-west',
    maasGatewayIds: [],
    status: 'Ready',
    replicas: '1× · 1 GPU',
    reqPerMin: 2.1,
  },
  {
    id: 'dep-llama-central',
    presetId: 'llama-4-scout',
    clusterId: 'ocp-us-central-1',
    orgId: 'bluesolace',
    projectName: visionProjectForOrg('bluesolace'),
    attachedGatewayId: 'bsfg-us',
    maasGatewayIds: ['bsfg-us'],
    status: 'Ready',
    replicas: '1× · 4 GPU',
    reqPerMin: 6.5,
  },
  {
    id: 'dep-granite8-eu',
    presetId: 'granite-8b',
    clusterId: 'ocp-eu-west-2',
    orgId: 'bluesolace',
    projectName: visionProjectForOrg('bluesolace'),
    attachedGatewayId: null,
    maasGatewayIds: [],
    status: 'Ready',
    replicas: '1× · 1 GPU',
    reqPerMin: 1.2,
  },
]

export const VISION_OFF_PLATFORM_MODELS: VisionOffPlatformModel[] = [
  // Parked: Titan Text Express (Bedrock, two NSB gateways) and Claude Sonnet 4 (Anthropic, unassigned).
  // Restore these objects to bring them back as fleet off-platform models.
  /*
  {
    id: 'ext-bedrock-titan',
    displayName: 'Titan Text Express',
    modelId: 'titan-express',
    servedBy: 'Amazon Bedrock',
    orgId: 'nsb',
    projectName: visionProjectForOrg('nsb'),
    clusterId: 'ocp-us-east-1',
    gatewayIds: ['nsb-markets', 'nsb-retail'],
  },
  {
    id: 'ext-anthropic-claude',
    displayName: 'Claude Sonnet 4',
    modelId: 'claude-sonnet-4',
    servedBy: 'Anthropic',
    orgId: 'nsb',
    projectName: visionProjectForOrg('nsb'),
    clusterId: 'ocp-us-east-1',
    gatewayIds: [],
  },
  */
]

export const createInitialPaths = (): VisionServingPath[] => [
  {
    id: 'path-granite-east-eu',
    fromClusterId: 'ocp-us-east-1',
    toClusterId: 'ocp-eu-west-1',
    presetId: 'granite-3b',
    reqPerMin: 9.3,
    isLive: true,
  },
  {
    id: 'path-mistral-west-east',
    fromClusterId: 'ocp-us-west-1',
    toClusterId: 'ocp-us-east-1',
    presetId: 'mistral-7b',
    reqPerMin: 2.1,
    isLive: true,
  },
  {
    id: 'path-llama-central-eu',
    fromClusterId: 'ocp-us-central-1',
    toClusterId: 'ocp-eu-west-2',
    presetId: 'llama-4-scout',
    reqPerMin: 6.5,
    isLive: true,
  },
]

export const getVisionOffPlatformModel = (id: string): VisionOffPlatformModel | undefined =>
  VISION_OFF_PLATFORM_MODELS.find((entry) => entry.id === id)

export const gatewaysOnCluster = (clusterId: string): VisionGateway[] =>
  VISION_GATEWAYS.filter((gateway) => gateway.clusterId === clusterId)

export const offPlatformModelsForOrgFilter = (
  orgFilter: VisionOrgFilter,
): VisionOffPlatformModel[] => {
  if (orgFilter === 'all') {
    return VISION_OFF_PLATFORM_MODELS
  }
  return VISION_OFF_PLATFORM_MODELS.filter((model) => model.orgId === orgFilter)
}

export const isDeploymentMaas = (deployment: VisionDeployment): boolean =>
  deployment.maasGatewayIds.length > 0

export const maasOriginOnGateway = (
  deployment: VisionDeployment,
  gateway: VisionGateway,
): VisionMaasOrigin | null => {
  if (!deployment.maasGatewayIds.includes(gateway.id)) {
    return null
  }
  return deployment.clusterId === gateway.clusterId ? 'this-cluster' : 'other-cluster'
}

export const homeMaasOrigin = (deployment: VisionDeployment): VisionMaasOrigin | null => {
  if (!isDeploymentMaas(deployment)) {
    return null
  }
  return deployment.maasGatewayIds.some((gatewayId) => {
    const gateway = VISION_GATEWAYS.find((entry) => entry.id === gatewayId)
    return gateway?.clusterId === deployment.clusterId
  })
    ? 'this-cluster'
    : 'other-cluster'
}

export const formatInstanceCount = (count: number): string =>
  count === 1 ? '1 instance' : `${count} instances`

export const visibleOffPlatformModels = (
  orgFilter: VisionOrgFilter,
): VisionOffPlatformModel[] => offPlatformModelsForOrgFilter(orgFilter)

export const deploymentsOnGatewayAsMaas = (
  deployments: VisionDeployment[],
  gatewayId: VisionGatewayId,
): VisionDeployment[] =>
  deployments.filter((deployment) => deployment.maasGatewayIds.includes(gatewayId))

export const offPlatformModelsOnGateway = (
  models: VisionOffPlatformModel[],
  gatewayId: VisionGatewayId,
): VisionOffPlatformModel[] => models.filter((model) => model.gatewayIds.includes(gatewayId))

export const modelsOnGatewayCount = (
  deployments: VisionDeployment[],
  offPlatformModels: VisionOffPlatformModel[],
  gatewayId: VisionGatewayId,
): number =>
  deployments.filter(
    (deployment) =>
      deployment.maasGatewayIds.includes(gatewayId) || deployment.attachedGatewayId === gatewayId,
  ).length + offPlatformModels.filter((model) => model.gatewayIds.includes(gatewayId)).length

export const formatModelCount = (count: number): string =>
  count === 1 ? '1 model' : `${count} models`

export const visibleGatewaysById = (
  gatewayIds: VisionGatewayId[],
  visibleGateways: VisionGateway[],
): VisionGateway[] => visibleGateways.filter((gateway) => gatewayIds.includes(gateway.id))

export const clustersForOffPlatformModel = (
  model: VisionOffPlatformModel,
  clusters: VisionCluster[],
): string[] => (clusters.some((cluster) => cluster.id === model.clusterId) ? [model.clusterId] : [])

export const getVisionOrg = (id: VisionOrgId): VisionOrg => {
  const org = VISION_ORGS.find((entry) => entry.id === id)
  if (!org) {
    throw new Error(`Unknown vision org: ${id}`)
  }
  return org
}

export const getVisionGateway = (id: VisionGatewayId): VisionGateway => {
  const gateway = VISION_GATEWAYS.find((entry) => entry.id === id)
  if (!gateway) {
    throw new Error(`Unknown vision gateway: ${id}`)
  }
  return gateway
}

export const getClusterLatLng = (
  cluster: VisionCluster,
  all: VisionCluster[],
): [number, number] => {
  const site = getVisionSite(cluster.siteId)
  const offset = all
    .filter((entry) => entry.siteId === cluster.siteId)
    .findIndex((entry) => entry.id === cluster.id)
  const index = Math.max(0, offset)
  return [site.lat - (index % 2) * 0.32, site.lng + index * 0.42]
}

export const getVisionSite = (id: VisionSiteId): VisionSite => {
  const site = VISION_SITES.find((entry) => entry.id === id)
  if (!site) {
    throw new Error(`Unknown vision site: ${id}`)
  }
  return site
}

export const getVisionPreset = (id: string): VisionModelPreset | undefined =>
  VISION_MODEL_PRESETS.find((entry) => entry.id === id)

export const getVisionOffering = (id: string): VisionClusterOffering | undefined =>
  VISION_CLUSTER_OFFERINGS.find((entry) => entry.id === id)

export const gatewaysForOrgFilter = (orgFilter: VisionOrgFilter): VisionGateway[] => {
  if (orgFilter === 'all') {
    return VISION_GATEWAYS
  }
  return VISION_GATEWAYS.filter((gateway) => gateway.orgId === orgFilter)
}

export const clusterMatchesFilters = (
  cluster: VisionCluster,
  orgFilter: VisionOrgFilter,
  gatewayFilter: VisionGatewayFilter,
): boolean => {
  if (orgFilter !== 'all' && cluster.orgId !== orgFilter) {
    return false
  }
  if (gatewayFilter !== 'all' && cluster.gatewayId !== gatewayFilter) {
    return false
  }
  return true
}

export const deploymentMatchesFilters = (
  deployment: VisionDeployment,
  orgFilter: VisionOrgFilter,
  gatewayFilter: VisionGatewayFilter,
): boolean => {
  if (orgFilter !== 'all' && deployment.orgId !== orgFilter) {
    return false
  }
  if (gatewayFilter !== 'all' && deployment.attachedGatewayId !== gatewayFilter) {
    return false
  }
  return true
}

export const pathMatchesFilters = (
  path: VisionServingPath,
  clusters: VisionCluster[],
  orgFilter: VisionOrgFilter,
  gatewayFilter: VisionGatewayFilter,
): boolean => {
  const from = clusters.find((cluster) => cluster.id === path.fromClusterId)
  const to = clusters.find((cluster) => cluster.id === path.toClusterId)
  if (!from || !to) {
    return false
  }
  return (
    clusterMatchesFilters(from, orgFilter, gatewayFilter) &&
    clusterMatchesFilters(to, orgFilter, gatewayFilter)
  )
}

export type VisionFleetSummary = {
  totalGpus: number
  gpuUtilPercent: number
  tokensPerSec: number
  activeModels: number
  activeClusters: number
}

export const summarizeFleet = (
  clusters: VisionCluster[],
  deployments: VisionDeployment[],
  offPlatformModels: VisionOffPlatformModel[] = [],
): VisionFleetSummary => {
  const available = clusters.filter((cluster) => cluster.health === 'available')
  const totalGpus = available.reduce((sum, cluster) => sum + cluster.gpuCount, 0)
  const weightedUtil = available.reduce(
    (sum, cluster) => sum + cluster.gpuCount * cluster.gpuUtilPercent,
    0,
  )
  const reqPerMin = deployments.reduce((sum, deployment) => sum + deployment.reqPerMin, 0)

  return {
    totalGpus,
    gpuUtilPercent: totalGpus === 0 ? 0 : Math.round(weightedUtil / totalGpus),
    tokensPerSec: Math.round(reqPerMin * 0.4 * 10) / 10,
    activeModels: deployments.length + offPlatformModels.length,
    activeClusters: available.length,
  }
}

export const visionOrgIdForTenantSlug = (slug: string): VisionOrgId =>
  slug === 'evergreen' ? 'bluesolace' : 'nsb'

export const deploymentsOnCluster = (
  deployments: VisionDeployment[],
  clusterId: string,
): VisionDeployment[] => deployments.filter((deployment) => deployment.clusterId === clusterId)

export const clustersForPreset = (
  deployments: VisionDeployment[],
  presetId: string,
): string[] =>
  deployments.filter((deployment) => deployment.presetId === presetId).map((deployment) => deployment.clusterId)

export const clustersForOffering = (
  clusters: VisionCluster[],
  offering: VisionClusterOffering,
): string[] => {
  if (offering.gpuCount === 0) {
    return clusters.filter((cluster) => cluster.gpuCount === 0).map((cluster) => cluster.id)
  }

  return clusters.filter((cluster) => cluster.gpuCount > 0).map((cluster) => cluster.id)
}

export const clustersForGateway = (clusters: VisionCluster[], gatewayId: VisionGatewayId): string[] => {
  const gateway = VISION_GATEWAYS.find((entry) => entry.id === gatewayId)
  if (!gateway) {
    return []
  }
  return clusters.some((cluster) => cluster.id === gateway.clusterId) ? [gateway.clusterId] : []
}

export const createClusterFromOffering = (
  offering: VisionClusterOffering,
  siteId: VisionSiteId,
  orgId: VisionOrgId,
  gatewayId: VisionGatewayId,
  existing: VisionCluster[],
): VisionCluster => {
  const site = getVisionSite(siteId)
  const platform = SITE_PLATFORM[siteId]
  const siblings = existing.filter((cluster) => cluster.siteId === siteId)
  const offset = siblings.length * 2.4

  return {
    id: `ocp-${siteId}-${Date.now()}`,
    name: `ocp-${site.regionLabel.toLowerCase().replace(/\s+/g, '-')}-${siblings.length + 1}`,
    siteId,
    orgId,
    gatewayId,
    platform: platform.platform,
    region: platform.region,
    health: 'available',
    enrollmentStatus: 'active',
    nodeCount: offering.nodeCount,
    nodesReady: offering.nodeCount,
    gpuCount: offering.gpuCount,
    gpuType: offering.gpuCount > 0 ? 'NVIDIA T4' : 'None',
    gpuUtilPercent: 0,
    openshiftVersion: '4.21.20',
    x: Math.min(96, site.x + offset),
    y: Math.min(52, site.y + (siblings.length % 2 === 0 ? 0 : 4)),
  }
}

export const createDeploymentOnCluster = (
  preset: VisionModelPreset,
  cluster: VisionCluster,
): VisionDeployment => {
  const localGateway = gatewaysOnCluster(cluster.id)[0]
  return {
    id: `dep-${preset.id}-${cluster.id}-${Date.now()}`,
    presetId: preset.id,
    clusterId: cluster.id,
    orgId: cluster.orgId,
    projectName: visionProjectForOrg(cluster.orgId),
    attachedGatewayId: localGateway?.id ?? null,
    maasGatewayIds: [],
    status: 'Ready',
    replicas: `1× · ${preset.gpuRequirement}`,
    reqPerMin: 0.8,
  }
}

export const ensureServingPath = (
  paths: VisionServingPath[],
  clusters: VisionCluster[],
  deployments: VisionDeployment[],
  presetId: string,
  toClusterId: string,
): VisionServingPath[] => {
  const peers = deployments.filter(
    (deployment) => deployment.presetId === presetId && deployment.clusterId !== toClusterId,
  )
  const from = peers
    .map((deployment) => clusters.find((cluster) => cluster.id === deployment.clusterId))
    .find((cluster) => cluster && cluster.health === 'available')
  const to = clusters.find((cluster) => cluster.id === toClusterId)
  if (!from || !to || to.health !== 'available') {
    return paths
  }

  const exists = paths.some(
    (path) =>
      path.presetId === presetId &&
      ((path.fromClusterId === from.id && path.toClusterId === to.id) ||
        (path.fromClusterId === to.id && path.toClusterId === from.id)),
  )
  if (exists) {
    return paths
  }

  return [
    ...paths,
    {
      id: `path-${presetId}-${from.id}-${to.id}`,
      fromClusterId: from.id,
      toClusterId: to.id,
      presetId,
      reqPerMin: 0.8,
      isLive: true,
    },
  ]
}
