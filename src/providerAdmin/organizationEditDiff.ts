import {
  normalizeAdditionalDomains,
  normalizePrimaryDomain,
  type RegisterOrganizationForm,
  type RegisteredOrganization,
  type TenantOnboardingStepId,
} from './organizations'
import {
  editSnapshotValue,
  getEditChanges,
  getEditModifiedStepIds,
  type EditSnapshotValue,
} from '../shared/editDiff'

type OrganizationEditSnapshot = {
  organizationName: EditSnapshotValue
  displayName: EditSnapshotValue
  primaryDomain: EditSnapshotValue
  additionalDomains: EditSnapshotValue
  logo: EditSnapshotValue
  m360AccountId: EditSnapshotValue
  idpProtocol: EditSnapshotValue
  idpIssuerUrl: EditSnapshotValue
  claimMappings: EditSnapshotValue
}

function formatAdditionalDomains(domains: string[], primaryDomain: string): string {
  const normalized = normalizeAdditionalDomains(domains, primaryDomain)
  return normalized.length > 0 ? normalized.join(', ') : '—'
}

function formatLogo(logoSrc: string, logoFileName: string): string {
  if (!logoSrc.trim()) {
    return '—'
  }

  return logoFileName.trim() || 'Custom logo'
}

export function buildOrganizationEditSnapshot(
  form: RegisterOrganizationForm,
  options?: { m360AccountId?: string },
): OrganizationEditSnapshot {
  const primaryDomain = normalizePrimaryDomain(form.primaryDomain)
  const additionalDomains = normalizeAdditionalDomains(form.additionalDomains, primaryDomain)
  const m360AccountId = (options?.m360AccountId ?? form.m360AccountId).trim()

  const idpProtocol = form.idpConfig?.protocol ?? 'oidc'
  const idpIssuerUrl = form.idpConfig?.issuerUrl?.trim() ?? ''
  const claimMappingsStr = JSON.stringify(form.claimMappings ?? [])

  return {
    organizationName: editSnapshotValue(form.organizationName, form.organizationName.trim() || '—'),
    displayName: editSnapshotValue(form.displayName, form.displayName.trim() || '—'),
    primaryDomain: editSnapshotValue(form.primaryDomain, primaryDomain || '—'),
    additionalDomains: editSnapshotValue(
      JSON.stringify(additionalDomains),
      formatAdditionalDomains(form.additionalDomains, primaryDomain),
    ),
    logo: editSnapshotValue(
      form.logoSrc.trim(),
      formatLogo(form.logoSrc, form.logoFileName),
    ),
    m360AccountId: editSnapshotValue(m360AccountId, m360AccountId || '—'),
    idpProtocol: editSnapshotValue(idpProtocol, idpProtocol.toUpperCase()),
    idpIssuerUrl: editSnapshotValue(idpIssuerUrl, idpIssuerUrl || '—'),
    claimMappings: editSnapshotValue(claimMappingsStr, claimMappingsStr),
  }
}

export function buildOrganizationEditSnapshotFromOrganization(
  organization: RegisteredOrganization,
): OrganizationEditSnapshot {
  return buildOrganizationEditSnapshot({
    organizationName: organization.name,
    displayName: organization.displayName?.trim() || organization.name,
    primaryDomain: organization.primaryDomain,
    additionalDomains:
      organization.additionalDomains.length > 0 ? [...organization.additionalDomains] : [],
    m360AccountId: organization.m360AccountId?.trim() || organization.billingAccountId.trim(),
    billingAccountId: organization.billingAccountId,
    billingAccountName: organization.billingAccountName,
    externalIpPoolId: organization.externalIpPoolId ?? '',
    maxInstances: String(organization.maxInstances),
    logoSrc: organization.logoSrc?.trim() || '',
    logoFileName: organization.logoFileName?.trim() || '',
    breakGlassUsername: organization.breakGlassUsername?.trim() || '',
    breakGlassPassword: '',
    idpConfig: organization.idpConfig ?? {
      protocol: 'oidc',
      issuerUrl: '',
      clientId: '',
      clientSecret: '',
      keycloakRealm: '',
    },
    claimMappings: organization.claimMappings ?? [],
  })
}

export function getOrganizationEditChanges(
  baseline: OrganizationEditSnapshot,
  current: OrganizationEditSnapshot,
) {
  return getEditChanges(baseline, current, [
    { id: 'organizationName', stepId: 'general', label: 'Tenant name' },
    { id: 'displayName', stepId: 'general', label: 'Display name' },
    { id: 'primaryDomain', stepId: 'general', label: 'Primary email domain' },
    { id: 'additionalDomains', stepId: 'general', label: 'Additional email domains' },
    { id: 'logo', stepId: 'general', label: 'Company logo' },
    { id: 'm360AccountId', stepId: 'general', label: 'M360 billing account' },
    { id: 'idpProtocol', stepId: 'idp_federation', label: 'IdP protocol' },
    { id: 'idpIssuerUrl', stepId: 'idp_federation', label: 'Issuer URL' },
    { id: 'claimMappings', stepId: 'claim_mapping', label: 'Claim mappings' },
  ])
}

export function getOrganizationEditModifiedStepIds(
  changes: ReadonlyArray<{ stepId: TenantOnboardingStepId }>,
) {
  return getEditModifiedStepIds(changes)
}
