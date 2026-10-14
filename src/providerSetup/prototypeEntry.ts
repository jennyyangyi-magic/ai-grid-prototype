import {
  catalogNetworkPolicyMatchesLockPattern,
  createAllEditableCatalogNetworkPolicy,
  createCatalogNetworkPolicyForLockPattern,
  type CatalogNetworkLockPattern,
} from '../providerAdmin/catalogNetworkPolicy'
import {
  CATALOG_ITEM_DESCRIPTIONS_BY_ID,
  DEMO_CATALOG_ITEM_IDS,
} from '../catalog/catalogItemDescriptions'
import {
  CLUSTER_NODE_SETS_CATALOG_ITEM_ID,
  CLUSTER_NODE_SETS_DISPLAY_NAME,
  CLUSTER_NODE_SETS_RATE_CARD,
  CLUSTER_NODE_SETS_TEMPLATE_NAME,
  CLUSTER_NODE_SETS_TEMPLATE_REF_ID,
  LEGACY_CLUSTER_NODE_SETS_CATALOG_ITEM_ID,
  LEGACY_CLUSTER_NODE_SETS_DISPLAY_NAME,
  LEGACY_VM_NETWORK_ATTACHMENTS_CATALOG_ITEM_ID,
  LEGACY_VM_NETWORK_ATTACHMENTS_DISPLAY_NAME,
  VM_NETWORK_ATTACHMENTS_CATALOG_ITEM_ID,
  VM_NETWORK_ATTACHMENTS_DISPLAY_NAME,
} from '../catalog/catalogSpecs'
import {
  DEFAULT_CLUSTER_CATALOG_VERSION_ID,
  DEFAULT_CLUSTER_HOST_TYPE_ID,
  DEFAULT_CLUSTER_NODE_SET_ID,
  formatBaremetalInstanceTypeLabel,
  formatClusterHostTypeLabel,
  formatClusterNodeSetLabel,
  formatClusterPlatformLabel,
} from '../catalog/catalogPublishConfig'
import { getDefaultMasterTemplate, getStandardClusterTemplate } from '../providerAdmin/bmaasTemplates'
import {
  addProviderCatalogItem,
  deleteProviderCatalogItem,
  getCatalogItemNetworkPolicy,
  getProviderCatalogDraft,
  getProviderCatalogItems,
  getProviderRegisteredOrganizations,
  getProviderSelectedServices,
  setProviderActiveNav,
  setProviderSelectedServices,
  setProviderSetupComplete,
  updateProviderCatalogNetworkPolicy,
  updateProviderRegisteredOrganization,
  upsertProviderSavedTemplate,
  ensureProviderDemoOrganizations,
  patchProviderCatalogItem,
  rewriteProviderCatalogItemIdentity,
  type ProviderCatalogDraft,
} from './storage'
import {
  DEFAULT_BLUEPRINT_FORM,
  DEFAULT_CATALOG_ITEM_DISPLAY_NAME,
  DEFAULT_RATE_CARD,
  DEMO_EXISTING_MASTER_TEMPLATES,
  GPU_BLUEPRINT_FORM,
  LEGACY_DEFAULT_CATALOG_ITEM_DISPLAY_NAME,
  LEGACY_SECOND_CATALOG_ITEM_DISPLAY_NAME,
  LEGACY_SECOND_CATALOG_ITEM_TITLE_CASE_DISPLAY_NAME,
  SECOND_CATALOG_ITEM_DISPLAY_NAME,
  parseRateCardFromForm,
} from './templateDemo'
import { DEFAULT_PROVIDER_SERVICE_SELECTION, type ProviderServiceId } from './constants'
import { createModelCatalogDrafts, MODEL_CATALOG_SEED } from '../vision/modelCatalogSeed'
import {
  DEMO_HARBORLINE_CAPITAL_ORG_ID,
  DEMO_HARBORLINE_CAPITAL_SLUG,
  DEMO_HARBORLINE_CAPITAL_TENANT_ID,
  DEMO_NORTH_SUMMIT_BANK_ORG_ID,
} from '../providerAdmin/organizations'
import type { ProviderAdminNavId } from '../providerAdmin/constants'

