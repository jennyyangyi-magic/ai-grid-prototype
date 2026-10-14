import type { M360ConnectionStatus } from '../billing/m360'
import {
  findM360AccountByReference,
  findM360AccountByTenantName,
  listM360PortalAccounts,
} from '../billing/m360Accounts'
import {
  DEMO_TENANT_DISPLAY_ADMIN,
  DEMO_TENANT_LOGIN_EMAIL_ADMIN,
  DEMO_TENANT_LOGIN_EMAIL_USER,
  DEMO_TENANT_LABEL,
} from '../demoTenant'

export type IdentityProviderProtocol = 'OIDC' | 'SAML'

export type OrganizationAssignedRoleId =
  | 'tenant-administrator'
  | 'tenant-reader'
  | 'tenant-user'

export type OrganizationRoleAssignment = {
  name: string
  email: string
  roleId?: OrganizationAssignedRoleId
}

export function isOrganizationAssignedRoleId(
  value: unknown,
): value is OrganizationAssignedRoleId {
  return (
    value === 'tenant-administrator' ||
    value === 'tenant-reader' ||
    value === 'tenant-user'
  )
}

export function isTenantAdministratorAssignment(
  assignment: OrganizationRoleAssignment,
): boolean {
  return !assignment.roleId || assignment.roleId === 'tenant-administrator'
}

export type OrganizationIdentityProvider = {
  id: string
  name: string
  displayName: string
  protocol: IdentityProviderProtocol
  issuerUrl: string
  clientId: string
}

export type IdpInviteStatus = 'none' | 'pending' | 'accepted' | 'expired'

export type IdentityProviderConnectedBy = 'provider-admin' | 'idp-manager'

/** Tenant billing onboarding progress — distinct from IdP configuration. */
export type TenantSetupStatus = 'incomplete' | 'billing_configured' | 'ready'

export type RegisteredOrganization = {
  id: string
  name: string
  tenantId: string
  slug: string
  /** Primary email domain used for IdP association and RBAC tenancy. */
  primaryDomain: string
  /** Extra email domains covered by the same IdP. Set when connecting identity. */
  additionalDomains: string[]
  /** Human-readable tenant name shown in workspace branding. */
  displayName?: string
  /** Mapped M360 tenant / billing account identifier. */
  m360AccountId?: string
  m360ConnectionStatus?: M360ConnectionStatus
  /**
   * Shared M360 rate card applied to this tenant (flat rate for all tenants in MVP).
   * Not selected or created in OSAC.
   */
  m360RateCardId?: string
  m360RateCardName?: string
  /** True after the Provider admin confirms the OSAC ↔ M360 link. */
  billingAccountLinked?: boolean
  /** Billing onboarding state — separate from IdP setup. */
  tenantSetupStatus?: TenantSetupStatus
  billingAccountId: string
  billingAccountName: string
  /** Tenant company mark (data URL or public path). Shown on tenant login and workspace. */
  logoSrc: string | null
  logoFileName: string | null
  catalogItemId: string | null
  catalogDisplayName: string | null
  externalIpPoolId: string | null
  externalIpPoolName: string | null
  externalIpPoolCidr: string | null
  maxInstances: number
  /** Kept for demo activation flows; assigned later via Roles in production. */
  tenantAdminName: string
  tenantAdminEmail: string
  /** Optional additional tenant admins from Define roles, plus reader/user assignments. */
  additionalTenantAdmins: OrganizationRoleAssignment[]
  /** Optional day-0 tenant user invites; supports paste or CSV upload in Define roles. */
  invitedTenantUserEmails: string[]
  /** Org-scoped IdP connected after registration. */
  identityProviderConnected: boolean
  /** Who completed the first IdP connection. Null until connected. */
  identityProviderConnectedBy: IdentityProviderConnectedBy | null
  identityProviderName: string | null
  identityProviderDisplayName: string | null
  identityProviderProtocol: 'OIDC' | 'SAML' | null
  identityProviderIssuerUrl: string | null
  identityProviderClientId: string | null
  /** Identity providers connected by the break-glass / IdP manager workspace. */
  identityProviders: OrganizationIdentityProvider[]
  /**
   * IdP manager handoff (Path B). Provider copies break-glass credentials and an
   * OSAC link to send out of band. Path A still lets the provider connect IdP.
   */
  idpManagerEmail: string | null
  idpInviteToken: string | null
  idpInviteStatus: IdpInviteStatus
  idpInviteSentAt: string | null
  idpInviteExpiresAt: string | null
  /** Emergency break-glass custodian who receives the credentials. */
  breakGlassName: string | null
  breakGlassEmail: string | null
  /** Platform-local username; does not authenticate through the organization IdP. */
  breakGlassUsername: string | null
  breakGlassPassword: string | null
  breakGlassIssuedAt: string | null
  /** Org-scoped roles + first tenant admin assigned after registration. */
  rbacConfigured: boolean
  /** AI Grid IdP federation config set during onboarding. */
  idpConfig?: IdpFederationConfig | null
  /** AI Grid OIDC claim mappings: source IdP group → grid role. */
  claimMappings?: ClaimMapping[]
  status: 'Pending activation' | 'Active'
  createdAt: string
}

export function resolveIdentityProviderConnectedBy(organization: {
  identityProviderConnected: boolean
  identityProviderConnectedBy?: IdentityProviderConnectedBy | null
  idpInviteStatus: IdpInviteStatus
}): IdentityProviderConnectedBy | null {
  if (!organization.identityProviderConnected) {
    return null
  }
  if (
    organization.identityProviderConnectedBy === 'provider-admin' ||
    organization.identityProviderConnectedBy === 'idp-manager'
  ) {
    return organization.identityProviderConnectedBy
  }
  return organization.idpInviteStatus === 'accepted' ? 'idp-manager' : 'provider-admin'
}

export function identityProviderConnectedByLabel(
  connectedBy: IdentityProviderConnectedBy,
): string {
  return connectedBy === 'idp-manager' ? 'IdP manager' : 'Provider admin'
}

export const IDP_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type OrganizationSetupNextAction = 'billing' | 'idp' | 'rbac'

export type IdpFederationConfig = {
  protocol: 'oidc' | 'saml'
  issuerUrl: string
  clientId: string
  clientSecret: string
  keycloakRealm: string
}

export type ClaimMapping = {
  sourceGroup: string
  gridRole: string
}

export const TENANT_ONBOARDING_STEPS = [
  { id: 'general', label: 'General' },
  { id: 'idp_federation', label: 'IdP federation' },
  { id: 'claim_mapping', label: 'Claim mapping' },
  { id: 'review', label: 'Review' },
] as const

export type TenantOnboardingStepId = (typeof TENANT_ONBOARDING_STEPS)[number]['id']

export function resolveTenantSetupStatus(
  organization: RegisteredOrganization,
): TenantSetupStatus {
  if (organization.tenantSetupStatus) {
    return organization.tenantSetupStatus
  }

  const m360AccountId =
    organization.m360AccountId?.trim() || organization.billingAccountId.trim()
  const isLinked =
    organization.billingAccountLinked === true ||
    organization.m360ConnectionStatus === 'connected'

  if (isLinked && m360AccountId) {
    return 'ready'
  }

  if (m360AccountId) {
    return 'billing_configured'
  }

  return 'incomplete'
}

export function getTenantSetupStatusLabel(status: TenantSetupStatus): string {
  switch (status) {
    case 'incomplete':
      return 'Incomplete'
    case 'billing_configured':
      return 'Billing configured'
    case 'ready':
      return 'Ready for provisioning'
  }
}

export function getTenantSetupStatusColor(
  status: TenantSetupStatus,
): 'orange' | 'blue' | 'green' {
  switch (status) {
    case 'incomplete':
      return 'orange'
    case 'billing_configured':
      return 'blue'
    case 'ready':
      return 'green'
  }
}

export function isTenantReadyForProvisioning(organization: RegisteredOrganization): boolean {
  return resolveTenantSetupStatus(organization) === 'ready'
}

export function isTenantBillingConfigured(organization: RegisteredOrganization): boolean {
  const status = resolveTenantSetupStatus(organization)
  return status === 'billing_configured' || status === 'ready'
}

export function isOrganizationBillingPending(organization: RegisteredOrganization): boolean {
  return !isTenantBillingConfigured(organization)
}

export function getOrganizationBillingPendingTooltip(
  organization: RegisteredOrganization,
): string {
  const accounts = listM360PortalAccounts()
  const account =
    findM360AccountByTenantName(organization.name, accounts) ??
    findM360AccountByReference(organization.m360AccountId ?? '', accounts) ??
    findM360AccountByTenantName(organization.tenantId, accounts)

  if (account?.accountStatus === 'Inactive') {
    return 'Billing not linked. M360 account is inactive.'
  }

  return 'Finish tenant billing setup to publish.'
}

export function getOrganizationBillingAccountDisplay(
  organization: RegisteredOrganization,
): string {
  const reference =
    organization.m360AccountId?.trim() ||
    organization.billingAccountId.trim() ||
    organization.billingAccountName.trim()

  return reference || '—'
}

