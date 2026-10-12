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
} from '@patternfly/react-core'
import { ModelsInstanceCard } from '../../../components/catalog/ModelsInstanceCard'
import {
  getVisionOrg,
  getVisionSite,
  type VisionCluster,
} from '../../../vision/fleetWorld'
import { modelsOnCluster } from '../../../vision/legacyModelInstanceSeed'
import { VisionGridCountHeading } from './VisionGridCountHeading'

type VisionClusterInspectorProps = {
  cluster: VisionCluster | null
}

export const VisionClusterInspector = ({ cluster }: VisionClusterInspectorProps) => {
  if (!cluster) {
    return (
      <Stack hasGutter>
        <StackItem>
          <Content component="p">
            This cluster is hidden by the tenant filter. Use Catalog or Services to return to the
            list.
          </Content>
        </StackItem>
      </Stack>
    )
  }

  const site = getVisionSite(cluster.siteId)
  const org = getVisionOrg(cluster.orgId)
  const isAvailable = cluster.health === 'available'
  const nestedModels = modelsOnCluster(cluster.id)

  const enrollmentColor =
    cluster.enrollmentStatus === 'active'
      ? 'green'
      : cluster.enrollmentStatus === 'frozen'
        ? 'orange'
        : 'blue'

  return (
    <Stack hasGutter>
      <StackItem>
        <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
          <FlexItem>
            <Label color={isAvailable ? 'green' : 'red'} isCompact>
              {isAvailable ? 'Available' : 'Unavailable'}
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
      <StackItem>
        <DescriptionList isCompact aria-label={`${cluster.name} details`}>
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
          <DescriptionListGroup>
            <DescriptionListTerm>Tenant</DescriptionListTerm>
            <DescriptionListDescription>{org.label}</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </StackItem>
      <StackItem>
        <VisionGridCountHeading
          id="vision-cluster-running-models"
          title="Model instances"
          count={nestedModels.length}
        />
      </StackItem>
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
  )
}