/** Stable demo IDs so ensure can re-seed without creating duplicates. */
export const BARE_METAL_GPU_CATALOG_ITEM_ID = 'cat-bm-gpu-training'
export const BARE_METAL_GPU_TEMPLATE_REF_ID = 'bm-dell-r750'
export const LEGACY_BARE_METAL_GPU_CATALOG_ITEM_ID = 'cat_BM_GPU_TRAINING'
export const LEGACY_BARE_METAL_GPU_TEMPLATE_REF_ID = 'bm_dell_r750'

/** Second Bare Metal offering — HPE ProLiant DL380 with A100 GPUs. */
export const BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID = 'cat-bm-dense-gpu'

const BARE_METAL_GPU_TRAINING_INSTANCE_TYPE_ID = 'large'
const BARE_METAL_AI_INFERENCE_INSTANCE_TYPE_ID = 'medium'

function patchBaremetalInstanceTypeIfNeeded(
  catalogItemId: string,
  instanceTypeId: string,
): void {
  const current = getProviderCatalogItems().find((item) => item.catalogItemId === catalogItemId)
  if (!current || current.instanceTypeId === instanceTypeId) {
    return
  }

  patchProviderCatalogItem(catalogItemId, {
    instanceTypeId,
    instanceTypeLabel: formatBaremetalInstanceTypeLabel(instanceTypeId),
  })
}
export const BARE_METAL_AI_INFERENCE_TEMPLATE_REF_ID = 'bm-hpe-dl380-a100'
export const LEGACY_BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID = 'cat_BM_AI_INFERENCE'
export const LEGACY_BARE_METAL_AI_INFERENCE_TEMPLATE_REF_ID = 'bm_hpe_dl380_a100'

/**
 * Demo storefront order for Provider Admin. Tenant Admin / Tenant User use the same order,
 * with unpublished items filtered out.
 */
export const DEMO_CATALOG_ITEM_ORDER = [
  BARE_METAL_GPU_CATALOG_ITEM_ID,
  BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID,
  CLUSTER_NODE_SETS_CATALOG_ITEM_ID,
  ...MODEL_CATALOG_SEED.map((item) => item.catalogItemId),
] as const

function demoCatalogItemOrderIndex(catalogItemId: string): number {
  return (DEMO_CATALOG_ITEM_ORDER as readonly string[]).indexOf(catalogItemId)
}

/**
 * Demo storefront order for known offerings.
 * Newly created items (unknown IDs) sort first by createdAt (newest first) so they
 * appear top-left; demo IDs keep their fixed relative order and never move on
 * publish/unpublish.
 */
export function sortByDemoCatalogOrder<
  T extends { catalogItemId: string; createdAt?: string },
>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftIndex = demoCatalogItemOrderIndex(left.catalogItemId)
    const rightIndex = demoCatalogItemOrderIndex(right.catalogItemId)
    const leftKnown = leftIndex !== -1
    const rightKnown = rightIndex !== -1

    // Unknown (in-session) items stay ahead of the demo set — newest first.
    if (!leftKnown && rightKnown) {
      return -1
    }
    if (leftKnown && !rightKnown) {
      return 1
    }
    if (!leftKnown && !rightKnown) {
      return (right.createdAt ?? '').localeCompare(left.createdAt ?? '')
    }

    return leftIndex - rightIndex
  })
}

function createDefaultCatalogDraft(): ProviderCatalogDraft {
  return {
    catalogItemId: BARE_METAL_GPU_CATALOG_ITEM_ID,
    templateRefId: BARE_METAL_GPU_TEMPLATE_REF_ID,
    templateName: DEFAULT_BLUEPRINT_FORM.templateName,
    displayName: DEFAULT_CATALOG_ITEM_DISPLAY_NAME,
    description: CATALOG_ITEM_DESCRIPTIONS_BY_ID[DEMO_CATALOG_ITEM_IDS.bareMetalGpuTraining],
    scope: 'global-public',
    rateCard: DEFAULT_RATE_CARD,
    serviceId: 'baremetal',
    instanceTypeId: BARE_METAL_GPU_TRAINING_INSTANCE_TYPE_ID,
    instanceTypeLabel: formatBaremetalInstanceTypeLabel(BARE_METAL_GPU_TRAINING_INSTANCE_TYPE_ID),
    osImageMode: 'editable',
    networkPolicy: createAllEditableCatalogNetworkPolicy(),
    status: 'live',
    createdAt: new Date().toISOString(),
  }
}

