import { Label, Flex, FlexItem } from '@patternfly/react-core'
import type { VisionCluster } from '../../../vision/fleetWorld'
import { deriveClusterHealth } from '../../../vision/fleetTimeSeries'

type VisionAttentionStripProps = {
  clusters: VisionCluster[]
  onSelectCluster: (clusterId: string) => void
}

export function VisionAttentionStrip({ clusters, onSelectCluster }: VisionAttentionStripProps) {
  const unhealthy = clusters
    .map((cluster) => {
      const queueDepth = cluster.gpuUtilPercent > 85 ? 55 : 8
      const health = deriveClusterHealth(
        cluster.gpuUtilPercent,
        queueDepth,
        180,
        cluster.health === 'available' ? 1 : 0,
      )
      if (health.level === 'green') return null
      return { cluster, health }
    })
    .filter(Boolean) as { cluster: VisionCluster; health: ReturnType<typeof deriveClusterHealth> }[]

  if (unhealthy.length === 0) return null

  return (
    <div className="vision-attention-strip">
      <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'wrap' }}>
        {unhealthy.map(({ cluster, health }) => (
          <FlexItem key={cluster.id}>
            <Label
              color={health.level === 'red' ? 'red' : 'orange'}
              isCompact
              onClick={() => onSelectCluster(cluster.id)}
              className="vision-attention-strip__chip"
            >
              {cluster.name}: {health.reasons[0]?.message ?? 'unhealthy'}
            </Label>
          </FlexItem>
        ))}
      </Flex>
    </div>
  )
}
