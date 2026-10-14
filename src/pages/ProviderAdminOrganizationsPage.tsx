import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PlusIcon } from '@patternfly/react-icons/dist/esm/icons/plus-icon'
import {
  Button,
  Card,
  CardBody,
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  FormSelect,
  FormSelectOption,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  SearchInput,
  Spinner,
  Title,
} from '@patternfly/react-core'
import { ActionsColumn, Table, Tbody, Td, Th, Thead, Tr, type IAction } from '@patternfly/react-table'
import { CatalogFilterEmptyState } from '../components/catalog/CatalogFilterEmptyState'
import { CatalogFilterResultsSummary } from '../components/catalog/CatalogFilterResultsSummary'
import { ResourceCreatingGridCardBody } from '../components/catalog/ResourceCreatingGridCardBody'
import { ResourceCreatingTableRow } from '../components/catalog/ResourceCreatingTableRow'
import {
  orderItemsForDisplay,
  sortItemsByCreatedAtDesc,
  useResourceCreateReveal,
} from '../catalog/resourceCreateReveal'
import { ViewModeToggle } from '../components/catalog/CatalogViewToggle'
import { getAdministrationViewMode, setAdministrationViewMode, type ViewMode } from '../catalog/viewMode'
import { OrganizationDetailsPage } from '../components/provider-admin/OrganizationDetailsPage'
import { ProviderAdminWorkspacePageHeader } from '../components/provider-admin/ProviderAdminWorkspacePageHeader'
import { TenantOnboardingWizard } from '../components/provider-admin/TenantOnboardingWizard'
import { SetupIdentityProviderWizard } from '../components/provider-admin/SetupIdentityProviderWizard'
import { AddTenantAdministratorWizard } from '../components/tenant-admin/AddTenantAdministratorWizard'
import { IdpManagerIdentityProviderPage } from './idp-manager/IdpManagerIdentityProviderPage'
import { IDP_MANAGER_ROLES_COPY } from '../idpManager/constants'
import { BillingPendingLabel } from '../components/billing/BillingPendingLabel'
import { isOrganizationM360AccountInactive } from '../billing/m360'
import {
  getOrganizationBillingAccountDisplay,
  getOrganizationBillingPendingTooltip,
  getOrganizationSetupNextAction,
  getOrganizationSetupSignal,
  buildOrganizationFilterParts,
  getOrganizationNameInitial,
  isOrganizationBillingPending,
  matchesOrganizationSetupFilter,
  ORGANIZATION_SETUP_FILTER_OPTIONS,
  organizationMatchesSearch,
  PROVIDER_ORGANIZATIONS_DEMO,
  type OrganizationSetupFilter,
  type OrganizationSetupNextAction,
  type RegisteredOrganization,
  type TenantOnboardingStepId,
} from '../providerAdmin/organizations'
import {
  addProviderRegisteredOrganization,
  assignCatalogToRegisteredOrganization,
  assignExternalIpPoolToRegisteredOrganization,
  consumeProviderOpenRegisterOrgWizard,
  ensureProviderDemoOrganizations,
  getProviderCatalogDraft,
  getProviderRegisteredOrganizations,
  peekProviderVipCatalogResumeIntent,
  removeProviderRegisteredOrganization,
  updateProviderRegisteredOrganization,
} from '../providerSetup/storage'
import type { ProviderAdminNavId } from '../providerAdmin/constants'
import {
  getWorkspaceActionParam,
  getWorkspaceOrganizationParam,
  syncWorkspaceActionParam,
  syncWorkspaceOrganizationParam,
  WORKSPACE_ACTION_REGISTER_TENANT,
} from '../shared/workspaceNavUrl'

function formatRegisteredAt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getOrganizationActions(
  organization: RegisteredOrganization,
  onViewDetails: (organization: RegisteredOrganization) => void,
  onEdit: (organization: RegisteredOrganization) => void,
  onRemove: (organization: RegisteredOrganization) => void,
  onOpenIdpInformation: (organization: RegisteredOrganization) => void,
): IAction[] {
  return [
    {
      title: 'View details',
      onClick: () => onViewDetails(organization),
    },
    ...(organization.identityProviderConnected
      ? [
          {
            title: 'View IdP information',
            onClick: () => onOpenIdpInformation(organization),
          },
        ]
      : []),
    {
      title: 'Edit',
      onClick: () => onEdit(organization),
    },
    {
      isSeparator: true,
    },
    {
      title: 'Remove',
      isDanger: true,
      onClick: () => onRemove(organization),
    },
  ]
}