export function generateIdpInviteToken(): string {
  return `idpinv-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}

export function identityProviderProtocolLabel(protocol: IdentityProviderProtocol): string {
  return protocol === 'SAML' ? 'SAML 2.0' : 'OpenID Connect (OIDC)'
}

export function migrateLegacyIdentityProviderClientId(clientId: string): string {
  if (clientId === 'bmaas-northstar' || clientId === 'bmaas-northsummit') {
    return 'north-summit-bank'
  }
  if (clientId === 'bmaas-harborline') {
    return 'harborline-capital'
  }
  return clientId
}

export function buildDefaultIdentityProviderClientId(
  organization: Pick<RegisteredOrganization, 'name' | 'slug'>,
  existingClientIds: readonly string[] = [],
): string {
  const base = organization.name.trim() || organization.slug.trim() || 'osac-client'
  const taken = new Set(
    existingClientIds.map((clientId) => clientId.trim().toLowerCase()).filter(Boolean),
  )
  if (!taken.has(base.toLowerCase())) {
    return base
  }

  let suffix = 2
  let candidate = `${base}-${suffix}`
  while (taken.has(candidate.toLowerCase())) {
    suffix += 1
    candidate = `${base}-${suffix}`
  }
  return candidate
}

export function normalizeOrganizationIdentityProviders(
  value: unknown,
): OrganizationIdentityProvider[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) {
      return []
    }

    const provider = entry as Partial<OrganizationIdentityProvider>
    const displayName =
      typeof provider.displayName === 'string' ? provider.displayName.trim() : ''
    const issuerUrl = typeof provider.issuerUrl === 'string' ? provider.issuerUrl.trim() : ''
    const clientId =
      typeof provider.clientId === 'string'
        ? migrateLegacyIdentityProviderClientId(provider.clientId.trim())
        : ''
    const protocol = provider.protocol === 'SAML' || provider.protocol === 'OIDC' ? provider.protocol : null
    const id = typeof provider.id === 'string' ? provider.id.trim() : ''

    if (!displayName || !issuerUrl || !clientId || !protocol || !id) {
      return []
    }

    return [
      {
        id,
        name:
          typeof provider.name === 'string' && provider.name.trim()
            ? provider.name.trim()
            : displayName,
        displayName,
        protocol,
        issuerUrl,
        clientId,
      },
    ]
  })
}

export function hydrateIdentityProvidersFromOrganizationFields(organization: {
  id: string
  primaryDomain: string
  identityProviderConnected: boolean
  identityProviderName: string | null
  identityProviderDisplayName: string | null
  identityProviderProtocol: IdentityProviderProtocol | null
  identityProviderIssuerUrl: string | null
  identityProviderClientId: string | null
  identityProviders?: OrganizationIdentityProvider[]
}): OrganizationIdentityProvider[] {
  const existing = organization.identityProviders ?? []
  if (existing.length > 0) {
    return existing
  }

  const displayName = organization.identityProviderDisplayName?.trim()
  const issuerUrl = organization.identityProviderIssuerUrl?.trim()
  const clientId = organization.identityProviderClientId?.trim()
  const protocol = organization.identityProviderProtocol
  if (
    !organization.identityProviderConnected ||
    !displayName ||
    !issuerUrl ||
    !clientId ||
    !protocol
  ) {
    return []
  }

  return [
    {
      id: `idp-${organization.id}-primary`,
      name:
        organization.identityProviderName?.trim() ||
        buildDemoIdentityProviderName(protocol, organization.primaryDomain),
      displayName,
      protocol,
      issuerUrl,
      clientId,
    },
  ]
}

export function resolveOrganizationIdentityProviders(
  organization: RegisteredOrganization,
): OrganizationIdentityProvider[] {
  return hydrateIdentityProvidersFromOrganizationFields(organization)
}

export function createIdpInviteTimestamps(now = Date.now()): {
  idpInviteSentAt: string
  idpInviteExpiresAt: string
} {
  return {
    idpInviteSentAt: new Date(now).toISOString(),
    idpInviteExpiresAt: new Date(now + IDP_INVITE_TTL_MS).toISOString(),
  }
}

export function isIdpInviteExpired(organization: RegisteredOrganization, now = Date.now()): boolean {
  if (!organization.idpInviteExpiresAt) {
    return false
  }

  return new Date(organization.idpInviteExpiresAt).getTime() <= now
}

export function hasPendingIdpInvite(organization: RegisteredOrganization, now = Date.now()): boolean {
  if (organization.identityProviderConnected) {
    return false
  }

  if (organization.idpInviteStatus !== 'pending' || !organization.idpInviteToken) {
    return false
  }

  return !isIdpInviteExpired(organization, now)
}

export type BreakGlassCustodian = {
  name: string
  email: string
}

export type BreakGlassIssuePatch = Pick<
  RegisteredOrganization,
  | 'breakGlassName'
  | 'breakGlassEmail'
  | 'breakGlassUsername'
  | 'breakGlassPassword'
  | 'breakGlassIssuedAt'
>

export const DEMO_BLUESOLACE_COMPANY_LOGO_FILE_NAME = 'bluesolace-financial-group-logo.png'
export const DEMO_NORTH_SUMMIT_BANK_COMPANY_LOGO_FILE_NAME = 'north-summit-bank-logo.svg'
export const DEMO_HARBORLINE_CAPITAL_COMPANY_LOGO_FILE_NAME = 'harborline-capital-logo.svg'
export const DEMO_REDWOOD_MUTUAL_COMPANY_LOGO_FILE_NAME = 'redwood-mutual-logo.svg'

export function getDemoBluesolaceCompanyLogoSrc(): string {
  return `${import.meta.env.BASE_URL}${DEMO_BLUESOLACE_COMPANY_LOGO_FILE_NAME}`
}

export function getDemoNorthSummitBankCompanyLogoSrc(): string {
  return `${import.meta.env.BASE_URL}${DEMO_NORTH_SUMMIT_BANK_COMPANY_LOGO_FILE_NAME}`
}

export function getDemoHarborlineCapitalCompanyLogoSrc(): string {
  return `${import.meta.env.BASE_URL}${DEMO_HARBORLINE_CAPITAL_COMPANY_LOGO_FILE_NAME}`
}

export function getDemoRedwoodMutualCompanyLogoSrc(): string {
  return `${import.meta.env.BASE_URL}${DEMO_REDWOOD_MUTUAL_COMPANY_LOGO_FILE_NAME}`
}

const DEMO_COMPANY_LOGO_FILE_NAMES = new Set([
  DEMO_BLUESOLACE_COMPANY_LOGO_FILE_NAME,
  DEMO_NORTH_SUMMIT_BANK_COMPANY_LOGO_FILE_NAME,
  DEMO_HARBORLINE_CAPITAL_COMPANY_LOGO_FILE_NAME,
  DEMO_REDWOOD_MUTUAL_COMPANY_LOGO_FILE_NAME,
])

/**
 * Rewrite demo logo paths so they keep working when the app base changes
 * (local `/` vs GitHub Pages `/osac-bmaas/`), or when only a filename was stored.
 */
export function normalizeDemoCompanyLogoSrc(logoSrc: string | null | undefined): string | null {
  const raw = logoSrc?.trim()
  if (!raw) {
    return null
  }

  if (raw.startsWith('data:')) {
    return raw
  }

  const fileName = raw.split('/').pop()?.split('?')[0]?.trim() || ''
  if (!fileName || !DEMO_COMPANY_LOGO_FILE_NAMES.has(fileName)) {
    return raw
  }

  return `${import.meta.env.BASE_URL}${fileName}`
}

export function isNorthSummitBankOrganization(
  organization: Pick<RegisteredOrganization, 'slug'>,
): boolean {
  const slug = organization.slug.trim().toLowerCase()
  return slug === 'northsummit' || slug === 'northstar' || slug === 'north-summit-bank'
}

export function isHarborlineCapitalOrganization(
  organization: Pick<RegisteredOrganization, 'slug'>,
): boolean {
  const slug = organization.slug.trim().toLowerCase()
  return slug === 'harborline' || slug === 'harborline-capital'
}

export function isRedwoodMutualOrganization(
  organization: Pick<RegisteredOrganization, 'slug'>,
): boolean {
  const slug = organization.slug.trim().toLowerCase()
  return slug === 'redwood' || slug === 'redwood-mutual'
}

export function getOrganizationNameInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return '?'
  }

  return trimmed.charAt(0).toUpperCase()
}

export function resolveOrganizationCompanyLogo(
  organization: Pick<RegisteredOrganization, 'slug'> & {
    name?: string
    logoSrc?: string | null
  },
): string | null {
  const raw = organization.logoSrc?.trim() || ''

  // Keep user-uploaded data URLs as-is.
  if (raw.startsWith('data:')) {
    return raw
  }

  const slug = organization.slug.trim().toLowerCase()
  if (
    slug === 'evergreen' ||
    slug === 'bluesolace' ||
    slug === 'bluesolace-financial-group'
  ) {
    return getDemoBluesolaceCompanyLogoSrc()
  }

  if (
    slug === 'northsummit' ||
    slug === 'northstar' ||
    slug === 'north-summit-bank'
  ) {
    return getDemoNorthSummitBankCompanyLogoSrc()
  }

  if (slug === 'harborline' || slug === 'harborline-capital') {
    return getDemoHarborlineCapitalCompanyLogoSrc()
  }

  if (slug === 'redwood' || slug === 'redwood-mutual') {
    return getDemoRedwoodMutualCompanyLogoSrc()
  }

  return normalizeDemoCompanyLogoSrc(raw)
}

export function generateBreakGlassUsername(slug: string): string {
  const normalized = slug.trim().toLowerCase() || 'org'
  if (
    normalized === 'evergreen' ||
    normalized === 'bluesolace' ||
    normalized === 'bluesolace-financial-group'
  ) {
    return 'breakglass-bluesolace'
  }
  if (normalized === 'northstar' || normalized === 'northsummit') {
    return 'breakglass-northsummit'
  }
  return `breakglass-${normalized}`
}

function breakGlassPasswordLabel(slug: string): string {
  const normalized = slug.trim().toLowerCase() || 'org'
  if (
    normalized === 'evergreen' ||
    normalized === 'bluesolace' ||
    normalized === 'bluesolace-financial-group'
  ) {
    return 'bluesolace'
  }
  if (normalized === 'northstar') {
    return 'northsummit'
  }
  return normalized
}

/** Rewrite leftover demo passwords that used stored evergreen or northstar slugs. */
export function rewriteBreakGlassPassword(password: string): string {
  const rewritten = password
    .replace(/^BG-evergreen-/i, 'BG-bluesolace-')
    .replace(/^BG-northstar-/i, 'BG-northsummit-')

  // One-time IdP-wizard tokens (e.g. BG-bluesolace-yy6mbv) are not a second account.
  if (/^BG-bluesolace-[a-z0-9]{6}$/i.test(rewritten)) {
    return getDemoBreakGlassPassword('bluesolace')
  }

  return rewritten
}

/** Stable demo password for seeded orgs; new issues use a one-time token. */
export function getDemoBreakGlassPassword(slug: string): string {
  return `BG-${breakGlassPasswordLabel(slug)}-vault`
}

export function generateBreakGlassPassword(slug: string): string {
  const token = Math.random().toString(36).slice(2, 8)
  return `BG-${breakGlassPasswordLabel(slug)}-${token}`
}

export function resolveBreakGlassUsername(
  organization: Pick<RegisteredOrganization, 'slug' | 'breakGlassUsername'>,
): string {
  const existing = organization.breakGlassUsername?.trim()
  if (
    !existing ||
    existing.toLowerCase() === 'breakglass-evergreen' ||
    existing.toLowerCase() === 'breakglass-northstar'
  ) {
    return generateBreakGlassUsername(organization.slug)
  }
  return existing
}

export function hasBreakGlassAccount(organization: RegisteredOrganization): boolean {
  return Boolean(organization.breakGlassUsername?.trim() && organization.breakGlassPassword?.trim())
}

export function buildBreakGlassIssuePatch(
  organization: Pick<
    RegisteredOrganization,
    'slug' | 'breakGlassUsername' | 'breakGlassPassword' | 'breakGlassIssuedAt'
  > &
    Partial<Pick<RegisteredOrganization, 'breakGlassName' | 'breakGlassEmail'>>,
  custodian?: BreakGlassCustodian,
): BreakGlassIssuePatch {
  const username = resolveBreakGlassUsername(organization)
  const password = resolveRegisterBreakGlassPassword(
    organization.slug,
    organization.breakGlassPassword,
  )
  const email = custodian?.email.trim() || organization.breakGlassEmail?.trim() || ''

  return {
    breakGlassName:
      custodian?.name.trim() || organization.breakGlassName?.trim() || null,
    breakGlassEmail: email ? email.toLowerCase() : null,
    breakGlassUsername: username,
    breakGlassPassword: password,
    breakGlassIssuedAt: organization.breakGlassIssuedAt ?? new Date().toISOString(),
  }
}

export function defaultBreakGlassCustodianEmail(primaryDomain: string): string {
  return `idp-admin@${normalizePrimaryDomain(primaryDomain) || 'example.com'}`
}

export function resolveRegisterBreakGlassPassword(
  slug: string,
  existingPassword?: string | null,
): string {
  if (existingPassword?.trim()) {
    return rewriteBreakGlassPassword(existingPassword.trim())
  }

  const normalized = slug.trim().toLowerCase()
  if (
    normalized === 'evergreen' ||
    normalized === 'bluesolace' ||
    normalized === 'bluesolace-financial-group' ||
    normalized === 'northsummit' ||
    normalized === 'northstar' ||
    normalized === 'harborline'
  ) {
    return getDemoBreakGlassPassword(normalized)
  }

  return generateBreakGlassPassword(slug)
}

export function buildRegisterBreakGlassFields(
  organizationName: string,
  primaryDomain: string,
  existing?: {
    breakGlassName?: string | null
    breakGlassEmail?: string | null
    breakGlassUsername?: string | null
    breakGlassPassword?: string | null
    slug?: string | null
  } | null,
): {
  breakGlassName: string
  breakGlassEmail: string
  breakGlassUsername: string
  breakGlassPassword: string
} {
  const slug = slugifyOrganizationName(organizationName) || existing?.slug?.trim() || 'org'

  return {
    breakGlassName: existing?.breakGlassName?.trim() || 'IdP manager',
    breakGlassEmail:
      existing?.breakGlassEmail?.trim() || defaultBreakGlassCustodianEmail(primaryDomain),
    breakGlassUsername: existing?.breakGlassUsername?.trim() || generateBreakGlassUsername(slug),
    breakGlassPassword: resolveRegisterBreakGlassPassword(slug, existing?.breakGlassPassword),
  }
}

/** Pending IdP manager invites that can be opened from the demo landing page. */
export function getPendingIdpManagerInvites(
  organizations: RegisteredOrganization[],
  now = Date.now(),
): Array<{ organization: RegisteredOrganization; token: string }> {
  return organizations
    .filter((organization) => hasPendingIdpInvite(organization, now) && organization.idpInviteToken)
    .map((organization) => ({
      organization,
      token: organization.idpInviteToken as string,
    }))
}

/** In-app route for the IdP Manager single-use setup page. */
export function getIdpManagerSetupRoute(token: string): string {
  return `/idp-setup/${encodeURIComponent(token)}`
}

/** Public IdP manager URL segment for the BlueSolace onboarding demo. */
export const DEMO_IDP_MANAGER_URL_SLUG = 'bluesolace'

/** Stored organization slug that backs the BlueSolace IdP manager demo. */
export const DEMO_IDP_MANAGER_ORG_SLUG = 'evergreen'
export const DEMO_BLUESOLACE_ORG_ID = 'org-bluesolace-financial-group'
export const DEMO_BLUESOLACE_TENANT_ID = DEMO_TENANT_LABEL.evergreen

export function getIdpManagerUrlSlug(slug = DEMO_IDP_MANAGER_URL_SLUG): string {
  const normalized = slug.trim().toLowerCase()
  if (
    normalized === '' ||
    normalized === DEMO_IDP_MANAGER_ORG_SLUG ||
    normalized === DEMO_IDP_MANAGER_URL_SLUG ||
    normalized === 'evergreen' ||
    normalized === 'northstar' ||
    normalized === 'bluesolace-financial-group'
  ) {
    return DEMO_IDP_MANAGER_URL_SLUG
  }
  return normalized
}

/** Map an IdP manager URL slug to the stored organization slug. */
export function getIdpManagerOrganizationSlug(urlSlug: string): string {
  const normalized = urlSlug.trim().toLowerCase()
  if (
    normalized === DEMO_IDP_MANAGER_URL_SLUG ||
    normalized === 'evergreen' ||
    normalized === 'bluesolace-financial-group'
  ) {
    return DEMO_IDP_MANAGER_ORG_SLUG
  }
  return normalized
}

export function findOrganizationForIdpManagerUrlSlug(
  organizations: RegisteredOrganization[],
  urlSlug: string,
): RegisteredOrganization | null {
  const normalized = urlSlug.trim().toLowerCase()
  const storedSlug = getIdpManagerOrganizationSlug(normalized)
  return (
    organizations.find((organization) => organization.slug.toLowerCase() === storedSlug) ??
    organizations.find((organization) => organization.slug.toLowerCase() === normalized) ??
    null
  )
}

/** Break-glass sign-in for an organization IdP manager. */
export function getIdpManagerPrototypeRoute(slug = DEMO_IDP_MANAGER_URL_SLUG): string {
  return `/idp-manager/${encodeURIComponent(getIdpManagerUrlSlug(slug))}`
}

export function getIdpManagerChangePasswordRoute(slug: string): string {
  return `${getIdpManagerPrototypeRoute(slug)}/change-password`
}

export function getIdpManagerWorkspaceRoute(slug: string): string {
  return `${getIdpManagerPrototypeRoute(slug)}/workspace`
}

/** Full browser path including the app basename (e.g. GitHub Pages). */
export function getIdpManagerSetupPath(token: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalizedBase}${getIdpManagerSetupRoute(token)}`
}

