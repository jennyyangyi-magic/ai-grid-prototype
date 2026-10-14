import {
  Label,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core'
import { FormSelect, FormSelectOption } from '@patternfly/react-core'
import type { VisionModelPreset } from '../../../vision/fleetWorld'

type VisionGridFiltersProps = {
  modelFilter?: string
  onModelFilterChange?: (value: string) => void
  availableModels?: VisionModelPreset[]
}

export const VisionGridFilters = ({
  modelFilter = 'all',
  onModelFilterChange,
  availableModels = [],
}: VisionGridFiltersProps) => {
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
      </ToolbarContent>
    </Toolbar>
  )
}
