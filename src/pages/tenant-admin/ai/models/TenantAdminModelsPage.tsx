import { useState } from 'react'
import {
  Button,
  Checkbox,
  EmptyState,
  EmptyStateBody,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  SearchInput,
  Stack,
  StackItem,
  TextInput,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
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

type ModelStatus = 'Saved' | 'Registered'

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

const RUNTIME_IMAGE_OPTIONS = [
  'quay.io/modh/vllm:latest',
  'quay.io/modh/tgis:latest',
  'quay.io/modh/caikit-tgis:latest',
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
    status: 'Registered',
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
    status: 'Registered',
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
    status: 'Saved',
    endpoint: '',
  },
]

const StatusLabel = ({ status }: { status: ModelStatus }) => (
  <Label
    color={status === 'Registered' ? 'green' : 'blue'}
    variant="outline"
    isCompact
  >
    {status}
  </Label>
)

type DeployFormState = {
  name: string
  displayName: string
  description: string
  modelUri: string
  modelName: string
  runtimeImage: string
  replicas: string
  cpu: string
  memory: string
  gpuCount: string
  runtimeArgs: string
  locations: string[]
}

const EMPTY_FORM: DeployFormState = {
  name: '',
  displayName: '',
  description: '',
  modelUri: '',
  modelName: '',
  runtimeImage: 'quay.io/modh/vllm:latest',
  replicas: '1',
  cpu: '4',
  memory: '16Gi',
  gpuCount: '1',
  runtimeArgs: '',
  locations: [],
}

