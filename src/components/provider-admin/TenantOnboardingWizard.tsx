import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { TrashIcon } from '@patternfly/react-icons/dist/esm/icons/trash-icon'
import {
  Alert,
  Button,
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  Label,
  Modal,
  ModalVariant,
  TextInput,
  Title,
  ToggleGroup,
  ToggleGroupItem,
  Wizard,
  WizardFooter,
  WizardHeader,
  WizardStep,
  useWizardContext,
} from '@patternfly/react-core'
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table'
import type { ProviderCatalogDraft } from '../../providerSetup/storage'
import { KubernetesResourceNameField } from '../shared/KubernetesResourceNameHelper'
import { ResourceCreatePageShell } from '../shared/ResourceCreatePageShell'
import { useWizardLeaveConfirm } from '../shared/useWizardLeaveConfirm'
import { getAssignableExternalIpPools } from '../../providerAdmin/externalIpPools'
import {
  getProviderExternalIpPools,
  getProviderRegisteredOrganizations,
} from '../../providerSetup/storage'
import {
  buildNextRegisterOrganizationForm,
  areAdditionalDomainsValid,
  buildDefaultIdentityProviderClientId,
  buildRegisterBreakGlassFields,
  formFromRegisteredOrganization,
  generateOrganizationId,
  getTakenEmailDomains,
  isOrganizationDomainTaken,
  isOrganizationNameTaken,
  isOrganizationSlugTaken,
  isValidPrimaryDomain,
  normalizeAdditionalDomains,
  normalizePrimaryDomain,
  slugifyOrganizationName,
  TENANT_ONBOARDING_STEPS,
  type ClaimMapping,
  type IdpFederationConfig,
  type RegisterOrganizationForm,
  type RegisteredOrganization,
  type TenantOnboardingStepId,
} from '../../providerAdmin/organizations'
import {
  AdditionalEmailDomainsField,
  AdditionalEmailDomainsValue,
} from './AdditionalEmailDomainsField'
import { CatalogEditChangesSummary } from './CatalogEditChangesSummary'
import { TenantCompanyLogoField } from './TenantCompanyLogoField'
import {
  buildOrganizationEditSnapshot,
  buildOrganizationEditSnapshotFromOrganization,
  getOrganizationEditChanges,
  getOrganizationEditModifiedStepIds,
} from '../../providerAdmin/organizationEditDiff'
import {
  getKubernetesResourceNameValidation,
  isValidKubernetesResourceName,
} from '../../shared/kubernetesResourceName'

type TenantOnboardingWizardProps = {
  isOpen: boolean
  presentation?: 'modal' | 'page'
  catalogDraft: ProviderCatalogDraft | null
  resumeOrganization?: RegisteredOrganization | null
  editingOrganization?: RegisteredOrganization | null
  initialStepId?: TenantOnboardingStepId
  onClose: () => void
  onPersistOrganization: (organization: RegisteredOrganization) => void
  onComplete?: (organization: RegisteredOrganization) => void
}

function buildTenantOnboardingForm(
  existingOrganizations: RegisteredOrganization[],
): RegisterOrganizationForm {
  return {
    ...buildNextRegisterOrganizationForm(existingOrganizations),
    additionalDomains: [],
  }
}

type TenantOnboardingNavigateFooterProps = {
  onClose: () => void
  isNextDisabled?: boolean
  nextButtonText?: ReactNode
  onNavigateNext: () => boolean | Promise<boolean>
}

function TenantOnboardingNavigateFooter({
  onClose,
  isNextDisabled = false,
  nextButtonText,
  onNavigateNext,
}: TenantOnboardingNavigateFooterProps) {
  const { goToNextStep, goToPrevStep, activeStep } = useWizardContext()

  const handleNext = async () => {
    const shouldAdvance = await onNavigateNext()
    if (shouldAdvance) {
      goToNextStep()
    }
  }

  if (!activeStep) {
    return null
  }

  return (
    <WizardFooter
      activeStep={activeStep}
      onBack={goToPrevStep}
      onClose={onClose}
      isBackDisabled={activeStep.index === 1}
      isNextDisabled={isNextDisabled}
      nextButtonText={nextButtonText}
      onNext={handleNext}
    />
  )
}

