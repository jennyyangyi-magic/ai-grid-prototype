import { useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelContent,
  Divider,
  Stack,
  StackItem,
} from '@patternfly/react-core'
import type { ProviderCatalogDraft } from '../../../providerSetup/storage'
import { getVisionScenarioSeed } from '../../../vision/fleetScenarios'
import {
  clustersForPreset,
  createClusterFromOffering,
  createDeploymentOnCluster,
  createInitialClusters,
  createInitialDeployments,
  createInitialPaths,
  ensureServingPath,
  gatewaysForOrgFilter,
  getVisionOffering,
  getVisionPreset,
  summarizeFleet,
  visibleOffPlatformModels,
  type VisionCluster,
  type VisionDeployment,
  type VisionGatewayId,
  type VisionServingPath,
  type VisionSiteId,
  VISION_MODEL_PRESETS,
} from '../../../vision/fleetWorld'
import { externalModelsForOrg } from '../../../vision/externalModelSeed'
import { groupModelInstancesByModelId, servicesModelsForOrg } from '../../../vision/legacyModelInstanceSeed'
import {
  relatedClusterIdsForSelection,
  seedVisionDrawerSelection,
  SERVICES_OBJECT_TYPES,
  toggleVisionObjectType,
  visionSelectionsEqual,
  type VisionDrawerSelection,
  type VisionDrawerTab,
  type VisionGridObjectType,
} from '../../../vision/visionDrawer'
import { VisionAddClusterModal } from './VisionAddClusterModal'
import { VisionFleetMap } from './VisionFleetMap'
import { VisionFleetSummary } from './VisionFleetSummary'
import { VisionGridFilters } from './VisionGridFilters'
import { VisionGridPanel } from './VisionGridPanel'
import { VisionAttentionStrip } from './VisionAttentionStrip'
import { VisionPlaceModelModal } from './VisionPlaceModelModal'

type VisionModelFleetPageProps = {
  catalogItems: ProviderCatalogDraft[]
  onOpenCatalogPreset: (catalogItemId: string) => void
}

