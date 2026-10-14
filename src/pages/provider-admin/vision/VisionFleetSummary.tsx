import { useMemo, useState } from 'react'
import {
  Button,
  Flex,
  FlexItem,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core'
import {
  Area,
  AreaChart,
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { VisionFleetSummary as VisionFleetSummaryData } from '../../../vision/fleetWorld'
import {
  buildFleetSummaryTiles,
  getFleetTimeSeries,
  type FleetSummaryTile,
} from '../../../vision/fleetTimeSeries'

type VisionFleetSummaryProps = {
  summary: VisionFleetSummaryData
  onActiveModelsClick: () => void
  onActiveClustersClick: () => void
}

function SummaryTile({ tile, onClick }: { tile: FleetSummaryTile; onClick?: () => void }) {
  return (
    <div className={`vision-summary-tile${tile.warn ? ' vision-summary-tile--warn' : ''}`}>
      <div className="vision-summary-tile__label">{tile.label}</div>
      <div className="vision-summary-tile__value">
        {onClick ? (
          <Button variant="link" isInline onClick={onClick} className="vision-summary-tile__link">
            {tile.value}
          </Button>
        ) : (
          tile.value
        )}
        {tile.delta && (
          <span className={`vision-summary-tile__delta vision-summary-tile__delta--${tile.deltaDirection}`}>
            {tile.delta}
          </span>
        )}
      </div>
      {tile.sub && <div className="vision-summary-tile__sub">{tile.sub}</div>}
    </div>
  )
}

type ChartRange = '1h' | '6h' | '24h'

function FleetCharts({ gpuUtil, tokensPerSec }: { gpuUtil: number; tokensPerSec: number }) {
  const [range, setRange] = useState<ChartRange>('1h')
  const fleet = useMemo(() => getFleetTimeSeries(gpuUtil, tokensPerSec), [gpuUtil, tokensPerSec])

  const sliceCount = range === '1h' ? 60 : range === '6h' ? 60 : 60
  const gpuData = fleet.gpuUtil.slice(-sliceCount)
  const combinedData = fleet.tokensPerSec.slice(-sliceCount).map((pt, i) => ({
    ts: pt.ts,
    tokensPerSec: pt.value,
    queueDepth: fleet.queueDepth[fleet.queueDepth.length - sliceCount + i]?.value ?? 0,
  }))

  const tooltipStyle = {
    fontSize: 11,
    padding: '4px 8px',
    background: 'var(--pf-t--global--background--color--primary--default)',
    border: '1px solid var(--pf-t--global--border--color--default)',
  }

  return (
    <div className="vision-fleet-charts">
      <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} alignItems={{ default: 'alignItemsCenter' }} className="pf-v6-u-mb-sm">
        <FlexItem>
          <span className="vision-fleet-charts__title">Fleet metrics</span>
        </FlexItem>
        <FlexItem>
          <ToggleGroup aria-label="Chart range" isCompact>
            <ToggleGroupItem text="1h" buttonId="range-1h" isSelected={range === '1h'} onChange={() => setRange('1h')} />
            <ToggleGroupItem text="6h" buttonId="range-6h" isSelected={range === '6h'} onChange={() => setRange('6h')} />
            <ToggleGroupItem text="24h" buttonId="range-24h" isSelected={range === '24h'} onChange={() => setRange('24h')} />
          </ToggleGroup>
        </FlexItem>
      </Flex>
      <div className="vision-fleet-charts__row">
        <div className="vision-fleet-charts__chart">
          <div className="vision-fleet-charts__chart-label">GPU utilization %</div>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={gpuData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--pf-t--color--blue--default)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--pf-t--color--blue--default)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <YAxis hide domain={[0, 100]} />
              <XAxis hide dataKey="ts" />
              <ReferenceLine y={90} stroke="var(--pf-t--color--orange--default)" strokeDasharray="4 3" strokeWidth={1} />
              <Area type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} fill="url(#gpuGrad)" dot={false} isAnimationActive={false} />
              <RechartsTooltip contentStyle={tooltipStyle} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'GPU util']} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="vision-fleet-charts__chart">
          <div className="vision-fleet-charts__chart-label">Tokens/s + queue depth</div>
          <ResponsiveContainer width="100%" height={80}>
            <ComposedChart data={combinedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <YAxis yAxisId="tps" hide />
              <YAxis yAxisId="queue" hide orientation="right" />
              <XAxis hide dataKey="ts" />
              <Bar yAxisId="queue" dataKey="queueDepth" fill="var(--pf-t--color--purple--default)" opacity={0.3} isAnimationActive={false} />
              <Line yAxisId="tps" type="monotone" dataKey="tokensPerSec" stroke="var(--pf-t--color--green--default)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <RechartsTooltip contentStyle={tooltipStyle} labelFormatter={() => ''} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

export const VisionFleetSummary = ({
  summary,
  onActiveModelsClick,
  onActiveClustersClick,
}: VisionFleetSummaryProps) => {
  const requestsPerMin = Math.round(summary.tokensPerSec * 2.4)
  const queueDepth = Math.round(summary.gpuUtilPercent > 80 ? 35 : 8)
  const totalClusters = summary.activeClusters + 1
  const greenSites = summary.activeClusters > 2 ? summary.activeClusters - 1 : summary.activeClusters
  const yellowSites = summary.activeClusters > 2 ? 1 : 0
  const redSites = totalClusters - summary.activeClusters

  const tiles = useMemo(
    () =>
      buildFleetSummaryTiles(
        summary.totalGpus,
        summary.gpuUtilPercent,
        summary.tokensPerSec,
        summary.activeModels,
        summary.activeClusters,
        totalClusters,
        requestsPerMin,
        queueDepth,
        greenSites,
        yellowSites,
        redSites,
      ),
    [summary, totalClusters, requestsPerMin, queueDepth, greenSites, yellowSites, redSites],
  )

  return (
    <div className="vision-summary-strip" aria-label="Fleet summary">
      <div className="vision-summary-strip__tiles">
        {tiles.map((tile) => (
          <SummaryTile
            key={tile.label}
            tile={tile}
            onClick={
              tile.label === 'Models'
                ? onActiveModelsClick
                : tile.label === 'Clusters'
                  ? onActiveClustersClick
                  : undefined
            }
          />
        ))}
      </div>
      <div className="vision-summary-strip__charts">
        <FleetCharts gpuUtil={summary.gpuUtilPercent} tokensPerSec={summary.tokensPerSec} />
      </div>
    </div>
  )
}