function createBareMetalAiInferenceCatalogDraft(): ProviderCatalogDraft {
  const rateCard = parseRateCardFromForm(GPU_BLUEPRINT_FORM) ?? DEFAULT_RATE_CARD

  return {
    catalogItemId: BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID,
    templateRefId: BARE_METAL_AI_INFERENCE_TEMPLATE_REF_ID,
    templateName: GPU_BLUEPRINT_FORM.templateName,
    displayName: SECOND_CATALOG_ITEM_DISPLAY_NAME,
    description: CATALOG_ITEM_DESCRIPTIONS_BY_ID[DEMO_CATALOG_ITEM_IDS.bareMetalDenseGpu],
    scope: 'vip-enterprise',
    enterpriseTenantId: DEMO_HARBORLINE_CAPITAL_TENANT_ID,
    rateCard,
    serviceId: 'baremetal',
    instanceTypeId: BARE_METAL_AI_INFERENCE_INSTANCE_TYPE_ID,
    instanceTypeLabel: formatBaremetalInstanceTypeLabel(BARE_METAL_AI_INFERENCE_INSTANCE_TYPE_ID),
    networkPolicy: createAllEditableCatalogNetworkPolicy(),
    status: 'unpublished',
    createdAt: new Date().toISOString(),
  }
}

function createClusterNodeSetsCatalogDraft(): ProviderCatalogDraft {
  return {
    catalogItemId: CLUSTER_NODE_SETS_CATALOG_ITEM_ID,
    templateRefId: CLUSTER_NODE_SETS_TEMPLATE_REF_ID,
    templateName: CLUSTER_NODE_SETS_TEMPLATE_NAME,
    displayName: CLUSTER_NODE_SETS_DISPLAY_NAME,
    description: CATALOG_ITEM_DESCRIPTIONS_BY_ID[DEMO_CATALOG_ITEM_IDS.clusterNodeSets],
    scope: 'global-public',
    rateCard: CLUSTER_NODE_SETS_RATE_CARD,
    serviceId: 'cluster',
    instanceTypeId: 'ocp-small',
    instanceTypeLabel: 'OpenShift small',
    diskImageId: DEFAULT_CLUSTER_CATALOG_VERSION_ID,
    diskImageLabel: formatClusterPlatformLabel(DEFAULT_CLUSTER_CATALOG_VERSION_ID),
    clusterVersionMode: 'locked',
    nodeSetId: DEFAULT_CLUSTER_NODE_SET_ID,
    nodeSetLabel: formatClusterNodeSetLabel(DEFAULT_CLUSTER_NODE_SET_ID),
    hostTypeId: DEFAULT_CLUSTER_HOST_TYPE_ID,
    hostTypeLabel: formatClusterHostTypeLabel(DEFAULT_CLUSTER_HOST_TYPE_ID),
    clusterNodeTopologyMode: 'editable',
    networkPolicy: createAllEditableCatalogNetworkPolicy(),
    status: 'live',
    createdAt: new Date().toISOString(),
  }
}

function hasBareMetalGpuCatalogItem(items: ProviderCatalogDraft[]): boolean {
  return items.some(
    (item) =>
      item.catalogItemId === BARE_METAL_GPU_CATALOG_ITEM_ID ||
      item.catalogItemId === LEGACY_BARE_METAL_GPU_CATALOG_ITEM_ID ||
      item.displayName === DEFAULT_CATALOG_ITEM_DISPLAY_NAME ||
      item.displayName === LEGACY_DEFAULT_CATALOG_ITEM_DISPLAY_NAME,
  )
}

function findBareMetalAiInferenceCatalogItem(
  items: ProviderCatalogDraft[],
): ProviderCatalogDraft | undefined {
  // Match only the demo identity — never by templateRefId alone, or a user-created
  // unpublished draft that reuses the demo template gets rewritten/deduped away.
  return items.find(
    (item) =>
      item.catalogItemId === BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID ||
      item.catalogItemId === LEGACY_BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID ||
      item.displayName === SECOND_CATALOG_ITEM_DISPLAY_NAME ||
      item.displayName === LEGACY_SECOND_CATALOG_ITEM_TITLE_CASE_DISPLAY_NAME ||
      item.displayName === LEGACY_SECOND_CATALOG_ITEM_DISPLAY_NAME,
  )
}

function hasBareMetalAiInferenceCatalogItem(items: ProviderCatalogDraft[]): boolean {
  return Boolean(findBareMetalAiInferenceCatalogItem(items))
}