/** Org for the landing IdP manager shortcut: pending Path B first, else BlueSolace onboarding. */
export function resolveIdpManagerPrototypeOrganization(
  organizations: RegisteredOrganization[],
  now = Date.now(),
): RegisteredOrganization | null {
  const pending = getPendingIdpManagerInvites(organizations, now)
  const onboardingPending =
    pending.find((item) => item.organization.slug === DEMO_IDP_MANAGER_ORG_SLUG) ?? pending[0]
  if (
    onboardingPending &&
    onboardingPending.organization.slug !== 'northstar' &&
    onboardingPending.organization.slug !== 'northsummit'
  ) {
    return onboardingPending.organization
  }

  const onboardingOrg = findOrganizationForIdpManagerUrlSlug(
    organizations,
    DEMO_IDP_MANAGER_URL_SLUG,
  )
  if (onboardingOrg && hasBreakGlassAccount(onboardingOrg)) {
    return onboardingOrg
  }

  return null
}

/** Under-Status line: next incomplete step while setup is incomplete. */
export function getOrganizationSetupSignal(organization: RegisteredOrganization): string | null {
  const setupStatus = resolveTenantSetupStatus(organization)
  if (setupStatus === 'incomplete') {
    return 'Billing pending'
  }
  if (setupStatus === 'billing_configured') {
    return 'Billing account not linked'
  }

  if (!organization.identityProviderConnected) {
    if (hasPendingIdpInvite(organization)) {
      return 'Waiting on IdP Manager'
    }
    if (organization.idpInviteStatus === 'expired' || isIdpInviteExpired(organization)) {
      return 'IdP manager link expired'
    }
    return 'Needs identity provider'
  }

  if (!organization.rbacConfigured) {
    return 'Needs roles'
  }

  return null
}

