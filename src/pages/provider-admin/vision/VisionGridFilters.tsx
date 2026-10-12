import { useLayoutEffect, useRef } from 'react'
import {
  ToggleGroup,
  ToggleGroupItem,
  Label,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
  Tooltip,
} from '@patternfly/react-core'
import { FormSelect, FormSelectOption } from '@patternfly/react-core'
import type { VisionOrgId, VisionModelPreset } from '../../../vision/fleetWorld'
import type { VisionDrawerTab } from '../../../vision/visionDrawer'
import VisionOrgSelect from '../../../vision/VisionOrgSelect'

type VisionGridFiltersProps = {
  orgFilter: VisionOrgId
  view: VisionDrawerTab
  onOrgChange: (value: VisionOrgId) => void
  onViewChange: (view: VisionDrawerTab) => void
  showTenantFilter?: boolean
  modelFilter?: string
  onModelFilterChange?: (value: string) => void
  availableModels?: VisionModelPreset[]
}

export const VisionGridFilters = ({
  orgFilter,
  view,
  onOrgChange,
  onViewChange,
  showTenantFilter = true,
  modelFilter = 'all',
  onModelFilterChange,
  availableModels = [],
}: VisionGridFiltersProps) => {
  const catalogTriggerRef = useRef<HTMLElement>(null)
  const servicesTriggerRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    catalogTriggerRef.current = document.getElementById('vision-view-catalog')
    servicesTriggerRef.current = document.getElementById('vision-view-services')
  }, [])

  return (
    <Toolbar id="vision-grid-toolbar">
      <ToolbarContent>
        <ToolbarGroup
          variant="filter-group"
          alignItems="baseline"
          columnGap={{ default: 'columnGapSm' }}
        >
          <ToolbarItem>
            <Label
              color="grey"
              className="tenant-genai-page__kicker pf-v6-u-mb-0"
              id="vision-grid-ai-label"
            >
              AI
            </Label>
          </ToolbarItem>
          {showTenantFilter ? (
            <ToolbarItem>
              <VisionOrgSelect
                id="vision-filter-org"
                value={orgFilter}
                onChange={onOrgChange}
                menuToggle
              />
            </ToolbarItem>
          ) : null}
          {onModelFilterChange && availableModels.length > 0 ? (
            <ToolbarItem>
              <FormSelect
                id="vision-filter-model"
                value={modelFilter}
                onChange={(_event, value) => onModelFilterChange(value)}
                aria-label="Filter by model"
              >
                <FormSelectOption value="all" label="All models" />
                {availableModels.map((model) => (
                  <FormSelectOption
                    key={model.id}
                    value={model.id}
                    label={model.displayName}
                  />
                ))}
              </FormSelect>
            </ToolbarItem>
          ) : null}
        </ToolbarGroup>
        <ToolbarGroup align={{ default: 'alignEnd' }} variant="action-group">
          <ToolbarItem>
            <Tooltip
              content="Browse available offerings in the catalog to launch."
              triggerRef={catalogTriggerRef}
              position="bottom"
              enableFlip={false}
              maxWidth="calc(8ch + 3rem)"
              className="vision-grid-view-tooltip"
            />
            <Tooltip
              content="Monitor and manage services across the grid."
              triggerRef={servicesTriggerRef}
              position="bottom"
              enableFlip={false}
              maxWidth="calc(8ch + 3rem)"
              className="vision-grid-view-tooltip"
            />
            <ToggleGroup aria-label="Catalog or services" id="vision-view-toggle">
              <ToggleGroupItem
                text="Catalog"
                buttonId="vision-view-catalog"
                isSelected={view === 'catalog'}
                onChange={() => onViewChange('catalog')}
              />
              <ToggleGroupItem
                text="Services"
                buttonId="vision-view-services"
                isSelected={view === 'services'}
                onChange={() => onViewChange('services')}
              />
            </ToggleGroup>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  )
}