/** Keep stored demo item title, VIP scope, and networking-off in sync. */
function syncBareMetalAiInferenceCatalogItem(): void {
  const items = getProviderCatalogItems()
  const current = findBareMetalAiInferenceCatalogItem(items)
  if (!current) {
    return
  }

  const needsIdentitySync =
    current.catalogItemId !== BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID ||
    current.templateRefId !== BARE_METAL_AI_INFERENCE_TEMPLATE_REF_ID ||
    current.displayName !== SECOND_CATALOG_ITEM_DISPLAY_NAME ||
    current.scope !== 'vip-enterprise' ||
    current.enterpriseTenantId !== DEMO_HARBORLINE_CAPITAL_TENANT_ID

  if (needsIdentitySync) {
    rewriteProviderCatalogItemIdentity(current.catalogItemId, {
      catalogItemId: BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID,
      templateRefId: BARE_METAL_AI_INFERENCE_TEMPLATE_REF_ID,
      displayName: SECOND_CATALOG_ITEM_DISPLAY_NAME,
      description: current.description ?? '',
      scope: 'vip-enterprise',
      enterpriseTenantId: DEMO_HARBORLINE_CAPITAL_TENANT_ID,
    })
  }

  const synced =
    findBareMetalAiInferenceCatalogItem(getProviderCatalogItems()) ?? current

  // Preserve publish state so detail-page Publish → Launch instance stays user-driven.
  patchBaremetalInstanceTypeIfNeeded(
    BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID,
    BARE_METAL_AI_INFERENCE_INSTANCE_TYPE_ID,
  )

  const denseGpu = synced
  const organizations = getProviderRegisteredOrganizations()

  const harborline = organizations.find(
    (organization) =>
      organization.id === DEMO_HARBORLINE_CAPITAL_ORG_ID ||
      organization.slug === DEMO_HARBORLINE_CAPITAL_SLUG,
  )
  if (
    harborline &&
    (harborline.catalogItemId !== denseGpu.catalogItemId ||
      harborline.catalogDisplayName !== denseGpu.displayName)
  ) {
    updateProviderRegisteredOrganization(harborline.id, {
      catalogItemId: denseGpu.catalogItemId,
      catalogDisplayName: denseGpu.displayName,
    })
  }

  const northSummit = organizations.find(
    (organization) => organization.id === DEMO_NORTH_SUMMIT_BANK_ORG_ID,
  )
  if (
    northSummit &&
    (northSummit.catalogItemId === denseGpu.catalogItemId ||
      northSummit.catalogDisplayName === denseGpu.displayName)
  ) {
    updateProviderRegisteredOrganization(northSummit.id, {
      catalogItemId: null,
      catalogDisplayName: null,
    })
  }
}

function syncBareMetalGpuTrainingCatalogItem(): void {
  const current = getProviderCatalogItems().find(
    (item) =>
      item.catalogItemId === BARE_METAL_GPU_CATALOG_ITEM_ID ||
      item.catalogItemId === LEGACY_BARE_METAL_GPU_CATALOG_ITEM_ID ||
      item.displayName === DEFAULT_CATALOG_ITEM_DISPLAY_NAME ||
      item.displayName === LEGACY_DEFAULT_CATALOG_ITEM_DISPLAY_NAME,
  )
  if (!current) {
    return
  }

  const needsIdentitySync =
    current.catalogItemId !== BARE_METAL_GPU_CATALOG_ITEM_ID ||
    current.templateRefId !== BARE_METAL_GPU_TEMPLATE_REF_ID ||
    current.displayName !== DEFAULT_CATALOG_ITEM_DISPLAY_NAME ||
    current.scope !== 'global-public' ||
    Boolean(current.enterpriseTenantId)

  if (needsIdentitySync) {
    rewriteProviderCatalogItemIdentity(current.catalogItemId, {
      catalogItemId: BARE_METAL_GPU_CATALOG_ITEM_ID,
      templateRefId: BARE_METAL_GPU_TEMPLATE_REF_ID,
      displayName: DEFAULT_CATALOG_ITEM_DISPLAY_NAME,
      description: current.description ?? '',
      scope: 'global-public',
      enterpriseTenantId: null,
    })
  }

  // Preserve the item's current publish state so detail-page publish/unpublish
  // transitions are user-driven during demos.
  patchBaremetalInstanceTypeIfNeeded(
    BARE_METAL_GPU_CATALOG_ITEM_ID,
    BARE_METAL_GPU_TRAINING_INSTANCE_TYPE_ID,
  )

  const synced =
    getProviderCatalogItems().find(
      (item) => item.catalogItemId === BARE_METAL_GPU_CATALOG_ITEM_ID,
    ) ?? current
  if (synced.osImageMode !== 'editable') {
    patchProviderCatalogItem(BARE_METAL_GPU_CATALOG_ITEM_ID, { osImageMode: 'editable' })
  }
}

