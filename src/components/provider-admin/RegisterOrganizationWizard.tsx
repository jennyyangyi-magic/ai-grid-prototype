import { useEffect, useMemo, useState } from 'react'
import { ArrowRightIcon } from '@patternfly/react-icons/dist/esm/icons/arrow-right-icon'
import { UsersIcon } from '@patternfly/react-icons/dist/esm/icons/users-icon'
import {
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
  Modal,
  ModalVariant,
  TextInput,
  Wizard,
  WizardHeader,
  WizardStep,
} from '@patternfly/react-core'
import { KubernetesResourceNameField } from '../shared/KubernetesResourceNameHelper'
import { ResourceCreatePageShell } from '../shared/ResourceCreatePageShell'
import { useWizardLeaveConfirm } from '../shared/useWizardLeaveConfirm'
import type { ProviderCatalogDraft } from '../../providerSetup/storage'
import {
  getAssignableExternalIpPools,
} from '../../providerAdmin/externalIpPools'
import {
  getProviderExternalIpPools,
  getProviderRegisteredOrganizations,
} from '../../providerSetup/storage'
import {
  DEFAULT_REGISTER_ORGANIZATION_FORM,
  buildNextRegisterOrganizationForm,
  buildRegisterBreakGlassFields,
  formFromRegisteredOrganization,
  generateOrganizationId,
  generateBillingAccountId,
  getTakenEmailDomains,
  isOrganizationDomainTaken,
  isOrganizationNameTaken,
  isOrganizationSlugTaken,
  areAdditionalDomainsValid,
  isValidPrimaryDomain,
  normalizeAdditionalDomains,
  normalizePrimaryDomain,
  REGISTER_ORGANIZATION_STEPS,
  slugifyOrganizationName,
  type RegisterOrganizationForm,
  type RegisterOrganizationStepId,
  type RegisteredOrganization,
} from '../../providerAdmin/organizations'
import {
  getKubernetesResourceNameValidation,
  isValidKubernetesResourceName,
} from '../../shared/kubernetesResourceName'
import { resolveM360ConnectionStatus } from '../../billing/m360'
import { M360ConnectionStatusField } from '../billing/M360ConnectionStatusField'
import { TenantCompanyLogoField } from './TenantCompanyLogoField'
import { CatalogEditChangesSummary } from './CatalogEditChangesSummary'
import {
  buildOrganizationEditSnapshot,
  buildOrganizationEditSnapshotFromOrganization,
  getOrganizationEditChanges,
  getOrganizationEditModifiedStepIds,
} from '../../providerAdmin/organizationEditDiff'
import {
  AdditionalEmailDomainsField,
  AdditionalEmailDomainsValue,
} from './AdditionalEmailDomainsField'

type RegisterOrganizationWizardProps = {
  isOpen: boolean
  /** `page` replaces the organizations landing (breadcrumb back). Default `modal`. */
  presentation?: 'modal' | 'page'
  catalogDraft: ProviderCatalogDraft | null
  editingOrganization?: RegisteredOrganization | null
  onClose: () => void
  onRegister: (organization: RegisteredOrganization) => void
  onSave?: (organization: RegisteredOrganization) => void
}