export const VisionModelFleetPage = ({
  catalogItems,
  onOpenCatalogPreset,
}: VisionModelFleetPageProps) => {
  const [searchParams] = useSearchParams()
  const seed = getVisionScenarioSeed(searchParams)
  const [clusters, setClusters] = useState<VisionCluster[]>(() =>
    seed.emptyGrid ? [] : createInitialClusters(),
  )
  const [deployments, setDeployments] = useState<VisionDeployment[]>(() =>
    seed.emptyGrid ? [] : createInitialDeployments(),
  )
  const [paths, setPaths] = useState<VisionServingPath[]>(() =>
    seed.emptyGrid ? [] : createInitialPaths(),
  )
  const [highlight, setHighlight] = useState<VisionDrawerSelection>(() =>
    seedVisionDrawerSelection(seed),
  )
  const [detail, setDetail] = useState<VisionDrawerSelection>(() =>
    seedVisionDrawerSelection(seed),
  )
  const [drawerTab, setDrawerTab] = useState<VisionDrawerTab>('services')
  const [objectTypes, setObjectTypes] = useState<VisionGridObjectType[]>(() => [
    ...SERVICES_OBJECT_TYPES,
  ])
  const [listSearch, setListSearch] = useState('')
  const [placePresetId, setPlacePresetId] = useState<string | null>(null)
  const [addOfferingId, setAddOfferingId] = useState<string | null>(null)
  const [modelFilter, setModelFilter] = useState('all')

  const orgFilteredClusters = useMemo(
    () => clusters,
    [clusters],
  )
  const visibleClusters = useMemo(() => {
    if (modelFilter === 'all') return orgFilteredClusters
    const clusterIdsWithModel = new Set(
      deployments
        .filter((d) => d.presetId === modelFilter)
        .map((d) => d.clusterId),
    )
    return orgFilteredClusters.filter((c) => clusterIdsWithModel.has(c.id))
  }, [orgFilteredClusters, deployments, modelFilter])
  const visibleDeployments = useMemo(
    () => deployments,
    [deployments],
  )
  const visibleCatalogItems = useMemo(
    () => catalogItems,
    [catalogItems],
  )
  const visibleGateways = useMemo(() => gatewaysForOrgFilter('all'), [])
  const visibleOffPlatform = useMemo(
    () => visibleOffPlatformModels('all'),
    [],
  )
  const summary = useMemo(() => {
    const fleet = summarizeFleet(visibleClusters, visibleDeployments, visibleOffPlatform)
    const groupedModels = groupModelInstancesByModelId(servicesModelsForOrg('all')).length
    const externalModels = externalModelsForOrg('all').length
    return {
      ...fleet,
      activeModels: groupedModels + externalModels,
    }
  }, [visibleClusters, visibleDeployments, visibleOffPlatform])
  const selectedCluster =
    detail.kind === 'cluster'
      ? (visibleClusters.find((cluster) => cluster.id === detail.clusterId) ??
        clusters.find((cluster) => cluster.id === detail.clusterId) ??
        null)
      : null
  const selectedGateway =
    detail.kind === 'gateway'
      ? (visibleGateways.find((gateway) => gateway.id === detail.gatewayId) ?? null)
      : null
  const selectedOffPlatform =
    detail.kind === 'off-platform-model'
      ? (visibleOffPlatform.find((model) => model.id === detail.modelId) ?? null)
      : null
  const relatedClusterIds = relatedClusterIdsForSelection(
    highlight,
    visibleClusters,
    visibleDeployments,
    visibleCatalogItems,
  )
  const selectedDeployment =
    highlight.kind === 'deployment'
      ? (visibleDeployments.find((entry) => entry.id === highlight.deploymentId) ?? null)
      : null
  const selectedClusterId =
    highlight.kind === 'cluster'
      ? highlight.clusterId
      : (selectedDeployment?.clusterId ?? null)
  const highlightedClusterIds =
    highlight.kind === 'cluster' || highlight.kind === 'deployment' ? [] : relatedClusterIds
  const isolateRelatedPins =
    relatedClusterIds.length > 0 && relatedClusterIds.length < visibleClusters.length
  const placePreset = placePresetId ? (getVisionPreset(placePresetId) ?? null) : null
  const addOffering = addOfferingId ? (getVisionOffering(addOfferingId) ?? null) : null
  const initiallySelectedForPlace = placePresetId
    ? clustersForPreset(visibleDeployments, placePresetId).filter((clusterId) =>
        visibleClusters.some((cluster) => cluster.id === clusterId && cluster.health === 'available'),
      )
    : []

  const toggleHighlight = (next: VisionDrawerSelection) => {
    setHighlight((current) => (visionSelectionsEqual(current, next) ? { kind: 'none' } : next))
  }

  const openDetails = (next: VisionDrawerSelection, tab?: VisionDrawerTab) => {
    setHighlight(next)
    setDetail(next)
    if (tab) {
      setDrawerTab(tab)
    }
  }

  const showServicesType = (type: VisionGridObjectType) => {
    setDrawerTab('services')
    setDetail({ kind: 'none' })
    setObjectTypes([type])
    setListSearch('')
  }

  const clearDetail = () => {
    setDetail({ kind: 'none' })
  }

  const placeOnClusters = (presetId: string, clusterIds: string[]) => {
    const preset = getVisionPreset(presetId)
    if (!preset) {
      return
    }

    let nextDeployments = deployments
    clusterIds.forEach((clusterId) => {
      const cluster = clusters.find((entry) => entry.id === clusterId)
      if (!cluster || cluster.health !== 'available') {
        return
      }
      const exists = nextDeployments.some(
        (deployment) => deployment.presetId === presetId && deployment.clusterId === clusterId,
      )
      if (!exists) {
        nextDeployments = [...nextDeployments, createDeploymentOnCluster(preset, cluster)]
      }
    })

    let nextPaths = paths
    clusterIds.forEach((clusterId) => {
      nextPaths = ensureServingPath(nextPaths, clusters, nextDeployments, presetId, clusterId)
    })

    setDeployments(nextDeployments)
    setPaths(nextPaths)
    setHighlight({ kind: 'preset', presetId })
    setDetail({ kind: 'preset', presetId })
    setPlacePresetId(null)
  }

  const handlePinCluster = (clusterId: string) => {
    const next: VisionDrawerSelection = { kind: 'cluster', clusterId }
    if (detail.kind === 'cluster' && detail.clusterId === clusterId) {
      setDetail({ kind: 'none' })
      setHighlight({ kind: 'none' })
      setDrawerTab('services')
      return
    }
    openDetails(next, 'services')
  }

  const handleAddCluster = (siteId: VisionSiteId) => {
    const offering = addOfferingId ? getVisionOffering(addOfferingId) : undefined
    if (!offering) {
      return
    }

    const allowedGateways = gatewaysForOrgFilter('all')
    const gatewayId: VisionGatewayId = allowedGateways[0]?.id ?? 'nsb-retail'

    const created = createClusterFromOffering(offering, siteId, 'nsb', gatewayId, clusters)
    setClusters((current) => [...current, created])
    openDetails({ kind: 'cluster', clusterId: created.id }, 'services')
    setAddOfferingId(null)
  }

  return (
    <div className="ai-grid-future-vision">
      <VisionGridFilters
        modelFilter={modelFilter}
        onModelFilterChange={setModelFilter}
        availableModels={VISION_MODEL_PRESETS}
      />
      <Divider inset={{ default: 'insetNone' }} />
      <div className="ai-grid-future-vision__fleet" aria-label="AI Grid map and drawer">
        <Drawer
          isExpanded
          isInline
          isStatic
          className="pf-v6-u-h-100 pf-v6-u-min-height"
          id="vision-grid-layout"
        >
          <DrawerContent
            className="pf-v6-u-h-100 pf-v6-u-min-height"
            panelContent={
              <DrawerPanelContent
                widths={{ default: 'width_33' }}
                id="vision-grid-drawer"
                style={
                  {
                    '--pf-v6-c-drawer__panel--MaxHeight': '100%',
                    overflow: 'hidden',
                  } as CSSProperties
                }
              >
                <VisionGridPanel
                  tab={drawerTab}
                  selection={detail}
                  highlight={highlight}
                  objectTypes={objectTypes}
                  onObjectTypeToggle={(type, isSelected) => {
                    setObjectTypes((current) => toggleVisionObjectType(current, type, isSelected))
                  }}
                  search={listSearch}
                  onSearchChange={setListSearch}
                  onClearSelection={clearDetail}
                  catalogItems={visibleCatalogItems}
                  selectedCluster={selectedCluster}
                  selectedGateway={selectedGateway}
                  selectedOffPlatform={selectedOffPlatform}
                  deployments={visibleDeployments}
                  clusters={visibleClusters}
                  gateways={visibleGateways}
                  offPlatformModels={visibleOffPlatform}
                  onHighlightPreset={(presetId) => toggleHighlight({ kind: 'preset', presetId })}
                  onHighlightCatalogItem={(catalogItemId) =>
                    toggleHighlight({ kind: 'catalog-item', catalogItemId })
                  }
                  onHighlightCluster={(clusterId) =>
                    toggleHighlight({ kind: 'cluster', clusterId })
                  }
                  onHighlightDeployment={(deploymentId) =>
                    toggleHighlight({ kind: 'deployment', deploymentId })
                  }
                  onHighlightGateway={(gatewayId) =>
                    toggleHighlight({ kind: 'gateway', gatewayId })
                  }
                  onHighlightOffPlatform={(modelId) =>
                    toggleHighlight({ kind: 'off-platform-model', modelId })
                  }
                  onViewPreset={(presetId) => openDetails({ kind: 'preset', presetId })}
                  onViewCatalogItem={(catalogItemId) =>
                    openDetails({ kind: 'catalog-item', catalogItemId })
                  }
                  onViewCluster={(clusterId) =>
                    openDetails({ kind: 'cluster', clusterId }, 'services')
                  }
                  onViewDeployment={(deploymentId) =>
                    openDetails({ kind: 'deployment', deploymentId }, 'services')
                  }
                  onViewGateway={(gatewayId) =>
                    openDetails({ kind: 'gateway', gatewayId }, 'services')
                  }
                  onViewOffPlatform={(modelId) =>
                    openDetails({ kind: 'off-platform-model', modelId }, 'services')
                  }
                  onViewModelGroup={(modelId) =>
                    openDetails({ kind: 'model-group', modelId }, 'services')
                  }
                  onViewExternalModelGroup={(name) =>
                    openDetails({ kind: 'external-model-group', name }, 'services')
                  }
                  onPlacePreset={setPlacePresetId}
                  onAddOffering={setAddOfferingId}
                  onOpenCatalogItem={onOpenCatalogPreset}
                />
              </DrawerPanelContent>
            }
          >
            <DrawerContentBody className="pf-v6-u-h-100 pf-v6-u-min-height">
              <Stack className="pf-v6-u-h-100">
                <StackItem isFilled className="pf-v6-u-min-height" style={{ position: 'relative' }}>
                  <VisionAttentionStrip
                    clusters={visibleClusters}
                    onSelectCluster={handlePinCluster}
                  />
                  <VisionFleetMap
                    clusters={visibleClusters}
                    selectedClusterId={selectedClusterId}
                    highlightedClusterIds={highlightedClusterIds}
                    isolateRelatedPins={isolateRelatedPins}
                    onSelectCluster={handlePinCluster}
                  />
                </StackItem>
                <StackItem>
                  <Divider />
                  <VisionFleetSummary
                    summary={summary}
                    onActiveModelsClick={() => showServicesType('models')}
                    onActiveClustersClick={() => showServicesType('clusters')}
                  />
                </StackItem>
              </Stack>
            </DrawerContentBody>
          </DrawerContent>
      </Drawer>
      </div>

      <VisionPlaceModelModal
        key={placePresetId ?? 'place-closed'}
        isOpen={Boolean(placePreset)}
        preset={placePreset}
        clusters={visibleClusters}
        initiallySelectedClusterIds={initiallySelectedForPlace}
        onClose={() => setPlacePresetId(null)}
        onPlace={(clusterIds) => {
          if (placePresetId) {
            placeOnClusters(placePresetId, clusterIds)
          }
        }}
      />
      <VisionAddClusterModal
        key={addOfferingId ?? 'add-closed'}
        isOpen={Boolean(addOffering)}
        offering={addOffering}
        onClose={() => setAddOfferingId(null)}
        onAdd={handleAddCluster}
      />
    </div>
  )
}
