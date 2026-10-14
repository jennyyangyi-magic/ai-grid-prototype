import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { PlusIcon } from '@patternfly/react-icons/dist/esm/icons/plus-icon'
import {
  Button,
  Card,
  CardBody,
  Content,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  SearchInput,
  Spinner,
  Title,
  Tooltip,
} from '@patternfly/react-core'
import { Table, ActionsColumn, Tbody, Td, Th, Thead, Tr, type IAction } from '@patternfly/react-table'
import { CatalogServiceFilterToggle, countCatalogServices, toggleCatalogServiceFilter } from '../components/catalog/CatalogServiceFilterToggle'
import { CatalogFilterEmptyState } from '../components/catalog/CatalogFilterEmptyState'
import { CatalogFilterResultsSummary } from '../components/catalog/CatalogFilterResultsSummary'
import { CatalogViewToggle } from '../components/catalog/CatalogViewToggle'
import { PillFilterSelect } from '../components/shared/PillFilterSelect'
import { CatalogItemDetailsPage } from '../components/provider-admin/CatalogItemDetailsPage'
import { CatalogPublishScopeIcon } from '../components/provider-admin/CatalogPublishScopeIcon'
import {
  formatVipEnterpriseVisibilityLabel,
  getCatalogEnterpriseTenantIds,
} from '../components/provider-admin/VipEnterpriseOrganizationField'
import { getCatalogServiceIcon } from '../catalog/serviceIcons'
import {
  createCatalogServiceFilterSet,
  describeCatalogServiceFilter,
} from '../catalog/catalogFilterSummary'
import { resolveCatalogCardSpecRows } from '../catalog/catalogSpecs'
import { CatalogSpecRowsList } from '../components/catalog/CatalogSpecRowsList'
import { findCatalogLinkedTemplate } from '../catalog/hardwareSpecs'
import { getCatalogViewMode, setCatalogViewMode, type CatalogViewMode } from '../catalog/viewMode'
import {
  findCatalogItemByWorkspaceParam,
  getWorkspaceCatalogItemParam,
  syncWorkspaceCatalogItemParam,
} from '../shared/workspaceNavUrl'
import type { RegisteredOrganization } from '../providerAdmin/organizations'
import { sortByDemoCatalogOrder } from '../providerSetup/prototypeEntry'
import type { CatalogItemStatus, ProviderCatalogDraft } from '../providerSetup/storage'
import {
  consumeProviderVipCatalogResumeIntent,
  duplicateProviderCatalogItem,
  getCatalogItemStatus,
  getProviderCatalogItems,
  getProviderRegisteredOrganizations,
  getProviderSavedTemplate,
  deleteProviderCatalogItem,
  setProviderCatalogItemStatus,
  setProviderVipCatalogResumeIntent,
  updateProviderCatalogItemFromPayload,
} from '../providerSetup/storage'
import {
  CATALOG_SERVICE_FILTER_LABELS,
  CATALOG_SERVICE_LABELS,
  DEFAULT_BLUEPRINT_FORM,
  formatRateCardSummary,
  parseRateCardFromForm,
  type CatalogServiceId,
  type PublishedTemplatePayload,
  type RateCard,
} from '../providerSetup/templateDemo'
import { ProviderSetupPublishCatalogWizard } from './provider-setup/ProviderSetupPublishCatalogWizard'

type ProviderAdminCatalogPageProps = {
  catalogItems: ProviderCatalogDraft[]
  isModelDeploymentMvp?: boolean
  aiOnlyMode?: boolean
  isEntering?: boolean
  onCreateCatalogItem: (payload: PublishedTemplatePayload) => ProviderCatalogDraft | void
  onCatalogItemsChange?: (items?: ProviderCatalogDraft[]) => void
  isPublishing?: boolean
  onRegisterOrganization?: () => void
  /** When set, open this catalog item's detail page (id or display name). */
  openCatalogItemKey?: string | null
  onOpenCatalogItemConsumed?: () => void
  /**
   * When the edit wizard is open, parent navigation should call this to show the same
   * leave confirmation before leaving the page.
   */
  onEditLeaveAttemptChange?: (
    attemptLeave: ((onConfirmed: () => void) => void) | null,
  ) => void
}

/** Intentional create latency before revealing the new catalog card. */
const CATALOG_ITEM_CREATE_REVEAL_MS = 1600
/** Intentional publish latency before revealing the live state. */
const CATALOG_ITEM_PUBLISH_REVEAL_MS = 1500

function getDraftServiceId(catalogDraft: ProviderCatalogDraft): CatalogServiceId {
  return catalogDraft.serviceId ?? 'baremetal'
}

/** Grid: blue label chip. List: subtle subtext under the item name. */
function ProviderAdminCatalogServiceType({
  service,
  variant,
}: {
  service: string
  variant: 'grid' | 'list'
}) {
  if (variant === 'grid') {
    return (
      <Label color="blue" className="provider-admin-catalog-items__card-label">
        {service}
      </Label>
    )
  }

  return (
    <Content component="p" className="provider-admin-catalog-items__service-type">
      {service}
    </Content>
  )
}

function dedupeCatalogItemsById(items: ProviderCatalogDraft[]): ProviderCatalogDraft[] {
  const byId = new Map<string, ProviderCatalogDraft>()

  for (const item of items) {
    const existing = byId.get(item.catalogItemId)
    if (!existing) {
      byId.set(item.catalogItemId, item)
      continue
    }

    const existingStatus = getCatalogItemStatus(existing)
    const nextStatus = getCatalogItemStatus(item)

    // Never let an unpublished duplicate replace a live row.
    if (existingStatus === 'live' && nextStatus !== 'live') {
      continue
    }
    if (existingStatus !== 'live' && nextStatus === 'live') {
      byId.set(item.catalogItemId, item)
      continue
    }

    const createdAtComparison = (item.createdAt ?? '').localeCompare(existing.createdAt ?? '')
    if (createdAtComparison >= 0) {
      byId.set(item.catalogItemId, item)
    }
  }

  return Array.from(byId.values())
}

