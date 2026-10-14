import { useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  syncWorkspaceNavParam,
} from '../shared/workspaceNavUrl'
import { ProviderAdminShell } from '../components/provider-admin/ProviderAdminShell'
import { ProviderSetupWizardPanel } from '../components/provider-setup/ProviderSetupWizardPanel'
import type { ProviderAdminNavId } from '../providerAdmin/constants'
import { isServicesNavId, resolveProviderAdminNavId } from '../providerAdmin/constants'
import { ProviderAdminOverviewPage } from './ProviderAdminOverviewPage'
import { ProviderAdminOrganizationsPage } from './ProviderAdminOrganizationsPage'
import { ProviderAdminObservabilityPage } from './ProviderAdminObservabilityPage'
import { ProviderServiceSelectionPage } from './provider-setup/ProviderServiceSelectionPage'
import TenantAdminModelsPage from './tenant-admin/ai/models/TenantAdminModelsPage'
import { MaaSGovernancePage } from './tenant-admin/ai/maas-governance'
import { ModelCatalogSettingsPage } from './tenant-admin/ai/model-catalog-settings'
import { ProviderAdminGridEnrollmentPage } from './ProviderAdminGridEnrollmentPage'
import { VisionModelFleetPage } from './provider-admin/vision/VisionModelFleetPage'
import {
  GENAI_API_KEYS_DETAIL_PARAMS,
  MAAS_GOVERNANCE_DETAIL_PARAMS,
} from './tenant-user/genai/genaiNavParams'
import type { ProviderServiceId } from '../providerSetup/constants'
import { generateCatalogItemId, type PublishedTemplatePayload } from '../providerSetup/templateDemo'
import { DEFAULT_CATALOG_NETWORK_POLICY } from '../providerAdmin/catalogNetworkPolicy'
import {
  ensureProviderCatalogDemoItems,
  ensureProviderModelCatalogItems,
  ensureProviderPostSetupPrototype,
  isProviderAdminNavId,
} from '../providerSetup/prototypeEntry'
import {
  getProviderActiveNav,
  getProviderCatalogItems,
  getProviderRegisteredOrganizations,
  getProviderSelectedServices,
  isProviderServicesSelected,
  isProviderSetupComplete,
  addProviderCatalogItem,
  assignCatalogToRegisteredOrganization,
  setProviderActiveNav,
  setProviderSelectedServices,
  setProviderSetupComplete,
} from '../providerSetup/storage'
import type { WorkspaceTransition } from '../providerAdmin/workspace'

type ProviderModelsTab = 'catalog' | 'deployments'

function isProviderModelsTab(value: string | null): value is ProviderModelsTab {
  return value === 'catalog' || value === 'deployments'
}

function normalizeProviderNavParam(value: string | null): ProviderAdminNavId | null {
  const normalizedNav =
    value === 'administration-rbac' || value === 'administration-roles'
      ? 'administration-organizations'
      : value
  if (!isProviderAdminNavId(normalizedNav)) {
    return null
  }

  return resolveProviderAdminNavId(normalizedNav)
}

function readInitialProviderNav(searchParams: URLSearchParams): ProviderAdminNavId {
  const requestedNav = normalizeProviderNavParam(searchParams.get('nav'))
  if (requestedNav) {
    ensureProviderPostSetupPrototype(requestedNav)
    return requestedNav
  }

  return getProviderActiveNav()
}

