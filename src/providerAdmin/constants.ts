export type ProviderAdminNavId =
  | 'overview'
  | 'ai-grid'
  | 'ai-grid-enrollment'
  | 'provider-ai-models'
  | 'provider-ai-maas-governance'
  | 'provider-ai-usage'
  | 'provider-ai-model-catalog-settings'
  | 'provider-ai-observability'
  | 'catalog'
  | 'services-baremetal'
  | 'services-clusters'
  | 'services-models'
  | 'services-virtual-machines'
  | 'genai-asset-endpoints'
  | 'genai-playground'
  | 'genai-api-keys'
  | 'projects-teams'
  | 'networking'
  | 'networking-virtual-networks'
  | 'networking-subnets'
  | 'networking-security-groups'
  | 'networking-external-ip-pools'
  | 'secrets'
  | 'infrastructure-data-centers'
  | 'infrastructure-hardware-inventory'
  | 'infrastructure-bmaas-templates'
  | 'administration-organizations'
  | 'administration-subscription-tiers'
  | 'administration-billing'
  | 'administration-rate-cards'
  | 'system'

export type ProviderAdminNavItem = {
  id: ProviderAdminNavId
  label: string
}

export const PROVIDER_ADMIN_NAV_ITEMS: ProviderAdminNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'catalog', label: 'Catalog' },
]

export const PROVIDER_ADMIN_AI_NAV_ITEMS: ProviderAdminNavItem[] = [
  { id: 'ai-grid', label: 'AI Grid' },
  { id: 'provider-ai-models', label: 'Models' },
  { id: 'provider-ai-maas-governance', label: 'MaaS governance' },
  { id: 'provider-ai-observability', label: 'Observability' },
  { id: 'provider-ai-usage', label: 'Usage' },
]

export const PROVIDER_ADMIN_SERVICES_NAV_ITEMS: ProviderAdminNavItem[] = [
  { id: 'services-baremetal', label: 'Bare metal' },
  { id: 'services-clusters', label: 'Clusters' },
  { id: 'services-virtual-machines', label: 'Virtual machines' },
]

export const PROVIDER_ADMIN_NETWORKING_NAV_ID: ProviderAdminNavId = 'networking'
export const PROVIDER_ADMIN_NETWORKING_NAV_LABEL = 'External IP pools'

export const PROVIDER_ADMIN_INFRASTRUCTURE_NAV_ITEMS: ProviderAdminNavItem[] = [
  { id: 'infrastructure-data-centers', label: 'Data centers' },
  { id: 'infrastructure-hardware-inventory', label: 'Hardware inventory' },
  { id: 'infrastructure-bmaas-templates', label: 'Profiles & templates' },
]

export const PROVIDER_ADMIN_ADMINISTRATION_NAV_ITEMS: ProviderAdminNavItem[] = [
  { id: 'administration-organizations', label: 'Tenants' },
  { id: 'administration-subscription-tiers', label: 'Subscription tiers' },
  { id: 'administration-billing', label: 'Billing' },
]

export const PROVIDER_ADMIN_MODEL_DEPLOYMENT_MVP_AI_NAV_ITEMS = PROVIDER_ADMIN_AI_NAV_ITEMS

export function isProviderAiNavId(navId: string): boolean {
  return (
    navId === 'ai-grid' ||
    navId === 'provider-ai-models' ||
    navId === 'provider-ai-maas-governance' ||
    navId === 'provider-ai-usage' ||
    navId === 'provider-ai-model-catalog-settings' ||
    navId === 'provider-ai-observability'
  )
}

export function isServicesNavId(navId: string): boolean {
  return navId.startsWith('services-')
}

export function isNetworkingNavId(navId: string): boolean {
  return navId === PROVIDER_ADMIN_NETWORKING_NAV_ID || navId.startsWith('networking-')
}

export function isInfrastructureNavId(navId: string): boolean {
  return navId.startsWith('infrastructure-')
}

export function isAdministrationNavId(navId: string): boolean {
  return navId.startsWith('administration-')
}

export function isOrganizationsNavId(navId: string): boolean {
  return navId === 'administration-organizations'
}

/** Provider admin no longer exposes tenant workspace sections in the shell. */
export function resolveProviderAdminNavId(navId: ProviderAdminNavId): ProviderAdminNavId {
  if (isServicesNavId(navId) || navId === 'projects-teams') {
    return 'catalog'
  }

  if (isNetworkingNavId(navId)) {
    return PROVIDER_ADMIN_NETWORKING_NAV_ID
  }

  return navId
}