/**
 * Demo catalog items keep all networking fields unlocked.
 * Catalog creation no longer configures networking — launch chooses freely.
 */
const DEMO_CATALOG_NETWORK_LOCK_PATTERNS: ReadonlyArray<{
  catalogItemId: string
  pattern: CatalogNetworkLockPattern
}> = [
  { catalogItemId: BARE_METAL_GPU_CATALOG_ITEM_ID, pattern: 'all-editable' },
  { catalogItemId: BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID, pattern: 'all-editable' },
  { catalogItemId: CLUSTER_NODE_SETS_CATALOG_ITEM_ID, pattern: 'all-editable' },
]

function applyLockPatternToPolicy(
  current: ReturnType<typeof getCatalogItemNetworkPolicy>,
  pattern: CatalogNetworkLockPattern,
  seed: string,
): ReturnType<typeof getCatalogItemNetworkPolicy> {
  const patterned = createCatalogNetworkPolicyForLockPattern(pattern, seed)
  return {
    enabled: true,
    virtualNetwork: {
      ...current.virtualNetwork,
      locked: patterned.virtualNetwork.locked,
    },
    subnet: {
      ...current.subnet,
      locked: patterned.subnet.locked,
    },
    securityGroup: {
      ...current.securityGroup,
      locked: patterned.securityGroup.locked,
    },
    externalIpPool: {
      ...(current.externalIpPool ?? patterned.externalIpPool),
      locked: patterned.externalIpPool.locked,
    },
  }
}

function syncDemoCatalogNetworkLockPatterns(): void {
  const legacyIdByCurrent: Record<string, string> = {
    [BARE_METAL_GPU_CATALOG_ITEM_ID]: LEGACY_BARE_METAL_GPU_CATALOG_ITEM_ID,
    [BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID]: LEGACY_BARE_METAL_AI_INFERENCE_CATALOG_ITEM_ID,
    [CLUSTER_NODE_SETS_CATALOG_ITEM_ID]: LEGACY_CLUSTER_NODE_SETS_CATALOG_ITEM_ID,
  }

  for (const assignment of DEMO_CATALOG_NETWORK_LOCK_PATTERNS) {
    const current = getProviderCatalogItems().find(
      (item) =>
        item.catalogItemId === assignment.catalogItemId ||
        item.catalogItemId === legacyIdByCurrent[assignment.catalogItemId],
    )
    if (!current) {
      continue
    }

    const networkPolicy = getCatalogItemNetworkPolicy(current)

    if (catalogNetworkPolicyMatchesLockPattern(networkPolicy, assignment.pattern)) {
      continue
    }

    updateProviderCatalogNetworkPolicy(
      current.catalogItemId,
      applyLockPatternToPolicy(networkPolicy, assignment.pattern, assignment.catalogItemId),
    )
  }
}

function hasClusterNodeSetsCatalogItem(items: ProviderCatalogDraft[]): boolean {
  return items.some(
    (item) =>
      item.catalogItemId === CLUSTER_NODE_SETS_CATALOG_ITEM_ID ||
      item.catalogItemId === LEGACY_CLUSTER_NODE_SETS_CATALOG_ITEM_ID ||
      item.displayName === CLUSTER_NODE_SETS_DISPLAY_NAME ||
      item.displayName === LEGACY_CLUSTER_NODE_SETS_DISPLAY_NAME,
  )
}