function catalogItemMatchesOrganization(
  item: ProviderCatalogDraft,
  tenant: RegisteredOrganization,
): boolean {
  if (item.scope !== 'vip-enterprise') {
    return false
  }

  return getCatalogEnterpriseTenantIds(item).some(
    (tenantId) => tenantId === tenant.tenantId || tenantId === tenant.id,
  )
}

function formatCatalogCreatedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function CatalogStatusLabel({
  item,
  isPublishing = false,
}: {
  item: ProviderCatalogDraft
  isPublishing?: boolean
}) {
  if (isPublishing) {
    return (
      <Label
        color="blue"
        className="provider-admin-catalog-items__card-label provider-admin-catalog-items__status provider-admin-catalog-items__status--publishing"
        icon={<Spinner size="sm" aria-hidden />}
      >
        Publishing ...
      </Label>
    )
  }

  const status = getCatalogItemStatus(item)
  const isLive = status === 'live'

  return (
    <Label
      color={isLive ? 'green' : 'grey'}
      className="provider-admin-catalog-items__card-label provider-admin-catalog-items__status"
    >
      {isLive ? 'Live' : 'Unpublished'}
    </Label>
  )
}

function getVisibilityTooltip(scope: ProviderCatalogDraft['scope']): string {
  return scope === 'vip-enterprise'
    ? 'Visible only to chosen tenants'
    : 'Visible to all tenants'
}

function ScopeCell({ scope }: { scope: ProviderCatalogDraft['scope'] }) {
  const label = scope === 'vip-enterprise' ? 'VIP enterprise' : 'Global'

  return (
    <Tooltip content={getVisibilityTooltip(scope)} position="top" enableFlip={false}>
      <span className="provider-admin-catalog-items__scope">
        <CatalogPublishScopeIcon scope={scope} className="provider-admin-catalog__scope-icon" />
        <span>{label}</span>
      </span>
    </Tooltip>
  )
}

function ProviderAdminCatalogRateCell({ rateCard }: { rateCard: RateCard }) {
  const hourly = rateCard.hourlyRate.toFixed(2)
  const monthly = rateCard.monthlyRate.toLocaleString('en-US', { maximumFractionDigits: 0 })

  return (
    <Content component="p" className="provider-admin-catalog-items__primary-cell provider-admin-catalog-items__rate-cell">
      <span className="provider-admin-catalog-items__rate-line">
        ${hourly}/hr · ${monthly}/mo
      </span>
      <span className="provider-admin-catalog-items__rate-unit">per instance</span>
    </Content>
  )
}

function getTemplateRowData() {
  const saved = getProviderSavedTemplate()
  if (saved) {
    return saved
  }

  return {
    templateRefId: 'bm-dell-r750',
    templateName: DEFAULT_BLUEPRINT_FORM.templateName,
    description: DEFAULT_BLUEPRINT_FORM.description,
    hardwareProfileId: DEFAULT_BLUEPRINT_FORM.hardwareProfileId,
    osImageId: DEFAULT_BLUEPRINT_FORM.osImage,
    suggestedDisplayName: DEFAULT_BLUEPRINT_FORM.templateName,
    rateCard: parseRateCardFromForm(DEFAULT_BLUEPRINT_FORM)!,
  }
}

function getCatalogItemActions(
  item: ProviderCatalogDraft,
  isPublishing: boolean,
  onViewDetails: () => void,
  onEdit: () => void,
  onDuplicate: () => void,
  onTogglePublish: () => void,
  onDelete: () => void,
): IAction[] {
  const isUnpublished = getCatalogItemStatus(item) === 'unpublished'
  const actions: IAction[] = [
    {
      title: 'View details',
      onClick: onViewDetails,
    },
  ]

  actions.push(
    {
      title: 'Edit',
      onClick: onEdit,
      isDisabled: isPublishing,
    },
    {
      title: 'Duplicate',
      onClick: onDuplicate,
      isDisabled: isPublishing,
    },
    {
      isSeparator: true,
    },
    {
      title: isPublishing ? 'Publishing ...' : isUnpublished ? 'Publish' : 'Unpublish',
      onClick: onTogglePublish,
      isDisabled: isPublishing,
    },
    {
      title: 'Delete',
      isDanger: true,
      onClick: onDelete,
      isDisabled: isPublishing,
    },
  )

  return actions
}