export function isOrganizationReadyForLogin(organization: RegisteredOrganization): boolean {
  return organization.identityProviderConnected
}

/** Count primary + additional tenant admins with an email. */
export function getOrganizationTenantAdminCount(organization: RegisteredOrganization): number {
  const emails = [
    organization.tenantAdminEmail,
    ...organization.additionalTenantAdmins
      .filter(isTenantAdministratorAssignment)
      .map((admin) => admin.email),
  ]
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  return new Set(emails).size
}

export function formatOrganizationRolesAssignmentSummary(
  organization: RegisteredOrganization,
): string {
  const adminCount = getOrganizationTenantAdminCount(organization)
  const adminLabel = adminCount === 1 ? '1 tenant admin' : `${adminCount} tenant admins`
  return `${adminLabel} · Tenant users by email domain`
}

/** In-app OSAC login route for a tenant (Router `to` value). */
export function getOrganizationOsacLoginRoute(slug: string): string {
  return `/osac/${slug}`
}

/** Full browser OSAC login path including the app basename (e.g. GitHub Pages). */
export function getOrganizationOsacLoginPath(slug: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${normalizedBase}/osac/${slug}`
}

/** Single next kebab / Status-link action while setup is incomplete. */
export function getOrganizationSetupNextAction(
  organization: RegisteredOrganization,
): OrganizationSetupNextAction | null {
  const setupStatus = resolveTenantSetupStatus(organization)
  if (setupStatus !== 'ready') {
    return 'billing'
  }

  if (!organization.identityProviderConnected) {
    return 'idp'
  }

  if (!organization.rbacConfigured) {
    return 'rbac'
  }

  return null
}

export const ORGANIZATION_SETUP_NEXT_ACTION_LABEL: Record<OrganizationSetupNextAction, string> = {
  billing: 'Complete billing setup',
  idp: 'Set up identity provider',
  rbac: 'Assign roles',
}

export type OrganizationActivationStepId =
  | 'tenant_created'
  | 'billing_account'
  | 'idp'

export type OrganizationActivationStepStatus =
  | 'complete'
  | 'current'
  | 'pending'
  | 'problematic'

export type OrganizationActivationStep = {
  id: OrganizationActivationStepId
  label: string
  complete: boolean
  status: OrganizationActivationStepStatus
  description: string | null
}

function resolveOrganizationSetupM360Account(
  organization: RegisteredOrganization,
) {
  const accounts = listM360PortalAccounts()
  const linkedReference =
    organization.m360AccountId?.trim() || organization.billingAccountId.trim() || ''

  return (
    (linkedReference ? findM360AccountByReference(linkedReference, accounts) : null) ??
    findM360AccountByTenantName(organization.name, accounts) ??
    findM360AccountByTenantName(organization.tenantId, accounts)
  )
}

function isOrganizationSetupM360AccountInactive(
  organization: RegisteredOrganization,
): boolean {
  return resolveOrganizationSetupM360Account(organization)?.accountStatus === 'Inactive'
}

function formatOrganizationSetupTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getOrganizationBillingAccountStepDescription(
  organization: RegisteredOrganization,
): string {
  const accountId =
    organization.m360AccountId?.trim() || organization.billingAccountId.trim()
  if (!accountId) {
    return 'Not configured'
  }

  const accountLabel =
    organization.billingAccountName?.trim() ||
    resolveOrganizationSetupM360Account(organization)?.accountName?.trim() ||
    accountId

  if (isOrganizationSetupM360AccountInactive(organization)) {
    return `${accountLabel} · Billing account inactive`
  }

  return accountLabel
}

function getOrganizationIdentityProviderStepDescription(
  organization: RegisteredOrganization,
): string | null {
  if (!organization.identityProviderConnected) {
    if (hasPendingIdpInvite(organization)) {
      return organization.idpManagerEmail
        ? `Invite sent to ${organization.idpManagerEmail}`
        : 'Waiting on IdP manager'
    }

    return 'Not configured'
  }

  const parts = [
    organization.identityProviderProtocol,
    organization.identityProviderDisplayName || organization.identityProviderName,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : organization.identityProviderName
}

/** Vertical tenant setup timeline for the organization details page. */
export function getOrganizationActivationSteps(
  organization: RegisteredOrganization,
): OrganizationActivationStep[] {
  const m360AccountId =
    organization.m360AccountId?.trim() || organization.billingAccountId.trim()
  const billingAccountInactive = isOrganizationSetupM360AccountInactive(organization)
  const billingAccountComplete = Boolean(m360AccountId) && !billingAccountInactive
  const billingAccountProblematic = Boolean(m360AccountId) && billingAccountInactive
  const idpComplete = organization.identityProviderConnected

  const steps: Array<
    Omit<OrganizationActivationStep, 'status'> & { problematic?: boolean }
  > = [
    {
      id: 'tenant_created',
      label: 'Tenant created',
      complete: true,
      description: formatOrganizationSetupTimestamp(organization.createdAt),
    },
    {
      id: 'billing_account',
      label: 'M360 billing account',
      complete: billingAccountComplete,
      problematic: billingAccountProblematic,
      description: getOrganizationBillingAccountStepDescription(organization),
    },
    {
      id: 'idp',
      label: 'Identity provider',
      complete: idpComplete,
      description: getOrganizationIdentityProviderStepDescription(organization),
    },
  ]

  const firstIncompleteIndex = steps.findIndex(
    (step) => !step.complete && !step.problematic,
  )

  return steps.map((step, index) => ({
    id: step.id,
    label: step.label,
    complete: step.complete,
    description: step.description,
    status:
      step.complete
        ? 'complete'
        : step.problematic
          ? 'problematic'
          : index === firstIncompleteIndex
            ? 'current'
            : 'pending',
  }))
}

export function buildDemoIdentityProviderName(
  protocol: 'OIDC' | 'SAML',
  primaryDomain: string,
): string {
  const domain = primaryDomain.trim() || 'tenant'
  return `${protocol} · ${domain}`
}

/** Stable id for the Organizations page baseline row. */
export const DEMO_NORTH_SUMMIT_BANK_ORG_ID = 'org-northsummit-bank'
export const DEMO_NORTH_SUMMIT_BANK_ORG_NAME = DEMO_TENANT_LABEL.northsummit
export const DEMO_NORTH_SUMMIT_BANK_TENANT_ID = DEMO_NORTH_SUMMIT_BANK_ORG_NAME
export const DEMO_NORTH_SUMMIT_BANK_SLUG = 'northsummit'
export const DEMO_NORTH_SUMMIT_BANK_PRIMARY_DOMAIN = 'northsummitbank.com'
export const DEMO_NORTH_SUMMIT_BANK_ADDITIONAL_DOMAIN = 'northsummitbank.net'
export const DEMO_NORTH_SUMMIT_BANK_IDP_DISPLAY_NAME = `${DEMO_NORTH_SUMMIT_BANK_ORG_NAME}-idp`
export const DEMO_NORTH_SUMMIT_BANK_IDP_CLIENT_ID = DEMO_NORTH_SUMMIT_BANK_ORG_NAME
export const DEMO_NORTH_SUMMIT_BANK_BILLING_ACCOUNT_NAME =
  'north-summit-bank-enterprise-billing'

/** Second demo enterprise for VIP visibility multi-select (not BlueSolace). */
export const DEMO_HARBORLINE_CAPITAL_ORG_ID = 'org-harborline-capital'
export const DEMO_HARBORLINE_CAPITAL_NAME = 'harborline-capital'
export const DEMO_HARBORLINE_CAPITAL_TENANT_ID = DEMO_HARBORLINE_CAPITAL_NAME
export const DEMO_HARBORLINE_CAPITAL_SLUG = 'harborline'
export const DEMO_HARBORLINE_CAPITAL_DOMAIN = 'harborlinecapital.com'

export const DEMO_REDWOOD_MUTUAL_ORG_ID = 'org-redwood-mutual'
export const DEMO_REDWOOD_MUTUAL_NAME = 'redwood-mutual'
export const DEMO_REDWOOD_MUTUAL_TENANT_ID = DEMO_REDWOOD_MUTUAL_NAME
export const DEMO_REDWOOD_MUTUAL_SLUG = 'redwood'
export const DEMO_REDWOOD_MUTUAL_DOMAIN = 'redwoodmutual.com'
export const DEMO_REDWOOD_MUTUAL_DISPLAY_NAME = 'Redwood Mutual'
export const DEMO_REDWOOD_MUTUAL_IDP_DISPLAY_NAME = `${DEMO_REDWOOD_MUTUAL_NAME}-idp`
export const DEMO_REDWOOD_MUTUAL_IDP_CLIENT_ID = DEMO_REDWOOD_MUTUAL_NAME

export const REGISTER_ORGANIZATION_STEPS = [
  { id: 'organization', label: 'Tenant' },
  { id: 'review', label: 'Review' },
] as const

export type RegisterOrganizationStepId = (typeof REGISTER_ORGANIZATION_STEPS)[number]['id']

export type RegisterOrganizationForm = {
  organizationName: string
  displayName: string
  primaryDomain: string
  additionalDomains: string[]
  m360AccountId: string
  billingAccountId: string
  billingAccountName: string
  externalIpPoolId: string
  maxInstances: string
  logoSrc: string
  logoFileName: string
  breakGlassUsername: string
  breakGlassPassword: string
  idpConfig: IdpFederationConfig
  claimMappings: ClaimMapping[]
}

/** BlueSolace values for the register-tenant wizard / Onboarding prefill. */
export const DEMO_BLUESOLACE_ORG_NAME = DEMO_TENANT_LABEL.evergreen
export const DEMO_BLUESOLACE_PRIMARY_DOMAIN = 'bluesolacefinancial.com'
export const DEMO_BLUESOLACE_ADDITIONAL_DOMAIN = 'bluesolacefinancial.net'
export const DEMO_BLUESOLACE_IDP_DISPLAY_NAME = `${DEMO_BLUESOLACE_ORG_NAME}-idp`
export const DEMO_BLUESOLACE_IDP_CLIENT_ID = DEMO_BLUESOLACE_ORG_NAME
export const DEMO_BLUESOLACE_BILLING_ACCOUNT_NAME =
  'bluesolace-financial-group-enterprise-billing'

function registerFormBreakGlassFields(
  organizationName: string,
  primaryDomain: string,
  existing?: Parameters<typeof buildRegisterBreakGlassFields>[2],
): Pick<RegisterOrganizationForm, 'breakGlassUsername' | 'breakGlassPassword'> {
  const issued = buildRegisterBreakGlassFields(organizationName, primaryDomain, existing)
  return {
    breakGlassUsername: issued.breakGlassUsername,
    breakGlassPassword: issued.breakGlassPassword,
  }
}

export const DEFAULT_REGISTER_ORGANIZATION_FORM: RegisterOrganizationForm = {
  organizationName: DEMO_BLUESOLACE_ORG_NAME,
  displayName: DEMO_BLUESOLACE_ORG_NAME,
  primaryDomain: DEMO_BLUESOLACE_PRIMARY_DOMAIN,
  additionalDomains: [buildDemoSubsidiaryDomain('silverpinetrust.com')],
  m360AccountId: 'bluesolace-financial-group',
  billingAccountId: 'bluesolace-financial-group',
  billingAccountName: DEMO_BLUESOLACE_BILLING_ACCOUNT_NAME,
  externalIpPoolId: 'eipool-northsummit-edge',
  maxInstances: '20',
  logoSrc: getDemoBluesolaceCompanyLogoSrc(),
  logoFileName: DEMO_BLUESOLACE_COMPANY_LOGO_FILE_NAME,
  ...registerFormBreakGlassFields(DEMO_BLUESOLACE_ORG_NAME, DEMO_BLUESOLACE_PRIMARY_DOMAIN),
  idpConfig: {
    protocol: 'oidc',
    issuerUrl: '',
    clientId: '',
    clientSecret: '',
    keycloakRealm: '',
  },
  claimMappings: [
    { sourceGroup: 'engineers', gridRole: 'ai-grid-users' },
    { sourceGroup: 'platform-admins', gridRole: 'ai-grid-admins' },
  ],
}

/** Pending BlueSolace tenant for IdP manager onboarding. Provider-admin NSB seed is separate. */
export function createDemoBlueSolaceOnboardingOrganization(): RegisteredOrganization {
  const primaryDomain = DEMO_BLUESOLACE_PRIMARY_DOMAIN

  return {
    id: DEMO_BLUESOLACE_ORG_ID,
    name: DEMO_BLUESOLACE_ORG_NAME,
    tenantId: DEMO_BLUESOLACE_TENANT_ID,
    slug: DEMO_IDP_MANAGER_ORG_SLUG,
    primaryDomain,
    additionalDomains: [DEMO_BLUESOLACE_ADDITIONAL_DOMAIN],
    displayName: DEMO_BLUESOLACE_ORG_NAME,
    m360AccountId: 'bluesolace-financial-group',
    m360ConnectionStatus: 'pending',
    m360RateCardId: 'rate-enterprise-us',
    m360RateCardName: 'Enterprise — US',
    billingAccountId: 'bluesolace-financial-group',
    billingAccountName: DEMO_BLUESOLACE_BILLING_ACCOUNT_NAME,
    tenantSetupStatus: 'billing_configured',
    billingAccountLinked: false,
    logoSrc: getDemoBluesolaceCompanyLogoSrc(),
    logoFileName: DEMO_BLUESOLACE_COMPANY_LOGO_FILE_NAME,
    catalogItemId: null,
    catalogDisplayName: null,
    externalIpPoolId: null,
    externalIpPoolName: null,
    externalIpPoolCidr: null,
    maxInstances: 20,
    tenantAdminName: '',
    tenantAdminEmail: '',
    additionalTenantAdmins: [],
    invitedTenantUserEmails: [],
    identityProviderConnected: false,
    identityProviderConnectedBy: null,
    identityProviderName: null,
    identityProviderDisplayName: null,
    identityProviderProtocol: null,
    identityProviderIssuerUrl: null,
    identityProviderClientId: null,
    identityProviders: [],
    idpManagerEmail: null,
    idpInviteToken: null,
    idpInviteStatus: 'none',
    idpInviteSentAt: null,
    idpInviteExpiresAt: null,
    breakGlassName: 'IdP manager',
    breakGlassEmail: `idp-admin@${primaryDomain}`,
    breakGlassUsername: generateBreakGlassUsername(DEMO_IDP_MANAGER_ORG_SLUG),
    breakGlassPassword: getDemoBreakGlassPassword(DEMO_IDP_MANAGER_ORG_SLUG),
    breakGlassIssuedAt: new Date().toISOString(),
    rbacConfigured: false,
    status: 'Pending activation',
    createdAt: new Date().toISOString(),
  }
}

/** Fully activated North Summit Bank — IdP connected, roles defined, Active. */
export function createDemoNorthSummitBankOrganization(
  options: {
    catalogItemId?: string | null
    catalogDisplayName?: string | null
    externalIpPoolId?: string | null
    externalIpPoolName?: string | null
    externalIpPoolCidr?: string | null
  } = {},
): RegisteredOrganization {
  const primaryDomain = DEMO_NORTH_SUMMIT_BANK_PRIMARY_DOMAIN

  return {
    id: DEMO_NORTH_SUMMIT_BANK_ORG_ID,
    name: DEMO_NORTH_SUMMIT_BANK_ORG_NAME,
    tenantId: DEMO_NORTH_SUMMIT_BANK_TENANT_ID,
    slug: DEMO_NORTH_SUMMIT_BANK_SLUG,
    primaryDomain,
    additionalDomains: [DEMO_NORTH_SUMMIT_BANK_ADDITIONAL_DOMAIN],
    displayName: DEMO_NORTH_SUMMIT_BANK_ORG_NAME,
    m360AccountId: 'north-summit-bank',
    m360ConnectionStatus: 'connected',
    m360RateCardId: 'rate-enterprise-us',
    m360RateCardName: 'Enterprise — US',
    billingAccountLinked: true,
    tenantSetupStatus: 'ready',
    billingAccountId: 'north-summit-bank',
    billingAccountName: DEMO_NORTH_SUMMIT_BANK_BILLING_ACCOUNT_NAME,
    logoSrc: getDemoNorthSummitBankCompanyLogoSrc(),
    logoFileName: DEMO_NORTH_SUMMIT_BANK_COMPANY_LOGO_FILE_NAME,
    catalogItemId: options.catalogItemId ?? null,
    catalogDisplayName: options.catalogDisplayName ?? null,
    externalIpPoolId: options.externalIpPoolId ?? DEFAULT_REGISTER_ORGANIZATION_FORM.externalIpPoolId,
    externalIpPoolName: options.externalIpPoolName ?? null,
    externalIpPoolCidr: options.externalIpPoolCidr ?? null,
    maxInstances: 20,
    tenantAdminName: DEMO_TENANT_DISPLAY_ADMIN.northsummit,
    tenantAdminEmail: DEMO_TENANT_LOGIN_EMAIL_ADMIN.northsummit,
    additionalTenantAdmins: [
      { name: 'Jordan Hale', email: 'jhale@northsummitbank.com' },
      { name: 'Sam Okonkwo', email: 'sokonkowo@northsummitbank.com' },
      {
        name: 'Alex Kim',
        email: 'akim@northsummitbank.com',
        roleId: 'tenant-reader',
      },
    ],
    invitedTenantUserEmails: [
      DEMO_TENANT_LOGIN_EMAIL_USER.northsummit,
      'akim@northsummitbank.com',
      'rchen@northsummitbank.com',
      'tbrooks@northsummitbank.com',
    ],
    identityProviderConnected: true,
    identityProviderConnectedBy: 'provider-admin',
    identityProviderName: buildDemoIdentityProviderName('OIDC', primaryDomain),
    identityProviderDisplayName: DEMO_NORTH_SUMMIT_BANK_IDP_DISPLAY_NAME,
    identityProviderProtocol: 'OIDC',
    identityProviderIssuerUrl: `https://login.${primaryDomain}/oauth2`,
    identityProviderClientId: DEMO_NORTH_SUMMIT_BANK_IDP_CLIENT_ID,
    identityProviders: [
      {
        id: 'idp-northsummit-primary',
        name: buildDemoIdentityProviderName('OIDC', primaryDomain),
        displayName: DEMO_NORTH_SUMMIT_BANK_IDP_DISPLAY_NAME,
        protocol: 'OIDC',
        issuerUrl: `https://login.${primaryDomain}/oauth2`,
        clientId: DEMO_NORTH_SUMMIT_BANK_IDP_CLIENT_ID,
      },
    ],
    idpManagerEmail: null,
    idpInviteToken: null,
    idpInviteStatus: 'none',
    idpInviteSentAt: null,
    idpInviteExpiresAt: null,
    breakGlassName: 'IdP manager',
    breakGlassEmail: `idp-admin@${primaryDomain}`,
    breakGlassUsername: 'breakglass-bluesolace',
    breakGlassPassword: getDemoBreakGlassPassword(DEMO_NORTH_SUMMIT_BANK_SLUG),
    breakGlassIssuedAt: '2026-06-12T14:30:00.000Z',
    rbacConfigured: true,
    status: 'Active',
    createdAt: '2026-06-12T14:30:00.000Z',
  }
}