function renderOrganizationBillingPendingLabel(organization: RegisteredOrganization) {
  const inactive = isOrganizationM360AccountInactive(organization)

  return (
    <BillingPendingLabel
      label={inactive ? 'Billing account inactive' : 'Billing pending'}
      tooltip={getOrganizationBillingPendingTooltip(organization)}
    />
  )
}

export function ProviderAdminOrganizationsPage({
  onNavigate,
}: {
  onNavigate?: (navId: ProviderAdminNavId) => void
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [organizations, setOrganizations] = useState<RegisteredOrganization[]>(() =>
    ensureProviderDemoOrganizations(),
  )
  const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState(false)
  const [onboardingResumeOrganization, setOnboardingResumeOrganization] =
    useState<RegisteredOrganization | null>(null)
  const [editingOrganization, setEditingOrganization] = useState<RegisteredOrganization | null>(
    null,
  )
  const [onboardingInitialStepId, setOnboardingInitialStepId] =
    useState<TenantOnboardingStepId>('general')
  const [editReturnToDetails, setEditReturnToDetails] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<RegisteredOrganization | null>(
    null,
  )
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [idpDelegationOrganization, setIdpDelegationOrganization] =
    useState<RegisteredOrganization | null>(null)
  const [idpDirectoryOrganization, setIdpDirectoryOrganization] =
    useState<RegisteredOrganization | null>(null)
  const [rolesOrganization, setRolesOrganization] = useState<RegisteredOrganization | null>(null)
  const [organizationPendingRemove, setOrganizationPendingRemove] =
    useState<RegisteredOrganization | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'all' | RegisteredOrganization['status']>(
    'all',
  )
  const [selectedSetup, setSelectedSetup] = useState<OrganizationSetupFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() => getAdministrationViewMode())
  const organizationDisplayOrderRef = useRef<string[] | null>(null)
  const {
    creatingItemId: registeringOrganizationId,
    creatingCardHeightPx,
    cardGridRef,
    beginCreateReveal: beginOrganizationCreateReveal,
    measureCreatingCardHeight,
  } = useResourceCreateReveal()
  const [activatingOrganizationId, setActivatingOrganizationId] = useState<string | null>(null)
  const activatingTimerRef = useRef<number | null>(null)
  const pendingActivationAfterIdpCloseRef = useRef<string | null>(null)
  const catalogDraft = getProviderCatalogDraft()

  const orderedOrganizations = useMemo(
    () =>
      orderItemsForDisplay(organizations, organizationDisplayOrderRef, sortItemsByCreatedAtDesc),
    [organizations],
  )

  const filteredOrganizations = useMemo(() => {
    return orderedOrganizations.filter((organization) => {
      if (selectedStatus !== 'all' && organization.status !== selectedStatus) {
        return false
      }

      if (!matchesOrganizationSetupFilter(organization, selectedSetup)) {
        return false
      }

      return organizationMatchesSearch(organization, searchValue)
    })
  }, [orderedOrganizations, searchValue, selectedSetup, selectedStatus])

  useLayoutEffect(() => {
    measureCreatingCardHeight(viewMode === 'grid', 'provider-admin-catalog-items__card--creating')
  }, [filteredOrganizations, measureCreatingCardHeight, registeringOrganizationId, viewMode])

  const filterDescriptionParts = useMemo(
    () => buildOrganizationFilterParts(searchValue, selectedStatus, selectedSetup),
    [searchValue, selectedSetup, selectedStatus],
  )

  const clearAllFilters = () => {
    setSearchValue('')
    setSelectedStatus('all')
    setSelectedSetup('all')
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    setAdministrationViewMode(mode)
  }

  const clearActivatingTimer = () => {
    if (activatingTimerRef.current !== null) {
      window.clearTimeout(activatingTimerRef.current)
      activatingTimerRef.current = null
    }
  }

  useEffect(() => {
    if (consumeProviderOpenRegisterOrgWizard()) {
      setEditingOrganization(null)
      setEditReturnToDetails(false)
      setOnboardingResumeOrganization(null)
      setOnboardingInitialStepId('general')
      setIsOnboardingWizardOpen(true)
      syncWorkspaceActionParam(setSearchParams, WORKSPACE_ACTION_REGISTER_TENANT, {
        replace: true,
      })
    }
  }, [setSearchParams])

  useEffect(() => {
    if (getWorkspaceActionParam(searchParams) !== WORKSPACE_ACTION_REGISTER_TENANT) {
      return
    }

    setEditingOrganization(null)
    setEditReturnToDetails(false)
    setOnboardingResumeOrganization(null)
    setOnboardingInitialStepId('general')
    setIsDetailsOpen(false)
    setIsOnboardingWizardOpen(true)
  }, [searchParams])

  useEffect(() => {
    return () => {
      clearActivatingTimer()
    }
  }, [])

  useEffect(() => {
    const organizationId = getWorkspaceOrganizationParam(searchParams)
    if (!organizationId) {
      return
    }

    const organization = organizations.find((entry) => entry.id === organizationId)
    if (!organization) {
      return
    }

    setSelectedOrganization(organization)
    setIsDetailsOpen(true)
  }, [organizations, searchParams])

  const refreshOrganizations = (nextSelectedId?: string | null) => {
    const next = ensureProviderDemoOrganizations()
    setOrganizations(next)

    setIdpDirectoryOrganization((current) => {
      if (!current) {
        return current
      }
      return next.find((organization) => organization.id === current.id) ?? null
    })

    if (nextSelectedId) {
      setSelectedOrganization(next.find((organization) => organization.id === nextSelectedId) ?? null)
      return
    }

    if (selectedOrganization) {
      const refreshed =
        next.find((organization) => organization.id === selectedOrganization.id) ?? null
      setSelectedOrganization(refreshed)
      if (!refreshed) {
        setIsDetailsOpen(false)
      }
    }
  }

  const startOrganizationActivation = (organizationId: string) => {
    clearActivatingTimer()
    setActivatingOrganizationId(organizationId)
    activatingTimerRef.current = window.setTimeout(() => {
      updateProviderRegisteredOrganization(organizationId, { status: 'Active' })
      refreshOrganizations(organizationId)
      setActivatingOrganizationId(null)
      activatingTimerRef.current = null
    }, 1500)
  }

  const handleIdpModalClose = () => {
    setIdpDelegationOrganization(null)
    const organizationId = pendingActivationAfterIdpCloseRef.current
    if (!organizationId) {
      return
    }
    pendingActivationAfterIdpCloseRef.current = null
    startOrganizationActivation(organizationId)
  }

  const openIdpDirectory = (organization: RegisteredOrganization) => {
    setSelectedOrganization(organization)
    setIdpDirectoryOrganization(organization)
  }

  const closeIdpDirectoryToTenants = () => {
    setIdpDirectoryOrganization(null)
    setIsDetailsOpen(false)
  }

  const closeIdpDirectoryToTenantDetails = () => {
    setIdpDirectoryOrganization(null)
    setIsDetailsOpen(true)
  }

  const openRegisterWizard = () => {
    setEditingOrganization(null)
    setEditReturnToDetails(false)
    setOnboardingResumeOrganization(null)
    setOnboardingInitialStepId('general')
    setIsOnboardingWizardOpen(true)
    syncWorkspaceActionParam(setSearchParams, WORKSPACE_ACTION_REGISTER_TENANT, {
      replace: true,
    })
  }

  const openEdit = (organization: RegisteredOrganization, returnToDetails = false) => {
    setSelectedOrganization(organization)
    setEditingOrganization(organization)
    setOnboardingResumeOrganization(null)
    setOnboardingInitialStepId('general')
    setEditReturnToDetails(returnToDetails)
    setIsDetailsOpen(false)
    setIsOnboardingWizardOpen(true)
    if (getWorkspaceActionParam(searchParams) === WORKSPACE_ACTION_REGISTER_TENANT) {
      syncWorkspaceActionParam(setSearchParams, null, { replace: true })
    }
  }

  const openBillingSetup = (organization: RegisteredOrganization, returnToDetails = false) => {
    // Re-open the edit wizard, landing on IdP federation step.
    setSelectedOrganization(organization)
    setEditingOrganization(organization)
    setOnboardingResumeOrganization(null)
    setOnboardingInitialStepId('idp_federation')
    setEditReturnToDetails(returnToDetails)
    setIsDetailsOpen(false)
    setIsOnboardingWizardOpen(true)
    if (getWorkspaceActionParam(searchParams) === WORKSPACE_ACTION_REGISTER_TENANT) {
      syncWorkspaceActionParam(setSearchParams, null, { replace: true })
    }
  }

  const closeOnboardingWizard = () => {
    const shouldReturnToDetails = editReturnToDetails && selectedOrganization
    setIsOnboardingWizardOpen(false)
    setOnboardingResumeOrganization(null)
    setEditingOrganization(null)
    setOnboardingInitialStepId('general')
    setEditReturnToDetails(false)
    if (shouldReturnToDetails) {
      setIsDetailsOpen(true)
    }
    if (getWorkspaceActionParam(searchParams) === WORKSPACE_ACTION_REGISTER_TENANT) {
      syncWorkspaceActionParam(setSearchParams, null, { replace: true })
    }
  }

  const openDetails = (organization: RegisteredOrganization) => {
    setSelectedOrganization(organization)
    setIsDetailsOpen(true)
    syncWorkspaceOrganizationParam(setSearchParams, organization.id, { replace: true })
  }

  const closeDetails = () => {
    setIsDetailsOpen(false)
    setSelectedOrganization(null)
    if (getWorkspaceOrganizationParam(searchParams)) {
      syncWorkspaceOrganizationParam(setSearchParams, null, { replace: true })
    }
  }

  const openRemove = (organization: RegisteredOrganization) => {
    setOrganizationPendingRemove(organization)
  }

  const handleConfirmRemove = () => {
    if (!organizationPendingRemove) {
      return
    }

    const removedId = organizationPendingRemove.id
    const removed = removeProviderRegisteredOrganization(removedId)
    if (removed) {
      if (selectedOrganization?.id === removedId) {
        setIsDetailsOpen(false)
        setSelectedOrganization(null)
      }
      if (idpDelegationOrganization?.id === removedId) {
        setIdpDelegationOrganization(null)
      }
      if (idpDirectoryOrganization?.id === removedId) {
        setIdpDirectoryOrganization(null)
      }
      if (rolesOrganization?.id === removedId) {
        setRolesOrganization(null)
      }
      setOrganizations(getProviderRegisteredOrganizations())
    }
    setOrganizationPendingRemove(null)
  }

  const handleOnboardingPersist = (organization: RegisteredOrganization) => {
    const existing = getProviderRegisteredOrganizations().find(
      (item) => item.id === organization.id,
    )
    if (existing) {
      updateProviderRegisteredOrganization(organization.id, {
        name: organization.name,
        tenantId: organization.tenantId,
        slug: organization.slug,
        displayName: organization.displayName,
        primaryDomain: organization.primaryDomain,
        additionalDomains: organization.additionalDomains,
        logoSrc: organization.logoSrc,
        logoFileName: organization.logoFileName,
        m360AccountId: organization.m360AccountId,
        m360ConnectionStatus: organization.m360ConnectionStatus,
        m360RateCardId: organization.m360RateCardId,
        m360RateCardName: organization.m360RateCardName,
        billingAccountId: organization.billingAccountId,
        billingAccountName: organization.billingAccountName,
        billingAccountLinked: organization.billingAccountLinked,
        tenantSetupStatus: organization.tenantSetupStatus,
      })
    } else {
      addProviderRegisteredOrganization(organization)
      if (organization.externalIpPoolId) {
        assignExternalIpPoolToRegisteredOrganization(
          organization.externalIpPoolId,
          organization.id,
        )
      }
      if (organization.catalogItemId && catalogDraft) {
        assignCatalogToRegisteredOrganization(organization.id, catalogDraft)
      }
    }
    refreshOrganizations(organization.id)
  }

  const handleOnboardingComplete = (organization: RegisteredOrganization) => {
    if (editingOrganization) {
      refreshOrganizations(organization.id)
      const shouldReturnToDetails = editReturnToDetails
      setIsOnboardingWizardOpen(false)
      setOnboardingResumeOrganization(null)
      setEditingOrganization(null)
      setOnboardingInitialStepId('general')
      setEditReturnToDetails(false)
      if (shouldReturnToDetails) {
        setSelectedOrganization(
          getProviderRegisteredOrganizations().find((item) => item.id === organization.id) ??
            organization,
        )
        setIsDetailsOpen(true)
      }
      return
    }

    setSearchValue('')
    setSelectedStatus('all')
    setSelectedSetup('all')

    if (peekProviderVipCatalogResumeIntent()) {
      onNavigate?.('catalog')
      return
    }

    beginOrganizationCreateReveal(organization.id)
  }

  const handleSetupNextAction = (
    organization: RegisteredOrganization,
    action: OrganizationSetupNextAction,
  ) => {
    if (action === 'billing') {
      openBillingSetup(organization)
      return
    }

    if (action === 'idp') {
      if (organization.identityProviderConnected) {
        openIdpDirectory(organization)
        return
      }
      setIdpDelegationOrganization(organization)
      return
    }

    setRolesOrganization(organization)
  }

  const handleIdentityProviderConnected = (organization: RegisteredOrganization) => {
    refreshOrganizations(organization.id)
    // Keep the setup wizard mounted so working → success can play; it closes via onClose.
    // Activate (Active + Needs roles) only after the modal closes, with a short spinner.
    if (
      organization.identityProviderConnected &&
      organization.status === 'Pending activation'
    ) {
      pendingActivationAfterIdpCloseRef.current = organization.id
    }
    setIdpDelegationOrganization((current) =>
      current != null && current.id === organization.id ? organization : current,
    )
    setIdpDirectoryOrganization((current) =>
      current != null && current.id === organization.id ? organization : current,
    )
  }

  const handleIdpSetupUpdated = (organization: RegisteredOrganization) => {
    refreshOrganizations(organization.id)
    setIdpDelegationOrganization(organization)
  }

  const handleRolesConfigured = (organization: RegisteredOrganization) => {
    refreshOrganizations(organization.id)
  }

  const closeRolesToTenants = () => {
    setRolesOrganization(null)
    setIsDetailsOpen(false)
  }

  const closeRolesToTenantDetails = () => {
    if (rolesOrganization) {
      setSelectedOrganization(rolesOrganization)
      setIsDetailsOpen(true)
    }
    setRolesOrganization(null)
  }

  return (
    <>
      {rolesOrganization !== null ? (
        <AddTenantAdministratorWizard
          isOpen
          organization={rolesOrganization}
          breadcrumbAncestors={[
            { label: 'Tenants', onNavigate: closeRolesToTenants },
            {
              label: rolesOrganization.name,
              onNavigate: closeRolesToTenantDetails,
            },
          ]}
          title={IDP_MANAGER_ROLES_COPY.wizardTitle}
          submitLabel={IDP_MANAGER_ROLES_COPY.wizardSubmitLabel}
          showRoleCatalog
          onClose={() => setRolesOrganization(null)}
          onAdded={(organization) => {
            handleRolesConfigured(organization)
            setRolesOrganization(null)
          }}
        />
      ) : isOnboardingWizardOpen ? (
        <TenantOnboardingWizard
          isOpen={isOnboardingWizardOpen}
          catalogDraft={catalogDraft}
          resumeOrganization={onboardingResumeOrganization}
          editingOrganization={editingOrganization}
          initialStepId={onboardingInitialStepId}
          onClose={closeOnboardingWizard}
          onPersistOrganization={handleOnboardingPersist}
          onComplete={handleOnboardingComplete}
        />
      ) : idpDelegationOrganization !== null ? (
        <SetupIdentityProviderWizard
          presentation="page"
          isOpen
          organization={idpDelegationOrganization}
          onClose={handleIdpModalClose}
          onUpdated={handleIdpSetupUpdated}
          onConnected={handleIdentityProviderConnected}
        />
      ) : idpDirectoryOrganization !== null ? (
        <IdpManagerIdentityProviderPage
          organization={idpDirectoryOrganization}
          identityProviderConnectedBy="provider-admin"
          onOrganizationChange={(organization) => {
            refreshOrganizations(organization.id)
            setIdpDirectoryOrganization(organization)
            setSelectedOrganization((current) =>
              current?.id === organization.id ? organization : current,
            )
          }}
          onBackToTenants={closeIdpDirectoryToTenants}
          onBackToTenantDetails={closeIdpDirectoryToTenantDetails}
        />
      ) : isDetailsOpen && selectedOrganization ? (
        <OrganizationDetailsPage
          organization={selectedOrganization}
          onBack={closeDetails}
          onEdit={() => openEdit(selectedOrganization, true)}
          onRemove={() => openRemove(selectedOrganization)}
          onReviewBilling={(organization) => openBillingSetup(organization, true)}
          onReviewIdentityProvider={(organization) => {
            if (organization.identityProviderConnected) {
              openIdpDirectory(organization)
              return
            }
            setIdpDelegationOrganization(organization)
          }}
          onReviewRoles={(organization) => setRolesOrganization(organization)}
          onOrganizationChange={(organization) => refreshOrganizations(organization.id)}
        />
      ) : (
      <div className="provider-admin-workspace-page provider-admin-organizations">
        <ProviderAdminWorkspacePageHeader
          kicker="Administration"
          title="Tenants"
          lede={PROVIDER_ORGANIZATIONS_DEMO.lede}
          action={
            organizations.length > 0 ? (
              <Button variant="primary" icon={<PlusIcon />} onClick={openRegisterWizard}>
                {PROVIDER_ORGANIZATIONS_DEMO.registerOrganizationLabel}
              </Button>
            ) : undefined
          }
        />

        {organizations.length > 0 ? (
          <div className="catalog-view-toolbar">
            <div className="catalog-view-toolbar__start">
              <FormSelect
                className="catalog-status-filter"
                id="tenants-status-filter"
                value={selectedStatus}
                onChange={(_event, value) =>
                  setSelectedStatus(value as 'all' | RegisteredOrganization['status'])
                }
                aria-label="Filter tenants by status"
              >
                <FormSelectOption value="all" label="All statuses" />
                <FormSelectOption value="Active" label="Active" />
                <FormSelectOption value="Pending activation" label="Pending activation" />
              </FormSelect>
              <FormSelect
                className="catalog-status-filter"
                id="tenants-setup-filter"
                value={selectedSetup}
                onChange={(_event, value) =>
                  setSelectedSetup(value as OrganizationSetupFilter)
                }
                aria-label="Filter tenants by setup state"
              >
                {ORGANIZATION_SETUP_FILTER_OPTIONS.map((option) => (
                  <FormSelectOption key={option.value} value={option.value} label={option.label} />
                ))}
              </FormSelect>
              <SearchInput
                className="catalog-search"
                placeholder="Search tenants"
                value={searchValue}
                onChange={(_event, value) => setSearchValue(value)}
                onClear={() => setSearchValue('')}
                aria-label="Search tenants"
              />
            </div>
            <ViewModeToggle
              viewMode={viewMode}
              onChange={handleViewModeChange}
              idPrefix="tenants-view"
              ariaLabel="Tenants view"
            />
          </div>
        ) : null}

        {organizations.length === 0 ? (
          <EmptyState className="catalog-filter-empty provider-admin-organizations__empty">
            <Title headingLevel="h2" size="lg">
              {PROVIDER_ORGANIZATIONS_DEMO.emptyTitle}
            </Title>
            <EmptyStateBody className="catalog-filter-empty__body">
              {PROVIDER_ORGANIZATIONS_DEMO.emptyBody}
            </EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button variant="primary" icon={<PlusIcon />} onClick={openRegisterWizard}>
                  {PROVIDER_ORGANIZATIONS_DEMO.registerFirstOrganizationLabel}
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        ) : filteredOrganizations.length === 0 ? (
          <CatalogFilterEmptyState
            title="No tenants match your filters"
            description="Try a different status, setup state, or search term."
            onClearFilters={clearAllFilters}
          />
        ) : viewMode === 'grid' ? (
          <>
            <CatalogFilterResultsSummary
              filteredCount={filteredOrganizations.length}
              totalCount={organizations.length}
              singular="tenant"
              filterParts={filterDescriptionParts}
              onClearFilters={clearAllFilters}
            />
            <div
              ref={cardGridRef}
              className="catalog-card-grid catalog-card-grid--stable provider-admin-organizations__grid"
            >
              {filteredOrganizations.map((org) => {
                const isRegistering = registeringOrganizationId === org.id
                const isActivating = activatingOrganizationId === org.id
                const setupSignal = isRegistering || isActivating ? null : getOrganizationSetupSignal(org)
                const nextAction =
                  isRegistering || isActivating ? null : getOrganizationSetupNextAction(org)

                return (
                  <Card
                    key={org.id}
                    isCompact={false}
                    className={[
                      'provider-admin-catalog-items__card',
                      'provider-admin-organizations__card',
                      isRegistering ? 'provider-admin-catalog-items__card--creating' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      isRegistering && creatingCardHeightPx
                        ? { height: creatingCardHeightPx, minBlockSize: creatingCardHeightPx }
                        : undefined
                    }
                  >
                    {isRegistering ? (
                      <ResourceCreatingGridCardBody label="Registering tenant…" />
                    ) : (
                    <CardBody>
                      <div className="provider-admin-organizations__card-main">
                      <div className="provider-admin-catalog-items__card-header">
                        <span
                          className="provider-admin-catalog-items__card-icon provider-admin-organizations__card-logo provider-admin-organizations__card-logo--initial"
                          aria-hidden
                        >
                          <span className="provider-admin-organizations__card-initial">
                            {getOrganizationNameInitial(org.name)}
                          </span>
                        </span>
                        <div className="provider-admin-catalog-items__card-header-actions">
                          {isActivating || isRegistering ? (
                            <Spinner
                              size="sm"
                              aria-label={
                                isActivating ? `Activating ${org.name}` : `Registering ${org.name}`
                              }
                            />
                          ) : (
                            <Label
                              color={org.status === 'Active' ? 'green' : 'orange'}
                              isCompact
                              className="provider-admin-catalog-items__card-label"
                            >
                              {org.status}
                            </Label>
                          )}
                          <ActionsColumn
                            items={getOrganizationActions(
                              org,
                              openDetails,
                              openEdit,
                              openRemove,
                              (organization) => openIdpDirectory(organization),
                            )}
                          />
                        </div>
                      </div>
                      <Content
                        component="p"
                        className="provider-admin-catalog-items__primary-cell"
                      >
                        <Button
                          variant="link"
                          isInline
                          className="provider-admin-catalog-items__name-link catalog-item-name-link"
                          onClick={() => openDetails(org)}
                        >
                          {org.name}
                        </Button>
                      </Content>
                      <dl
                        className="provider-admin-catalog-items__specs-list provider-admin-organizations__card-specs"
                      >
                        <div className="provider-admin-catalog-items__spec-row">
                          <dt className="provider-admin-catalog-items__spec-label">Domain</dt>
                          <dd className="provider-admin-catalog-items__spec-value">
                            {org.primaryDomain || '—'}
                          </dd>
                        </div>
                        <div className="provider-admin-catalog-items__spec-row">
                          <dt className="provider-admin-catalog-items__spec-label">Billing</dt>
                          <dd className="provider-admin-catalog-items__spec-value">
                            {isOrganizationBillingPending(org) ? (
                              renderOrganizationBillingPendingLabel(org)
                            ) : (
                              getOrganizationBillingAccountDisplay(org)
                            )}
                          </dd>
                        </div>
                        <div className="provider-admin-catalog-items__spec-row">
                          <dt className="provider-admin-catalog-items__spec-label">Registered</dt>
                          <dd className="provider-admin-catalog-items__spec-value">
                            {formatRegisteredAt(org.createdAt)}
                          </dd>
                        </div>
                      </dl>
                      </div>
                      {setupSignal ? (
                        <div
                          className="provider-admin-catalog-items__card-footer provider-admin-organizations__card-footer"
                          aria-label="Setup"
                        >
                          {nextAction ? (
                            <Button
                              variant="link"
                              isInline
                              className="provider-admin-organizations__setup-signal-link"
                              onClick={() => handleSetupNextAction(org, nextAction)}
                            >
                              {setupSignal}
                            </Button>
                          ) : (
                            <Content
                              component="p"
                              className="provider-admin-organizations__setup-signal"
                            >
                              {setupSignal}
                            </Content>
                          )}
                        </div>
                      ) : null}
                    </CardBody>
                    )}
                  </Card>
                )
              })}
            </div>
          </>
        ) : (
          <div className="catalog-table-panel">
            <CatalogFilterResultsSummary
              filteredCount={filteredOrganizations.length}
              totalCount={organizations.length}
              singular="tenant"
              filterParts={filterDescriptionParts}
              onClearFilters={clearAllFilters}
            />
          <Table
            aria-label="Tenants"
            borders={false}
            className="provider-admin-organizations__table catalog-data-table"
          >
            <Thead>
              <Tr>
                <Th>Tenant</Th>
                <Th>Status</Th>
                <Th>Primary domain</Th>
                <Th>Billing account</Th>
                <Th>Registered</Th>
                <Th screenReaderText="Actions" />
              </Tr>
            </Thead>
            <Tbody>
              {filteredOrganizations.map((org) => {
                const isRegistering = registeringOrganizationId === org.id
                const isActivating = activatingOrganizationId === org.id
                const isStatusPending = isRegistering || isActivating

                if (isRegistering) {
                  return (
                    <ResourceCreatingTableRow
                      key={org.id}
                      itemId={org.id}
                      label="Registering tenant…"
                      colSpan={6}
                      className="provider-admin-organizations__row--registering catalog-resource-creating-row"
                    />
                  )
                }

                const setupSignal = isStatusPending ? null : getOrganizationSetupSignal(org)
                const nextAction = isStatusPending ? null : getOrganizationSetupNextAction(org)

                return (
                  <Tr
                    key={org.id}
                    className={
                      isActivating ? 'provider-admin-organizations__row--registering' : undefined
                    }
                  >
                    <Td modifier="wrap" dataLabel="Tenant">
                      <Content component="p" className="provider-admin-organizations__primary-cell">
                        <Button
                          variant="link"
                          isInline
                          className="catalog-table-name-link"
                          onClick={() => openDetails(org)}
                        >
                          {org.name}
                        </Button>
                      </Content>
                    </Td>
                    <Td modifier="wrap" dataLabel="Status">
                      <div className="provider-admin-organizations__status-cell">
                        {isActivating ? (
                          <span className="provider-admin-organizations__registering-status">
                            <Spinner size="sm" aria-label={`Activating ${org.name}`} />
                            <span className="pf-v6-screen-reader">Activating tenant</span>
                          </span>
                        ) : (
                          <Label
                            color={org.status === 'Active' ? 'green' : 'orange'}
                            isCompact
                            className="provider-admin-organizations__status"
                          >
                            {org.status}
                          </Label>
                        )}
                        {setupSignal && nextAction ? (
                          <Button
                            variant="link"
                            isInline
                            className="provider-admin-organizations__setup-signal-link"
                            onClick={() => handleSetupNextAction(org, nextAction)}
                          >
                            {setupSignal}
                          </Button>
                        ) : null}
                        {setupSignal && !nextAction ? (
                          <Content
                            component="p"
                            className="provider-admin-organizations__setup-signal"
                          >
                            {setupSignal}
                          </Content>
                        ) : null}
                      </div>
                    </Td>
                    <Td modifier="wrap" dataLabel="Primary domain">
                      <Content component="p" className="provider-admin-organizations__primary-cell">
                        {org.primaryDomain || '—'}
                      </Content>
                    </Td>
                    <Td modifier="wrap" dataLabel="Billing account">
                      {isOrganizationBillingPending(org) ? (
                        renderOrganizationBillingPendingLabel(org)
                      ) : (
                        <>
                          <Content component="p" className="provider-admin-organizations__primary-cell">
                            {org.billingAccountName}
                          </Content>
                          <Content component="p" className="provider-admin-organizations__secondary-cell">
                            <code>{getOrganizationBillingAccountDisplay(org)}</code>
                          </Content>
                        </>
                      )}
                    </Td>
                    <Td modifier="wrap" dataLabel="Registered">
                      {formatRegisteredAt(org.createdAt)}
                    </Td>
                    <Td isActionCell>
                      <ActionsColumn
                        items={getOrganizationActions(
                          org,
                          openDetails,
                          openEdit,
                          openRemove,
                          (organization) => openIdpDirectory(organization),
                        )}
                      />
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
          </div>
        )}
      </div>
      )}

      <Modal
        variant={ModalVariant.small}
        isOpen={organizationPendingRemove !== null}
        onClose={() => setOrganizationPendingRemove(null)}
        aria-labelledby="remove-organization-title"
        aria-describedby="remove-organization-description"
      >
        <ModalHeader
          title="Remove tenant?"
          titleIconVariant="warning"
          labelId="remove-organization-title"
        />
        <ModalBody>
          <Content component="p" id="remove-organization-description">
            {organizationPendingRemove ? (
              <>
                <strong>{organizationPendingRemove.name}</strong> will be permanently removed from
                provider administration. This cannot be undone.
              </>
            ) : (
              'This tenant will be permanently removed from provider administration. This cannot be undone.'
            )}
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleConfirmRemove}>
            Remove
          </Button>
          <Button variant="link" onClick={() => setOrganizationPendingRemove(null)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