/** Keep the Cluster demo identity/config in sync without forcing publish state. */
function syncClusterNodeSetsCatalogItem(): void {
  const items = getProviderCatalogItems()
  const current = items.find(
    (item) =>
      item.catalogItemId === CLUSTER_NODE_SETS_CATALOG_ITEM_ID ||
      item.catalogItemId === LEGACY_CLUSTER_NODE_SETS_CATALOG_ITEM_ID ||
      item.displayName === CLUSTER_NODE_SETS_DISPLAY_NAME ||
      item.displayName === LEGACY_CLUSTER_NODE_SETS_DISPLAY_NAME,
  )
  if (!current) {
    return
  }

  if (
    current.catalogItemId !== CLUSTER_NODE_SETS_CATALOG_ITEM_ID ||
    current.templateRefId !== CLUSTER_NODE_SETS_TEMPLATE_REF_ID ||
    current.templateName !== CLUSTER_NODE_SETS_TEMPLATE_NAME ||
    current.displayName !== CLUSTER_NODE_SETS_DISPLAY_NAME
  ) {
    rewriteProviderCatalogItemIdentity(current.catalogItemId, {
      catalogItemId: CLUSTER_NODE_SETS_CATALOG_ITEM_ID,
      templateRefId: CLUSTER_NODE_SETS_TEMPLATE_REF_ID,
      templateName: CLUSTER_NODE_SETS_TEMPLATE_NAME,
      displayName: CLUSTER_NODE_SETS_DISPLAY_NAME,
      description: CATALOG_ITEM_DESCRIPTIONS_BY_ID[DEMO_CATALOG_ITEM_IDS.clusterNodeSets],
    })
  }

  const synced =
    getProviderCatalogItems().find(
      (item) => item.catalogItemId === CLUSTER_NODE_SETS_CATALOG_ITEM_ID,
    ) ?? current

  // Preserve the item's current publish state so detail-page publish/unpublish
  // transitions are user-driven during demos.

  const needsVersion =
    synced.diskImageId !== DEFAULT_CLUSTER_CATALOG_VERSION_ID ||
    synced.diskImageLabel !== formatClusterPlatformLabel(DEFAULT_CLUSTER_CATALOG_VERSION_ID) ||
    synced.instanceTypeId !== 'ocp-small' ||
    synced.instanceTypeLabel !== 'OpenShift small' ||
    synced.rateCard.hourlyRate !== CLUSTER_NODE_SETS_RATE_CARD.hourlyRate ||
    synced.rateCard.monthlyRate !== CLUSTER_NODE_SETS_RATE_CARD.monthlyRate ||
    !synced.diskImageId ||
    !synced.diskImageLabel

  if (needsVersion) {
    patchProviderCatalogItem(synced.catalogItemId, {
      instanceTypeId: 'ocp-small',
      instanceTypeLabel: 'OpenShift small',
      diskImageId: DEFAULT_CLUSTER_CATALOG_VERSION_ID,
      diskImageLabel: formatClusterPlatformLabel(DEFAULT_CLUSTER_CATALOG_VERSION_ID),
      rateCard: { ...CLUSTER_NODE_SETS_RATE_CARD },
    })
  }
}

/** Backfill cluster version + node topology fields on any Cluster catalog item missing them. */
function syncClusterCatalogVersionLabels(): void {
  const items = getProviderCatalogItems()
  for (const item of items) {
    if (item.serviceId !== 'cluster') {
      continue
    }
    const versionId = item.diskImageId?.trim()
    const versionLabel = item.diskImageLabel?.trim()
    if (versionId && versionLabel) {
      const normalized = formatClusterPlatformLabel(versionId)
      if (versionLabel !== normalized) {
        patchProviderCatalogItem(item.catalogItemId, {
          diskImageLabel: normalized,
        })
      }
    } else if (versionLabel && /^Red Hat\s+/i.test(versionLabel)) {
      patchProviderCatalogItem(item.catalogItemId, {
        diskImageLabel: formatClusterPlatformLabel(versionLabel),
      })
    } else if (versionId && !versionLabel) {
      patchProviderCatalogItem(item.catalogItemId, {
        diskImageLabel: formatClusterPlatformLabel(versionId),
      })
    } else if (!versionId && !versionLabel) {
      // No version stored (e.g. interim demo items) — apply catalog default.
      patchProviderCatalogItem(item.catalogItemId, {
        diskImageId: DEFAULT_CLUSTER_CATALOG_VERSION_ID,
        diskImageLabel: formatClusterPlatformLabel(DEFAULT_CLUSTER_CATALOG_VERSION_ID),
      })
    }

    const nodeSetId = item.nodeSetId?.trim() || DEFAULT_CLUSTER_NODE_SET_ID
    const hostTypeId = item.hostTypeId?.trim() || DEFAULT_CLUSTER_HOST_TYPE_ID
    const nodeSetLabel = formatClusterNodeSetLabel(item.nodeSetLabel?.trim() || nodeSetId)
    const hostTypeLabel = formatClusterHostTypeLabel(item.hostTypeLabel?.trim() || hostTypeId)
    // Demo Node Sets offering: topology stays editable so launch can add node sets.
    const desiredTopologyMode =
      item.catalogItemId === CLUSTER_NODE_SETS_CATALOG_ITEM_ID ||
      item.catalogItemId === LEGACY_CLUSTER_NODE_SETS_CATALOG_ITEM_ID
        ? 'editable'
        : (item.clusterNodeTopologyMode ?? 'locked')
    if (
      item.nodeSetId !== nodeSetId ||
      item.nodeSetLabel !== nodeSetLabel ||
      item.hostTypeId !== hostTypeId ||
      item.hostTypeLabel !== hostTypeLabel ||
      item.clusterNodeTopologyMode !== desiredTopologyMode
    ) {
      patchProviderCatalogItem(item.catalogItemId, {
        nodeSetId,
        nodeSetLabel,
        hostTypeId,
        hostTypeLabel,
        clusterNodeTopologyMode: desiredTopologyMode,
      })
    }
  }
}