/** Fully activated Harborline Capital — IdP connected, roles defined, Active. */
export function createDemoHarborlineCapitalOrganization(
  options: {
    catalogItemId?: string | null
    catalogDisplayName?: string | null
    externalIpPoolId?: string | null
    externalIpPoolName?: string | null
    externalIpPoolCidr?: string | null
  } = {},
): RegisteredOrganization {
  const primaryDomain = DEMO_HARBORLINE_CAPITAL_DOMAIN

  return {
    id: DEMO_HARBORLINE_CAPITAL_ORG_ID,
    name: DEMO_HARBORLINE_CAPITAL_NAME,
    tenantId: DEMO_HARBORLINE_CAPITAL_TENANT_ID,
    slug: DEMO_HARBORLINE_CAPITAL_SLUG,
    primaryDomain,
    additionalDomains: ['harborline.com'],
    displayName: DEMO_HARBORLINE_CAPITAL_NAME,
    m360AccountId: 'harborline-capital',
    m360ConnectionStatus: 'connected',
    m360RateCardId: 'rate-enterprise-us',
    m360RateCardName: 'Enterprise — US',
    billingAccountLinked: true,
    tenantSetupStatus: 'ready',
    billingAccountId: 'harborline-capital',
    billingAccountName: 'harborline-capital-enterprise-billing',
    logoSrc: getDemoHarborlineCapitalCompanyLogoSrc(),
    logoFileName: DEMO_HARBORLINE_CAPITAL_COMPANY_LOGO_FILE_NAME,
    catalogItemId: options.catalogItemId ?? null,
    catalogDisplayName: options.catalogDisplayName ?? null,
    externalIpPoolId: options.externalIpPoolId ?? 'eipool-standby-a',
    externalIpPoolName: options.externalIpPoolName ?? null,
    externalIpPoolCidr: options.externalIpPoolCidr ?? null,
    maxInstances: 16,
    tenantAdminName: 'Avery Quinn',
    tenantAdminEmail: `aquinn@${primaryDomain}`,
    additionalTenantAdmins: [
      { name: 'Noah Patel', email: `npatel@${primaryDomain}` },
      { name: 'Riley Soto', email: `rsoto@${primaryDomain}` },
      {
        name: 'Morgan Lee',
        email: `mlee@${primaryDomain}`,
        roleId: 'tenant-reader',
      },
      {
        name: 'Kai Davis',
        email: `kdavis@${primaryDomain}`,
        roleId: 'tenant-user',
      },
    ],
    invitedTenantUserEmails: [
      `mlee@${primaryDomain}`,
      `kdavis@${primaryDomain}`,
      `jwu@${primaryDomain}`,
    ],
    identityProviderConnected: true,
    identityProviderConnectedBy: 'provider-admin',
    identityProviderName: buildDemoIdentityProviderName('SAML', primaryDomain),
    identityProviderDisplayName: 'harborline-capital-idp',
    identityProviderProtocol: 'SAML',
    identityProviderIssuerUrl: `https://idp.${primaryDomain}/saml`,
    identityProviderClientId: 'harborline-capital',
    identityProviders: [
      {
        id: 'idp-harborline-primary',
        name: buildDemoIdentityProviderName('SAML', primaryDomain),
        displayName: 'harborline-capital-idp',
        protocol: 'SAML',
        issuerUrl: `https://idp.${primaryDomain}/saml`,
        clientId: 'harborline-capital',
      },
    ],
    idpManagerEmail: null,
    idpInviteToken: null,
    idpInviteStatus: 'none',
    idpInviteSentAt: null,
    idpInviteExpiresAt: null,
    breakGlassName: 'IdP manager',
    breakGlassEmail: `idp-admin@${primaryDomain}`,
    breakGlassUsername: generateBreakGlassUsername(DEMO_HARBORLINE_CAPITAL_SLUG),
    breakGlassPassword: getDemoBreakGlassPassword(DEMO_HARBORLINE_CAPITAL_SLUG),
    breakGlassIssuedAt: '2026-06-18T11:00:00.000Z',
    rbacConfigured: true,
    status: 'Active',
    createdAt: '2026-06-18T11:00:00.000Z',
  }
}

