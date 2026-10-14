import { useCallback, useMemo, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CodeBlock,
  CodeBlockCode,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
  NumberInput,
  Tab,
  Tabs,
  TabTitleText,
  TextInput,
  TextArea,
  Title,
} from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import { ProviderAdminWorkspacePageHeader } from '../components/provider-admin/ProviderAdminWorkspacePageHeader'
import {
  addSubscriptionTier,
  formatTokenLimit,
  generateTierId,
  getSubscriptionTiers,
  removeSubscriptionTier,
  type SubscriptionTier,
  type TierModelRef,
} from '../providerAdmin/subscriptionTierData'
import { VISION_MODEL_PRESETS } from '../vision/fleetWorld'

type TiersView = 'list' | 'create' | 'detail'

export function ProviderAdminSubscriptionTiersPage() {
  const [tiers, setTiers] = useState(() => getSubscriptionTiers())
  const [view, setView] = useState<TiersView>('list')
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'details' | 'yaml'>('details')

  const selectedTier = useMemo(
    () => tiers.find((t) => t.id === selectedTierId) ?? null,
    [tiers, selectedTierId],
  )

  const openDetail = (tierId: string) => {
    setSelectedTierId(tierId)
    setDetailTab('details')
    setView('detail')
  }

  const handleDelete = (tierId: string) => {
    removeSubscriptionTier(tierId)
    setTiers(getSubscriptionTiers())
    if (selectedTierId === tierId) {
      setView('list')
      setSelectedTierId(null)
    }
  }

  const handleCreate = (tier: SubscriptionTier) => {
    addSubscriptionTier(tier)
    setTiers(getSubscriptionTiers())
    setView('list')
  }

  if (view === 'create') {
    return <CreateTierForm onCancel={() => setView('list')} onCreate={handleCreate} />
  }

  if (view === 'detail' && selectedTier) {
    return (
      <TierDetail
        tier={selectedTier}
        activeTab={detailTab}
        onTabChange={setDetailTab}
        onBack={() => setView('list')}
        onDelete={() => handleDelete(selectedTier.id)}
      />
    )
  }

  return (
    <div className="provider-admin-workspace-page provider-admin-subscription-tiers">
      <ProviderAdminWorkspacePageHeader
        kicker="Administration"
        title="Subscription tiers"
        lede="Manage service tiers that define model access and rate limits for tenants across the AI Grid."
        action={
          <Button variant="primary" onClick={() => setView('create')}>
            Create tier
          </Button>
        }
      />

      <Card className="provider-admin-subscription-tiers__table-card">
        <CardHeader>
          <CardTitle>Service tiers</CardTitle>
        </CardHeader>
        <CardBody>
          {tiers.length === 0 ? (
            <Content component="p">No subscription tiers configured yet.</Content>
          ) : (
            <Table aria-label="Subscription tiers" className="catalog-data-table">
              <Thead>
                <Tr>
                  <Th>Tier name</Th>
                  <Th>Priority</Th>
                  <Th>Models</Th>
                  <Th>Rate limits</Th>
                  <Th>Tenants</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {tiers.map((tier) => (
                  <Tr key={tier.id}>
                    <Td dataLabel="Tier name">
                      <Button variant="link" isInline onClick={() => openDetail(tier.id)}>
                        {tier.name}
                      </Button>
                    </Td>
                    <Td dataLabel="Priority">
                      <Label isCompact color={tier.priority >= 100 ? 'yellow' : tier.priority >= 10 ? 'blue' : 'grey'}>
                        {tier.priority}
                      </Label>
                    </Td>
                    <Td dataLabel="Models">{tier.modelRefs.length}</Td>
                    <Td dataLabel="Rate limits">
                      {tier.modelRefs.length > 0
                        ? tier.modelRefs
                            .slice(0, 2)
                            .map((m) =>
                              m.tokenRateLimits
                                .map((rl) => `${formatTokenLimit(rl.limit)}/${rl.window}`)
                                .join(', '),
                            )
                            .join('; ') + (tier.modelRefs.length > 2 ? ' ...' : '')
                        : '—'}
                    </Td>
                    <Td dataLabel="Tenants">{tier.assignedTenantIds.length}</Td>
                    <Td isActionCell>
                      <Button variant="link" isDanger onClick={() => handleDelete(tier.id)}>
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

type CreateTierFormProps = {
  onCancel: () => void
  onCreate: (tier: SubscriptionTier) => void
}

function CreateTierForm({ onCancel, onCreate }: CreateTierFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(0)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [rateLimits, setRateLimits] = useState<Record<string, number>>({})

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModelIds((current) =>
      current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId],
    )
  }, [])

  const setModelRateLimit = useCallback((modelId: string, limit: number) => {
    setRateLimits((current) => ({ ...current, [modelId]: limit }))
  }, [])

  const handleSubmit = () => {
    const modelRefs: TierModelRef[] = selectedModelIds.map((modelId) => {
      const preset = VISION_MODEL_PRESETS.find((m) => m.id === modelId)
      return {
        modelId,
        displayName: preset?.displayName ?? modelId,
        tokenRateLimits: [{ limit: rateLimits[modelId] ?? 1000000, window: 'month' }],
      }
    })

    onCreate({
      id: generateTierId(),
      name,
      description,
      priority,
      modelRefs,
      assignedTenantIds: [],
      createdAt: new Date().toISOString(),
    })
  }

  const isValid = name.trim().length > 0 && selectedModelIds.length > 0

  return (
    <div className="provider-admin-workspace-page provider-admin-subscription-tiers">
      <ProviderAdminWorkspacePageHeader kicker="Administration" title="Create subscription tier" />

      <Card>
        <CardBody>
          <Flex direction={{ default: 'column' }} gap={{ default: 'gapLg' }}>
            <FlexItem>
              <FormGroup label="Tier name" isRequired fieldId="tier-name">
                <TextInput
                  id="tier-name"
                  value={name}
                  onChange={(_event, value) => setName(value)}
                  placeholder="e.g. Standard, Premium"
                />
              </FormGroup>
            </FlexItem>
            <FlexItem>
              <FormGroup label="Description" fieldId="tier-description">
                <TextArea
                  id="tier-description"
                  value={description}
                  onChange={(_event, value) => setDescription(value)}
                  placeholder="What is this tier for?"
                  rows={3}
                />
              </FormGroup>
            </FlexItem>
            <FlexItem>
              <FormGroup
                label="Priority"
                fieldId="tier-priority"
              >
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>Higher priority tiers are served first under contention (0 = lowest).</HelperTextItem>
                  </HelperText>
                </FormHelperText>
                <NumberInput
                  id="tier-priority"
                  value={priority}
                  min={0}
                  max={1000}
                  onMinus={() => setPriority(Math.max(0, priority - 10))}
                  onPlus={() => setPriority(priority + 10)}
                  onChange={(event) => {
                    const val = Number((event.target as HTMLInputElement).value)
                    if (!isNaN(val) && val >= 0) setPriority(val)
                  }}
                />
              </FormGroup>
            </FlexItem>
            <FlexItem>
              <Title headingLevel="h3" size="lg">
                Models
              </Title>
              <Content component="p" className="pf-v6-u-mb-md pf-v6-u-color-200">
                Select which models are included in this tier and set per-model token rate limits.
              </Content>
              <Table aria-label="Available models" className="catalog-data-table">
                <Thead>
                  <Tr>
                    <Th />
                    <Th>Model</Th>
                    <Th>GPU requirement</Th>
                    <Th>Monthly token limit</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {VISION_MODEL_PRESETS.map((model) => {
                    const isSelected = selectedModelIds.includes(model.id)
                    return (
                      <Tr key={model.id}>
                        <Td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleModel(model.id)}
                            aria-label={`Select ${model.displayName}`}
                          />
                        </Td>
                        <Td dataLabel="Model">{model.displayName}</Td>
                        <Td dataLabel="GPU requirement">{model.gpuRequirement}</Td>
                        <Td dataLabel="Monthly token limit">
                          {isSelected ? (
                            <NumberInput
                              value={rateLimits[model.id] ?? 1000000}
                              min={100000}
                              max={100000000}
                              onMinus={() =>
                                setModelRateLimit(
                                  model.id,
                                  Math.max(100000, (rateLimits[model.id] ?? 1000000) - 500000),
                                )
                              }
                              onPlus={() =>
                                setModelRateLimit(
                                  model.id,
                                  (rateLimits[model.id] ?? 1000000) + 500000,
                                )
                              }
                              onChange={(event) => {
                                const val = Number((event.target as HTMLInputElement).value)
                                if (!isNaN(val) && val >= 100000) setModelRateLimit(model.id, val)
                              }}
                              widthChars={10}
                            />
                          ) : (
                            '—'
                          )}
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </FlexItem>
            <FlexItem>
              <Flex gap={{ default: 'gapSm' }}>
                <FlexItem>
                  <Button variant="primary" isDisabled={!isValid} onClick={handleSubmit}>
                    Create tier
                  </Button>
                </FlexItem>
                <FlexItem>
                  <Button variant="link" onClick={onCancel}>
                    Cancel
                  </Button>
                </FlexItem>
              </Flex>
            </FlexItem>
          </Flex>
        </CardBody>
      </Card>
    </div>
  )
}

type TierDetailProps = {
  tier: SubscriptionTier
  activeTab: 'details' | 'yaml'
  onTabChange: (tab: 'details' | 'yaml') => void
  onBack: () => void
  onDelete: () => void
}

function TierDetail({ tier, activeTab, onTabChange, onBack, onDelete }: TierDetailProps) {
  const yamlSpec = useMemo(() => {
    const models = tier.modelRefs.map((m) => ({
      modelId: m.modelId,
      displayName: m.displayName,
      tokenRateLimits: m.tokenRateLimits,
    }))

    const spec = {
      apiVersion: 'maas.opendatahub.io/v1alpha1',
      kind: 'MaaSSubscription',
      metadata: { name: tier.id, namespace: 'ai-grid-system' },
      spec: {
        displayName: tier.name,
        description: tier.description,
        priority: tier.priority,
        owner: {
          groups: tier.assignedTenantIds.map((tid) => `${tid}:ai-grid-users`),
        },
        modelRefs: models,
      },
    }
    return JSON.stringify(spec, null, 2)
  }, [tier])

  return (
    <div className="provider-admin-workspace-page provider-admin-subscription-tiers">
      <Flex
        className="provider-admin-workspace-page__header"
        alignItems={{ default: 'alignItemsFlexStart' }}
        justifyContent={{ default: 'justifyContentSpaceBetween' }}
        gap={{ default: 'gapMd' }}
      >
        <FlexItem>
          <Label color="grey" className="provider-admin-workspace-page__kicker">
            Administration
          </Label>
          <Title headingLevel="h1" size="3xl" className="provider-admin-workspace-page__title">
            {tier.name}
          </Title>
          <Content component="p" className="provider-admin-workspace-page__lede">
            {tier.description}
          </Content>
        </FlexItem>
        <FlexItem alignSelf={{ default: 'alignSelfFlexStart' }}>
          <Flex gap={{ default: 'gapSm' }}>
            <FlexItem>
              <Button variant="secondary" onClick={onBack}>
                Back to tiers
              </Button>
            </FlexItem>
            <FlexItem>
              <Button variant="link" isDanger onClick={onDelete}>
                Delete
              </Button>
            </FlexItem>
          </Flex>
        </FlexItem>
      </Flex>

      <Tabs
        activeKey={activeTab}
        onSelect={(_event, key) => onTabChange(key as 'details' | 'yaml')}
        aria-label="Tier detail tabs"
      >
        <Tab eventKey="details" title={<TabTitleText>Details</TabTitleText>}>
          <Card className="pf-v6-u-mt-md">
            <CardBody>
              <DescriptionList isCompact>
                <DescriptionListGroup>
                  <DescriptionListTerm>Tier name</DescriptionListTerm>
                  <DescriptionListDescription>{tier.name}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Priority</DescriptionListTerm>
                  <DescriptionListDescription>
                    <Label
                      isCompact
                      color={tier.priority >= 100 ? 'yellow' : tier.priority >= 10 ? 'blue' : 'grey'}
                    >
                      {tier.priority}
                    </Label>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Created</DescriptionListTerm>
                  <DescriptionListDescription>
                    {new Date(tier.createdAt).toLocaleDateString()}
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Assigned tenants</DescriptionListTerm>
                  <DescriptionListDescription>
                    {tier.assignedTenantIds.length > 0
                      ? tier.assignedTenantIds.join(', ')
                      : 'None'}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </CardBody>
          </Card>

          <Card className="pf-v6-u-mt-md">
            <CardHeader>
              <CardTitle>Models &amp; rate limits</CardTitle>
            </CardHeader>
            <CardBody>
              {tier.modelRefs.length === 0 ? (
                <Content component="p">No models assigned to this tier.</Content>
              ) : (
                <Table aria-label="Tier models" className="catalog-data-table">
                  <Thead>
                    <Tr>
                      <Th>Model</Th>
                      <Th>Rate limit</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {tier.modelRefs.map((m) => (
                      <Tr key={m.modelId}>
                        <Td dataLabel="Model">{m.displayName}</Td>
                        <Td dataLabel="Rate limit">
                          {m.tokenRateLimits
                            .map((rl) => `${formatTokenLimit(rl.limit)} tokens / ${rl.window}`)
                            .join(', ')}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </Tab>

        <Tab eventKey="yaml" title={<TabTitleText>MaaSSubscription spec</TabTitleText>}>
          <Card className="pf-v6-u-mt-md">
            <CardBody>
              <Content component="p" className="pf-v6-u-mb-md pf-v6-u-color-200">
                Equivalent MaaSSubscription CR distributed to all enrolled Grid sites via ACM.
              </Content>
              <CodeBlock>
                <CodeBlockCode>{yamlSpec}</CodeBlockCode>
              </CodeBlock>
            </CardBody>
          </Card>
        </Tab>
      </Tabs>
    </div>
  )
}
