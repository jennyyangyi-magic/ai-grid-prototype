import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  Content,
  Flex,
  FlexItem,
  FormSelect,
  FormSelectOption,
  Progress,
  ProgressMeasureLocation,
  Tab,
  Tabs,
  TabTitleText,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ProviderAdminWorkspacePageHeader } from '../components/provider-admin/ProviderAdminWorkspacePageHeader'
import {
  formatLargeNumber,
  getModelTimeSeries,
  MOCK_FLEET_HEALTH,
  MOCK_MODELS,
  MOCK_TENANT_USAGE,
} from '../providerAdmin/observabilityMockData'
import { getFleetTimeSeries } from '../vision/fleetTimeSeries'

type TimeRange = '1h' | '6h' | '24h'

const TOOLTIP_STYLE = {
  fontSize: 11,
  padding: '4px 8px',
  background: 'var(--pf-t--global--background--color--primary--default)',
  border: '1px solid var(--pf-t--global--border--color--default)',
}

function StatCard({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className={`observability-stat-card${warn ? ' observability-stat-card--warn' : ''}`}>
      <div className="observability-stat-card__label">{label}</div>
      <div className="observability-stat-card__value">
        {value}
        {unit && <span className="observability-stat-card__unit">{unit}</span>}
      </div>
    </div>
  )
}

function ClusterTab({ range }: { range: TimeRange }) {
  const health = MOCK_FLEET_HEALTH
  const fleet = useMemo(() => getFleetTimeSeries(health.gpuUtilPercent, health.throughputTps), [health.gpuUtilPercent, health.throughputTps])

  const sliceCount = range === '1h' ? 60 : range === '6h' ? 60 : 60
  const gpuData = fleet.gpuUtil.slice(-sliceCount)
  const combinedData = fleet.tokensPerSec.slice(-sliceCount).map((pt, i) => ({
    ts: pt.ts,
    tokensPerSec: pt.value,
    queueDepth: fleet.queueDepth[fleet.queueDepth.length - sliceCount + i]?.value ?? 0,
  }))

  return (
    <div className="observability-dashboard">
      <div className="observability-stat-row">
        <StatCard label="GPU utilization" value={`${health.gpuUtilPercent}`} unit="%" warn={health.gpuUtilPercent > 85} />
        <StatCard label="Throughput" value={formatLargeNumber(health.throughputTps)} unit="tps" />
        <StatCard label="P99 latency" value={`${health.p99LatencyMs}`} unit="ms" warn={health.p99LatencyMs > 200} />
        <StatCard label="Queue depth" value={`${health.queueDepth}`} warn={health.queueDepth >= 50} />
      </div>

      <div className="observability-chart-grid observability-chart-grid--2col">
        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">GPU utilization %</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={gpuData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="obsGpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--pf-t--color--blue--default)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--pf-t--color--blue--default)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, 100]} />
                <XAxis hide dataKey="ts" />
                <ReferenceLine y={90} stroke="var(--pf-t--color--orange--default)" strokeDasharray="4 3" strokeWidth={1} />
                <Area type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} fill="url(#obsGpuGrad)" dot={false} isAnimationActive={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'GPU util']} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Tokens/s + queue depth</div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={combinedData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <YAxis yAxisId="tps" hide />
                <YAxis yAxisId="queue" hide orientation="right" />
                <XAxis hide dataKey="ts" />
                <Bar yAxisId="queue" dataKey="queueDepth" fill="var(--pf-t--color--purple--default)" opacity={0.3} isAnimationActive={false} />
                <Line yAxisId="tps" type="monotone" dataKey="tokensPerSec" stroke="var(--pf-t--color--green--default)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <Card className="observability-metric-card pf-v6-u-mt-md">
        <CardBody>
          <Content component="small" className="pf-v6-u-color-200">
            {health.activeClusters}/{health.totalClusters} clusters active · Source: ACM Thanos
          </Content>
        </CardBody>
      </Card>
    </div>
  )
}