export function TenantOnboardingWizard({
  isOpen,
  presentation = 'page',
  catalogDraft,
  resumeOrganization = null,
  editingOrganization = null,
  initialStepId = 'general',
  onClose,
  onPersistOrganization,
  onComplete,
}: TenantOnboardingWizardProps) {
  const isPage = presentation === 'page'
  const sourceOrganization = editingOrganization ?? resumeOrganization
  const isEditMode = Boolean(editingOrganization)
  const isExistingTenantMode = Boolean(sourceOrganization)
  const wizardTitle = isExistingTenantMode ? 'Edit tenant' : 'Register tenant'
  const wizardStartIndex = (() => {
    const stepIndex = TENANT_ONBOARDING_STEPS.findIndex((step) => step.id === initialStepId)
    return stepIndex >= 0 ? stepIndex + 1 : 1
  })()
  const [form, setForm] = useState<RegisterOrganizationForm>(() =>
    buildTenantOnboardingForm(getProviderRegisteredOrganizations()),
  )
  const [createdOrganization, setCreatedOrganization] = useState<RegisteredOrganization | null>(
    null,
  )

  const existingOrganizations = useMemo(
    () => (isOpen ? getProviderRegisteredOrganizations() : []),
    [isOpen],
  )

  const excludeOrganizationId = sourceOrganization?.id
  const nameTaken = isOrganizationNameTaken(
    form.organizationName,
    existingOrganizations,
    excludeOrganizationId,
  )
  const domainTaken = isOrganizationDomainTaken(
    form.primaryDomain,
    existingOrganizations,
    excludeOrganizationId,
  )
  const slugTaken = isOrganizationSlugTaken(
    form.organizationName,
    existingOrganizations,
    excludeOrganizationId,
  )
  const nameFormat = getKubernetesResourceNameValidation(form.organizationName)
  const takenEmailDomains = useMemo(
    () => getTakenEmailDomains(existingOrganizations, excludeOrganizationId),
    [existingOrganizations, excludeOrganizationId],
  )
  const additionalDomainsValid = areAdditionalDomainsValid(
    form.additionalDomains,
    form.primaryDomain,
    takenEmailDomains,
  )
  const isGeneralStepValid =
    isValidKubernetesResourceName(form.organizationName) &&
    isValidPrimaryDomain(form.primaryDomain) &&
    additionalDomainsValid &&
    !nameTaken &&
    !domainTaken &&
    !slugTaken

  const isIdpStepValid =
    form.idpConfig.issuerUrl.trim().length > 0 &&
    form.idpConfig.clientId.trim().length > 0

  const editBaseline = useMemo(() => {
    if (!isEditMode || !editingOrganization) {
      return null
    }

    return buildOrganizationEditSnapshotFromOrganization(editingOrganization)
  }, [editingOrganization, isEditMode])

  const currentEditSnapshot = useMemo(() => {
    if (!isEditMode) {
      return null
    }

    return buildOrganizationEditSnapshot(form)
  }, [form, isEditMode])

  const editChanges = useMemo(() => {
    if (!editBaseline || !currentEditSnapshot) {
      return []
    }

    return getOrganizationEditChanges(editBaseline, currentEditSnapshot)
  }, [currentEditSnapshot, editBaseline])

  const modifiedStepIds = useMemo(
    () => getOrganizationEditModifiedStepIds(editChanges),
    [editChanges],
  )

  const canSaveOrganizationEdit = !isEditMode || editChanges.length > 0

  const draftOrganizationSlug = slugifyOrganizationName(form.organizationName)

  const resetWizard = () => {
    setForm(buildTenantOnboardingForm(getProviderRegisteredOrganizations()))
    setCreatedOrganization(null)
  }

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  const { requestClose, leaveConfirmModal, wrapStepFooter } = useWizardLeaveConfirm({
    onLeave: handleClose,
    primaryActionLabel: 'Leave',
    titleId: 'tenant-onboarding-leave-confirm',
  })

  useEffect(() => {
    if (!isOpen) {
      resetWizard()
      return
    }

    if (sourceOrganization) {
      setForm(formFromRegisteredOrganization(sourceOrganization))
      setCreatedOrganization(sourceOrganization)
      return
    }

    setForm(buildTenantOnboardingForm(getProviderRegisteredOrganizations()))
  }, [editingOrganization, isOpen, resumeOrganization])

  const buildOrganizationFromForm = (): RegisteredOrganization | null => {
    if (!isGeneralStepValid) {
      return null
    }

    const slug = slugifyOrganizationName(form.organizationName)
    const normalizedPrimaryDomain = normalizePrimaryDomain(form.primaryDomain)
    const normalizedAdditionalDomains = normalizeAdditionalDomains(
      form.additionalDomains,
      normalizedPrimaryDomain,
    )
    const pools = getAssignableExternalIpPools(getProviderExternalIpPools())
    const selectedPool = pools[0] ?? null
    const breakGlass = buildRegisterBreakGlassFields(
      form.organizationName.trim(),
      normalizedPrimaryDomain,
      {
        breakGlassUsername: form.breakGlassUsername,
        breakGlassPassword: form.breakGlassPassword,
        slug,
      },
    )

    const normalizedTenantName = form.organizationName.trim()
    const organization: RegisteredOrganization = {
      id: generateOrganizationId(),
      name: normalizedTenantName,
      displayName: form.displayName.trim() || normalizedTenantName,
      tenantId: normalizedTenantName,
      slug,
      primaryDomain: normalizedPrimaryDomain,
      additionalDomains: normalizedAdditionalDomains,
      m360AccountId: '',
      m360ConnectionStatus: 'pending',
      billingAccountId: '',
      billingAccountName: '',
      billingAccountLinked: false,
      tenantSetupStatus: 'incomplete',
      logoSrc: form.logoSrc.trim() || null,
      logoFileName: form.logoFileName.trim() || null,
      catalogItemId: catalogDraft?.catalogItemId ?? null,
      catalogDisplayName: catalogDraft?.displayName ?? null,
      externalIpPoolId: selectedPool?.id ?? null,
      externalIpPoolName: selectedPool?.name ?? null,
      externalIpPoolCidr: selectedPool?.cidr ?? null,
      maxInstances: 20,
      tenantAdminName: '',
      tenantAdminEmail: '',
      additionalTenantAdmins: [],
      invitedTenantUserEmails: [],
      identityProviderConnected: Boolean(form.idpConfig.issuerUrl.trim()),
      identityProviderConnectedBy: form.idpConfig.issuerUrl.trim() ? 'provider-admin' : null,
      identityProviderName: null,
      identityProviderDisplayName: null,
      identityProviderProtocol: form.idpConfig.protocol === 'saml' ? 'SAML' : 'OIDC',
      identityProviderIssuerUrl: form.idpConfig.issuerUrl.trim() || null,
      identityProviderClientId: form.idpConfig.clientId.trim() || null,
      identityProviders: [],
      idpManagerEmail: null,
      idpInviteToken: null,
      idpInviteStatus: 'none',
      idpInviteSentAt: null,
      idpInviteExpiresAt: null,
      ...breakGlass,
      breakGlassIssuedAt: new Date().toISOString(),
      rbacConfigured: false,
      idpConfig: { ...form.idpConfig },
      claimMappings: [...form.claimMappings],
      status: 'Pending activation',
      createdAt: new Date().toISOString(),
    }

    return organization
  }

  const applyGeneralFormToOrganization = (
    organization: RegisteredOrganization,
  ): RegisteredOrganization | null => {
    if (!isGeneralStepValid) {
      return null
    }

    const slug = slugifyOrganizationName(form.organizationName)
    const normalizedPrimaryDomain = normalizePrimaryDomain(form.primaryDomain)
    const normalizedAdditionalDomains = normalizeAdditionalDomains(
      form.additionalDomains,
      normalizedPrimaryDomain,
    )
    const normalizedTenantName = form.organizationName.trim()

    return {
      ...organization,
      name: normalizedTenantName,
      displayName: form.displayName.trim() || normalizedTenantName,
      tenantId: normalizedTenantName,
      slug,
      primaryDomain: normalizedPrimaryDomain,
      additionalDomains: normalizedAdditionalDomains,
      logoSrc: form.logoSrc.trim() || null,
      logoFileName: form.logoFileName.trim() || null,
      idpConfig: { ...form.idpConfig },
      claimMappings: [...form.claimMappings],
    }
  }

  const handleCreateTenant = (): boolean => {
    if (isEditMode && editingOrganization) {
      const organization = applyGeneralFormToOrganization(
        createdOrganization ?? editingOrganization,
      )
      if (!organization) {
        return false
      }
      setCreatedOrganization(organization)
      return true
    }

    const organization = buildOrganizationFromForm()
    if (!organization) {
      return false
    }

    setCreatedOrganization(organization)
    return true
  }

  const handleRegisterTenant = (): boolean => {
    const baseOrganization =
      createdOrganization ?? sourceOrganization ?? buildOrganizationFromForm()
    const organization =
      isEditMode && baseOrganization
        ? applyGeneralFormToOrganization(baseOrganization) ?? baseOrganization
        : baseOrganization
    if (!organization) {
      return false
    }

    const finalOrg: RegisteredOrganization = {
      ...organization,
      idpConfig: { ...form.idpConfig },
      claimMappings: [...form.claimMappings],
      identityProviderConnected: Boolean(form.idpConfig.issuerUrl.trim()),
      identityProviderProtocol: form.idpConfig.protocol === 'saml' ? 'SAML' : 'OIDC',
      identityProviderIssuerUrl: form.idpConfig.issuerUrl.trim() || null,
      identityProviderClientId: form.idpConfig.clientId.trim() || null,
      tenantSetupStatus: 'ready',
    }

    setCreatedOrganization(finalOrg)
    onPersistOrganization(finalOrg)
    onComplete?.(finalOrg)
    handleClose()
    return false
  }

  function isStepDisabled(_stepId: TenantOnboardingStepId): boolean {
    return false
  }

  function renderGeneralStep() {
    return (
      <div className="provider-admin-organizations__wizard-step tenant-onboarding__step">
        <Content component="p" className="provider-admin-organizations__wizard-lede">
          {isEditMode ? 'Update tenant details.' : 'Enter tenant details.'}
        </Content>
        <Form autoComplete="off" className="provider-admin-organizations__wizard-form">
          <FormGroup label="Tenant name" fieldId="tenant-onboarding-name" isRequired>
            <KubernetesResourceNameField
              id="tenant-onboarding-name"
              value={form.organizationName}
              onChange={(value) =>
                setForm((current) => {
                  const previousSlug = slugifyOrganizationName(current.organizationName)
                  const nextSlug = slugifyOrganizationName(value)
                  const issued = buildRegisterBreakGlassFields(value, current.primaryDomain, {
                    breakGlassUsername:
                      previousSlug === nextSlug ? current.breakGlassUsername : null,
                    breakGlassPassword:
                      previousSlug === nextSlug ? current.breakGlassPassword : null,
                  })
                  const shouldRefreshDisplayName =
                    !current.displayName.trim() ||
                    current.displayName.trim() === current.organizationName.trim()
                  return {
                    ...current,
                    organizationName: value,
                    displayName: shouldRefreshDisplayName ? value : current.displayName,
                    breakGlassUsername: issued.breakGlassUsername,
                    breakGlassPassword: issued.breakGlassPassword,
                  }
                })
              }
              placeholder="e.g. bluesolace-financial-group"
              isRequired
            />
            {nameTaken || slugTaken || nameFormat.validated === 'error' ? (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem variant="error">
                    {nameTaken
                      ? 'A tenant with this name is already registered.'
                      : slugTaken
                        ? 'A tenant with this login path already exists. Choose a different name.'
                        : nameFormat.message}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            ) : null}
          </FormGroup>
          <FormGroup label="Primary email domain" fieldId="tenant-onboarding-primary-domain" isRequired>
            <TextInput
              id="tenant-onboarding-primary-domain"
              value={form.primaryDomain}
              validated={domainTaken ? 'error' : 'default'}
              onChange={(_event, value) =>
                setForm((current) => ({ ...current, primaryDomain: value }))
              }
              placeholder="example.com"
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem variant={domainTaken ? 'error' : 'default'}>
                  {domainTaken
                    ? 'This email domain is already mapped to another tenant.'
                    : 'Primary domain for tenant sign-in and IdP association.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
          <AdditionalEmailDomainsField
            idPrefix="tenant-onboarding-additional-domain"
            primaryDomain={form.primaryDomain}
            domains={form.additionalDomains}
            onChange={(additionalDomains) =>
              setForm((current) => ({ ...current, additionalDomains }))
            }
            takenDomains={takenEmailDomains}
          />
          <TenantCompanyLogoField
            id="tenant-onboarding-company-logo"
            logoSrc={form.logoSrc}
            logoFileName={form.logoFileName}
            onLogoChange={(patch) =>
              setForm((current) => ({
                ...current,
                logoSrc: patch.logoSrc ?? current.logoSrc,
                logoFileName: patch.logoFileName ?? current.logoFileName,
              }))
            }
          />
        </Form>
      </div>
    )
  }

  function updateIdpConfig(patch: Partial<IdpFederationConfig>) {
    setForm((current) => ({
      ...current,
      idpConfig: { ...current.idpConfig, ...patch },
    }))
  }

  function renderIdpFederationStep() {
    const autoClientId = buildDefaultIdentityProviderClientId({
      name: form.organizationName,
      slug: draftOrganizationSlug,
    })

    return (
      <div className="provider-admin-organizations__wizard-step tenant-onboarding__step">
        <Content component="p" className="provider-admin-organizations__wizard-lede">
          Configure the tenant&apos;s identity provider for federated authentication.
        </Content>

        <Alert
          variant="info"
          isInline
          title="Identity brokering"
          className="pf-v6-u-mb-lg"
        >
          AI Grid connects to the tenant&apos;s identity provider via Keycloak identity brokering.
          OIDC is recommended for most deployments.
        </Alert>

        <Form autoComplete="off" className="provider-admin-organizations__wizard-form">
          <FormGroup label="Protocol" fieldId="tenant-onboarding-idp-protocol">
            <ToggleGroup aria-label="IdP protocol">
              <ToggleGroupItem
                text="OIDC"
                buttonId="idp-protocol-oidc"
                isSelected={form.idpConfig.protocol === 'oidc'}
                onChange={() => updateIdpConfig({ protocol: 'oidc' })}
              />
              <ToggleGroupItem
                text="SAML"
                buttonId="idp-protocol-saml"
                isSelected={form.idpConfig.protocol === 'saml'}
                onChange={() => updateIdpConfig({ protocol: 'saml' })}
              />
            </ToggleGroup>
          </FormGroup>

          <FormGroup label="Issuer URL" fieldId="tenant-onboarding-idp-issuer" isRequired>
            <TextInput
              id="tenant-onboarding-idp-issuer"
              value={form.idpConfig.issuerUrl}
              onChange={(_e, value) => updateIdpConfig({ issuerUrl: value })}
              placeholder="https://idp.example.com/realms/tenant"
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {form.idpConfig.protocol === 'oidc'
                    ? 'OpenID Connect discovery endpoint base URL.'
                    : 'SAML IdP entity ID or metadata URL.'}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label="Client ID" fieldId="tenant-onboarding-idp-client-id" isRequired>
            <TextInput
              id="tenant-onboarding-idp-client-id"
              value={form.idpConfig.clientId}
              onChange={(_e, value) => updateIdpConfig({ clientId: value })}
              placeholder={autoClientId}
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Registered client identifier at the tenant&apos;s IdP.{' '}
                  {!form.idpConfig.clientId.trim() && (
                    <Button
                      variant="link"
                      isInline
                      onClick={() => updateIdpConfig({ clientId: autoClientId })}
                    >
                      Auto-generate
                    </Button>
                  )}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>

          <FormGroup label="Client secret" fieldId="tenant-onboarding-idp-client-secret">
            <TextInput
              id="tenant-onboarding-idp-client-secret"
              type="password"
              value={form.idpConfig.clientSecret}
              onChange={(_e, value) => updateIdpConfig({ clientSecret: value })}
              placeholder="••••••••"
            />
          </FormGroup>

          <FormGroup label="Keycloak realm" fieldId="tenant-onboarding-idp-realm">
            <TextInput
              id="tenant-onboarding-idp-realm"
              value={form.idpConfig.keycloakRealm}
              onChange={(_e, value) => updateIdpConfig({ keycloakRealm: value })}
              placeholder="e.g. ai-grid-tenant"
            />
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  Optional. Keycloak realm name for the brokered connection.
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          </FormGroup>
        </Form>
      </div>
    )
  }

  function renderClaimMappingStep() {
    const tenantSlug = draftOrganizationSlug || 'tenant'

    const addMapping = () => {
      setForm((current) => ({
        ...current,
        claimMappings: [...current.claimMappings, { sourceGroup: '', gridRole: '' }],
      }))
    }

    const updateMapping = (index: number, patch: Partial<ClaimMapping>) => {
      setForm((current) => ({
        ...current,
        claimMappings: current.claimMappings.map((m, i) =>
          i === index ? { ...m, ...patch } : m,
        ),
      }))
    }

    const removeMapping = (index: number) => {
      setForm((current) => ({
        ...current,
        claimMappings: current.claimMappings.filter((_, i) => i !== index),
      }))
    }

    return (
      <div className="provider-admin-organizations__wizard-step tenant-onboarding__step">
        <Content component="p" className="provider-admin-organizations__wizard-lede">
          Map the tenant&apos;s IdP groups to AI Grid roles. Each mapping produces a
          tenant-qualified OIDC group claim.
        </Content>

        <Alert
          variant="info"
          isInline
          title="JWT claim structure"
          className="pf-v6-u-mb-lg"
        >
          <code>
            {'{'} &quot;groups&quot;: [&quot;{tenantSlug}:ai-grid-admins&quot;, &quot;{tenantSlug}:ai-grid-users&quot;] {'}'}
          </code>
        </Alert>

        <Table aria-label="Claim mappings" variant="compact">
          <Thead>
            <Tr>
              <Th>Source IdP group</Th>
              <Th>AI Grid role</Th>
              <Th>Qualified claim</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {form.claimMappings.map((mapping, index) => (
              <Tr key={index}>
                <Td dataLabel="Source IdP group">
                  <TextInput
                    aria-label={`Source group ${index + 1}`}
                    value={mapping.sourceGroup}
                    onChange={(_e, value) => updateMapping(index, { sourceGroup: value })}
                    placeholder="e.g. engineers"
                  />
                </Td>
                <Td dataLabel="AI Grid role">
                  <TextInput
                    aria-label={`Grid role ${index + 1}`}
                    value={mapping.gridRole}
                    onChange={(_e, value) => updateMapping(index, { gridRole: value })}
                    placeholder="e.g. ai-grid-users"
                  />
                </Td>
                <Td dataLabel="Qualified claim">
                  <Label isCompact color="blue">
                    {tenantSlug}:{mapping.gridRole || '…'}
                  </Label>
                </Td>
                <Td dataLabel="Actions">
                  <Button
                    variant="plain"
                    aria-label={`Remove mapping ${index + 1}`}
                    onClick={() => removeMapping(index)}
                  >
                    <TrashIcon />
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        <Button variant="secondary" className="pf-v6-u-mt-md" onClick={addMapping}>
          Add mapping
        </Button>
      </div>
    )
  }

  function renderReviewStep() {
    if (isEditMode) {
      return (
        <div className="provider-admin-organizations__wizard-step tenant-onboarding__step">
          <Content component="p" className="provider-admin-organizations__wizard-lede">
            Review your changes before saving.
          </Content>
          <CatalogEditChangesSummary changes={editChanges} ariaLabel="Tenant changes" />
        </div>
      )
    }

    const organization = createdOrganization ?? sourceOrganization
    const tenantName = organization?.name || form.organizationName.trim() || '—'
    const primaryDomain =
      organization?.primaryDomain || normalizePrimaryDomain(form.primaryDomain) || '—'
    const reviewAdditionalDomains = normalizeAdditionalDomains(
      organization?.additionalDomains ?? form.additionalDomains,
      primaryDomain === '—' ? form.primaryDomain : primaryDomain,
    )
    const logoSrc = organization?.logoSrc?.trim() || form.logoSrc.trim()
    const logoFileName =
      organization?.logoFileName?.trim() || form.logoFileName.trim() || tenantName

    return (
      <div className="provider-admin-organizations__wizard-step tenant-onboarding__step">
        <Content component="p" className="provider-admin-organizations__wizard-lede">
          Review your tenant settings before registering.
        </Content>
        <DescriptionList isCompact className="provider-admin-organizations__wizard-review">
          <DescriptionListGroup>
            <DescriptionListTerm>Tenant name</DescriptionListTerm>
            <DescriptionListDescription>{tenantName}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Primary email domain</DescriptionListTerm>
            <DescriptionListDescription>{primaryDomain}</DescriptionListDescription>
          </DescriptionListGroup>
          {reviewAdditionalDomains.length > 0 ? (
            <DescriptionListGroup>
              <DescriptionListTerm>Additional email domains</DescriptionListTerm>
              <DescriptionListDescription>
                <AdditionalEmailDomainsValue domains={reviewAdditionalDomains} />
              </DescriptionListDescription>
            </DescriptionListGroup>
          ) : null}
          <DescriptionListGroup>
            <DescriptionListTerm>Company logo</DescriptionListTerm>
            <DescriptionListDescription>
              {logoSrc ? (
                <div className="provider-admin-organizations__logo-preview">
                  <img src={logoSrc} alt={logoFileName || 'Company logo'} />
                </div>
              ) : (
                '—'
              )}
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>

        <Title headingLevel="h4" size="md" className="pf-v6-u-mt-lg pf-v6-u-mb-sm">
          Identity provider
        </Title>
        <DescriptionList isCompact>
          <DescriptionListGroup>
            <DescriptionListTerm>Protocol</DescriptionListTerm>
            <DescriptionListDescription>
              {form.idpConfig.protocol === 'saml' ? 'SAML 2.0' : 'OpenID Connect (OIDC)'}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Issuer URL</DescriptionListTerm>
            <DescriptionListDescription>
              {form.idpConfig.issuerUrl.trim() || '—'}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Client ID</DescriptionListTerm>
            <DescriptionListDescription>
              {form.idpConfig.clientId.trim() || '—'}
            </DescriptionListDescription>
          </DescriptionListGroup>
          {form.idpConfig.keycloakRealm.trim() ? (
            <DescriptionListGroup>
              <DescriptionListTerm>Keycloak realm</DescriptionListTerm>
              <DescriptionListDescription>
                {form.idpConfig.keycloakRealm}
              </DescriptionListDescription>
            </DescriptionListGroup>
          ) : null}
        </DescriptionList>

        {form.claimMappings.length > 0 ? (
          <>
            <Title headingLevel="h4" size="md" className="pf-v6-u-mt-lg pf-v6-u-mb-sm">
              Claim mappings
            </Title>
            <Table aria-label="Review claim mappings" variant="compact">
              <Thead>
                <Tr>
                  <Th>Source group</Th>
                  <Th>AI Grid role</Th>
                  <Th>Qualified claim</Th>
                </Tr>
              </Thead>
              <Tbody>
                {form.claimMappings.map((mapping, index) => (
                  <Tr key={index}>
                    <Td>{mapping.sourceGroup || '—'}</Td>
                    <Td>{mapping.gridRole || '—'}</Td>
                    <Td>
                      <Label isCompact color="blue">
                        {draftOrganizationSlug || 'tenant'}:{mapping.gridRole || '…'}
                      </Label>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        ) : null}
      </div>
    )
  }

  function renderStepContent(stepId: TenantOnboardingStepId) {
    switch (stepId) {
      case 'general':
        return renderGeneralStep()
      case 'idp_federation':
        return renderIdpFederationStep()
      case 'claim_mapping':
        return renderClaimMappingStep()
      case 'review':
        return renderReviewStep()
      default:
        return null
    }
  }

  function getStepFooter(stepId: TenantOnboardingStepId) {
    if (stepId === 'general') {
      return (
        <TenantOnboardingNavigateFooter
          onClose={requestClose}
          isNextDisabled={!isGeneralStepValid}
          onNavigateNext={() => handleCreateTenant()}
        />
      )
    }

    if (stepId === 'idp_federation') {
      return wrapStepFooter({
        isNextDisabled: !isIdpStepValid,
      })
    }

    if (stepId === 'claim_mapping') {
      return wrapStepFooter({
        isNextDisabled: false,
      })
    }

    if (stepId === 'review') {
      return (
        <TenantOnboardingNavigateFooter
          onClose={requestClose}
          isNextDisabled={!canSaveOrganizationEdit}
          nextButtonText={
            isExistingTenantMode ? 'Save' : 'Register tenant'
          }
          onNavigateNext={async () => {
            handleRegisterTenant()
            return false
          }}
        />
      )
    }

    return undefined
  }

  if (!isOpen) {
    return null
  }

  const wizardKey = editingOrganization
    ? `tenant-onboarding-edit-${editingOrganization.id}-${initialStepId}`
    : resumeOrganization
      ? `tenant-onboarding-resume-${resumeOrganization.id}`
      : 'tenant-onboarding-wizard'

  const wizard = (
    <Wizard
      key={wizardKey}
      className="provider-admin-organizations__wizard tenant-onboarding__wizard"
      height={isPage ? '100%' : '40rem'}
      isPlain={isPage}
      onClose={isPage ? undefined : requestClose}
      startIndex={wizardStartIndex}
      header={
        isPage ? undefined : (
          <WizardHeader
            title={wizardTitle}
            titleId="tenant-onboarding-wizard-title"
            onClose={requestClose}
            closeButtonAriaLabel={`Close ${wizardTitle.toLowerCase()} wizard`}
          />
        )
      }
    >
      {TENANT_ONBOARDING_STEPS.map((step) => (
        <WizardStep
          key={step.id}
          name={
            isEditMode && modifiedStepIds.has(step.id)
              ? `${step.label} (modified)`
              : step.label
          }
          id={`tenant-onboarding-step-${step.id}`}
          isDisabled={isStepDisabled(step.id)}
          footer={getStepFooter(step.id)}
        >
          {renderStepContent(step.id)}
        </WizardStep>
      ))}
    </Wizard>
  )

  if (isPage) {
    return (
      <ResourceCreatePageShell
        parentLabel="Tenants"
        title={wizardTitle}
        titleId="tenant-onboarding-wizard-title"
        onBack={requestClose}
      >
        {wizard}
        {leaveConfirmModal}
      </ResourceCreatePageShell>
    )
  }

  return (
    <>
      <Modal
        variant={ModalVariant.medium}
        width="64rem"
        maxWidth="64rem"
        isOpen={isOpen}
        onEscapePress={requestClose}
        aria-labelledby="tenant-onboarding-wizard-title"
        className="provider-admin-organizations__wizard-modal"
      >
        {wizard}
      </Modal>
      {leaveConfirmModal}
    </>
  )
}