/**
 * Redwood Mutual — IdP connected, no M360 billing yet.
 * Setup status Incomplete; lifecycle still Pending activation.
 */
export function createDemoRedwoodMutualOrganization(
  options: {
    catalogItemId?: string | null
    catalogDisplayName?: string | null
    externalIpPoolId?: string | null
    externalIpPoolName?: string | null
    externalIpPoolCidr?: string | null
  } = {},
): RegisteredOrganization {
  const primaryDomain = DEMO_REDWOOD_MUTUAL_DOMAIN

  return {
    id: DEMO_REDWOOD_MUTUAL_ORG_ID,
    name: DEMO_REDWOOD_MUTUAL_NAME,
    tenantId: DEMO_REDWOOD_MUTUAL_TENANT_ID,
    slug: DEMO_REDWOOD_MUTUAL_SLUG,
    primaryDomain,
    additionalDomains: [],
    displayName: DEMO_REDWOOD_MUTUAL_DISPLAY_NAME,
    m360AccountId: '',
    m360ConnectionStatus: 'pending',
    billingAccountId: '',
    billingAccountName: '',
    billingAccountLinked: false,
    tenantSetupStatus: 'incomplete',
    logoSrc: getDemoRedwoodMutualCompanyLogoSrc(),
    logoFileName: DEMO_REDWOOD_MUTUAL_COMPANY_LOGO_FILE_NAME,
    catalogItemId: options.catalogItemId ?? null,
    catalogDisplayName: options.catalogDisplayName ?? null,
    externalIpPoolId: options.externalIpPoolId ?? null,
    externalIpPoolName: options.externalIpPoolName ?? null,
    externalIpPoolCidr: options.externalIpPoolCidr ?? null,
    maxInstances: 12,
    tenantAdminName: '',
    tenantAdminEmail: '',
    additionalTenantAdmins: [],
    invitedTenantUserEmails: [],
    identityProviderConnected: true,
    identityProviderConnectedBy: 'provider-admin',
    identityProviderName: buildDemoIdentityProviderName('OIDC', primaryDomain),
    identityProviderDisplayName: DEMO_REDWOOD_MUTUAL_IDP_DISPLAY_NAME,
    identityProviderProtocol: 'OIDC',
    identityProviderIssuerUrl: `https://login.${primaryDomain}/oauth2`,
    identityProviderClientId: DEMO_REDWOOD_MUTUAL_IDP_CLIENT_ID,
    identityProviders: [
      {
        id: 'idp-redwood-primary',
        name: buildDemoIdentityProviderName('OIDC', primaryDomain),
        displayName: DEMO_REDWOOD_MUTUAL_IDP_DISPLAY_NAME,
        protocol: 'OIDC',
        issuerUrl: `https://login.${primaryDomain}/oauth2`,
        clientId: DEMO_REDWOOD_MUTUAL_IDP_CLIENT_ID,
      },
    ],
    idpManagerEmail: null,
    idpInviteToken: null,
    idpInviteStatus: 'none',
    idpInviteSentAt: null,
    idpInviteExpiresAt: null,
    breakGlassName: 'IdP manager',
    breakGlassEmail: `idp-admin@${primaryDomain}`,
    breakGlassUsername: generateBreakGlassUsername(DEMO_REDWOOD_MUTUAL_SLUG),
    breakGlassPassword: getDemoBreakGlassPassword(DEMO_REDWOOD_MUTUAL_SLUG),
    breakGlassIssuedAt: '2026-07-02T09:15:00.000Z',
    rbacConfigured: false,
    status: 'Pending activation',
    createdAt: '2026-07-02T09:15:00.000Z',
  }
}