const TenantAdminModelsPage = () => {
  const [deployments, setDeployments] = useState(INITIAL_DEPLOYMENTS)
  const [searchValue, setSearchValue] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)
  const [form, setForm] = useState<DeployFormState>(EMPTY_FORM)

  const visibleDeployments = deployments.filter((d) =>
    d.name.toLocaleLowerCase().includes(searchValue.trim().toLocaleLowerCase()),
  )

  const isFormValid =
    form.name.trim().length > 0 &&
    form.modelUri.trim().length > 0 &&
    form.locations.length > 0

  const handleDeploy = () => {
    const args = form.runtimeArgs.trim()
      ? form.runtimeArgs.split(',').map((a) => a.trim()).filter(Boolean)
      : []
    const newDeployment: ModelDeployment = {
      id: form.name.trim(),
      name: form.name.trim(),
      displayName: form.displayName.trim() || form.name.trim(),
      description: form.description.trim(),
      modelUri: form.modelUri.trim(),
      modelName: form.modelName.trim() || form.name.trim(),
      runtimeImage: form.runtimeImage,
      replicas: parseInt(form.replicas, 10) || 1,
      cpu: form.cpu.trim() || '4',
      memory: form.memory.trim() || '16Gi',
      gpuCount: parseInt(form.gpuCount, 10) || 1,
      runtimeArgs: args,
      locations: form.locations,
      status: 'Registered',
      endpoint: `https://${form.name.trim()}.apps.grid.example.com`,
    }
    setDeployments((current) => [newDeployment, ...current])
    setForm(EMPTY_FORM)
    setIsDeployModalOpen(false)
  }

  const toggleLocation = (loc: string) => {
    setForm((current) => ({
      ...current,
      locations: current.locations.includes(loc)
        ? current.locations.filter((l) => l !== loc)
        : [...current.locations, loc],
    }))
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
                onClick={() => setIsDeployModalOpen(true)}
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
                <Th>Runtime image</Th>
                <Th>Replicas</Th>
                <Th>Resources</Th>
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
                    <Td dataLabel="Runtime image">
                      <code style={{ fontSize: '0.85em' }}>{deployment.runtimeImage.split('/').pop()}</code>
                    </Td>
                    <Td dataLabel="Replicas">{deployment.replicas}</Td>
                    <Td dataLabel="Resources">
                      {deployment.gpuCount} GPU · {deployment.cpu} CPU · {deployment.memory}
                    </Td>
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
                          <Stack hasGutter>
                            {deployment.description && (
                              <StackItem>{deployment.description}</StackItem>
                            )}
                            <StackItem>
                              <strong>Model URI:</strong>{' '}
                              <code>{deployment.modelUri}</code>
                            </StackItem>
                            <StackItem>
                              <strong>Model name:</strong>{' '}
                              <code>{deployment.modelName}</code>
                            </StackItem>
                            <StackItem>
                              <strong>Runtime image:</strong>{' '}
                              <code>{deployment.runtimeImage}</code>
                            </StackItem>
                            {deployment.endpoint && (
                              <StackItem>
                                <strong>Inference endpoint:</strong>{' '}
                                <code>{deployment.endpoint}</code>
                              </StackItem>
                            )}
                            {deployment.runtimeArgs.length > 0 && (
                              <StackItem>
                                <strong>Runtime args:</strong>{' '}
                                <code>{deployment.runtimeArgs.join(' ')}</code>
                              </StackItem>
                            )}
                          </Stack>
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

      <Modal
        isOpen={isDeployModalOpen}
        onClose={() => {
          setIsDeployModalOpen(false)
          setForm(EMPTY_FORM)
        }}
        variant="medium"
      >
        <ModalHeader title="Deploy model" />
        <ModalBody>
          <Form isHorizontal>
            <FormGroup label="Name" isRequired fieldId="deploy-name">
              <TextInput
                id="deploy-name"
                isRequired
                value={form.name}
                onChange={(_e, v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. granite-3b-instruct"
              />
            </FormGroup>
            <FormGroup label="Display name" fieldId="deploy-display-name">
              <TextInput
                id="deploy-display-name"
                value={form.displayName}
                onChange={(_e, v) => setForm((f) => ({ ...f, displayName: v }))}
                placeholder="e.g. Granite 3B Instruct"
              />
            </FormGroup>
            <FormGroup label="Description" fieldId="deploy-description">
              <TextInput
                id="deploy-description"
                value={form.description}
                onChange={(_e, v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Brief description of this model deployment"
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
            <FormGroup label="Model name" fieldId="deploy-model-name">
              <TextInput
                id="deploy-model-name"
                value={form.modelName}
                onChange={(_e, v) => setForm((f) => ({ ...f, modelName: v }))}
                placeholder="e.g. granite-3b-instruct (defaults to name)"
              />
            </FormGroup>
            <FormGroup label="Runtime image" fieldId="deploy-runtime-image">
              <FormSelect
                id="deploy-runtime-image"
                value={form.runtimeImage}
                onChange={(_e, v) => setForm((f) => ({ ...f, runtimeImage: v }))}
              >
                {RUNTIME_IMAGE_OPTIONS.map((img) => (
                  <FormSelectOption key={img} value={img} label={img} />
                ))}
              </FormSelect>
            </FormGroup>
            <FormGroup label="Replicas" fieldId="deploy-replicas">
              <TextInput
                id="deploy-replicas"
                type="number"
                value={form.replicas}
                onChange={(_e, v) => setForm((f) => ({ ...f, replicas: v }))}
                min={1}
              />
            </FormGroup>
            <FormGroup label="CPU" fieldId="deploy-cpu">
              <TextInput
                id="deploy-cpu"
                value={form.cpu}
                onChange={(_e, v) => setForm((f) => ({ ...f, cpu: v }))}
                placeholder="4"
              />
            </FormGroup>
            <FormGroup label="Memory" fieldId="deploy-memory">
              <TextInput
                id="deploy-memory"
                value={form.memory}
                onChange={(_e, v) => setForm((f) => ({ ...f, memory: v }))}
                placeholder="16Gi"
              />
            </FormGroup>
            <FormGroup label="GPU count" fieldId="deploy-gpu">
              <TextInput
                id="deploy-gpu"
                type="number"
                value={form.gpuCount}
                onChange={(_e, v) => setForm((f) => ({ ...f, gpuCount: v }))}
                min={0}
              />
            </FormGroup>
            <FormGroup label="Runtime arguments" fieldId="deploy-runtime-args">
              <TextInput
                id="deploy-runtime-args"
                value={form.runtimeArgs}
                onChange={(_e, v) => setForm((f) => ({ ...f, runtimeArgs: v }))}
                placeholder="--max-model-len=4096, --tensor-parallel-size=2"
              />
            </FormGroup>
            <FormGroup
              label="Locations"
              isRequired
              fieldId="deploy-locations"
              role="group"
            >
              {AVAILABLE_LOCATIONS.map((loc) => (
                <Checkbox
                  key={loc}
                  id={`deploy-loc-${loc}`}
                  label={loc}
                  isChecked={form.locations.includes(loc)}
                  onChange={() => toggleLocation(loc)}
                  className="pf-v6-u-mb-xs"
                />
              ))}
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="primary"
            isDisabled={!isFormValid}
            onClick={handleDeploy}
          >
            Deploy
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setIsDeployModalOpen(false)
              setForm(EMPTY_FORM)
            }}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </TenantUserPageChrome>
  )
}

export default TenantAdminModelsPage