function ModelsTab({ range }: { range: TimeRange }) {
  const [selectedModel, setSelectedModel] = useState<string>(MOCK_MODELS[0])
  const series = useMemo(() => getModelTimeSeries(selectedModel), [selectedModel])
  void range

  const lastTtft = series.ttft[series.ttft.length - 1]?.value ?? 0
  const lastTpot = series.tpot[series.tpot.length - 1]?.value ?? 0
  const lastKv = series.kvCacheUsage[series.kvCacheUsage.length - 1]?.value ?? 0
  const lastReqs = series.currentRequests[series.currentRequests.length - 1]?.value ?? 0

  return (
    <div className="observability-dashboard">
      <FormSelect
        value={selectedModel}
        onChange={(_e, v) => setSelectedModel(v)}
        aria-label="Select model"
        className="pf-v6-u-mb-md"
        style={{ maxWidth: 320 }}
      >
        {MOCK_MODELS.map((m) => (
          <FormSelectOption key={m} value={m} label={m} />
        ))}
      </FormSelect>

      <div className="observability-stat-row">
        <StatCard label="TTFT" value={`${lastTtft.toFixed(0)}`} unit="ms" />
        <StatCard label="TPOT" value={`${lastTpot.toFixed(0)}`} unit="ms" />
        <StatCard label="KV cache" value={`${lastKv.toFixed(0)}`} unit="%" warn={lastKv > 80} />
        <StatCard label="Active requests" value={`${lastReqs.toFixed(0)}`} />
      </div>

      <div className="observability-chart-grid observability-chart-grid--3col">
        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Time to First Token (ms)</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={series.ttft} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <YAxis hide />
                <XAxis hide dataKey="ts" />
                <Line type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)} ms`, 'TTFT']} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Time per Output Token (ms)</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={series.tpot} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <YAxis hide />
                <XAxis hide dataKey="ts" />
                <Line type="monotone" dataKey="value" stroke="var(--pf-t--color--green--default)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)} ms`, 'TPOT']} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">KV Cache Usage (%)</div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={series.kvCacheUsage} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="obsKvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--pf-t--color--orange--default)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--pf-t--color--orange--default)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, 100]} />
                <XAxis hide dataKey="ts" />
                <ReferenceLine y={80} stroke="var(--pf-t--color--red--default)" strokeDasharray="4 3" strokeWidth={1} />
                <Area type="monotone" dataKey="value" stroke="var(--pf-t--color--orange--default)" strokeWidth={1.5} fill="url(#obsKvGrad)" dot={false} isAnimationActive={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'KV cache']} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Current Requests</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={series.currentRequests} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <YAxis hide />
                <XAxis hide dataKey="ts" />
                <Bar dataKey="value" fill="var(--pf-t--color--purple--default)" opacity={0.6} isAnimationActive={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(0)}`, 'Requests']} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Request Count (cumulative)</div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={series.requestCount} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <YAxis hide />
                <XAxis hide dataKey="ts" />
                <Line type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [formatLargeNumber(Number(v)), 'Requests']} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Token Count (prompt + generation)</div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={series.tokenCount} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="obsPromptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--pf-t--color--blue--default)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--pf-t--color--blue--default)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="obsGenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--pf-t--color--green--default)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--pf-t--color--green--default)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <YAxis hide />
                <XAxis hide dataKey="ts" />
                <Area type="monotone" dataKey="prompt" stackId="1" stroke="var(--pf-t--color--blue--default)" strokeWidth={1} fill="url(#obsPromptGrad)" isAnimationActive={false} />
                <Area type="monotone" dataKey="generation" stackId="1" stroke="var(--pf-t--color--green--default)" strokeWidth={1} fill="url(#obsGenGrad)" isAnimationActive={false} />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function UsageTab() {
  const tenantUsage = MOCK_TENANT_USAGE

  const tenantBarData = tenantUsage.map((row) => ({
    name: row.tenantName,
    input: row.inputTokens,
    output: row.outputTokens,
  }))

  return (
    <div className="observability-dashboard">
      <div className="observability-chart-grid observability-chart-grid--2col">
        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Token consumption by tenant</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tenantBarData} margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Bar dataKey="input" stackId="tokens" fill="var(--pf-t--color--blue--default)" opacity={0.7} isAnimationActive={false} name="Input tokens" />
                <Bar dataKey="output" stackId="tokens" fill="var(--pf-t--color--green--default)" opacity={0.7} isAnimationActive={false} name="Output tokens" />
                <RechartsTooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [formatLargeNumber(Number(v)), '']} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Quota utilization</div>
            <div className="pf-v6-u-mt-md">
              {tenantUsage.map((row) => (
                <div key={row.tenantId} className="pf-v6-u-mb-md">
                  <Content component="small" className="pf-v6-u-mb-xs">{row.tenantName}</Content>
                  <Progress
                    value={row.quotaPercent}
                    measureLocation={ProgressMeasureLocation.inside}
                    variant={row.quotaPercent > 80 ? 'warning' : undefined}
                  />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="observability-metric-card pf-v6-u-mt-md">
        <CardBody>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }} className="pf-v6-u-mb-sm">
            <FlexItem>
              <div className="observability-metric-card__title">Usage by tenant</div>
            </FlexItem>
            <FlexItem>
              <Content component="small" className="pf-v6-u-color-200">
                Source: ACM Thanos · rhaig_tenant_id label
              </Content>
            </FlexItem>
          </Flex>
          <Table aria-label="Tenant usage" className="catalog-data-table">
            <Thead>
              <Tr>
                <Th>Tenant</Th>
                <Th>Tenant ID</Th>
                <Th>Models</Th>
                <Th>Input tokens</Th>
                <Th>Output tokens</Th>
                <Th>Cached tokens</Th>
                <Th>Quota used</Th>
              </Tr>
            </Thead>
            <Tbody>
              {tenantUsage.map((row) => (
                <Tr key={row.tenantId}>
                  <Td dataLabel="Tenant">{row.tenantName}</Td>
                  <Td dataLabel="Tenant ID">
                    <code>{row.rhaigTenantId}</code>
                  </Td>
                  <Td dataLabel="Models">{row.modelsConsumed}</Td>
                  <Td dataLabel="Input tokens">{formatLargeNumber(row.inputTokens)}</Td>
                  <Td dataLabel="Output tokens">{formatLargeNumber(row.outputTokens)}</Td>
                  <Td dataLabel="Cached tokens">{formatLargeNumber(row.cachedTokens)}</Td>
                  <Td dataLabel="Quota used">
                    <Progress
                      value={row.quotaPercent}
                      measureLocation={ProgressMeasureLocation.inside}
                      variant={row.quotaPercent > 80 ? 'warning' : undefined}
                      style={{ minWidth: '100px' }}
                    />
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  )
}

export function ProviderAdminObservabilityPage() {
  const [activeTab, setActiveTab] = useState<string | number>('cluster')
  const [range, setRange] = useState<TimeRange>('1h')

  return (
    <div className="provider-admin-workspace-page provider-admin-observability">
      <ProviderAdminWorkspacePageHeader
        title="Observability"
        lede="Fleet health, model inference performance, and tenant usage attribution. Powered by Perses dashboards backed by ACM Thanos."
        action={
          <Flex gap={{ default: 'gapMd' }} alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>
              <ToggleGroup aria-label="Time range" isCompact className="observability-timeframe-selector">
                <ToggleGroupItem text="1h" buttonId="obs-range-1h" isSelected={range === '1h'} onChange={() => setRange('1h')} />
                <ToggleGroupItem text="6h" buttonId="obs-range-6h" isSelected={range === '6h'} onChange={() => setRange('6h')} />
                <ToggleGroupItem text="24h" buttonId="obs-range-24h" isSelected={range === '24h'} onChange={() => setRange('24h')} />
              </ToggleGroup>
            </FlexItem>
            <FlexItem>
              <Button variant="secondary" component="a" href="#" isDisabled>
                Open in Perses
              </Button>
            </FlexItem>
          </Flex>
        }
      />

      <Tabs activeKey={activeTab} onSelect={(_e, k) => setActiveTab(k)} className="pf-v6-u-mb-md">
        <Tab eventKey="cluster" title={<TabTitleText>Cluster</TabTitleText>}>
          <ClusterTab range={range} />
        </Tab>
        <Tab eventKey="models" title={<TabTitleText>Models</TabTitleText>}>
          <ModelsTab range={range} />
        </Tab>
        <Tab eventKey="usage" title={<TabTitleText>Usage</TabTitleText>}>
          <UsageTab />
        </Tab>
      </Tabs>
    </div>
  )
}
