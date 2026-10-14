import { useState } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Checkbox,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  EmptyState,
  EmptyStateBody,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Label,
  NumberInput,
  SearchInput,
  Stack,
  StackItem,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Wizard,
  WizardStep,
} from '@patternfly/react-core'
import {
  ExpandableRowContent,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@patternfly/react-table'
import { GenaiPageStack } from '../../../tenant-user/genai/GenaiPageStack'
import { TenantUserPageChrome } from '../../../tenant-user/genai/TenantUserPageChrome'

type ModelStatus = 'Deploying' | 'Available' | 'Failed'

interface ModelDeployment {
  id: string
  name: string
  displayName: string
  description: string
  modelUri: string
  modelName: string
  runtimeImage: string
  replicas: number
  cpu: string
  memory: string
  gpuCount: number
  runtimeArgs: string[]
  locations: string[]
  status: ModelStatus
  endpoint: string
}

const AVAILABLE_LOCATIONS = [
  'us-west-1-dc-a',
  'us-east-1-dc-b',
  'eu-west-1-dc-a',
  'us-central-1-dc-a',
]

const RUNTIME_OPTIONS: { value: string; label: string; image: string }[] = [
  { value: 'vllm', label: 'vLLM', image: 'quay.io/modh/vllm:latest' },
  { value: 'tgis', label: 'TGIS', image: 'quay.io/modh/tgis:latest' },
  { value: 'caikit-tgis', label: 'Caikit+TGIS', image: 'quay.io/modh/caikit-tgis:latest' },
]

const INITIAL_DEPLOYMENTS: ModelDeployment[] = [
  {
    id: 'granite-3b-instruct',
    name: 'granite-3b-instruct',
    displayName: 'Granite 3B Instruct',
    description: 'Granite 3B for instruction-following tasks',
    modelUri: 'oci://quay.io/modh/granite-3b-instruct',
    modelName: 'granite-3b-instruct',
    runtimeImage: 'quay.io/modh/vllm:latest',
    replicas: 1,
    cpu: '4',
    memory: '16Gi',
    gpuCount: 1,
    runtimeArgs: ['--max-model-len=4096'],
    locations: ['us-west-1-dc-a', 'eu-west-1-dc-a'],
    status: 'Available',
    endpoint: 'https://granite-3b-instruct.apps.grid.example.com',
  },
  {
    id: 'llama-3-1-70b',
    name: 'llama-3-1-70b',
    displayName: 'Llama 3.1 70B',
    description: 'Meta Llama 3.1 70B for general-purpose inference',
    modelUri: 'oci://quay.io/modh/llama-3.1-70b',
    modelName: 'llama-3.1-70b',
    runtimeImage: 'quay.io/modh/vllm:latest',
    replicas: 2,
    cpu: '8',
    memory: '64Gi',
    gpuCount: 4,
    runtimeArgs: ['--max-model-len=8192', '--tensor-parallel-size=4'],
    locations: ['us-west-1-dc-a', 'us-east-1-dc-b'],
    status: 'Available',
    endpoint: 'https://llama-3-1-70b.apps.grid.example.com',
  },
  {
    id: 'mistral-7b-instruct',
    name: 'mistral-7b-instruct',
    displayName: 'Mistral 7B Instruct',
    description: 'Mistral 7B for fast instruction tasks',
    modelUri: 'oci://quay.io/modh/mistral-7b',
    modelName: 'mistral-7b-instruct-v0.3',
    runtimeImage: 'quay.io/modh/vllm:latest',
    replicas: 1,
    cpu: '4',
    memory: '16Gi',
    gpuCount: 1,
    runtimeArgs: [],
    locations: ['us-east-1-dc-b'],
    status: 'Deploying',
    endpoint: '',
  },
]

const StatusLabel = ({ status }: { status: ModelStatus }) => {
  const color = status === 'Available' ? 'green' : status === 'Deploying' ? 'blue' : 'red'
  return (
    <Label color={color} variant="outline" isCompact>
      {status}
    </Label>
  )
}

type DeployFormState = {
  name: string
  modelUri: string
  runtime: string
  replicas: number
  gpuCount: number
  locations: string[]
}

const EMPTY_FORM: DeployFormState = {
  name: '',
  modelUri: '',
  runtime: 'vllm',
  replicas: 1,
  gpuCount: 1,
  locations: [],
}

function DeployModelPage({ onDeploy, onCancel }: {
  onDeploy: (deployment: ModelDeployment) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<DeployFormState>(EMPTY_FORM)

  const isModelDetailsValid =
    form.name.trim().length > 0 && form.modelUri.trim().length > 0
  const isDeploymentValid = form.locations.length > 0
  const runtimeOption = RUNTIME_OPTIONS.find((r) => r.value === form.runtime) ?? RUNTIME_OPTIONS[0]

  const toggleLocation = (loc: string) => {
    setForm((current) => ({
      ...current,
      locations: current.locations.includes(loc)
        ? current.locations.filter((l) => l !== loc)
        : [...current.locations, loc],
    }))
  }

  const handleDeploy = () => {
    const gpuCount = form.gpuCount
    const cpuDefault = gpuCount >= 4 ? '8' : '4'
    const memDefault = gpuCount >= 4 ? '64Gi' : '16Gi'
    onDeploy({
      id: form.name.trim(),
      name: form.name.trim(),
      displayName: form.name.trim().split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: '',
      modelUri: form.modelUri.trim(),
      modelName: form.name.trim(),
      runtimeImage: runtimeOption.image,
      replicas: form.replicas,
      cpu: cpuDefault,
      memory: memDefault,
      gpuCount,
      runtimeArgs: [],
      locations: form.locations,
      status: 'Deploying',
      endpoint: `https://${form.name.trim()}.apps.grid.example.com`,
    })
  }

  return (
    <div className="provider-admin-workspace-page">
      <Breadcrumb className="pf-v6-u-mb-md">
        <BreadcrumbItem
          to="#"
          onClick={(e) => { e.preventDefault(); onCancel() }}
        >
          Models
        </BreadcrumbItem>
        <BreadcrumbItem isActive>Deploy a model</BreadcrumbItem>
      </Breadcrumb>

      <Content component="h1" className="pf-v6-u-mb-xs">Deploy a model</Content>
      <Content component="p" className="pf-v6-u-color-200 pf-v6-u-mb-lg">
        Configure deployment options for this model version.
      </Content>

      <Wizard
        isPlain
        height="100%"
      >
        <WizardStep
          name="Model details"
          id="deploy-step-model-details"
          footer={{ isNextDisabled: !isModelDetailsValid }}
        >
          <Content component="h3" className="pf-v6-u-mb-xs">Model details</Content>
          <Content component="p" className="pf-v6-u-color-200 pf-v6-u-mb-lg">
            Provide information about the model you want to deploy.
          </Content>
          <Form>
            <FormGroup label="Name" isRequired fieldId="deploy-name">
              <TextInput
                id="deploy-name"
                isRequired
                value={form.name}
                onChange={(_e, v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. granite-3b-instruct"
              />
            </FormGroup>
            <FormGroup label="Model URI" isRequired fieldId="deploy-model-uri">
              <TextInput
                id="deploy-model-uri"
                isRequired
                value={form.modelUri}
                onChange={(_e, v) => setForm((f) => ({ ...f, modelUri: v }))}
                placeholder="oci://quay.io/modh/granite-3b-instruct"
              />
            </FormGroup>
            <FormGroup label="Serving runtime" fieldId="deploy-runtime">
              <FormSelect
                id="deploy-runtime"
                value={form.runtime}
                onChange={(_e, v) => setForm((f) => ({ ...f, runtime: v }))}
              >
                {RUNTIME_OPTIONS.map((rt) => (
                  <FormSelectOption key={rt.value} value={rt.value} label={rt.label} />
                ))}
              </FormSelect>
            </FormGroup>
          </Form>
        </WizardStep>

        <WizardStep
          name="Model deployment"
          id="deploy-step-deployment"
        >
          <Content component="h3" className="pf-v6-u-mb-xs">Model deployment</Content>
          <Content component="p" className="pf-v6-u-color-200 pf-v6-u-mb-lg">
            Configure replicas and GPU resources for this model.
          </Content>
          <Form>
            <FormGroup label="Replica count" isRequired fieldId="deploy-replicas">
              <NumberInput
                id="deploy-replicas"
                value={form.replicas}
                min={1}
                onMinus={() => setForm((f) => ({ ...f, replicas: Math.max(1, f.replicas - 1) }))}
                onPlus={() => setForm((f) => ({ ...f, replicas: f.replicas + 1 }))}
                onChange={(event) => {
                  const val = parseInt((event.target as HTMLInputElement).value, 10)
                  if (!isNaN(val) && val >= 1) setForm((f) => ({ ...f, replicas: val }))
                }}
                inputAriaLabel="Replica count"
                minusBtnAriaLabel="Decrease replicas"
                plusBtnAriaLabel="Increase replicas"
              />
            </FormGroup>
            <FormGroup label="GPU count" isRequired fieldId="deploy-gpu">
              <NumberInput
                id="deploy-gpu"
                value={form.gpuCount}
                min={0}
                onMinus={() => setForm((f) => ({ ...f, gpuCount: Math.max(0, f.gpuCount - 1) }))}
                onPlus={() => setForm((f) => ({ ...f, gpuCount: f.gpuCount + 1 }))}
                onChange={(event) => {
                  const val = parseInt((event.target as HTMLInputElement).value, 10)
                  if (!isNaN(val) && val >= 0) setForm((f) => ({ ...f, gpuCount: val }))
                }}
                inputAriaLabel="GPU count"
                minusBtnAriaLabel="Decrease GPU count"
                plusBtnAriaLabel="Increase GPU count"
              />
            </FormGroup>
          </Form>
        </WizardStep>

        <WizardStep
          name="Locations"
          id="deploy-step-locations"
          footer={{ isNextDisabled: !isDeploymentValid }}
        >
          <Content component="h3" className="pf-v6-u-mb-xs">Locations</Content>
          <Content component="p" className="pf-v6-u-color-200 pf-v6-u-mb-lg">
            Select which cluster locations this model should be deployed to via ACM placement.
          </Content>
          <Form>
            <FormGroup
              label="Target clusters"
              isRequired
              fieldId="deploy-locations"
              role="group"
            >
              <Stack hasGutter>
                {AVAILABLE_LOCATIONS.map((loc) => (
                  <StackItem key={loc}>
                    <Checkbox
                      id={`deploy-loc-${loc}`}
                      label={loc}
                      isChecked={form.locations.includes(loc)}
                      onChange={() => toggleLocation(loc)}
                    />
                  </StackItem>
                ))}
              </Stack>
            </FormGroup>
          </Form>
        </WizardStep>

        <WizardStep
          name="Review"
          id="deploy-step-review"
          footer={{
            nextButtonText: 'Deploy',
            onNext: handleDeploy,
            isNextDisabled: !isModelDetailsValid || !isDeploymentValid,
          }}
        >
          <Content component="h3" className="pf-v6-u-mb-xs">Review</Content>
          <Content component="p" className="pf-v6-u-color-200 pf-v6-u-mb-lg">
            Review your model deployment configuration before deploying.
          </Content>
          <Stack hasGutter>
            <StackItem>
              <Content component="h4" className="pf-v6-u-mb-sm">Model details</Content>
              <DescriptionList isCompact isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Name</DescriptionListTerm>
                  <DescriptionListDescription>{form.name || '—'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Model URI</DescriptionListTerm>
                  <DescriptionListDescription>{form.modelUri || '—'}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Serving runtime</DescriptionListTerm>
                  <DescriptionListDescription>{runtimeOption.label}</DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </StackItem>
            <StackItem>
              <Content component="h4" className="pf-v6-u-mb-sm">Model deployment</Content>
              <DescriptionList isCompact isHorizontal>
                <DescriptionListGroup>
                  <DescriptionListTerm>Replicas</DescriptionListTerm>
                  <DescriptionListDescription>{form.replicas}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>GPU count</DescriptionListTerm>
                  <DescriptionListDescription>{form.gpuCount}</DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Locations</DescriptionListTerm>
                  <DescriptionListDescription>
                    {form.locations.length > 0 ? form.locations.join(', ') : '—'}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </DescriptionList>
            </StackItem>
          </Stack>
        </WizardStep>
      </Wizard>
    </div>
  )
}

const TenantAdminModelsPage = () => {
  const [deployments, setDeployments] = useState(INITIAL_DEPLOYMENTS)
  const [searchValue, setSearchValue] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isDeployView, setIsDeployView] = useState(false)

  const visibleDeployments = deployments.filter((d) =>
    d.name.toLocaleLowerCase().includes(searchValue.trim().toLocaleLowerCase()),
  )

  if (isDeployView) {
    return (
      <DeployModelPage
        onDeploy={(newDeployment) => {
          setDeployments((current) => [newDeployment, ...current])
          setIsDeployView(false)
        }}
        onCancel={() => setIsDeployView(false)}
      />
    )
  }

  return (
    <TenantUserPageChrome
      pageClassName="tenant-admin-models"
      kicker="AI"
      title="Models"
      description="Deploy and manage LLM inference services across the AI Grid. Each model targets one or more cluster locations via ACM placement."
    >
      <GenaiPageStack>
        <Toolbar id="models-toolbar" hasNoPadding>
          <ToolbarContent>
            <ToolbarItem>
              <SearchInput
                id="models-search"
                aria-label="Filter models by name"
                placeholder="Filter by name"
                value={searchValue}
                onChange={(_event, value) => setSearchValue(value)}
                onClear={() => setSearchValue('')}
              />
            </ToolbarItem>
            <ToolbarItem>
              <Button
                variant="primary"
                onClick={() => setIsDeployView(true)}
              >
                Deploy model
              </Button>
            </ToolbarItem>
          </ToolbarContent>
        </Toolbar>

        {visibleDeployments.length > 0 ? (
          <Table aria-label="Deployed models" variant="compact">
            <Thead>
              <Tr>
                <Th screenReaderText="Expand" />
                <Th>Name</Th>
                <Th>Serving runtime</Th>
                <Th>Replicas</Th>
                <Th>GPU</Th>
                <Th>Locations</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visibleDeployments.flatMap((deployment, rowIndex) => {
                const isExpanded = expandedId === deployment.id
                return [
                  <Tr key={deployment.id}>
                    <Td
                      expand={{
                        rowIndex,
                        isExpanded,
                        onToggle: () =>
                          setExpandedId(isExpanded ? null : deployment.id),
                        expandId: `model-expand-${deployment.id}`,
                      }}
                    />
                    <Td dataLabel="Name">
                      <strong>{deployment.displayName}</strong>
                      <br />
                      <code style={{ fontSize: '0.85em' }}>{deployment.name}</code>
                    </Td>
                    <Td dataLabel="Serving runtime">
                      <code style={{ fontSize: '0.85em' }}>{deployment.runtimeImage.split('/').pop()?.replace(':latest', '')}</code>
                    </Td>
                    <Td dataLabel="Replicas">{deployment.replicas}</Td>
                    <Td dataLabel="GPU">{deployment.gpuCount}</Td>
                    <Td dataLabel="Locations">
                      {deployment.locations.map((loc) => (
                        <Label key={loc} isCompact color="blue" className="pf-v6-u-mr-xs pf-v6-u-mb-xs">
                          {loc}
                        </Label>
                      ))}
                    </Td>
                    <Td dataLabel="Status">
                      <StatusLabel status={deployment.status} />
                    </Td>
                  </Tr>,
                  <Tr key={`${deployment.id}-detail`} isExpanded={isExpanded}>
                    <Td />
                    <Td noPadding colSpan={7}>
                      <ExpandableRowContent>
                        <div className="pf-v6-u-p-md">
                          <DescriptionList isCompact isHorizontal>
                            <DescriptionListGroup>
                              <DescriptionListTerm>Model URI</DescriptionListTerm>
                              <DescriptionListDescription>
                                <code>{deployment.modelUri}</code>
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>Runtime image</DescriptionListTerm>
                              <DescriptionListDescription>
                                <code>{deployment.runtimeImage}</code>
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            <DescriptionListGroup>
                              <DescriptionListTerm>Resources</DescriptionListTerm>
                              <DescriptionListDescription>
                                {deployment.gpuCount} GPU · {deployment.cpu} CPU · {deployment.memory}
                              </DescriptionListDescription>
                            </DescriptionListGroup>
                            {deployment.endpoint && (
                              <DescriptionListGroup>
                                <DescriptionListTerm>Inference endpoint</DescriptionListTerm>
                                <DescriptionListDescription>
                                  <code>{deployment.endpoint}</code>
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                            )}
                            {deployment.runtimeArgs.length > 0 && (
                              <DescriptionListGroup>
                                <DescriptionListTerm>Runtime args</DescriptionListTerm>
                                <DescriptionListDescription>
                                  <code>{deployment.runtimeArgs.join(' ')}</code>
                                </DescriptionListDescription>
                              </DescriptionListGroup>
                            )}
                          </DescriptionList>
                        </div>
                      </ExpandableRowContent>
                    </Td>
                  </Tr>,
                ]
              })}
            </Tbody>
          </Table>
        ) : (
          <EmptyState
            headingLevel="h2"
            titleText={
              searchValue.trim()
                ? 'No models match your filter'
                : 'No models deployed'
            }
          >
            <EmptyStateBody>
              {searchValue.trim()
                ? 'Try a different name or clear the search field.'
                : 'Deploy a model to see its status and inference endpoint here.'}
            </EmptyStateBody>
          </EmptyState>
        )}
      </GenaiPageStack>
    </TenantUserPageChrome>
  )
}

export default TenantAdminModelsPage