/** Demo presets cycled so the wizard never prefill a name/domain already registered. */
const REGISTER_ORGANIZATION_DEMO_PRESETS: Array<{
  organizationName: string
  primaryDomain: string
  billingAccountName: string
}> = [
  {
    organizationName: DEMO_TENANT_LABEL.northsummit,
    primaryDomain: 'northsummitbank.com',
    billingAccountName: 'north-summit-bank-enterprise-billing',
  },
  {
    organizationName: DEMO_BLUESOLACE_ORG_NAME,
    primaryDomain: DEMO_BLUESOLACE_PRIMARY_DOMAIN,
    billingAccountName: DEMO_BLUESOLACE_BILLING_ACCOUNT_NAME,
  },
  {
    organizationName: 'harborline-capital',
    primaryDomain: 'harborlinecapital.com',
    billingAccountName: 'harborline-capital-enterprise-billing',
  },
  {
    organizationName: 'silverpine-trust',
    primaryDomain: 'silverpinetrust.com',
    billingAccountName: 'silverpine-trust-enterprise-billing',
  },
  {
    organizationName: 'redwood-mutual',
    primaryDomain: 'redwoodmutual.com',
    billingAccountName: 'redwood-mutual-enterprise-billing',
  },
]

/** Prefill for the optional Roles step after IdP. Not assigned at registration. */
export const DEFAULT_REGISTER_ORGANIZATION_TENANT_ADMIN = {
  name: DEMO_TENANT_DISPLAY_ADMIN.northsummit,
  email: DEMO_TENANT_LOGIN_EMAIL_ADMIN.northsummit,
} as const

export function generateOrganizationId(): string {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `org-${suffix}`
}

/** Tenant name is the OSAC tenant identifier (same value stored in `name` and `tenantId`). */
export function resolveOrganizationTenantName(
  organization: Pick<RegisteredOrganization, 'name'>,
): string {
  return organization.name.trim()
}

export function generateTenantId(): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  return `tenant-${suffix}`
}

/** System-assigned billing account id shown read-only during registration. */
export function generateBillingAccountId(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  const sequence = String(Math.floor(Math.random() * 9000) + 1000)
  return `ACCT-${suffix}-${sequence}`
}

/** Normalize user input to a bare hostname (no scheme, path, or leading @). */
export function normalizePrimaryDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
}

export function isValidPrimaryDomain(value: string): boolean {
  const domain = normalizePrimaryDomain(value)
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    domain,
  )
}

export function getOrganizationEmailDomains(
  organization: Pick<RegisteredOrganization, 'primaryDomain' | 'additionalDomains'>,
): string[] {
  const primary = normalizePrimaryDomain(organization.primaryDomain)
  const additional = (organization.additionalDomains ?? [])
    .map((domain) => normalizePrimaryDomain(domain))
    .filter(Boolean)
  return [...new Set([primary, ...additional].filter(Boolean))]
}

export function normalizeAdditionalDomains(
  domains: readonly string[],
  primaryDomain: string,
): string[] {
  const primary = normalizePrimaryDomain(primaryDomain)
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of domains) {
    const domain = normalizePrimaryDomain(value)
    if (!domain || domain === primary || seen.has(domain) || !isValidPrimaryDomain(domain)) {
      continue
    }
    seen.add(domain)
    result.push(domain)
  }

  return result
}

export function buildDemoSubsidiaryDomain(primaryDomain: string): string {
  const domain = normalizePrimaryDomain(primaryDomain)
  return domain ? `subsidiary.${domain}` : 'subsidiary.example.com'
}

export function buildDefaultAdditionalDomains(
  organization: Pick<
    RegisteredOrganization,
    'primaryDomain' | 'additionalDomains' | 'identityProviderConnected'
  >,
): string[] {
  const existing = normalizeAdditionalDomains(
    organization.additionalDomains ?? [],
    organization.primaryDomain,
  )
  if (existing.length > 0) {
    return existing
  }
  if (organization.identityProviderConnected) {
    return []
  }

  return [buildDemoSubsidiaryDomain(organization.primaryDomain)]
}

export function emailMatchesOrganizationDomains(
  email: string,
  organization: Pick<RegisteredOrganization, 'primaryDomain' | 'additionalDomains'>,
): boolean {
  if (!email.includes('@')) {
    return false
  }

  const emailDomain = email.split('@')[1]?.toLowerCase() ?? ''
  return getOrganizationEmailDomains(organization).includes(emailDomain)
}

export function areAdditionalDomainsValid(
  domains: readonly string[],
  primaryDomain: string,
  takenDomains: ReadonlySet<string>,
): boolean {
  const primary = normalizePrimaryDomain(primaryDomain)
  const seen = new Set<string>()

  for (const value of domains) {
    if (!value.trim()) {
      continue
    }
    if (!isValidPrimaryDomain(value)) {
      return false
    }
    const domain = normalizePrimaryDomain(value)
    if (domain === primary || takenDomains.has(domain) || seen.has(domain)) {
      return false
    }
    seen.add(domain)
  }

  return true
}

