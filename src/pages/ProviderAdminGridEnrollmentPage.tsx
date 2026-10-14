import { useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ClipboardCopy,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Stack,
  StackItem,
  TextInput,
  Title,
} from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import { ProviderAdminWorkspacePageHeader } from '../components/provider-admin/ProviderAdminWorkspacePageHeader'

type EnrollmentStatus = 'active' | 'enrolling' | 'frozen' | 'pending-approval'

type EnrolledSite = {
  id: string
  name: string
  region: string
  spiffeId: string
  enrollmentStatus: EnrollmentStatus
  certExpiresAt: string
  clusterCount: number
  gpuCount: number
  gpuType: string
  enrolledAt: string
}

const DEMO_SITES: EnrolledSite[] = [
  {
    id: 'site-us-west',
    name: 'us-west-1-dc-a',
    region: 'US West (Oregon)',
    spiffeId: 'spiffe://grid.vertexa.cloud/site/us-west-1-dc-a',
    enrollmentStatus: 'active',
    certExpiresAt: '2027-06-15T00:00:00Z',
    clusterCount: 3,
    gpuCount: 24,
    gpuType: 'A100',
    enrolledAt: '2026-08-01T10:00:00Z',
  },
  {
    id: 'site-us-east',
    name: 'us-east-1-dc-b',
    region: 'US East (Virginia)',
    spiffeId: 'spiffe://grid.vertexa.cloud/site/us-east-1-dc-b',
    enrollmentStatus: 'active',
    certExpiresAt: '2027-06-15T00:00:00Z',
    clusterCount: 2,
    gpuCount: 16,
    gpuType: 'H100',
    enrolledAt: '2026-08-05T14:00:00Z',
  },
  {
    id: 'site-us-central',
    name: 'us-central-1-dc-a',
    region: 'US Central (Iowa)',
    spiffeId: 'spiffe://grid.vertexa.cloud/site/us-central-1-dc-a',
    enrollmentStatus: 'enrolling',
    certExpiresAt: '2027-09-01T00:00:00Z',
    clusterCount: 1,
    gpuCount: 8,
    gpuType: 'T4',
    enrolledAt: '2026-10-10T09:00:00Z',
  },
  {
    id: 'site-eu-west',
    name: 'eu-west-1-dc-a',
    region: 'EU West (Frankfurt)',
    spiffeId: 'spiffe://grid.vertexa.cloud/site/eu-west-1-dc-a',
    enrollmentStatus: 'active',
    certExpiresAt: '2027-06-20T00:00:00Z',
    clusterCount: 1,
    gpuCount: 8,
    gpuType: 'A100',
    enrolledAt: '2026-08-12T16:00:00Z',
  },
  {
    id: 'site-ap-south',
    name: 'ap-south-1-dc-a',
    region: 'Asia Pacific (Singapore)',
    spiffeId: 'spiffe://grid.vertexa.cloud/site/ap-south-1-dc-a',
    enrollmentStatus: 'pending-approval',
    certExpiresAt: '',
    clusterCount: 0,
    gpuCount: 0,
    gpuType: '—',
    enrolledAt: '',
  },
]

function statusColor(status: EnrollmentStatus): 'green' | 'blue' | 'orange' | 'purple' {
  switch (status) {
    case 'active': return 'green'
    case 'enrolling': return 'blue'
    case 'frozen': return 'orange'
    case 'pending-approval': return 'purple'
  }
}