export function ProviderAdminCatalogPage({
  catalogItems,
  isModelDeploymentMvp = false,
  aiOnlyMode = false,
  isEntering = false,
  onCreateCatalogItem,
  onCatalogItemsChange,
  isPublishing = false,
  onRegisterOrganization,
  openCatalogItemKey = null,
  onOpenCatalogItemConsumed,
  onEditLeaveAttemptChange,
}: ProviderAdminCatalogPageProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const visibleCatalogItems = useMemo(
    () => {
      if (aiOnlyMode) {
        return catalogItems.filter((item) => getDraftServiceId(item) === 'models')
      }
      return isModelDeploymentMvp
        ? catalogItems.filter((item) => getDraftServiceId(item) !== 'models')
        : catalogItems
    },
    [catalogItems, isModelDeploymentMvp, aiOnlyMode],
  )
  const initialServiceFilters = visibleCatalogItems.map(getDraftServiceId)
  const [selectedFilters, setSelectedFilters] = useState<Set<CatalogServiceId>>(
    () => new Set(initialServiceFilters.length > 0 ? initialServiceFilters : aiOnlyMode ? ['models'] : ['baremetal']),
  )
  const [selectedStatus, setSelectedStatus] = useState<'all' | CatalogItemStatus>('all')
  const [organizationFilter, setOrganizationFilter] = useState('')
  const [viewMode, setViewMode] = useState<CatalogViewMode>(() => getCatalogViewMode('grid'))
  const [searchValue, setSearchValue] = useState('')
  const [organizations, setOrganizations] = useState(() => getProviderRegisteredOrganizations())
  const [isPublishWizardOpen, setIsPublishWizardOpen] = useState(false)
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ProviderCatalogDraft | null>(null)
  const [isEditWizardOpen, setIsEditWizardOpen] = useState(false)
  const [editReturnToDetails, setEditReturnToDetails] = useState(false)
  const [isUnpublishModalOpen, setIsUnpublishModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isViewingDetails, setIsViewingDetails] = useState(false)
  const [publishResumeScope, setPublishResumeScope] = useState<'global-public' | 'vip-enterprise'>(
    'global-public',
  )
  const [publishResumeTenantId, setPublishResumeTenantId] = useState('')
  const [editResumeTenantId, setEditResumeTenantId] = useState<string | undefined>(undefined)
  const [creatingCatalogItemId, setCreatingCatalogItemId] = useState<string | null>(null)
  const [creatingCardHeightPx, setCreatingCardHeightPx] = useState<number | null>(null)
  const [publishingCatalogItemId, setPublishingCatalogItemId] = useState<string | null>(null)
  const createRevealTimeoutRef = useRef<number | null>(null)
  const publishRevealTimeoutRef = useRef<number | null>(null)
  const catalogCardGridRef = useRef<HTMLDivElement | null>(null)
  const editWizardRequestCloseRef = useRef<(() => void) | null>(null)
  const pendingLeaveActionRef = useRef<(() => void) | null>(null)
  const itemParam = getWorkspaceCatalogItemParam(searchParams)

  const uniqueCatalogItems = useMemo(
    () => dedupeCatalogItemsById(visibleCatalogItems),
    [visibleCatalogItems],
  )
  /** Freeze card order for the session so publish/unpublish never reshuffles the grid. */
  const catalogDisplayOrderRef = useRef<string[] | null>(null)
  const orderedCatalogItems = useMemo(() => {
    const byId = new Map(
      uniqueCatalogItems.map((item) => [item.catalogItemId, item] as const),
    )
    const currentIds = new Set(byId.keys())

    if (!catalogDisplayOrderRef.current) {
      catalogDisplayOrderRef.current = sortByDemoCatalogOrder(uniqueCatalogItems).map(
        (item) => item.catalogItemId,
      )
    } else {
      const retained = catalogDisplayOrderRef.current.filter((id) => currentIds.has(id))
      const retainedSet = new Set(retained)
      const added = sortByDemoCatalogOrder(
        uniqueCatalogItems.filter((item) => !retainedSet.has(item.catalogItemId)),
      ).map((item) => item.catalogItemId)
      // New cards prepend; existing cards keep their places (including across publish).
      catalogDisplayOrderRef.current = [...added, ...retained]
    }

    return catalogDisplayOrderRef.current
      .map((id) => byId.get(id))
      .filter((item): item is ProviderCatalogDraft => Boolean(item))
  }, [uniqueCatalogItems])
  const newestCatalogItem = orderedCatalogItems[0] ?? null
  const knownServiceFiltersRef = useRef(new Set(initialServiceFilters))

  const refreshCatalogItems = () => {
    onCatalogItemsChange?.(getProviderCatalogItems())
  }

  useEffect(() => {
    return () => {
      if (createRevealTimeoutRef.current !== null) {
        window.clearTimeout(createRevealTimeoutRef.current)
      }
      if (publishRevealTimeoutRef.current !== null) {
        window.clearTimeout(publishRevealTimeoutRef.current)
      }
    }
  }, [])

  const beginCatalogItemCreateReveal = (catalogItemId: string) => {
    if (createRevealTimeoutRef.current !== null) {
      window.clearTimeout(createRevealTimeoutRef.current)
    }
    setCreatingCardHeightPx(null)
    setCreatingCatalogItemId(catalogItemId)
    createRevealTimeoutRef.current = window.setTimeout(() => {
      setCreatingCatalogItemId((current) => (current === catalogItemId ? null : current))
      setCreatingCardHeightPx(null)
      createRevealTimeoutRef.current = null
    }, CATALOG_ITEM_CREATE_REVEAL_MS)
  }

  useEffect(() => {
    setSelectedFilters((current) => {
      const next = new Set(current)
      let changed = false

      for (const item of orderedCatalogItems) {
        const serviceId = getDraftServiceId(item)
        if (!knownServiceFiltersRef.current.has(serviceId)) {
          knownServiceFiltersRef.current.add(serviceId)
          next.add(serviceId)
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [orderedCatalogItems])

  const serviceCounts = useMemo(
    () => countCatalogServices(orderedCatalogItems.map(getDraftServiceId)),
    [orderedCatalogItems],
  )
  const organizationOptions = useMemo(
    () =>
      [...organizations].sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
      ),
    [organizations],
  )

  const tenantFilterOptions = useMemo(
    () => [
      { value: '', label: 'All tenants' },
      ...organizationOptions.map((organization) => ({
        value: organization.tenantId,
        label: organization.name,
      })),
    ],
    [organizationOptions],
  )

  const publishStatusFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All publish states' },
      { value: 'live', label: 'Published' },
      { value: 'unpublished', label: 'Unpublished' },
    ],
    [],
  )

  const filteredCatalogItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase()
    const selectedTenant = organizationFilter
      ? organizations.find(
          (organization) =>
            organization.tenantId === organizationFilter || organization.id === organizationFilter,
        )
      : null

    // Filter only — preserve frozen display order (do not re-sort on status changes).
    return orderedCatalogItems.filter((item) => {
      if (!selectedFilters.has(getDraftServiceId(item))) {
        return false
      }

      if (selectedStatus !== 'all' && getCatalogItemStatus(item) !== selectedStatus) {
        return false
      }

      if (selectedTenant && !catalogItemMatchesOrganization(item, selectedTenant)) {
        return false
      }

      if (!query) {
        return true
      }

      return (
        item.displayName.toLowerCase().includes(query) ||
        item.catalogItemId.toLowerCase().includes(query) ||
        item.templateName.toLowerCase().includes(query) ||
        item.templateRefId.toLowerCase().includes(query)
      )
    })
  }, [
    orderedCatalogItems,
    selectedFilters,
    selectedStatus,
    organizationFilter,
    organizations,
    searchValue,
  ])

  useLayoutEffect(() => {
    if (!creatingCatalogItemId || viewMode !== 'grid') {
      setCreatingCardHeightPx(null)
      return
    }

    const grid = catalogCardGridRef.current
    if (!grid) {
      return
    }

    const referenceCard = Array.from(
      grid.querySelectorAll<HTMLElement>('.provider-admin-catalog-items__card'),
    ).find((card) => !card.classList.contains('provider-admin-catalog-items__card--creating'))

    if (!referenceCard) {
      setCreatingCardHeightPx(null)
      return
    }

    setCreatingCardHeightPx(Math.round(referenceCard.getBoundingClientRect().height))
  }, [creatingCatalogItemId, filteredCatalogItems, viewMode])

  const linkedTemplate = useMemo(() => getTemplateRowData(), [])
  const availableTemplates = useMemo(() => {
    // Demo currently has one real template; don't invent a second picker option.
    return [getTemplateRowData()]
  }, [isPublishWizardOpen])

  const refreshOrganizations = () => {
    setOrganizations(getProviderRegisteredOrganizations())
  }

  useEffect(() => {
    const intent = consumeProviderVipCatalogResumeIntent()
    if (!intent) {
      return
    }

    const latestOrganizations = getProviderRegisteredOrganizations()
    setOrganizations(latestOrganizations)
    const preferredTenantId = latestOrganizations[0]?.tenantId ?? ''

    if (intent.kind === 'publish') {
      setPublishResumeScope('vip-enterprise')
      setPublishResumeTenantId(preferredTenantId)
      setIsViewingDetails(false)
      setIsPublishWizardOpen(true)
      return
    }

    const catalogItem =
      orderedCatalogItems.find((item) => item.catalogItemId === intent.catalogItemId) ?? null
    if (!catalogItem) {
      return
    }

    setSelectedCatalogItem(catalogItem)
    setEditResumeTenantId(preferredTenantId)
    setEditReturnToDetails(true)
    setIsEditWizardOpen(true)
    // Resume once when returning from organization registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only resume
  }, [])

  const handleRegisterOrganizationFromVip = (intent: {
    kind: 'publish'
  } | {
    kind: 'edit'
    catalogItemId: string
  }) => {
    setProviderVipCatalogResumeIntent(intent)
    setIsPublishWizardOpen(false)
    setIsEditWizardOpen(false)
    onRegisterOrganization?.()
  }

  const openDetails = (item: ProviderCatalogDraft) => {
    setSelectedCatalogItem(item)
    setIsPublishWizardOpen(false)
    setIsViewingDetails(true)
    // Prefer stable id in the URL so display-name collisions cannot open the wrong row.
    syncWorkspaceCatalogItemParam(setSearchParams, item.catalogItemId)
  }

  const closeDetails = () => {
    setIsViewingDetails(false)
    syncWorkspaceCatalogItemParam(setSearchParams, null)
  }

  const closeCreateWizard = () => {
    setIsPublishWizardOpen(false)
    setPublishResumeScope('global-public')
    setPublishResumeTenantId('')
  }

  const closeEditWizard = () => {
    const pendingLeave = pendingLeaveActionRef.current
    pendingLeaveActionRef.current = null
    const returnToDetails = editReturnToDetails

    setIsEditWizardOpen(false)
    setEditResumeTenantId(undefined)
    setEditReturnToDetails(false)

    if (pendingLeave) {
      pendingLeave()
      return
    }

    if (returnToDetails && selectedCatalogItem) {
      setIsViewingDetails(true)
      syncWorkspaceCatalogItemParam(setSearchParams, selectedCatalogItem.catalogItemId)
    }
  }

  const openCreateWizard = () => {
    setIsViewingDetails(false)
    setPublishResumeScope('global-public')
    setPublishResumeTenantId('')
    setIsPublishWizardOpen(true)
    syncWorkspaceCatalogItemParam(setSearchParams, null, { replace: true })
  }

  useEffect(() => {
    if (!openCatalogItemKey) {
      return
    }

    const match = findCatalogItemByWorkspaceParam(orderedCatalogItems, openCatalogItemKey)
    if (match) {
      openDetails(match)
    }

    onOpenCatalogItemConsumed?.()
  }, [openCatalogItemKey, orderedCatalogItems, onOpenCatalogItemConsumed])

  useEffect(() => {
    const match = findCatalogItemByWorkspaceParam(orderedCatalogItems, itemParam)
    if (match) {
      setSelectedCatalogItem((current) => {
        // While publishing, keep the current selection so the CTA stays on Publishing ...
        // until storage + list both report live.
        if (
          current &&
          current.catalogItemId === match.catalogItemId &&
          publishingCatalogItemId === current.catalogItemId
        ) {
          return current
        }
        return match
      })
      if (!isEditWizardOpen && !isPublishWizardOpen) {
        setIsViewingDetails(true)
      }
      return
    }

    if (!itemParam) {
      setIsViewingDetails(false)
    }
  }, [
    itemParam,
    orderedCatalogItems,
    isEditWizardOpen,
    isPublishWizardOpen,
    publishingCatalogItemId,
  ])

  useEffect(() => {
    if (!onEditLeaveAttemptChange) {
      return
    }

    if (!isEditWizardOpen) {
      onEditLeaveAttemptChange(null)
      return
    }

    onEditLeaveAttemptChange((onConfirmed) => {
      pendingLeaveActionRef.current = onConfirmed
      editWizardRequestCloseRef.current?.()
    })

    return () => {
      onEditLeaveAttemptChange(null)
    }
  }, [isEditWizardOpen, onEditLeaveAttemptChange])

  const openEdit = (
    item: ProviderCatalogDraft,
    options?: {
      returnToDetails?: boolean
    },
  ) => {
    setSelectedCatalogItem(item)
    setEditReturnToDetails(options?.returnToDetails ?? isViewingDetails)
    setIsViewingDetails(false)
    setIsPublishWizardOpen(false)
    setIsEditWizardOpen(true)
  }

  const handleDuplicate = (item: ProviderCatalogDraft) => {
    const duplicate = duplicateProviderCatalogItem(item.catalogItemId)
    if (!duplicate) {
      return
    }

    const wasOnDetailPage =
      isViewingDetails && selectedCatalogItem?.catalogItemId === item.catalogItemId

    refreshCatalogItems()
    setSelectedCatalogItem(duplicate)
    setIsEditWizardOpen(false)
    setIsPublishWizardOpen(false)

    if (wasOnDetailPage) {
      setIsViewingDetails(false)
      setViewMode('grid')
      setCatalogViewMode('grid')
      setSelectedStatus('all')
      setSearchValue('')
      beginCatalogItemCreateReveal(duplicate.catalogItemId)
      syncWorkspaceCatalogItemParam(setSearchParams, null, { replace: true })
    }
  }

  const publishCatalogItem = (item: ProviderCatalogDraft) => {
    if (getCatalogItemStatus(item) === 'live') {
      return
    }
    if (publishingCatalogItemId === item.catalogItemId) {
      return
    }

    if (publishRevealTimeoutRef.current !== null) {
      window.clearTimeout(publishRevealTimeoutRef.current)
    }

    const catalogItemId = item.catalogItemId
    // Persist live immediately so the detail CTA can complete Publishing.
    // Keep publishingCatalogItemId for the 1.5s card/detail "Publishing ..." chrome.
    const updated = setProviderCatalogItemStatus(catalogItemId, 'live')
    const nextItems = getProviderCatalogItems()

    flushSync(() => {
      if (updated) {
        setSelectedCatalogItem(updated)
      } else {
        setSelectedCatalogItem(item)
      }
      onCatalogItemsChange?.(nextItems)
      setPublishingCatalogItemId(catalogItemId)
    })

    publishRevealTimeoutRef.current = window.setTimeout(() => {
      setPublishingCatalogItemId((current) => (current === catalogItemId ? null : current))
      publishRevealTimeoutRef.current = null
    }, CATALOG_ITEM_PUBLISH_REVEAL_MS)
  }

  const openTogglePublish = (item: ProviderCatalogDraft) => {
    if (getCatalogItemStatus(item) === 'unpublished') {
      publishCatalogItem(item)
      return
    }

    setSelectedCatalogItem(item)
    setIsUnpublishModalOpen(true)
  }

  const handleConfirmUnpublish = () => {
    if (!selectedCatalogItem) {
      return
    }

    const updated = setProviderCatalogItemStatus(selectedCatalogItem.catalogItemId, 'unpublished')
    if (updated) {
      setSelectedCatalogItem(updated)
      refreshCatalogItems()
    }
    setIsUnpublishModalOpen(false)
  }

  const openDelete = (item: ProviderCatalogDraft) => {
    setSelectedCatalogItem(item)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmDelete = () => {
    if (!selectedCatalogItem) {
      return
    }

    const deletedId = selectedCatalogItem.catalogItemId
    const deleted = deleteProviderCatalogItem(deletedId)
    if (deleted) {
      closeDetails()
      syncWorkspaceCatalogItemParam(setSearchParams, null, { replace: true })
      setIsEditWizardOpen(false)
      setSelectedCatalogItem(null)
      refreshCatalogItems()
      refreshOrganizations()
    }
    setIsDeleteModalOpen(false)
  }

  const handleUpdateCatalogItemFromWizard = (
    catalogItemId: string,
    payload: PublishedTemplatePayload,
  ) => {
    const updated = updateProviderCatalogItemFromPayload(catalogItemId, payload)
    if (!updated) {
      return
    }

    const returnToDetails = editReturnToDetails
    setSelectedCatalogItem(updated)
    refreshCatalogItems()
    refreshOrganizations()
    setIsEditWizardOpen(false)
    setEditResumeTenantId(undefined)
    setEditReturnToDetails(false)

    if (returnToDetails) {
      setIsViewingDetails(true)
      syncWorkspaceCatalogItemParam(setSearchParams, updated.catalogItemId)
    }
  }

  const handleViewModeChange = (nextViewMode: CatalogViewMode) => {
    setViewMode(nextViewMode)
    setCatalogViewMode(nextViewMode)
  }

  const handleFilterToggle = (serviceId: CatalogServiceId, isSelected: boolean) => {
    setSelectedFilters((current) => toggleCatalogServiceFilter(current, serviceId, isSelected))
  }

  const catalogServiceIds = useMemo(
    () => orderedCatalogItems.map(getDraftServiceId),
    [orderedCatalogItems],
  )

  const filterDescriptionParts = useMemo(() => {
    const parts: string[] = []
    const serviceDescription = describeCatalogServiceFilter(selectedFilters, catalogServiceIds)
    if (serviceDescription) {
      parts.push(`service: ${serviceDescription}`)
    }
    if (selectedStatus !== 'all') {
      parts.push(
        `publish status: ${selectedStatus === 'live' ? 'Published' : 'Unpublished'}`,
      )
    }
    if (organizationFilter) {
      const organizationName =
        organizations.find(
          (organization) =>
            organization.tenantId === organizationFilter || organization.id === organizationFilter,
        )?.name ?? organizationFilter
      parts.push(`tenant: ${organizationName}`)
    }
    if (searchValue.trim()) {
      parts.push(`search: "${searchValue.trim()}"`)
    }
    return parts
  }, [
    catalogServiceIds,
    organizationFilter,
    organizations,
    searchValue,
    selectedFilters,
    selectedStatus,
  ])

  const clearAllFilters = () => {
    setSearchValue('')
    setSelectedStatus('all')
    setOrganizationFilter('')
    setSelectedFilters(createCatalogServiceFilterSet(catalogServiceIds))
  }

  const emptyStateTitle = (() => {
    if (selectedFilters.size === 0) {
      return 'Select a service to view catalog items'
    }
    if (searchValue.trim() || organizationFilter) {
      return 'No matching catalog items'
    }
    if (selectedStatus !== 'all') {
      return `No ${selectedStatus === 'live' ? 'published' : 'unpublished'} catalog items`
    }
    if (selectedFilters.size === 1) {
      const [onlyFilter] = selectedFilters
      return `No ${CATALOG_SERVICE_FILTER_LABELS[onlyFilter!]} items yet`
    }
    return 'No catalog items for the selected services'
  })()

  const emptyStateBody = (() => {
    if (selectedFilters.size === 0) {
      return 'Choose one or more services above to filter the catalog.'
    }
    if (searchValue.trim() || organizationFilter) {
      return 'Try a different search, tenant, or clear filters.'
    }
    if (selectedStatus !== 'all') {
      return 'Try a different publish status or clear filters.'
    }
    return 'Create a catalog item for this service to see it listed here.'
  })()

  // Persisted list is the source of truth so card + detail status stay aligned.
  // During publish, keep the pre-live row so Publishing ... can render until flush completes.
  const drawerCatalog = selectedCatalogItem
    ? (() => {
        const catalogFromList =
          orderedCatalogItems.find(
            (item) => item.catalogItemId === selectedCatalogItem.catalogItemId,
          ) ?? null

        if (publishingCatalogItemId === selectedCatalogItem.catalogItemId) {
          return catalogFromList ?? selectedCatalogItem
        }

        return catalogFromList ?? selectedCatalogItem
      })()
    : null
  const linkedTemplateForDetails = drawerCatalog
    ? findCatalogLinkedTemplate(drawerCatalog.templateRefId, drawerCatalog.templateName)
    : null

  return (
    <>
      {isPublishWizardOpen ? (
        <ProviderSetupPublishCatalogWizard
          presentation="page"
          isOpen={isPublishWizardOpen}
          templates={availableTemplates}
          hiddenServiceIds={aiOnlyMode ? ['baremetal', 'cluster', 'virtual-machine'] : isModelDeploymentMvp ? ['models'] : []}
          organizations={organizations}
          defaultTemplateRefId={newestCatalogItem?.templateRefId}
          initialPublishScope={publishResumeScope}
          initialEnterpriseTenantId={publishResumeTenantId}
          onClose={closeCreateWizard}
          onCreateCatalogItem={(payload) => {
            closeCreateWizard()
            const created = onCreateCatalogItem(payload)
            if (created?.catalogItemId) {
              setViewMode('grid')
              setCatalogViewMode('grid')
              setSelectedStatus('all')
              setSearchValue('')
              beginCatalogItemCreateReveal(created.catalogItemId)
              setIsViewingDetails(false)
              syncWorkspaceCatalogItemParam(setSearchParams, null, { replace: true })
            }
          }}
          onRegisterOrganization={() => handleRegisterOrganizationFromVip({ kind: 'publish' })}
          isPublishing={isPublishing}
        />
      ) : isEditWizardOpen && selectedCatalogItem ? (
        <ProviderSetupPublishCatalogWizard
          mode="edit"
          presentation="page"
          isOpen={isEditWizardOpen}
          editingCatalog={selectedCatalogItem}
          templates={availableTemplates}
          hiddenServiceIds={aiOnlyMode ? ['baremetal', 'cluster', 'virtual-machine'] : isModelDeploymentMvp ? ['models'] : []}
          organizations={organizations}
          initialPublishScope={selectedCatalogItem.scope}
          initialEnterpriseTenantId={editResumeTenantId}
          leaveConfirmActionLabel={
            editReturnToDetails ? 'Back to catalog item' : 'Go to Catalog'
          }
          onRegisterRequestClose={(requestClose) => {
            editWizardRequestCloseRef.current = requestClose
          }}
          onLeaveConfirmDismissed={() => {
            pendingLeaveActionRef.current = null
          }}
          onClose={closeEditWizard}
          onCreateCatalogItem={() => undefined}
          onSaveCatalogItem={handleUpdateCatalogItemFromWizard}
          onRegisterOrganization={() =>
            handleRegisterOrganizationFromVip({
              kind: 'edit',
              catalogItemId: selectedCatalogItem.catalogItemId,
            })
          }
        />
      ) : isViewingDetails && drawerCatalog ? (
        <CatalogItemDetailsPage
          catalog={drawerCatalog}
          templateDescription={
            linkedTemplateForDetails?.description ?? linkedTemplate.description
          }
          onBackToCatalog={closeDetails}
          onPublish={() => publishCatalogItem(drawerCatalog)}
          onUnpublish={() => openTogglePublish(drawerCatalog)}
          isPublishing={publishingCatalogItemId === drawerCatalog.catalogItemId}
          onEdit={() => openEdit(drawerCatalog, { returnToDetails: true })}
          onDuplicate={() => handleDuplicate(drawerCatalog)}
          onDelete={() => openDelete(drawerCatalog)}
        />
      ) : (
    <div
      className={`provider-admin-catalog-items${
        isEntering ? ' provider-admin-catalog-items--entering' : ''
      }`}
    >
      <Flex
        className="provider-admin-catalog-items__header"
        alignItems={{ default: 'alignItemsFlexStart' }}
        justifyContent={{ default: 'justifyContentSpaceBetween' }}
        gap={{ default: 'gapMd' }}
      >
        <FlexItem>
          <Title headingLevel="h1" size="3xl" className="provider-admin-catalog-items__title">
            Catalog
          </Title>
          <Content component="p" className="provider-admin-catalog-items__lede">
            {aiOnlyMode
              ? 'Create AI model catalog items from curated model endpoints, then attach them to tenants.'
              : isModelDeploymentMvp
                ? 'Create catalog items from master templates across Bare Metal, Clusters, and Virtual machines, then attach them to tenants.'
                : 'Create catalog items from master templates across Bare Metal, Clusters, Models, and Virtual machines, then attach them to tenants.'}
          </Content>
        </FlexItem>
        <FlexItem alignSelf={{ default: 'alignSelfFlexStart' }}>
          <Button
            variant="primary"
            icon={<PlusIcon />}
            className="provider-admin-catalog-items__create"
            isDisabled={isPublishing}
            onClick={openCreateWizard}
          >
            Create catalog item
          </Button>
        </FlexItem>
      </Flex>

      <div className="catalog-view-toolbar">
        <div className="catalog-view-toolbar__start">
          <CatalogServiceFilterToggle
            selectedFilters={selectedFilters}
            serviceCounts={serviceCounts}
            onToggle={handleFilterToggle}
            hiddenServiceIds={aiOnlyMode ? ['baremetal', 'cluster', 'virtual-machine'] : isModelDeploymentMvp ? ['models'] : []}
          />
          <PillFilterSelect
            id="catalog-status-filter"
            className="pill-filter-select--status"
            value={selectedStatus}
            options={publishStatusFilterOptions}
            onChange={(value) => setSelectedStatus(value as 'all' | CatalogItemStatus)}
            ariaLabel="Filter catalog items by publish status"
          />
          <PillFilterSelect
            id="catalog-organization-filter"
            className="pill-filter-select--organization"
            value={organizationFilter}
            options={tenantFilterOptions}
            onChange={setOrganizationFilter}
            ariaLabel="Filter catalog items by tenant"
          />
          <SearchInput
            className="catalog-search provider-admin-catalog-items__search"
            placeholder="Search catalog items"
            value={searchValue}
            onChange={(_event, value) => setSearchValue(value)}
            onClear={() => setSearchValue('')}
            aria-label="Search catalog items"
          />
        </div>
        <CatalogViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
      </div>

      {filteredCatalogItems.length === 0 ? (
        filterDescriptionParts.length > 0 ? (
          <CatalogFilterEmptyState
            title="No catalog items match your filters"
            description="Try a different service, publish status, tenant, or search term."
            onClearFilters={clearAllFilters}
          />
        ) : (
        <EmptyState className="provider-admin-catalog-items__empty">
          <Title headingLevel="h2" size="lg">
            {emptyStateTitle}
          </Title>
          <EmptyStateBody>{emptyStateBody}</EmptyStateBody>
        </EmptyState>
        )
      ) : viewMode === 'grid' ? (
        <>
          <CatalogFilterResultsSummary
            filteredCount={filteredCatalogItems.length}
            totalCount={orderedCatalogItems.length}
            singular="catalog item"
            filterParts={filterDescriptionParts}
            onClearFilters={clearAllFilters}
          />
        <div
          ref={catalogCardGridRef}
          className="catalog-card-grid catalog-card-grid--stable provider-admin-catalog-items__card-grid"
        >
          {filteredCatalogItems.map((item) => {
            const serviceId = getDraftServiceId(item)
            const isCreating = creatingCatalogItemId === item.catalogItemId
            const isPublishing = publishingCatalogItemId === item.catalogItemId
            const catalogItemActions = getCatalogItemActions(
              item,
              isPublishing,
              () => openDetails(item),
              () => openEdit(item),
              () => handleDuplicate(item),
              () => openTogglePublish(item),
              () => openDelete(item),
            )
            const visibilityDetail =
              item.scope === 'vip-enterprise'
                ? formatVipEnterpriseVisibilityLabel(
                    organizations,
                    getCatalogEnterpriseTenantIds(item),
                  )
                : 'Global public'
            const specRows = resolveCatalogCardSpecRows(item)

            return (
              <Card
                key={item.catalogItemId}
                isCompact={false}
                className={[
                  'provider-admin-catalog-items__card',
                  getCatalogItemStatus(item) === 'unpublished'
                    ? 'provider-admin-catalog-items__card--unpublished'
                    : '',
                  isCreating ? 'provider-admin-catalog-items__card--creating' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  isCreating && creatingCardHeightPx
                    ? { height: creatingCardHeightPx, minBlockSize: creatingCardHeightPx }
                    : undefined
                }
              >
                {isCreating ? (
                  <CardBody className="provider-admin-catalog-items__card-body--creating">
                    <Spinner
                      size="lg"
                      aria-label={`Creating ${item.displayName}`}
                    />
                    <Content
                      component="p"
                      className="provider-admin-catalog-items__creating-kicker"
                    >
                      Creating catalog item…
                    </Content>
                  </CardBody>
                ) : (
                <CardBody>
                  <div className="provider-admin-catalog-items__card-header">
                    <span className="provider-admin-catalog-items__card-icon" aria-hidden>
                      {getCatalogServiceIcon(serviceId)}
                    </span>
                    <div className="provider-admin-catalog-items__card-header-actions">
                      <ProviderAdminCatalogServiceType
                        service={CATALOG_SERVICE_LABELS[serviceId]}
                        variant="grid"
                      />
                      <CatalogStatusLabel item={item} isPublishing={isPublishing} />
                      <ActionsColumn items={catalogItemActions} />
                    </div>
                  </div>
                  <Content component="p" className="provider-admin-catalog-items__primary-cell">
                    <Button
                      variant="link"
                      isInline
                      className="provider-admin-catalog-items__name-link catalog-item-name-link"
                      onClick={() => openDetails(item)}
                    >
                      {item.displayName}
                    </Button>
                  </Content>
                  <CatalogSpecRowsList
                    rows={specRows}
                    className="provider-admin-catalog-items__specs-list"
                  />
                  <dl className="provider-admin-catalog-items__card-specs">
                    <div className="provider-admin-catalog-items__card-spec">
                      <dt>Rate</dt>
                      <dd>{formatRateCardSummary(item.rateCard)}</dd>
                    </div>
                  </dl>
                  <div
                    className="provider-admin-catalog-items__card-footer"
                    aria-label="Visibility"
                  >
                    <Tooltip
                      content={getVisibilityTooltip(item.scope)}
                      position="top"
                      enableFlip={false}
                    >
                      <span className="provider-admin-catalog-items__scope">
                        <CatalogPublishScopeIcon
                          scope={item.scope}
                          className="provider-admin-catalog__scope-icon"
                        />
                        <span>{visibilityDetail}</span>
                      </span>
                    </Tooltip>
                  </div>
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
            filteredCount={filteredCatalogItems.length}
            totalCount={orderedCatalogItems.length}
            singular="catalog item"
            filterParts={filterDescriptionParts}
            onClearFilters={clearAllFilters}
          />
          <Table
            aria-label="Catalog items"
            className="catalog-data-table provider-admin-catalog-items__table"
          >
          <Thead>
            <Tr>
              <Th className="provider-admin-catalog-items__col-name">Name</Th>
              <Th className="provider-admin-catalog-items__col-status">Status</Th>
              <Th className="provider-admin-catalog-items__col-configuration">Configuration</Th>
              <Th className="provider-admin-catalog-items__col-rate">Rate</Th>
              <Th className="provider-admin-catalog-items__col-visibility">Visibility</Th>
              <Th className="provider-admin-catalog-items__col-created">Created</Th>
              <Th screenReaderText="Actions" className="provider-admin-catalog-items__col-action" />
            </Tr>
          </Thead>
          <Tbody>
            {filteredCatalogItems.map((item) => {
              const serviceId = getDraftServiceId(item)
              const specRows = resolveCatalogCardSpecRows(item)
              const catalogItemActions = getCatalogItemActions(
                item,
                publishingCatalogItemId === item.catalogItemId,
                () => openDetails(item),
                () => openEdit(item),
                () => handleDuplicate(item),
                () => openTogglePublish(item),
                () => openDelete(item),
              )

              return (
                <Tr key={item.catalogItemId}>
                  <Td dataLabel="Name" className="provider-admin-catalog-items__col-name">
                    <Content component="p" className="provider-admin-catalog-items__primary-cell">
                      <Button
                        variant="link"
                        isInline
                        className="provider-admin-catalog-items__name-link catalog-item-name-link catalog-table-name-link"
                        onClick={() => openDetails(item)}
                      >
                        {item.displayName}
                      </Button>
                    </Content>
                    <ProviderAdminCatalogServiceType
                      service={CATALOG_SERVICE_LABELS[serviceId]}
                      variant="list"
                    />
                  </Td>
                  <Td dataLabel="Status" className="provider-admin-catalog-items__col-status">
                    <CatalogStatusLabel
                      item={item}
                      isPublishing={publishingCatalogItemId === item.catalogItemId}
                    />
                  </Td>
                  <Td dataLabel="Configuration" className="provider-admin-catalog-items__col-configuration">
                    <CatalogSpecRowsList
                      rows={specRows}
                      className="catalog-table-specs-list"
                      rowClassName="catalog-table-spec-row"
                      labelClassName="catalog-table-spec-label"
                      valueClassName="catalog-table-spec-value"
                    />
                  </Td>
                  <Td dataLabel="Rate" className="provider-admin-catalog-items__col-rate">
                    <ProviderAdminCatalogRateCell rateCard={item.rateCard} />
                  </Td>
                  <Td dataLabel="Visibility" className="provider-admin-catalog-items__col-visibility">
                    <ScopeCell scope={item.scope} />
                  </Td>
                  <Td dataLabel="Created" className="provider-admin-catalog-items__col-created">
                    {formatCatalogCreatedAt(item.createdAt)}
                  </Td>
                  <Td isActionCell className="provider-admin-catalog-items__col-action">
                    <ActionsColumn items={catalogItemActions} />
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
        isOpen={isUnpublishModalOpen}
        onClose={() => setIsUnpublishModalOpen(false)}
        aria-labelledby="unpublish-catalog-item-title"
      >
        <ModalHeader title="Unpublish catalog item?" labelId="unpublish-catalog-item-title" />
        <ModalBody>
          <Content component="p">
            {selectedCatalogItem ? (
              <>
                <strong>{selectedCatalogItem.displayName}</strong> will leave the tenant storefront.
                You can publish it again later.
              </>
            ) : (
              'This catalog item will leave the tenant storefront. You can publish it again later.'
            )}
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleConfirmUnpublish}>
            Unpublish
          </Button>
          <Button variant="link" onClick={() => setIsUnpublishModalOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        variant={ModalVariant.small}
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        aria-labelledby="delete-catalog-item-title"
        aria-describedby="delete-catalog-item-description"
      >
        <ModalHeader
          title="Delete catalog item?"
          titleIconVariant="warning"
          labelId="delete-catalog-item-title"
        />
        <ModalBody>
          <Content component="p" id="delete-catalog-item-description">
            {selectedCatalogItem ? (
              <>
                <strong>{selectedCatalogItem.displayName}</strong> will be permanently removed from
                the catalog. This cannot be undone.
              </>
            ) : (
              'This catalog item will be permanently removed from the catalog. This cannot be undone.'
            )}
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Delete
          </Button>
          <Button variant="link" onClick={() => setIsDeleteModalOpen(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