const PUBLISH_PHASE_MS = 900
const ENTER_PHASE_MS = 700
export function ProviderAdminWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [setupComplete, setSetupComplete] = useState(() => isProviderSetupComplete())
  const [servicesSelected, setServicesSelected] = useState(() => isProviderServicesSelected())
  const [selectedServices, setSelectedServices] = useState<ProviderServiceId[]>(() =>
    getProviderSelectedServices(),
  )
  const [activeNavId, setActiveNavId] = useState<ProviderAdminNavId>(() =>
    readInitialProviderNav(searchParams),
  )
  const [catalogItems, setCatalogItems] = useState(() =>
    isProviderSetupComplete() ? ensureProviderCatalogDemoItems() : getProviderCatalogItems(),
  )
  const [workspaceTransition, setWorkspaceTransition] = useState<WorkspaceTransition>('idle')
  const [, setOpenCatalogItemKey] = useState<string | null>(null)
  const [providerModelsInitialTab, setProviderModelsInitialTab] =
    useState<ProviderModelsTab>('deployments')
  const [navContentKey, setNavContentKey] = useState(0)
  const catalogEditLeaveAttemptRef = useRef<((onConfirmed: () => void) => void) | null>(null)

  const navParam = searchParams.get('nav')
  const isModelDeploymentMvp = searchParams.get('navVersion') === 'model-deployment-mvp'
  const requestedProviderModelsTab = searchParams.get('tab')
  const initialProviderModelsTab: ProviderModelsTab =
    isProviderModelsTab(requestedProviderModelsTab)
      ? requestedProviderModelsTab
      : providerModelsInitialTab

  useLayoutEffect(() => {
    const requestedNav = normalizeProviderNavParam(navParam)
    if (requestedNav) {
      // Do not re-run full demo seed/sync on every left-nav click — that rewrote
      // catalog identities and could drop unpublished drafts when returning to Catalog.
      const storedItems = getProviderCatalogItems()
      if (storedItems.length === 0) {
        ensureProviderPostSetupPrototype(requestedNav)
      } else {
        setProviderActiveNav(requestedNav)
      }
      // Hydrate the deep-linked workspace page with its persisted catalog snapshot.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCatalogItems(
        requestedNav === 'ai-grid' || (requestedNav === 'catalog' && !isModelDeploymentMvp)
          ? ensureProviderModelCatalogItems()
          : getProviderCatalogItems(),
      )
      setSelectedServices(getProviderSelectedServices())
      setServicesSelected(true)
      setSetupComplete(true)
      setActiveNavId(requestedNav)
      return
    }

    const fallbackNav = getProviderActiveNav()
    syncWorkspaceNavParam(setSearchParams, fallbackNav, { replace: true })

    if (isProviderSetupComplete()) {
      const storedItems = getProviderCatalogItems()
      setCatalogItems(
        storedItems.length > 0 ? storedItems : ensureProviderCatalogDemoItems(),
      )
    }
    // Rehydrate when the destination or prototype scope changes, not on item detail params.
  }, [navParam, setSearchParams, isModelDeploymentMvp])

  const handleServicesContinue = (nextSelectedServices: ProviderServiceId[]) => {
    setProviderSelectedServices(nextSelectedServices)
    setSelectedServices(nextSelectedServices)
    setServicesSelected(true)
  }

  const handleChangeServices = () => {
    setServicesSelected(false)
  }

  const handleCreateCatalogItem = (payload: PublishedTemplatePayload) => {
    const status = payload.status ?? 'unpublished'
    const draft = {
      catalogItemId: generateCatalogItemId(),
      templateRefId: payload.templateRefId,
      templateName: payload.templateName,
      displayName: payload.displayName,
      description: payload.description,
      scope: payload.scope,
      rateCard: payload.rateCard,
      serviceId: payload.serviceId,
      networkPolicy: payload.networkPolicy ?? DEFAULT_CATALOG_NETWORK_POLICY,
      ...(payload.enterpriseTenantId
        ? { enterpriseTenantId: payload.enterpriseTenantId }
        : {}),
      ...(payload.enterpriseTenantIds?.length
        ? { enterpriseTenantIds: payload.enterpriseTenantIds }
        : {}),
      ...(payload.instanceTypeId ? { instanceTypeId: payload.instanceTypeId } : {}),
      ...(payload.instanceTypeLabel ? { instanceTypeLabel: payload.instanceTypeLabel } : {}),
      ...(payload.diskImageId ? { diskImageId: payload.diskImageId } : {}),
      ...(payload.diskImageLabel ? { diskImageLabel: payload.diskImageLabel } : {}),
      ...(payload.clusterVersionMode
        ? { clusterVersionMode: payload.clusterVersionMode }
        : {}),
      ...(payload.hardwareOsMode ? { hardwareOsMode: payload.hardwareOsMode } : {}),
      ...(payload.osImageMode ? { osImageMode: payload.osImageMode } : {}),
      ...(payload.nodeSetId ? { nodeSetId: payload.nodeSetId } : {}),
      ...(payload.nodeSetLabel ? { nodeSetLabel: payload.nodeSetLabel } : {}),
      ...(payload.hostTypeId ? { hostTypeId: payload.hostTypeId } : {}),
      ...(payload.hostTypeLabel ? { hostTypeLabel: payload.hostTypeLabel } : {}),
      ...(payload.clusterNodeTopologyMode
        ? { clusterNodeTopologyMode: payload.clusterNodeTopologyMode }
        : {}),
      ...(payload.fieldPolicies?.length ? { fieldPolicies: payload.fieldPolicies } : {}),
      ...(payload.modelChoice ? { modelChoice: payload.modelChoice } : {}),
      ...(payload.modelSourceSettings
        ? { modelSourceSettings: payload.modelSourceSettings }
        : {}),
      ...(payload.modelClusterAvailability
        ? { modelClusterAvailability: payload.modelClusterAvailability }
        : {}),
      ...(payload.modelSettingModes ? { modelSettingModes: payload.modelSettingModes } : {}),
      status,
      createdAt: new Date().toISOString(),
    }

    addProviderCatalogItem(draft)

    const vipOrganizationIds =
      payload.vipOrganizationIds?.length
        ? payload.vipOrganizationIds
        : payload.vipOrganizationId
          ? [payload.vipOrganizationId]
          : []

    for (const organizationId of vipOrganizationIds) {
      assignCatalogToRegisteredOrganization(organizationId, draft)
    }

    setCatalogItems(getProviderCatalogItems())

    if (status === 'unpublished') {
      setProviderActiveNav('catalog')
      setProviderSetupComplete()
      setActiveNavId('catalog')
      syncWorkspaceNavParam(setSearchParams, 'catalog', { replace: true })
      setSetupComplete(true)
      setWorkspaceTransition('idle')
      return draft
    }

    setWorkspaceTransition('publishing')

    window.setTimeout(() => {
      setProviderActiveNav('catalog')
      setProviderSetupComplete()
      setActiveNavId('catalog')
      syncWorkspaceNavParam(setSearchParams, 'catalog', { replace: true })
      setSetupComplete(true)
      setWorkspaceTransition('entering')
    }, PUBLISH_PHASE_MS)

    window.setTimeout(() => {
      setWorkspaceTransition('idle')
    }, PUBLISH_PHASE_MS + ENTER_PHASE_MS)

    return draft
  }

  const performNavChange = (navId: ProviderAdminNavId) => {
    const resolvedNavId = resolveProviderAdminNavId(navId)
    setActiveNavId(resolvedNavId)
    setProviderActiveNav(resolvedNavId)
    setNavContentKey((current) => current + 1)
    syncWorkspaceNavParam(setSearchParams, resolvedNavId, {
      showLanding: true,
      clearParams: [
        ...GENAI_API_KEYS_DETAIL_PARAMS,
        ...MAAS_GOVERNANCE_DETAIL_PARAMS,
        ...(resolvedNavId === 'provider-ai-models' ? [] : ['tab']),
      ],
    })
  }

  const handleNavChange = (navId: ProviderAdminNavId) => {
    if (catalogEditLeaveAttemptRef.current) {
      catalogEditLeaveAttemptRef.current(() => {
        performNavChange(navId)
      })
      return
    }

    performNavChange(navId)
  }

  const renderPostSetupContent = () => {
    const resolvedActiveNavId = resolveProviderAdminNavId(activeNavId)

    if (
      catalogItems.length === 0 &&
      (resolvedActiveNavId === 'overview' ||
        resolvedActiveNavId === 'catalog' ||
        isServicesNavId(activeNavId))
    ) {
      return <ProviderAdminOverviewPage />
    }

    switch (resolvedActiveNavId) {
      case 'ai-grid':
        return (
          <VisionModelFleetPage
            catalogItems={catalogItems}
            onOpenCatalogPreset={(catalogItemId) => {
              setOpenCatalogItemKey(catalogItemId)
              handleNavChange('ai-grid')
            }}
          />
        )
      case 'ai-grid-enrollment':
        return <ProviderAdminGridEnrollmentPage />
      case 'provider-ai-models':
        return (
          <TenantAdminModelsPage
            providerOrganizations={getProviderRegisteredOrganizations()}
            initialTab={initialProviderModelsTab}
            onTabChange={(tab) => {
              setProviderModelsInitialTab(tab)
              setSearchParams(
                (current) => {
                  const next = new URLSearchParams(current)
                  next.set('tab', tab)
                  return next
                },
                { replace: true },
              )
            }}
            onManageSources={() => {
              setProviderModelsInitialTab('catalog')
              handleNavChange('provider-ai-model-catalog-settings')
            }}
          />
        )
      case 'provider-ai-model-catalog-settings':
        return (
          <ModelCatalogSettingsPage
            isProviderAdmin
            onBackToModels={() => handleNavChange('provider-ai-models')}
          />
        )
      case 'provider-ai-maas-governance':
        return (
          <MaaSGovernancePage
            surface="provider-admin"
            isModelDeploymentMvp={isModelDeploymentMvp}
          />
        )
      case 'provider-ai-observability':
        return <ProviderAdminObservabilityPage />
      case 'administration-organizations':
        return <ProviderAdminOrganizationsPage onNavigate={handleNavChange} />
      default:
        return (
          <VisionModelFleetPage
            catalogItems={catalogItems}
            onOpenCatalogPreset={(catalogItemId) => {
              setOpenCatalogItemKey(catalogItemId)
              handleNavChange('ai-grid')
            }}
          />
        )
    }
  }

  const renderWorkspaceContent = () => {
    if (!setupComplete) {
      if (servicesSelected) {
        return (
          <ProviderSetupWizardPanel
            selectedServices={selectedServices}
            onChangeServices={handleChangeServices}
            onCreateCatalogItem={handleCreateCatalogItem}
            isPublishing={workspaceTransition !== 'idle'}
          />
        )
      }

      return (
        <ProviderServiceSelectionPage
          initialSelectedServices={selectedServices}
          onContinue={handleServicesContinue}
        />
      )
    }

    return (
      <div key={navContentKey}>{renderPostSetupContent()}</div>
    )
  }

  return (
    <ProviderAdminShell
      showNavigation={setupComplete}
      activeNavId={activeNavId}
      onNavChange={handleNavChange}
      workspaceTransition={workspaceTransition}
      isModelDeploymentMvp={isModelDeploymentMvp}
    >
      {renderWorkspaceContent()}
    </ProviderAdminShell>
  )
}
