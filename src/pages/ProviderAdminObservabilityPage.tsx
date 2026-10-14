import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  Content,
  ExpandableSection,
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
      <ExpandableSection toggleText="Overview" isExpanded className="pf-v6-u-mb-md">
        <div className="observability-stat-row">
          <StatCard label="System health" value="100" unit="%" />
          <StatCard label="Deployed models" value={`${health.deployedModels}`} />
          <StatCard label="GPU utilization" value={`${health.gpuUtilPercent}`} unit="%" warn={health.gpuUtilPercent > 85} />
          <StatCard label="Request success rate" value="100.0" unit="%" />
        </div>
      </ExpandableSection>

      <ExpandableSection toggleText="Cluster resource overview" isExpanded className="pf-v6-u-mb-md">
        <div className="observability-chart-grid observability-chart-grid--2col">
          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">GPU utilization</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={gpuData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="obsGpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--pf-t--color--blue--default)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--pf-t--color--blue--default)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 100]} width={40} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <ReferenceLine y={90} stroke="var(--pf-t--color--orange--default)" strokeDasharray="4 3" strokeWidth={1} />
                  <Area type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} fill="url(#obsGpuGrad)" dot={false} isAnimationActive={false} />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'GPU util']} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">Memory allocated</div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={combinedData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="obsMemGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--pf-t--color--green--default)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--pf-t--color--green--default)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 20]} width={40} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <Area type="monotone" dataKey="tokensPerSec" stroke="var(--pf-t--color--green--default)" strokeWidth={1.5} fill="url(#obsMemGrad)" dot={false} isAnimationActive={false} />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Memory']} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      </ExpandableSection>

      <ExpandableSection toggleText="Project resource usage" isExpanded className="pf-v6-u-mb-md">
        <div className="observability-chart-grid observability-chart-grid--3col">
          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">GPU utilization</div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={gpuData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 60]} width={35} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <Area type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} fill="var(--pf-t--color--blue--default)" fillOpacity={0.6} dot={false} isAnimationActive={false} />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'GPU util']} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">CPU utilization</div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={combinedData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 5]} width={35} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <Area type="monotone" dataKey="queueDepth" stroke="var(--pf-t--color--orange--default)" strokeWidth={1.5} fill="var(--pf-t--color--orange--default)" fillOpacity={0.5} dot={false} isAnimationActive={false} />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'CPU']} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">Memory allocated</div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={combinedData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0, 15]} width={35} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <Area type="monotone" dataKey="tokensPerSec" stroke="var(--pf-t--color--green--default)" strokeWidth={1.5} fill="var(--pf-t--color--green--default)" fillOpacity={0.4} dot={false} isAnimationActive={false} />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Memory']} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      </ExpandableSection>

      <Content component="small" className="pf-v6-u-color-200 pf-v6-u-mt-sm">
        {health.activeClusters}/{health.totalClusters} clusters active · Source: ACM Thanos
      </Content>
    </div>
  )
}