function isVirtualMachineCatalogItem(item: ProviderCatalogDraft): boolean {
  return (
    item.serviceId === 'virtual-machine' ||
    item.catalogItemId === VM_NETWORK_ATTACHMENTS_CATALOG_ITEM_ID ||
    item.catalogItemId === LEGACY_VM_NETWORK_ATTACHMENTS_CATALOG_ITEM_ID ||
    item.displayName === VM_NETWORK_ATTACHMENTS_DISPLAY_NAME ||
    item.displayName === LEGACY_VM_NETWORK_ATTACHMENTS_DISPLAY_NAME
  )
}

function purgeVirtualMachineCatalogItems(): void {
  for (const item of getProviderCatalogItems()) {
    if (isVirtualMachineCatalogItem(item)) {
      deleteProviderCatalogItem(item.catalogItemId)
    }
  }
}

function ensureDemoBareMetalTemplates(): void {
  upsertProviderSavedTemplate(getDefaultMasterTemplate())
  upsertProviderSavedTemplate(getStandardClusterTemplate())

  const inferenceTemplate =
    DEMO_EXISTING_MASTER_TEMPLATES.find(
      (template) => template.templateRefId === BARE_METAL_AI_INFERENCE_TEMPLATE_REF_ID,
    ) ?? {
      templateRefId: BARE_METAL_AI_INFERENCE_TEMPLATE_REF_ID,
      templateName: GPU_BLUEPRINT_FORM.templateName,
      description: GPU_BLUEPRINT_FORM.description,
      hardwareProfileId: GPU_BLUEPRINT_FORM.hardwareProfileId,
      osImageId: GPU_BLUEPRINT_FORM.osImage,
      suggestedDisplayName: SECOND_CATALOG_ITEM_DISPLAY_NAME,
      rateCard: parseRateCardFromForm(GPU_BLUEPRINT_FORM)!,
    }

  upsertProviderSavedTemplate({
    ...inferenceTemplate,
    templateRefId: BARE_METAL_AI_INFERENCE_TEMPLATE_REF_ID,
  })
}

function syncDemoCatalogItemDescriptions(): void {
  for (const catalogItemId of Object.values(DEMO_CATALOG_ITEM_IDS)) {
    const description = CATALOG_ITEM_DESCRIPTIONS_BY_ID[catalogItemId]
    const item = getProviderCatalogItems().find((entry) => entry.catalogItemId === catalogItemId)
    if (item && item.description !== description) {
      patchProviderCatalogItem(catalogItemId, { description })
    }
  }
}

function ensureModelCatalogItems(): ProviderCatalogDraft[] {
  const currentItems = getProviderCatalogItems()
  const modelDrafts = createModelCatalogDrafts()

  for (const draft of modelDrafts) {
    const existing = currentItems.find((item) => item.catalogItemId === draft.catalogItemId)
    if (!existing) {
      addProviderCatalogItem(draft)
      continue
    }

    patchProviderCatalogItem(draft.catalogItemId, {
      description: draft.description,
      rateCard: draft.rateCard,
      fieldPolicies: draft.fieldPolicies,
      modelChoice: draft.modelChoice,
      modelProperties: draft.modelProperties,
    })
  }

  return getProviderCatalogItems()
}