export function RegisterOrganizationWizard({
  isOpen,
  presentation = 'modal',
  catalogDraft,
  editingOrganization = null,
  onClose,
  onRegister,
  onSave,
}: RegisterOrganizationWizardProps) {
  const isEditMode = editingOrganization !== null
  const [form, setForm] = useState<RegisterOrganizationForm>(() =>
    editingOrganization
      ? formFromRegisteredOrganization(editingOrganization)
      : buildNextRegisterOrganizationForm(getProviderRegisteredOrganizations()),
  )
  const existingOrganizations = useMemo(() => {
    if (!isOpen) {
      return []
    }

    return getProviderRegisteredOrganizations()
  }, [isOpen])

  const assignablePools = useMemo(() => {
    if (!isOpen) {
      return []
    }

    return getAssignableExternalIpPools(getProviderExternalIpPools())
  }, [isOpen])

  const resetWizard = () => {
    setForm(
      editingOrganization
        ? formFromRegisteredOrganization(editingOrganization)
        : buildNextRegisterOrganizationForm(getProviderRegisteredOrganizations()),
    )
  }

  const handleClose = () => {
    resetWizard()
    onClose()
  }

  const { requestClose, leaveConfirmModal, wrapStepFooter } = useWizardLeaveConfirm({
    onLeave: handleClose,
    primaryActionLabel: isEditMode ? 'Discard changes' : 'Leave',
    titleId: 'register-organization-leave-confirm',
  })

  useEffect(() => {
    if (!isOpen) {
      resetWizard()
      return
    }

    if (editingOrganization) {
      setForm(formFromRegisteredOrganization(editingOrganization))
      return
    }

    const pools = getAssignableExternalIpPools(getProviderExternalIpPools())
    const nextForm = buildNextRegisterOrganizationForm(getProviderRegisteredOrganizations())
    const defaultPoolAvailable = pools.some(
      (pool) => pool.id === DEFAULT_REGISTER_ORGANIZATION_FORM.externalIpPoolId,
    )

    setForm({
      ...nextForm,
      externalIpPoolId: defaultPoolAvailable
        ? DEFAULT_REGISTER_ORGANIZATION_FORM.externalIpPoolId
        : (pools[0]?.id ?? ''),
    })
  }, [editingOrganization, isOpen])

  const excludeOrganizationId = editingOrganization?.id
  const primaryDomain = normalizePrimaryDomain(form.primaryDomain)
  const takenEmailDomains = useMemo(
    () => getTakenEmailDomains(existingOrganizations, excludeOrganizationId),
    [existingOrganizations, excludeOrganizationId],
  )
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
  const additionalDomainsValid = areAdditionalDomainsValid(
    form.additionalDomains,
    form.primaryDomain,
    takenEmailDomains,
  )
  const m360ConnectionStatus = resolveM360ConnectionStatus(form.m360AccountId)
  const isOrganizationStepValid =
    isValidKubernetesResourceName(form.organizationName) &&
    form.displayName.trim().length > 0 &&
    form.m360AccountId.trim().length > 0 &&
    m360ConnectionStatus !== 'not_found' &&
    isValidPrimaryDomain(form.primaryDomain) &&
    additionalDomainsValid &&
    !nameTaken &&
    !domainTaken &&
    !slugTaken

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

  const handleRegister = () => {
    const maxInstances = Number.parseInt(form.maxInstances, 10)
    const latestOrganizations = getProviderRegisteredOrganizations()
    const selectedPool =
      assignablePools.find((pool) => pool.id === form.externalIpPoolId) ??
      assignablePools[0] ??
      null
    if (
      !isOrganizationStepValid ||
      isOrganizationNameTaken(
        form.organizationName,
        latestOrganizations,
        excludeOrganizationId,
      ) ||
      isOrganizationDomainTaken(
        form.primaryDomain,
        latestOrganizations,
        excludeOrganizationId,
      ) ||
      isOrganizationSlugTaken(
        form.organizationName,
        latestOrganizations,
        excludeOrganizationId,
      ) ||
      !Number.isFinite(maxInstances) ||
      maxInstances <= 0
    ) {
      return
    }

    const logoSrc = form.logoSrc.trim() || null
    const logoFileName = form.logoFileName.trim() || null
    const normalizedAdditionalDomains = normalizeAdditionalDomains(
      form.additionalDomains,
      primaryDomain,
    )

    if (editingOrganization) {
      const m360AccountId = form.m360AccountId.trim()
      const updated: RegisteredOrganization = {
        ...editingOrganization,
        name: form.organizationName.trim(),
        displayName: form.displayName.trim(),
        slug: slugifyOrganizationName(form.organizationName),
        primaryDomain,
        additionalDomains: normalizedAdditionalDomains,
        m360AccountId,
        m360ConnectionStatus: resolveM360ConnectionStatus(m360AccountId),
        billingAccountId: m360AccountId,
        billingAccountName: `${slugifyOrganizationName(form.organizationName)}-enterprise-billing`,
        logoSrc,
        logoFileName,
      }
      onSave?.(updated)
      handleClose()
      return
    }

    const m360AccountId = form.m360AccountId.trim() || generateBillingAccountId()
    const organization: RegisteredOrganization = {
      id: generateOrganizationId(),
      name: form.organizationName.trim(),
      displayName: form.displayName.trim(),
      tenantId: form.organizationName.trim(),
      slug: slugifyOrganizationName(form.organizationName),
      primaryDomain,
      additionalDomains: normalizedAdditionalDomains,
      m360AccountId,
      m360ConnectionStatus: resolveM360ConnectionStatus(m360AccountId),
      billingAccountId: m360AccountId,
      billingAccountName: `${slugifyOrganizationName(form.organizationName)}-enterprise-billing`,
      logoSrc,
      logoFileName,
      catalogItemId: catalogDraft?.catalogItemId ?? null,
      catalogDisplayName: catalogDraft?.displayName ?? null,
      externalIpPoolId: selectedPool?.id ?? null,
      externalIpPoolName: selectedPool?.name ?? null,
      externalIpPoolCidr: selectedPool?.cidr ?? null,
      maxInstances,
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
      ...buildRegisterBreakGlassFields(form.organizationName.trim(), primaryDomain, {
        breakGlassUsername: form.breakGlassUsername,
        breakGlassPassword: form.breakGlassPassword,
        slug: slugifyOrganizationName(form.organizationName),
      }),
      breakGlassIssuedAt: new Date().toISOString(),
      rbacConfigured: false,
      status: 'Pending activation',
      createdAt: new Date().toISOString(),
    }

    onRegister(organization)
    handleClose()
  }

  function renderStepContent(stepId: RegisterOrganizationStepId) {
    switch (stepId) {
      case 'organization':
        return (
          <div className="provider-admin-organizations__wizard-step">
            <Content component="p" className="provider-admin-organizations__wizard-lede">
              {isEditMode
                ? 'Update the tenant and its M360 account mapping.'
                : 'Create the tenant in OSAC and map it to an existing M360 account. Invoicing, payment methods, and rate cards stay in M360.'}
            </Content>
            <Form autoComplete="off" className="provider-admin-organizations__wizard-form">
              <FormGroup label="Tenant name" fieldId="register-org-name" isRequired>
                <KubernetesResourceNameField
                  id="register-org-name"
                  value={form.organizationName}
                  onChange={(value) =>
                    setForm((current) => {
                      if (isEditMode) {
                        return { ...current, organizationName: value }
                      }
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
                  placeholder="e.g. north-summit-bank"
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
              <FormGroup label="Display name" fieldId="register-display-name" isRequired>
                <TextInput
                  id="register-display-name"
                  value={form.displayName}
                  onChange={(_event, value) =>
                    setForm((current) => ({ ...current, displayName: value }))
                  }
                  placeholder="e.g. North Summit Bank"
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      Human-readable tenant name shown in workspace branding.
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <FormGroup label="Primary email domain" fieldId="register-primary-domain" isRequired>
                <TextInput
                  id="register-primary-domain"
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
                idPrefix="register-additional-domain"
                primaryDomain={form.primaryDomain}
                domains={form.additionalDomains}
                onChange={(additionalDomains) =>
                  setForm((current) => ({ ...current, additionalDomains }))
                }
                takenDomains={takenEmailDomains}
              />
              <TenantCompanyLogoField
                id="register-company-logo"
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
              <FormGroup label="M360 tenant / account ID" fieldId="register-m360-account" isRequired>
                <TextInput
                  id="register-m360-account"
                  value={form.m360AccountId}
                  validated={m360ConnectionStatus === 'not_found' ? 'error' : 'default'}
                  onChange={(_event, value) =>
                    setForm((current) => ({
                      ...current,
                      m360AccountId: value,
                      billingAccountId: value,
                    }))
                  }
                  placeholder="e.g. ACCT-NSB-2048"
                />
                <M360ConnectionStatusField
                  accountId={form.m360AccountId}
                  status={m360ConnectionStatus}
                />
              </FormGroup>
            </Form>
          </div>
        )
      case 'review':
        if (isEditMode) {
          return (
            <div className="provider-admin-organizations__wizard-step">
              <Content component="p" className="provider-admin-organizations__wizard-lede">
                Review your changes before saving.
              </Content>
              <CatalogEditChangesSummary
                changes={editChanges}
                ariaLabel="Tenant changes"
              />
            </div>
          )
        }

        return (
          <DescriptionList isCompact className="provider-admin-organizations__wizard-review">
            <DescriptionListGroup>
              <DescriptionListTerm>Tenant</DescriptionListTerm>
              <DescriptionListDescription>
                {form.organizationName.trim() || '—'}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Display name</DescriptionListTerm>
              <DescriptionListDescription>
                {form.displayName.trim() || '—'}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Primary email domain</DescriptionListTerm>
              <DescriptionListDescription>
                {primaryDomain || '—'}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Additional email domains</DescriptionListTerm>
              <DescriptionListDescription>
                <AdditionalEmailDomainsValue
                  domains={normalizeAdditionalDomains(form.additionalDomains, primaryDomain)}
                />
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Company logo</DescriptionListTerm>
              <DescriptionListDescription>
                {form.logoSrc.trim() ? (
                  <div className="provider-admin-organizations__logo-preview">
                    <img
                      src={form.logoSrc}
                      alt={form.logoFileName.trim() || form.organizationName.trim() || 'Company logo'}
                    />
                  </div>
                ) : (
                  '—'
                )}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>M360 account</DescriptionListTerm>
              <DescriptionListDescription>
                {form.m360AccountId.trim() ? (
                  <code>{form.m360AccountId.trim()}</code>
                ) : (
                  '—'
                )}
                <M360ConnectionStatusField
                  accountId={form.m360AccountId}
                  status={m360ConnectionStatus}
                />
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        )
      default:
        return null
    }
  }

  function getStepFooter(stepId: RegisterOrganizationStepId) {
    if (stepId === 'organization') {
      return wrapStepFooter({
        isNextDisabled: !isOrganizationStepValid,
      })
    }

    if (stepId === 'review') {
      const maxInstances = Number.parseInt(form.maxInstances, 10)
      const canRegister =
        isOrganizationStepValid && Number.isFinite(maxInstances) && maxInstances > 0

      return wrapStepFooter({
        nextButtonText: (
          <span className="provider-admin-organizations__register-label">
            {isEditMode ? null : <UsersIcon aria-hidden />}
            <span>{isEditMode ? 'Save' : 'Register tenant'}</span>
            <ArrowRightIcon aria-hidden />
          </span>
        ),
        onNext: handleRegister,
        isNextDisabled: isEditMode ? !canSaveOrganizationEdit : !canRegister,
      })
    }

    return undefined
  }

  const wizardTitle = isEditMode ? 'Edit tenant' : 'Register tenant'
  const isPage = presentation === 'page'

  const wizard = isOpen ? (
    <Wizard
      key={editingOrganization?.id ?? 'register-organization-wizard'}
      className="provider-admin-organizations__wizard"
      height={isPage ? '100%' : '40rem'}
      isPlain={isPage}
      onClose={isPage ? undefined : requestClose}
      header={
        isPage ? undefined : (
          <WizardHeader
            title={wizardTitle}
            titleId="register-organization-wizard-title"
            onClose={requestClose}
            closeButtonAriaLabel={
              isEditMode ? 'Close edit tenant wizard' : 'Close register tenant wizard'
            }
          />
        )
      }
    >
      {REGISTER_ORGANIZATION_STEPS.map((step) => {
        const isOrganizationStepModified =
          step.id === 'organization' &&
          (modifiedStepIds.has('general') || modifiedStepIds.has('idp_federation'))

        return (
          <WizardStep
            key={step.id}
            name={
              isEditMode && isOrganizationStepModified
                ? `${step.label} (modified)`
                : step.label
            }
            id={`register-org-step-${step.id}`}
            footer={getStepFooter(step.id)}
          >
            {renderStepContent(step.id)}
          </WizardStep>
        )
      })}
    </Wizard>
  ) : null

  if (isPage) {
    if (!isOpen) {
      return null
    }
    return (
      <ResourceCreatePageShell
        parentLabel="Tenants"
        title={wizardTitle}
        titleId="register-organization-wizard-title"
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
        aria-labelledby="register-organization-wizard-title"
        className="provider-admin-organizations__wizard-modal"
      >
        {wizard}
      </Modal>
      {leaveConfirmModal}
    </>
  )
}