function ModelsTab({ range }: { range: TimeRange }) {
  const [selectedModel, setSelectedModel] = useState<string>(MOCK_MODELS[0])
  const series = useMemo(() => getModelTimeSeries(selectedModel), [selectedModel])
  void range

  const MODEL_DEPLOYMENTS_TABLE = [
    { name: 'granite-3b-instruct', project: 'prelude-maas', totalRequests: 14, p90Latency: '526ms', errorRate: '0%', gpuUtil: '40%', cpuUsage: '0.01047' },
    { name: 'llama-3.1-70b', project: 'prelude-maas', totalRequests: 6, p90Latency: '305ms', errorRate: '0%', gpuUtil: '0%', cpuUsage: '2.01063' },
    { name: 'mistral-7b-instruct', project: 'prelude-maas', totalRequests: 6, p90Latency: '270ms', errorRate: '0%', gpuUtil: '0%', cpuUsage: '1.00801' },
    { name: 'gemma4', project: 'prelude-maas', totalRequests: 0, p90Latency: '0s', errorRate: '0%', gpuUtil: '0%', cpuUsage: '0.00737' },
    { name: 'bge-m3', project: 'prelude-maas', totalRequests: 0, p90Latency: '0s', errorRate: '0%', gpuUtil: '0%', cpuUsage: '0.08621' },
  ]

  return (
    <div className="observability-dashboard">
      <Flex gap={{ default: 'gapMd' }} className="pf-v6-u-mb-md" alignItems={{ default: 'alignItemsCenter' }}>
        <FlexItem>
          <Content component="small" className="pf-v6-u-font-weight-bold">Model deployment</Content>
        </FlexItem>
        <FlexItem>
          <FormSelect
            value={selectedModel}
            onChange={(_e, v) => setSelectedModel(v)}
            aria-label="Select model deployment"
            style={{ maxWidth: 220 }}
          >
            <FormSelectOption value="all" label="All" />
            {MOCK_MODELS.map((m) => (
              <FormSelectOption key={m} value={m} label={m} />
            ))}
          </FormSelect>
        </FlexItem>
      </Flex>

      <ExpandableSection toggleText="Model deployments" isExpanded className="pf-v6-u-mb-md">
        <Card className="observability-metric-card">
          <CardBody>
            <div className="observability-metric-card__title">Model deployments</div>
            <Table aria-label="Model deployments" variant="compact" className="pf-v6-u-mt-sm">
              <Thead>
                <Tr>
                  <Th>Model deployment</Th>
                  <Th>Project</Th>
                  <Th>Total requests</Th>
                  <Th>P90 E2E request latency</Th>
                  <Th>Error rate</Th>
                  <Th>GPU utilization</Th>
                  <Th>CPU usage (cores)</Th>
                </Tr>
              </Thead>
              <Tbody>
                {MODEL_DEPLOYMENTS_TABLE.map((row) => (
                  <Tr key={row.name}>
                    <Td dataLabel="Model deployment">{row.name}</Td>
                    <Td dataLabel="Project">{row.project}</Td>
                    <Td dataLabel="Total requests">{row.totalRequests}</Td>
                    <Td dataLabel="P90 E2E request latency">{row.p90Latency}</Td>
                    <Td dataLabel="Error rate">{row.errorRate}</Td>
                    <Td dataLabel="GPU utilization">{row.gpuUtil}</Td>
                    <Td dataLabel="CPU usage (cores)">{row.cpuUsage}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </CardBody>
        </Card>
      </ExpandableSection>

      <ExpandableSection toggleText="Performance metrics" isExpanded className="pf-v6-u-mb-md">
        <div className="observability-chart-grid observability-chart-grid--2col">
          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">Request queue length</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={series.currentRequests} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <YAxis tick={{ fontSize: 10 }} width={30} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <Line type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(0)}`, 'Queue']} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">Replica count</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={series.tpot.map((p) => ({ ...p, value: 1 }))} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 1.2]} width={30} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <Line type="stepAfter" dataKey="value" stroke="var(--pf-t--color--red--default)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(0)}`, 'Replicas']} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">P90 E2E request latency</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={series.ttft} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}s`} width={35} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <Line type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} dot={false} isAnimationActive={false} name="P90 latency" />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)}s`, 'P90']} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card className="observability-metric-card">
            <CardBody>
              <div className="observability-metric-card__title">P90 Time to first token (TTFT)</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={series.tpot} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`} width={45} />
                  <XAxis tick={{ fontSize: 10 }} dataKey="ts" />
                  <Line type="monotone" dataKey="value" stroke="var(--pf-t--color--blue--default)" strokeWidth={1.5} dot={false} isAnimationActive={false} name="TTFT" />
                  <RechartsTooltip contentStyle={TOOLTIP_STYLE} labelFormatter={() => ''} formatter={(v) => [`${Number(v).toFixed(1)} ms`, 'TTFT']} />
                </LineChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
      </ExpandableSection>
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

function ImportDashboardTab() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="observability-dashboard pf-v6-u-pt-lg">
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Content component="h3" className="pf-v6-u-mb-md">Import a custom dashboard</Content>
        <Content component="p" className="pf-v6-u-color-200 pf-v6-u-mb-lg">
          Import a Perses dashboard JSON to add custom views for your AI Grid observability needs.
        </Content>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          Import dashboard
        </Button>
      </div>
      {isModalOpen && (
        <div
          className="pf-v6-u-p-lg"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <Card style={{ maxWidth: 500, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <CardBody>
              <Content component="h3" className="pf-v6-u-mb-md">Import Perses dashboard</Content>
              <Content component="p" className="pf-v6-u-color-200 pf-v6-u-mb-md">
                Paste Perses dashboard JSON or provide a URL to the dashboard spec.
              </Content>
              <textarea
                className="pf-v6-c-form-control"
                rows={8}
                placeholder='{"kind": "Dashboard", "metadata": {"name": "my-custom-dashboard"}, ...}'
                style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
              />
              <Flex className="pf-v6-u-mt-md" gap={{ default: 'gapMd' }}>
                <FlexItem>
                  <Button variant="primary" onClick={() => setIsModalOpen(false)}>Import</Button>
                </FlexItem>
                <FlexItem>
                  <Button variant="link" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                </FlexItem>
              </Flex>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}

export function ProviderAdminObservabilityPage() {
  const [activeTab, setActiveTab] = useState<string | number>('cluster')
  const [range, setRange] = useState<TimeRange>('1h')

  return (
    <div className="provider-admin-workspace-page provider-admin-observability">
      <ProviderAdminWorkspacePageHeader
        title="Observability dashboard"
        lede="Monitor the health, performance, and resource usage of your AI workloads, cluster, and models."
        action={
          <Flex gap={{ default: 'gapMd' }} alignItems={{ default: 'alignItemsCenter' }}>
            <FlexItem>
              <Content component="small" className="pf-v6-u-color-200">Time period:</Content>
            </FlexItem>
            <FlexItem>
              <ToggleGroup aria-label="Time range" isCompact className="observability-timeframe-selector">
                <ToggleGroupItem text="Last 30 min" buttonId="obs-range-1h" isSelected={range === '1h'} onChange={() => setRange('1h')} />
                <ToggleGroupItem text="Last 6h" buttonId="obs-range-6h" isSelected={range === '6h'} onChange={() => setRange('6h')} />
                <ToggleGroupItem text="Last 24h" buttonId="obs-range-24h" isSelected={range === '24h'} onChange={() => setRange('24h')} />
              </ToggleGroup>
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
        <Tab eventKey="import" title={<TabTitleText>+</TabTitleText>}>
          <ImportDashboardTab />
        </Tab>
      </Tabs>
    </div>
  )
}