export function slugifyOrganizationName(name: string): string {
  const normalized = name.trim().toLowerCase()

  if (
    normalized === 'north summit bank' ||
    normalized === 'north-summit-bank' ||
    normalized === 'northsummit bank' ||
    normalized === 'northstar bank'
  ) {
    return DEMO_NORTH_SUMMIT_BANK_SLUG
  }

  if (
    normalized === 'bluesolace financial group' ||
    normalized === 'blue solace financial group' ||
    normalized === 'bluesolace-financial-group' ||
    normalized === 'bluestone financial group' ||
    normalized === 'bluestone-financial-group'
  ) {
    return 'evergreen'
  }

  if (
    normalized === 'redwood mutual' ||
    normalized === 'redwood-mutual'
  ) {
    return DEMO_REDWOOD_MUTUAL_SLUG
  }

  return normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function getTakenOrganizationKeys(existingOrganizations: RegisteredOrganization[]) {
  return {
    names: new Set(
      existingOrganizations.map((organization) => organization.name.trim().toLowerCase()),
    ),
    domains: new Set(
      existingOrganizations.flatMap((organization) => getOrganizationEmailDomains(organization)),
    ),
    slugs: new Set(existingOrganizations.map((organization) => organization.slug)),
  }
}

export function isOrganizationNameTaken(
  organizationName: string,
  existingOrganizations: RegisteredOrganization[],
  excludeOrganizationId?: string,
): boolean {
  const name = organizationName.trim().toLowerCase()
  if (!name) {
    return false
  }

  const organizations = excludeOrganizationId
    ? existingOrganizations.filter((organization) => organization.id !== excludeOrganizationId)
    : existingOrganizations

  return getTakenOrganizationKeys(organizations).names.has(name)
}

export function isOrganizationDomainTaken(
  domainValue: string,
  existingOrganizations: RegisteredOrganization[],
  excludeOrganizationId?: string,
): boolean {
  const domain = normalizePrimaryDomain(domainValue)
  if (!domain) {
    return false
  }

  const organizations = excludeOrganizationId
    ? existingOrganizations.filter((organization) => organization.id !== excludeOrganizationId)
    : existingOrganizations

  return getTakenOrganizationKeys(organizations).domains.has(domain)
}

export function getTakenEmailDomains(
  existingOrganizations: RegisteredOrganization[],
  excludeOrganizationId?: string,
): Set<string> {
  const organizations = excludeOrganizationId
    ? existingOrganizations.filter((organization) => organization.id !== excludeOrganizationId)
    : existingOrganizations

  return getTakenOrganizationKeys(organizations).domains
}

export function formatOrganizationEmailDomainsLabel(
  organization: Pick<RegisteredOrganization, 'primaryDomain' | 'additionalDomains'>,
): string {
  const domains = getOrganizationEmailDomains(organization).map((domain) => `@${domain}`)
  if (domains.length === 0) {
    return 'the tenant domain'
  }
  if (domains.length === 1) {
    return domains[0]
  }
  if (domains.length === 2) {
    return `${domains[0]} or ${domains[1]}`
  }

  return `${domains.slice(0, -1).join(', ')}, or ${domains[domains.length - 1]}`
}

export function isOrganizationSlugTaken(
  organizationName: string,
  existingOrganizations: RegisteredOrganization[],
  excludeOrganizationId?: string,
): boolean {
  const slug = slugifyOrganizationName(organizationName)
  if (!slug) {
    return false
  }

  const organizations = excludeOrganizationId
    ? existingOrganizations.filter((organization) => organization.id !== excludeOrganizationId)
    : existingOrganizations

  return getTakenOrganizationKeys(organizations).slugs.has(slug)
}

export function formFromRegisteredOrganization(
  organization: RegisteredOrganization,
): RegisterOrganizationForm {
  const m360AccountId =
    organization.m360AccountId?.trim() || organization.billingAccountId.trim()

  return {
    organizationName: organization.name,
    displayName: organization.displayName?.trim() || organization.name,
    primaryDomain: organization.primaryDomain,
    additionalDomains:
      organization.additionalDomains.length > 0 ? [...organization.additionalDomains] : [],
    m360AccountId,
    billingAccountId: m360AccountId,
    billingAccountName: organization.billingAccountName,
    externalIpPoolId: organization.externalIpPoolId ?? '',
    maxInstances: String(organization.maxInstances),
    logoSrc: normalizeDemoCompanyLogoSrc(organization.logoSrc) ?? '',
    logoFileName: organization.logoFileName?.trim() || '',
    breakGlassUsername: organization.breakGlassUsername?.trim() || '',
    breakGlassPassword: organization.breakGlassPassword?.trim()
      ? rewriteBreakGlassPassword(organization.breakGlassPassword.trim())
      : '',
    idpConfig: organization.idpConfig ?? {
      protocol: 'oidc',
      issuerUrl: '',
      clientId: '',
      clientSecret: '',
      keycloakRealm: '',
    },
    claimMappings: organization.claimMappings ?? [
      { sourceGroup: 'engineers', gridRole: 'ai-grid-users' },
      { sourceGroup: 'platform-admins', gridRole: 'ai-grid-admins' },
    ],
  }
}

function registerFormLogoFields(organizationName: string): Pick<
  RegisterOrganizationForm,
  'logoSrc' | 'logoFileName'
> {
  const normalized = organizationName.trim().toLowerCase()

  if (normalized === DEMO_BLUESOLACE_ORG_NAME) {
    return {
      logoSrc: getDemoBluesolaceCompanyLogoSrc(),
      logoFileName: DEMO_BLUESOLACE_COMPANY_LOGO_FILE_NAME,
    }
  }

  if (
    normalized === DEMO_NORTH_SUMMIT_BANK_ORG_NAME ||
    normalized === 'north-summit-bank' ||
    normalized === 'northsummit'
  ) {
    return {
      logoSrc: getDemoNorthSummitBankCompanyLogoSrc(),
      logoFileName: DEMO_NORTH_SUMMIT_BANK_COMPANY_LOGO_FILE_NAME,
    }
  }

  if (normalized === DEMO_HARBORLINE_CAPITAL_NAME || normalized === 'harborline') {
    return {
      logoSrc: getDemoHarborlineCapitalCompanyLogoSrc(),
      logoFileName: DEMO_HARBORLINE_CAPITAL_COMPANY_LOGO_FILE_NAME,
    }
  }

  if (
    normalized === DEMO_REDWOOD_MUTUAL_NAME ||
    normalized === DEMO_REDWOOD_MUTUAL_DISPLAY_NAME.toLowerCase() ||
    normalized === 'redwood'
  ) {
    return {
      logoSrc: getDemoRedwoodMutualCompanyLogoSrc(),
      logoFileName: DEMO_REDWOOD_MUTUAL_COMPANY_LOGO_FILE_NAME,
    }
  }

  return { logoSrc: '', logoFileName: '' }
}

/** Prefill the next unused demo org so the same organization cannot be registered twice. */
export function buildNextRegisterOrganizationForm(
  existingOrganizations: RegisteredOrganization[],
): RegisterOrganizationForm {
  const taken = getTakenOrganizationKeys(existingOrganizations)

  for (const preset of REGISTER_ORGANIZATION_DEMO_PRESETS) {
    const slug = slugifyOrganizationName(preset.organizationName)
    const domain = normalizePrimaryDomain(preset.primaryDomain)
    if (
      taken.names.has(preset.organizationName.trim().toLowerCase()) ||
      taken.domains.has(domain) ||
      taken.slugs.has(slug)
    ) {
      continue
    }

    const m360AccountId = generateBillingAccountId()

    return {
      ...DEFAULT_REGISTER_ORGANIZATION_FORM,
      organizationName: preset.organizationName,
      displayName: preset.organizationName,
      primaryDomain: preset.primaryDomain,
      m360AccountId,
      billingAccountName: preset.billingAccountName,
      billingAccountId: m360AccountId,
      ...registerFormLogoFields(preset.organizationName),
      ...registerFormBreakGlassFields(preset.organizationName, preset.primaryDomain),
    }
  }

  let suffix = existingOrganizations.length + 1
  while (suffix < existingOrganizations.length + 100) {
    const organizationName = `vertexa-tenant-${suffix}`
    const primaryDomain = `tenant${suffix}.example.com`
    const slug = slugifyOrganizationName(organizationName)
    if (
      !taken.names.has(organizationName.toLowerCase()) &&
      !taken.domains.has(primaryDomain) &&
      !taken.slugs.has(slug)
    ) {
      const m360AccountId = generateBillingAccountId()

      return {
        ...DEFAULT_REGISTER_ORGANIZATION_FORM,
        organizationName,
        displayName: organizationName,
        primaryDomain,
        m360AccountId,
        billingAccountName: `${organizationName}-enterprise-billing`,
        billingAccountId: m360AccountId,
        ...registerFormLogoFields(organizationName),
        ...registerFormBreakGlassFields(organizationName, primaryDomain),
      }
    }
    suffix += 1
  }

  const unique = Math.random().toString(36).slice(2, 6)
  const organizationName = `vertexa-tenant-${unique}`
  const primaryDomain = `tenant-${unique}.example.com`
  return {
    ...DEFAULT_REGISTER_ORGANIZATION_FORM,
    organizationName,
    primaryDomain,
    billingAccountName: `vertexa-tenant-${unique}-enterprise-billing`,
    billingAccountId: generateBillingAccountId(),
    ...registerFormLogoFields(organizationName),
    ...registerFormBreakGlassFields(organizationName, primaryDomain),
  }
}

export type OrganizationSetupFilter =
  | 'all'
  | 'ready'
  | 'needs-billing'
  | 'needs-idp'
  | 'waiting-idp'
  | 'expired-idp'
  | 'needs-roles'

export const ORGANIZATION_SETUP_FILTER_OPTIONS: ReadonlyArray<{
  value: OrganizationSetupFilter
  label: string
}> = [
  { value: 'all', label: 'All setup states' },
  { value: 'ready', label: 'Ready for provisioning' },
  { value: 'needs-billing', label: 'Needs billing setup' },
  { value: 'needs-idp', label: 'Needs identity provider' },
  { value: 'waiting-idp', label: 'Waiting on IdP Manager' },
  { value: 'expired-idp', label: 'IdP manager link expired' },
  { value: 'needs-roles', label: 'Needs roles' },
]

export function getOrganizationSetupFilterKey(
  organization: RegisteredOrganization,
): Exclude<OrganizationSetupFilter, 'all'> {
  const setupStatus = resolveTenantSetupStatus(organization)
  if (setupStatus !== 'ready') {
    return 'needs-billing'
  }

  const signal = getOrganizationSetupSignal(organization)
  if (signal === null) {
    return 'ready'
  }
  if (signal === 'Waiting on IdP Manager') {
    return 'waiting-idp'
  }
  if (signal === 'IdP manager link expired') {
    return 'expired-idp'
  }
  if (signal === 'Needs roles') {
    return 'needs-roles'
  }
  return 'needs-idp'
}

export function matchesOrganizationSetupFilter(
  organization: RegisteredOrganization,
  filter: OrganizationSetupFilter,
): boolean {
  if (filter === 'all') {
    return true
  }

  return getOrganizationSetupFilterKey(organization) === filter
}

export function organizationMatchesSearch(
  organization: RegisteredOrganization,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  return (
    organization.name.toLowerCase().includes(normalizedQuery) ||
    organization.tenantId.toLowerCase().includes(normalizedQuery) ||
    organization.slug.toLowerCase().includes(normalizedQuery) ||
    organization.primaryDomain.toLowerCase().includes(normalizedQuery) ||
    (organization.additionalDomains ?? []).some((domain) =>
      domain.toLowerCase().includes(normalizedQuery),
    ) ||
    organization.billingAccountName.toLowerCase().includes(normalizedQuery) ||
    organization.billingAccountId.toLowerCase().includes(normalizedQuery)
  )
}

export function buildOrganizationFilterParts(
  searchValue: string,
  selectedStatus: 'all' | RegisteredOrganization['status'],
  selectedSetup: OrganizationSetupFilter,
): string[] {
  const parts: string[] = []

  if (selectedStatus !== 'all') {
    parts.push(`status: ${selectedStatus}`)
  }

  if (selectedSetup !== 'all') {
    const setupLabel =
      ORGANIZATION_SETUP_FILTER_OPTIONS.find((option) => option.value === selectedSetup)?.label ??
      selectedSetup
    parts.push(`setup: ${setupLabel}`)
  }

  if (searchValue.trim()) {
    parts.push(`search: "${searchValue.trim()}"`)
  }

  return parts
}

export const PROVIDER_ORGANIZATIONS_DEMO = {
  lede: 'Register tenants and map billing accounts.',
  emptyTitle: 'No tenants yet',
  emptyBody: 'Register your first tenant to map billing and get started.',
  registerFirstOrganizationLabel: 'Register first tenant',
  registerOrganizationLabel: 'Register tenant',
} as const
