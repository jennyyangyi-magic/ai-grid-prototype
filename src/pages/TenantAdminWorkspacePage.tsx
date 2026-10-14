import { useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { syncWorkspaceCatalogItemParam, syncWorkspaceNavParam } from '../shared/workspaceNavUrl'
import { TenantShell } from '../components/tenant/TenantShell'
import { DEMO_TENANT_DISPLAY_ADMIN, isDemoTenantId } from '../demoTenant'
import { PlaceholderTenantAdminPage } from './PlaceholderTenantAdminPage'
import { ProviderAdminExternalNetworksPage } from './infrastructure/ProviderAdminExternalNetworksPage'
import { ProviderAdminVirtualNetworksPage } from './infrastructure/ProviderAdminVirtualNetworksPage'
import { TenantAdminCatalogPage } from './tenant-admin/TenantAdminCatalogPage'
import { MaaSGovernancePage } from './tenant-admin/ai/maas-governance'
import { ModelCatalogSettingsPage } from './tenant-admin/ai/model-catalog-settings'
import TenantAdminModelsPage from './tenant-admin/ai/models/TenantAdminModelsPage'
import { TenantAdminOverviewPage } from './tenant-admin/TenantAdminOverviewPage'
import { TenantAdminAdministratorsPage } from './tenant-admin/TenantAdminAdministratorsPage'
import { TenantAdminBillingPage } from './tenant-admin/TenantAdminBillingPage'
import { TenantAdminProjectsTeamsPage } from './tenant-admin/TenantAdminProjectsTeamsPage'
import { VisionModelFleetPage } from './provider-admin/vision/VisionModelFleetPage'
import { TenantSecretsPage } from './tenant/TenantSecretsPage'
import { TenantUserInstancesPage } from './tenant-user/TenantUserInstancesPage'
import { GenaiApiKeysPage } from './tenant-user/genai/api-keys'
import { AiAssetEndpointsPage } from './tenant-user/genai/asset-endpoints/AiAssetEndpointsPage'
import { PlaygroundPage } from './tenant-user/genai/playground'
import {
  GENAI_API_KEYS_DETAIL_PARAMS,
  MAAS_GOVERNANCE_DETAIL_PARAMS,
} from './tenant-user/genai/genaiNavParams'
import {
  TENANT_ADMIN_NAV_ITEMS,
  TENANT_ADMIN_MODEL_DEPLOYMENT_MVP_NAV_ITEMS,
  isServicesNavId,
  type TenantAdminNavId,
} from '../tenantAdmin/constants'
import { getWorkspaceOrganization } from '../tenantAdmin/organizations'
import { resolveOrganizationCompanyLogo } from '../providerAdmin/organizations'
import {
  getTenantActiveNav,
  ensureTenantDemoProjects,
  setTenantActiveNav,
  setTenantOnboardingComplete,
  addTenantProject,
} from '../tenantAdmin/storage'
import type { TenantProject } from '../tenantAdmin/projects'
import {
  getProjectScopeId,
  isAllProjectsScope,
  setProjectScopeId,
  type ProjectScopeId,
} from '../tenantUser/projectScope'
import type { CatalogServiceId } from '../providerSetup/templateDemo'
import {
  activateProviderRegisteredOrganizationBySlug,
  ensureProviderDemoOrganizations,
  getProviderCatalogDraft,
  getProviderCatalogItems,
} from '../providerSetup/storage'
import { ensureProviderCatalogDemoItems } from '../providerSetup/prototypeEntry'
import {
  shouldHideDemoServicesInstances,
  syncNorthSummitBillingInactiveScenarioFromSearch,
} from '../demo/billingInactiveScenario'
import {
  addTenantUserInstance,
  ensureTenantDemoInstances,
  getOrEnsureTenantUserInstances,
  updateTenantUserInstance,
} from '../tenantUser/storage'
import {
  getTenantInstanceServiceId,
  isStickyDemoProvisioningInstance,
  type TenantInstance,
} from '../tenantUser/instances'
import { LAUNCH_INSTANCE_PROVISIONING_DURATION_MS, LAUNCH_INSTANCE_SERVICES_PROVISIONING_MS } from '../tenantUser/launchInstanceWizard'

const TENANT_ADMIN_PLACEHOLDER_PAGES: Partial<
  Record<TenantAdminNavId, { title: string; description: string }>
> = {
  'admin-ai-usage': {
    title: 'AI usage',
    description: 'Review AI model usage across the tenant.',
  },
}

function isTenantAdminNavId(value: string | null): value is TenantAdminNavId {
  return (
    value === 'overview' ||
    value === 'ai-grid' ||
    value === 'ai-asset-endpoints' ||
    value === 'playground' ||
    value === 'api-keys' ||
    value === 'admin-maas-governance' ||
    value === 'admin-models' ||
    value === 'admin-model-catalog-settings' ||
    value === 'admin-api-keys' ||
    value === 'admin-ai-usage' ||
    value === 'catalog' ||
    value === 'services-baremetal' ||
    value === 'services-clusters' ||
    value === 'services-models' ||
    value === 'services-virtual-machines' ||
    value === 'projects-teams' ||
    value === 'administration-roles' ||
    value === 'administration-billing' ||
    value === 'networking-virtual-networks' ||
    value === 'networking-external-ip-pools' ||
    value === 'secrets'
  )
}

function normalizeTenantAdminNavParam(
  value: string | null,
  isModelDeploymentMvp = false,
): TenantAdminNavId | null {
  if (value === 'genai-asset-endpoints') {
    return 'ai-asset-endpoints'
  }
  if (value === 'genai-playground') {
    return 'playground'
  }
  if (value === 'genai-api-keys') {
    return 'api-keys'
  }
  if (isTenantAdminNavId(value)) {
    if (
      isModelDeploymentMvp &&
      (value === 'ai-grid' ||
        value === 'services-models' ||
        value === 'admin-models' ||
        value === 'admin-model-catalog-settings')
    ) {
      return 'admin-maas-governance'
    }
    return value
  }
  if (value === 'administrators') {
    return 'administration-roles'
  }
  if (value === 'billing') {
    return 'administration-billing'
  }
  if (value === 'services' || value === 'my-instances' || value === 'instances') {
    return 'services-baremetal'
  }
  if (value === 'networking-subnets' || value === 'networking-security-groups') {
    return 'networking-virtual-networks'
  }
  return null
}

function getLockedServiceIdFromNav(navId: TenantAdminNavId): CatalogServiceId | null {
  switch (navId) {
    case 'services-baremetal':
      return 'baremetal'
    case 'services-clusters':
      return 'cluster'
    case 'services-models':
      return 'models'
    case 'services-virtual-machines':
      return 'virtual-machine'
    default:
      return null
  }
}

function getServicesNavId(serviceId: CatalogServiceId): TenantAdminNavId {
  switch (serviceId) {
    case 'cluster':
      return 'services-clusters'
    case 'models':
      return 'services-models'
    case 'virtual-machine':
      return 'services-virtual-machines'
    default:
      return 'services-baremetal'
  }
}

/** Seeds Tenant Admin state so landing-page prototype links can open finished screens. */
function ensureTenantAdminPostOnboardingPrototype(
  tenant: string,
  navId: TenantAdminNavId,
  searchParams?: URLSearchParams,
) {
  setTenantOnboardingComplete(tenant)
  setTenantActiveNav(tenant, navId)
  ensureProviderDemoOrganizations()
  activateProviderRegisteredOrganizationBySlug(tenant)
  if (searchParams) {
    syncNorthSummitBillingInactiveScenarioFromSearch(searchParams)
  }
}

function readInitialTenantAdminNav(
  tenant: string,
  searchParams: URLSearchParams,
): TenantAdminNavId {
  const isModelDeploymentMvp = searchParams.get('navVersion') === 'model-deployment-mvp'
  const requestedNav = normalizeTenantAdminNavParam(
    searchParams.get('nav'),
    isModelDeploymentMvp,
  )
  if (requestedNav) {
    ensureTenantAdminPostOnboardingPrototype(tenant, requestedNav, searchParams)
    return requestedNav
  }

  syncNorthSummitBillingInactiveScenarioFromSearch(searchParams)
  const activeNav = getTenantActiveNav(tenant)
  return isModelDeploymentMvp &&
    (activeNav === 'ai-grid' ||
      activeNav === 'services-models' ||
      activeNav === 'admin-models' ||
      activeNav === 'admin-model-catalog-settings')
    ? 'admin-maas-governance'
    : activeNav
}

export function TenantAdminWorkspacePage() {
  const { tenant: tenantParam } = useParams<{ tenant: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navVersion = searchParams.get('navVersion')
  const isModelDeploymentMvp = navVersion === 'model-deployment-mvp'
  const navItems =
    isModelDeploymentMvp
      ? TENANT_ADMIN_MODEL_DEPLOYMENT_MVP_NAV_ITEMS
      : TENANT_ADMIN_NAV_ITEMS
  const isValidTenant = Boolean(
    tenantParam && isDemoTenantId(tenantParam) && tenantParam === 'northsummit',
  )
  const tenant = 'northsummit' as const

  const [organization, setOrganization] = useState(() => getWorkspaceOrganization(tenant))
  const [activeNavId, setActiveNavId] = useState<TenantAdminNavId>(() =>
    isValidTenant ? readInitialTenantAdminNav(tenant, searchParams) : 'overview',
  )
  const [visionCatalogItems, setVisionCatalogItems] = useState(() =>
    activeNavId === 'ai-grid' ? ensureProviderCatalogDemoItems() : getProviderCatalogItems(),
  )
  const [projects, setProjects] = useState<TenantProject[]>(() => ensureTenantDemoProjects(tenant))
  const [projectScopeId, setProjectScopeIdState] = useState<ProjectScopeId>(() =>
    getProjectScopeId(tenant),
  )
  const [instances, setInstances] = useState(() => {
    if (!isValidTenant) {
      return []
    }
    if (shouldHideDemoServicesInstances(tenant)) {
      return []
    }
    return getOrEnsureTenantUserInstances(tenant, getWorkspaceOrganization(tenant).name)
  })
  const [openVirtualNetworkId, setOpenVirtualNetworkId] = useState<string | null>(null)
  const [openSubnetId, setOpenSubnetId] = useState<string | null>(null)
  const [openSecurityGroupId, setOpenSecurityGroupId] = useState<string | null>(null)
  const [openCatalogItemKey, setOpenCatalogItemKey] = useState<string | null>(null)
  const [openInstanceId, setOpenInstanceId] = useState<string | null>(null)
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)
  const [navContentKey, setNavContentKey] = useState(0)
  const provisioningTimersRef = useRef<Map<string, number>>(new Map())

  useLayoutEffect(() => {
    if (!isValidTenant) {
      return
    }

    // Login and prototype shortcuts both land here with onboarding already complete.
    setTenantOnboardingComplete(tenant)
    ensureProviderDemoOrganizations()
    activateProviderRegisteredOrganizationBySlug(tenant)
    syncNorthSummitBillingInactiveScenarioFromSearch(searchParams)
    const workspaceOrganization = getWorkspaceOrganization(tenant)
    setOrganization(workspaceOrganization)
    const requestedNav = normalizeTenantAdminNavParam(
      searchParams.get('nav'),
      isModelDeploymentMvp,
    )
    setInstances(
      shouldHideDemoServicesInstances(tenant)
        ? []
        : ensureTenantDemoInstances(tenant, workspaceOrganization.name),
    )
    setProjects(ensureTenantDemoProjects(tenant))
    setProjectScopeIdState(getProjectScopeId(tenant))

    if (requestedNav) {
      ensureTenantAdminPostOnboardingPrototype(tenant, requestedNav, searchParams)
      setActiveNavId(requestedNav)
      setTenantActiveNav(tenant, requestedNav)
      if (searchParams.get('nav') !== requestedNav) {
        syncWorkspaceNavParam(setSearchParams, requestedNav, { replace: true })
      }
      return
    }

    const activeNav = getTenantActiveNav(tenant)
    const normalizedActiveNav =
      isModelDeploymentMvp &&
      (activeNav === 'ai-grid' ||
        activeNav === 'services-models' ||
        activeNav === 'admin-models' ||
        activeNav === 'admin-model-catalog-settings')
        ? 'admin-maas-governance'
        : activeNav
    if (normalizedActiveNav !== activeNav) {
      setTenantActiveNav(tenant, normalizedActiveNav)
    }
    syncWorkspaceNavParam(setSearchParams, normalizedActiveNav, { replace: true })
  }, [isValidTenant, isModelDeploymentMvp, searchParams, setSearchParams, tenant])

  if (!isValidTenant) {
    return <Navigate to="/" replace />
  }

  const catalogDraft = getProviderCatalogDraft()
  const displayName = organization.tenantAdminName ?? DEMO_TENANT_DISPLAY_ADMIN.northsummit
  const lockedServiceId = getLockedServiceIdFromNav(activeNavId)

  const handleProjectScopeChange = (scopeId: ProjectScopeId) => {
    setProjectScopeIdState(scopeId)
    setProjectScopeId(tenant, scopeId)
  }

  const handleNavChange = (navId: string) => {
    const nextNavId = navId as TenantAdminNavId
    if (nextNavId === 'ai-grid') {
      setVisionCatalogItems(ensureProviderCatalogDemoItems())
    }
    setActiveNavId(nextNavId)
    setTenantActiveNav(tenant, nextNavId)
    setNavContentKey((current) => current + 1)
    syncWorkspaceNavParam(setSearchParams, nextNavId, {
      showLanding: true,
      clearParams: [...GENAI_API_KEYS_DETAIL_PARAMS, ...MAAS_GOVERNANCE_DETAIL_PARAMS],
    })
    if (isServicesNavId(nextNavId)) {
      setInstances(
        shouldHideDemoServicesInstances(tenant)
          ? []
          : ensureTenantDemoInstances(tenant, organization.name),
      )
    }
  }

  const clearProvisioningTimer = (instanceId: string) => {
    const timeoutId = provisioningTimersRef.current.get(instanceId)
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      provisioningTimersRef.current.delete(instanceId)
    }
  }

  const scheduleProvisioningCompletion = (instanceId: string, delayMs: number) => {
    if (isStickyDemoProvisioningInstance(instanceId)) {
      return
    }
    clearProvisioningTimer(instanceId)
    const timeoutId = window.setTimeout(() => {
      setInstances((current) =>
        updateTenantUserInstance(
          tenant,
          instanceId,
          {
            status: 'running',
            provisionedAt: new Date().toISOString(),
          },
          current,
        ),
      )
      provisioningTimersRef.current.delete(instanceId)
    }, Math.max(0, delayMs))
    provisioningTimersRef.current.set(instanceId, timeoutId)
  }

  const handleProvisioningStarted = (instance: TenantInstance) => {
    setInstances((current) => addTenantUserInstance(tenant, instance, current))
    scheduleProvisioningCompletion(instance.id, LAUNCH_INSTANCE_PROVISIONING_DURATION_MS)
  }

  const handleNavigateToServices = (instanceId: string, serviceId: CatalogServiceId) => {
    clearProvisioningTimer(instanceId)
    setInstances((current) =>
      updateTenantUserInstance(
        tenant,
        instanceId,
        {
          status: 'provisioning',
          provisionedAt: null,
        },
        current,
      ),
    )
    scheduleProvisioningCompletion(instanceId, LAUNCH_INSTANCE_SERVICES_PROVISIONING_MS)
    handleNavChange(getServicesNavId(serviceId))
  }

  const renderWorkspaceContent = () => {
    const placeholder = TENANT_ADMIN_PLACEHOLDER_PAGES[activeNavId]
    if (placeholder) {
      return (
        <PlaceholderTenantAdminPage
          title={placeholder.title}
          description={placeholder.description}
        />
      )
    }

    switch (activeNavId) {
      case 'ai-asset-endpoints':
        return (
          <AiAssetEndpointsPage onNavigateToPlayground={() => handleNavChange('playground')} />
        )
      case 'playground':
        return <PlaygroundPage />
      case 'api-keys':
        return <GenaiApiKeysPage />
      case 'admin-api-keys':
        return <GenaiApiKeysPage surface="tenant-admin" kicker="AI" />
      case 'admin-maas-governance':
        return <MaaSGovernancePage isModelDeploymentMvp={isModelDeploymentMvp} />
      case 'admin-models':
        return <TenantAdminModelsPage />
      case 'admin-model-catalog-settings':
        return <ModelCatalogSettingsPage />
      case 'ai-grid':
        return (
          <VisionModelFleetPage
            catalogItems={visionCatalogItems}
            onOpenCatalogPreset={(catalogItemId) => {
              setOpenCatalogItemKey(catalogItemId)
              handleNavChange('catalog')
            }}
          />
        )
      case 'services-baremetal':
      case 'services-clusters':
      case 'services-models':
      case 'services-virtual-machines':
        return (
          <TenantUserInstancesPage
            tenantSlug={tenant}
            instances={instances}
            onInstancesChange={setInstances}
            projects={projects}
            projectScopeId={projectScopeId}
            onProjectScopeChange={handleProjectScopeChange}
            organization={organization}
            lockedServiceId={lockedServiceId ?? 'baremetal'}
            onNavigateToCatalogItem={(catalogItemDisplayName) => {
              handleNavChange('catalog')
              syncWorkspaceCatalogItemParam(setSearchParams, catalogItemDisplayName)
            }}
            openInstanceId={openInstanceId}
            onOpenInstanceConsumed={() => setOpenInstanceId(null)}
            onNavigateToProject={(project) => {
              setOpenProjectId(project.id)
              handleNavChange('projects-teams')
            }}
            onNavigateToCreateProject={() => {
              handleNavChange('projects-teams')
            }}
          />
        )
      case 'catalog':
        return (
          <TenantAdminCatalogPage
            organization={organization}
            catalogDraft={catalogDraft}
            hideModelService={isModelDeploymentMvp}
            projects={projects}
            initialProjectId={isAllProjectsScope(projectScopeId) ? null : projectScopeId}
            onProjectScopeChange={handleProjectScopeChange}
            onCreateProject={(project) => {
              addTenantProject(tenant, project)
              setProjects((current) => [...current, project])
            }}
            onNavigateToProjectsTeams={() => handleNavChange('projects-teams')}
            onNavigateToBilling={() => handleNavChange('administration-billing')}
            existingInstanceNames={instances.map((instance) => instance.name)}
            openCatalogItemKey={openCatalogItemKey}
            onOpenCatalogItemConsumed={() => setOpenCatalogItemKey(null)}
            onProvisioningStarted={handleProvisioningStarted}
            onDismissDuringProvisioning={handleNavigateToServices}
            onWizardFinished={handleNavigateToServices}
          />
        )
      case 'projects-teams':
        return (
          <TenantAdminProjectsTeamsPage
            tenantSlug={tenant}
            organization={organization}
            projects={projects}
            instances={instances}
            onProjectsChange={setProjects}
            openProjectId={openProjectId}
            onOpenProjectConsumed={() => setOpenProjectId(null)}
            onNavigateToInstance={(instance) => {
              const project = projects.find((entry) => entry.name === instance.projectName)
              if (project) {
                handleProjectScopeChange(project.id)
              }
              setOpenInstanceId(instance.id)
              handleNavChange(getServicesNavId(getTenantInstanceServiceId(instance)))
            }}
          />
        )
      case 'administration-roles':
        return (
          <TenantAdminAdministratorsPage
            organization={organization}
            onOrganizationChange={setOrganization}
          />
        )
      case 'administration-billing':
        return <TenantAdminBillingPage organization={organization} />
      case 'networking-virtual-networks':
        return (
          <ProviderAdminVirtualNetworksPage
            tenantSlug={tenant}
            openVirtualNetworkId={openVirtualNetworkId}
            openSubnetId={openSubnetId}
            openSecurityGroupId={openSecurityGroupId}
            onOpenVirtualNetworkConsumed={() => setOpenVirtualNetworkId(null)}
            onOpenSubnetConsumed={() => setOpenSubnetId(null)}
            onOpenSecurityGroupConsumed={() => setOpenSecurityGroupId(null)}
          />
        )
      case 'networking-external-ip-pools':
        return (
          <ProviderAdminExternalNetworksPage
            tenantSlug={tenant}
            scopeOrganization={organization}
            serviceInstances={instances}
            onNavigateToServiceInstance={(instance) => {
              const project = projects.find((entry) => entry.name === instance.projectName)
              if (project) {
                handleProjectScopeChange(project.id)
              }
              setOpenInstanceId(instance.id)
              handleNavChange(getServicesNavId(getTenantInstanceServiceId(instance)))
            }}
          />
        )
      case 'secrets':
        return <TenantSecretsPage tenantSlug={tenant} />
      case 'overview':
      default:
        return <TenantAdminOverviewPage />
    }
  }

  return (
    <TenantShell
      role="tenant-admin"
      displayName={displayName}
      navItems={navItems}
      showNavigation
      activeNavId={activeNavId}
      onNavChange={handleNavChange}
      companyLogoSrc={resolveOrganizationCompanyLogo(organization)}
      companyLogoAlt={organization.name}
      organizationSlug={organization.slug}
      isContentFilled={activeNavId === 'ai-grid'}
    >
      <div key={navContentKey}>{renderWorkspaceContent()}</div>
    </TenantShell>
  )
}