export function ProviderAdminGridEnrollmentPage() {
  const [sites] = useState(DEMO_SITES)
  const [selectedSite, setSelectedSite] = useState<EnrolledSite | null>(null)
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [newSiteName, setNewSiteName] = useState('')

  const demoToken = `eyJhbGciOiJFZDI1NTE5IiwidHlwIjoiSldUIn0.${btoa(JSON.stringify({ site: newSiteName || 'new-site', exp: Date.now() / 1000 + 3600 }))}.demo-signature`

  if (selectedSite) {
    return (
      <div className="provider-admin-workspace-page">
        <Flex
          className="provider-admin-workspace-page__header"
          alignItems={{ default: 'alignItemsFlexStart' }}
          justifyContent={{ default: 'justifyContentSpaceBetween' }}
          gap={{ default: 'gapMd' }}
        >
          <FlexItem>
            <Title headingLevel="h1" size="3xl" className="provider-admin-workspace-page__title">
              {selectedSite.name}
            </Title>
            <Flex spaceItems={{ default: 'spaceItemsSm' }} className="pf-v6-u-mt-sm">
              <FlexItem>
                <Label color={statusColor(selectedSite.enrollmentStatus)} isCompact>
                  {selectedSite.enrollmentStatus}
                </Label>
              </FlexItem>
              <FlexItem>
                <Content component="small">{selectedSite.region}</Content>
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem alignSelf={{ default: 'alignSelfFlexStart' }}>
            <Button variant="secondary" onClick={() => setSelectedSite(null)}>
              Back to enrollment
            </Button>
          </FlexItem>
        </Flex>

        <Stack hasGutter>
          <StackItem>
            <Card>
              <CardHeader><CardTitle>Site identity</CardTitle></CardHeader>
              <CardBody>
                <DescriptionList isCompact>
                  <DescriptionListGroup>
                    <DescriptionListTerm>SPIFFE ID</DescriptionListTerm>
                    <DescriptionListDescription>
                      <code>{selectedSite.spiffeId}</code>
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>mTLS certificate expires</DescriptionListTerm>
                    <DescriptionListDescription>
                      {selectedSite.certExpiresAt
                        ? new Date(selectedSite.certExpiresAt).toLocaleDateString()
                        : '—'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Enrolled</DescriptionListTerm>
                    <DescriptionListDescription>
                      {selectedSite.enrolledAt
                        ? new Date(selectedSite.enrolledAt).toLocaleDateString()
                        : 'Not yet'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </CardBody>
            </Card>
          </StackItem>
          <StackItem>
            <Card>
              <CardHeader><CardTitle>Clusters at this site</CardTitle></CardHeader>
              <CardBody>
                <DescriptionList isCompact isHorizontal columnModifier={{ default: '2Col' }}>
                  <DescriptionListGroup>
                    <DescriptionListTerm>Clusters</DescriptionListTerm>
                    <DescriptionListDescription>{selectedSite.clusterCount}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>GPUs</DescriptionListTerm>
                    <DescriptionListDescription>
                      {selectedSite.gpuCount > 0
                        ? `${selectedSite.gpuCount}× ${selectedSite.gpuType}`
                        : '—'}
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              </CardBody>
            </Card>
          </StackItem>
        </Stack>
      </div>
    )
  }

  return (
    <div className="provider-admin-workspace-page">
      <ProviderAdminWorkspacePageHeader
        title="Grid enrollment"
        lede="Register sites into the AI Grid. Each site receives a one-time enrollment token to establish mTLS identity via SPIFFE."
        action={
          <Button variant="primary" onClick={() => setIsTokenModalOpen(true)}>
            Enroll new site
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle>Enrolled sites</CardTitle></CardHeader>
        <CardBody>
          <Table aria-label="Enrolled sites" className="catalog-data-table">
            <Thead>
              <Tr>
                <Th>Site name</Th>
                <Th>Region</Th>
                <Th>Status</Th>
                <Th>Clusters</Th>
                <Th>GPUs</Th>
                <Th>Cert expires</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sites.map((site) => (
                <Tr key={site.id}>
                  <Td dataLabel="Site name">
                    <Button variant="link" isInline onClick={() => setSelectedSite(site)}>
                      {site.name}
                    </Button>
                  </Td>
                  <Td dataLabel="Region">{site.region}</Td>
                  <Td dataLabel="Status">
                    <Label color={statusColor(site.enrollmentStatus)} isCompact>
                      {site.enrollmentStatus}
                    </Label>
                  </Td>
                  <Td dataLabel="Clusters">{site.clusterCount}</Td>
                  <Td dataLabel="GPUs">
                    {site.gpuCount > 0 ? `${site.gpuCount}× ${site.gpuType}` : '—'}
                  </Td>
                  <Td dataLabel="Cert expires">
                    {site.certExpiresAt
                      ? new Date(site.certExpiresAt).toLocaleDateString()
                      : '—'}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      <Modal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        variant="medium"
      >
        <ModalHeader title="Enroll a new site" />
        <ModalBody>
          <Stack hasGutter>
            <StackItem>
              <Content component="p">
                Enter the site name to generate a one-time enrollment token. The site operator
                redeems this token to establish mTLS identity and join the grid.
              </Content>
            </StackItem>
            <StackItem>
              <TextInput
                id="enroll-site-name"
                value={newSiteName}
                onChange={(_e, v) => setNewSiteName(v)}
                placeholder="e.g. us-west-2-dc-b"
                aria-label="Site name"
              />
            </StackItem>
            {newSiteName.trim() && (
              <StackItem>
                <Content component="p" className="pf-v6-u-font-weight-bold pf-v6-u-mb-sm">
                  Enrollment token (one-time use):
                </Content>
                <ClipboardCopy isReadOnly isExpanded hoverTip="Copy" clickTip="Copied">
                  {demoToken}
                </ClipboardCopy>
                <Content component="small" className="pf-v6-u-mt-sm pf-v6-u-color-200">
                  Run on the site: <code>grid-enroll --token &lt;token&gt;</code>
                </Content>
              </StackItem>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" isDisabled={!newSiteName.trim()} onClick={() => {
            setIsTokenModalOpen(false)
            setNewSiteName('')
          }}>
            Done
          </Button>
          <Button variant="link" onClick={() => { setIsTokenModalOpen(false); setNewSiteName('') }}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