/** Restores missing model catalog entries without resyncing other catalog items. */
export function ensureProviderModelCatalogItems(): ProviderCatalogDraft[] {
  let currentItems = getProviderCatalogItems()

  for (const draft of createModelCatalogDrafts()) {
    if (!currentItems.some((item) => item.catalogItemId === draft.catalogItemId)) {
      addProviderCatalogItem(draft)
      currentItems = getProviderCatalogItems()
    }
  }

  return currentItems
}

/** Ensures demo catalog offerings exist for finished Provider Admin screens. */
export function ensureProviderCatalogDemoItems(): ProviderCatalogDraft[] {
  ensureDemoBareMetalTemplates()
  // So VIP enterprise labels can resolve Harborline Capital on catalog cards.
  ensureProviderDemoOrganizations()

  let items = getProviderCatalogItems()

  if (!hasBareMetalGpuCatalogItem(items)) {
    addProviderCatalogItem(createDefaultCatalogDraft())
    items = getProviderCatalogItems()
  }
  syncBareMetalGpuTrainingCatalogItem()
  items = getProviderCatalogItems()

  if (!hasBareMetalAiInferenceCatalogItem(items)) {
    addProviderCatalogItem(createBareMetalAiInferenceCatalogDraft())
    items = getProviderCatalogItems()
  }
  syncBareMetalAiInferenceCatalogItem()
  items = getProviderCatalogItems()

  if (!hasClusterNodeSetsCatalogItem(items)) {
    addProviderCatalogItem(createClusterNodeSetsCatalogDraft())
    items = getProviderCatalogItems()
  } else {
    syncClusterNodeSetsCatalogItem()
    items = getProviderCatalogItems()
  }

  syncClusterCatalogVersionLabels()
  items = getProviderCatalogItems()

  items = ensureModelCatalogItems()

  purgeVirtualMachineCatalogItems()
  items = getProviderCatalogItems()

  syncDemoCatalogNetworkLockPatterns()
  syncDemoCatalogItemDescriptions()

  const selectedServices = getProviderSelectedServices()
  const nextServices: ProviderServiceId[] = [
    ...new Set<ProviderServiceId>([
      ...(selectedServices.length > 0 ? selectedServices : DEFAULT_PROVIDER_SERVICE_SELECTION),
      'baremetal',
      'cluster',
      'models',
    ]),
  ]
  const servicesChanged =
    nextServices.length !== selectedServices.length ||
    nextServices.some((serviceId) => !selectedServices.includes(serviceId))
  if (servicesChanged) {
    setProviderSelectedServices(nextServices)
  }

  return getProviderCatalogItems()
}

/** Seeds post-setup Provider Admin state so landing-page prototype links can open finished screens. */
export function ensureProviderPostSetupPrototype(
  navId: ProviderAdminNavId = 'catalog',
): ProviderCatalogDraft {
  setProviderSelectedServices(DEFAULT_PROVIDER_SERVICE_SELECTION)
  setProviderSetupComplete()

  const items = ensureProviderCatalogDemoItems()
  ensureProviderDemoOrganizations()

  setProviderActiveNav(navId)
  return items[0] ?? getProviderCatalogDraft()!
}

export function isProviderAdminNavId(value: string | null): value is ProviderAdminNavId {
  return (
    value === 'overview' ||
    value === 'ai-grid' ||
    value === 'ai-grid-enrollment' ||
    value === 'provider-ai-models' ||
    value === 'provider-ai-observability' ||
    value === 'provider-ai-maas-governance' ||
    value === 'provider-ai-usage' ||
    value === 'provider-ai-model-catalog-settings' ||
    value === 'catalog' ||
    value === 'services-baremetal' ||
    value === 'services-clusters' ||
    value === 'services-models' ||
    value === 'services-virtual-machines' ||
    value === 'genai-asset-endpoints' ||
    value === 'genai-playground' ||
    value === 'genai-api-keys' ||
    value === 'projects-teams' ||
    value === 'infrastructure-data-centers' ||
    value === 'infrastructure-hardware-inventory' ||
    value === 'infrastructure-bmaas-templates' ||
    value === 'networking' ||
    value === 'networking-virtual-networks' ||
    value === 'networking-subnets' ||
    value === 'networking-security-groups' ||
    value === 'networking-external-ip-pools' ||
    value === 'secrets' ||
    value === 'administration-organizations' ||
    value === 'administration-billing' ||
    value === 'administration-rate-cards' ||
    value === 'system'
  )
}
