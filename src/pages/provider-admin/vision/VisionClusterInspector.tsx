import {
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Label,
  Stack,
  StackItem,
  Tab,
  Tabs,
  TabTitleText,
} from '@patternfly/react-core'
import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, YAxis } from 'recharts'
import { ModelsInstanceCard } from '../../../components/catalog/ModelsInstanceCard'
import {
  getVisionSite,
  type VisionCluster,
} from '../../../vision/fleetWorld'
import { modelsOnCluster } from '../../../vision/legacyModelInstanceSeed'
import {
  deriveClusterHealth,
  getClusterTimeSeries,
  type TimeSeriesPoint,
} from '../../../vision/fleetTimeSeries'

type VisionClusterInspectorProps = {
  cluster: VisionCluster | null
}

function KpiSparkline({ data, color, warn }: { data: TimeSeriesPoint[]; color: string; warn?: boolean }) {
  const chartColor = warn ? 'var(--pf-t--color--orange--default)' : color
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={chartColor} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={chartColor}
          strokeWidth={1.5}
          fill={`url(#spark-${color})`}
          dot={false}
          isAnimationActive={false}
        />
        <RechartsTooltip
          contentStyle={{ fontSize: 11, padding: '2px 6px', background: 'var(--pf-t--global--background--color--primary--default)', border: '1px solid var(--pf-t--global--border--color--default)' }}
          labelFormatter={() => ''}
          formatter={(v) => [Number(v).toFixed(1), '']}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function KpiTile({ label, value, unit, sparkData, color, warn, threshold }: {
  label: string
  value: number
  unit: string
  sparkData: TimeSeriesPoint[]
  color: string
  warn?: boolean
  threshold?: string
}) {
  return (
    <div className="vision-kpi-tile">
      <div className="vision-kpi-tile__header">
        <span className="vision-kpi-tile__label">{label}</span>
        {warn && <Label isCompact color="orange" variant="outline">warn</Label>}
      </div>
      <div className="vision-kpi-tile__value">
        {value.toFixed(value < 10 ? 1 : 0)}<span className="vision-kpi-tile__unit">{unit}</span>
      </div>
      {threshold && <div className="vision-kpi-tile__threshold">{threshold}</div>}
      <KpiSparkline data={sparkData} color={color} warn={warn} />
    </div>
  )
}

export const VisionClusterInspector = ({ cluster }: VisionClusterInspectorProps) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'models'>('overview')

  if (!cluster) {
    return (
      <Stack hasGutter>
        <StackItem>
          <Content component="p">
            Select a cluster on the map to view its details.
          </Content>
        </StackItem>
      </Stack>
    )
  }

  const site = getVisionSite(cluster.siteId)
  const nestedModels = modelsOnCluster(cluster.id)

  const tokensPerSec = cluster.gpuCount * cluster.gpuUtilPercent * 0.08
  const series = getClusterTimeSeries(cluster.id, cluster.gpuUtilPercent, tokensPerSec)
  const currentQueue = series.queueDepth[series.queueDepth.length - 1]?.value ?? 0
  const currentReqSec = series.requestsPerSec[series.requestsPerSec.length - 1]?.value ?? 0
  const healthDetail = deriveClusterHealth(
    cluster.gpuUtilPercent,
    currentQueue,
    180,
    cluster.health === 'available' ? nestedModels.length || 1 : 0,
  )

  const enrollmentColor =
    cluster.enrollmentStatus === 'active'
      ? 'green'
      : cluster.enrollmentStatus === 'frozen'
        ? 'orange'
        : 'blue'

  const healthColor = healthDetail.level === 'green' ? 'green' : healthDetail.level === 'yellow' ? 'orange' : 'red'

  return (
    <Stack hasGutter>
      <StackItem>
        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Label color={healthColor} isCompact>
              {healthDetail.level === 'green' ? 'Healthy' : healthDetail.level === 'yellow' ? 'Warning' : 'Critical'}
            </Label>
          </FlexItem>
          <FlexItem>
            <Label color={enrollmentColor} isCompact variant="outline">
              {cluster.enrollmentStatus}
            </Label>
          </FlexItem>
          <FlexItem>
            <Content component="small">
              {cluster.nodesReady}/{cluster.nodeCount} nodes ready
            </Content>
          </FlexItem>
        </Flex>
      </StackItem>

      {healthDetail.reasons.length > 0 && (
        <StackItem>
          <Stack hasGutter={false}>
            {healthDetail.reasons.map((reason, i) => (
              <StackItem key={i}>
                <Content component="small" className="pf-v6-u-color-200">
                  ⚠ {reason.message}
                </Content>
              </StackItem>
            ))}
          </Stack>
        </StackItem>
      )}

      <StackItem>
        <Tabs
          activeKey={activeTab}
          onSelect={(_e, key) => setActiveTab(key as 'overview' | 'models')}
          aria-label="Cluster detail tabs"
          isFilled
        >
          <Tab eventKey="overview" title={<TabTitleText>Overview</TabTitleText>}>
            <div className="vision-kpi-grid pf-v6-u-mt-md">
              <KpiTile
                label="GPU utilization"
                value={cluster.gpuUtilPercent}
                unit="%"
                sparkData={series.gpuUtil}
                color="var(--pf-t--color--blue--default)"
                warn={cluster.gpuUtilPercent >= 90}
                threshold="warn at 90%"
              />
              <KpiTile
                label="Queue depth"
                value={currentQueue}
                unit=""
                sparkData={series.queueDepth}
                color="var(--pf-t--color--purple--default)"
                warn={currentQueue >= 50}
                threshold="warn at 50"
              />
              <KpiTile
                label="Requests/sec"
                value={currentReqSec}
                unit="/s"
                sparkData={series.requestsPerSec}
                color="var(--pf-t--color--teal--default)"
              />
              <KpiTile
                label="Tokens/sec"
                value={tokensPerSec}
                unit="/s"
                sparkData={series.tokensPerSec}
                color="var(--pf-t--color--green--default)"
              />
            </div>

            <DescriptionList isCompact aria-label={`${cluster.name} details`} className="pf-v6-u-mt-md">
              <DescriptionListGroup>
                <DescriptionListTerm>Site</DescriptionListTerm>
                <DescriptionListDescription>
                  {site.label} · {site.regionLabel}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>Platform</DescriptionListTerm>
                <DescriptionListDescription>
                  {cluster.platform} · {cluster.region}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>OpenShift</DescriptionListTerm>
                <DescriptionListDescription>{cluster.openshiftVersion}</DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>GPUs</DescriptionListTerm>
                <DescriptionListDescription>
                  {cluster.gpuCount}× {cluster.gpuType} · {cluster.gpuUtilPercent}% utilized
                </DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
          </Tab>

          <Tab eventKey="models" title={<TabTitleText>Models ({nestedModels.length})</TabTitleText>}>
            <Stack hasGutter className="pf-v6-u-mt-md">
              {nestedModels.length === 0 ? (
                <StackItem>
                  <Content component="p">No model instances provisioned on this cluster.</Content>
                </StackItem>
              ) : (
                nestedModels.map((item) => (
                  <StackItem key={item.id}>
                    <ModelsInstanceCard
                      item={item}
                      variant="compact"
                      parent="cluster"
                      idPrefix="vision-cluster-model"
                    />
                  </StackItem>
                ))
              )}
            </Stack>
          </Tab>
        </Tabs>
      </StackItem>
    </Stack>
  )
}
