import type { ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarsIcon } from '@patternfly/react-icons/dist/esm/icons/bars-icon'
import { CogIcon } from '@patternfly/react-icons/dist/esm/icons/cog-icon'
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon'
import { UserIcon } from '@patternfly/react-icons/dist/esm/icons/user-icon'
import {
  Button,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  Label,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  MenuToggle,
  Nav,
  NavItem,
  NavList,
  Page,
  PageSection,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  Spinner,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core'
import {
  resolveProviderAdminNavId,
  type ProviderAdminNavId,
} from '../../providerAdmin/constants'
import { clearProviderOnboardingState } from '../../providerSetup/storage'
import type { WorkspaceTransition } from '../../providerAdmin/workspace'
import { UserPreferencesModal } from '../shared/UserPreferencesModal'
import { VertexaCloudMastheadLogo } from './VertexaCloudMastheadLogo'

type ProviderAdminShellProps = {
  children: ReactNode
  showNavigation?: boolean
  activeNavId?: ProviderAdminNavId
  onNavChange?: (navId: ProviderAdminNavId) => void
  workspaceTransition?: WorkspaceTransition
  isModelDeploymentMvp?: boolean
}

export function ProviderAdminShell({
  children,
  showNavigation = false,
  activeNavId = 'overview',
  onNavChange,
  workspaceTransition = 'idle',
  isModelDeploymentMvp: _isModelDeploymentMvp = false,
}: ProviderAdminShellProps) {
  const navigate = useNavigate()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false)
  const isContentFilled = activeNavId === 'ai-grid'

  const AI_GRID_FLAT_NAV: { id: ProviderAdminNavId; label: string }[] = [
    { id: 'ai-grid', label: 'AI Grid' },
    { id: 'ai-grid-enrollment', label: 'Grid enrollment' },
    { id: 'provider-ai-models', label: 'Models' },
    { id: 'provider-ai-maas-governance', label: 'MaaS governance' },
    { id: 'provider-ai-observability', label: 'Observability' },
    { id: 'administration-organizations', label: 'Tenants' },
  ]

  const header = (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton variant="plain" aria-label="Global navigation">
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        <MastheadBrand>
          <MastheadLogo className="vertexa-masthead-logo">
            <VertexaCloudMastheadLogo />
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>

      <MastheadContent className="provider-admin-masthead-content">
        <span className="provider-admin-masthead-content__spacer" aria-hidden />

        <Toolbar ouiaId="provider-admin-masthead-utilities" className="provider-admin-masthead-utilities">
          <ToolbarContent alignItems="center">
            <ToolbarGroup
              align={{ default: 'alignEnd' }}
              variant="action-group-plain"
              gap={{ default: 'gapSm' }}
            >
              <ToolbarItem>
                <Button variant="plain" aria-label="Help">
                  <OutlinedQuestionCircleIcon />
                </Button>
              </ToolbarItem>
              <ToolbarItem>
                <Dropdown
                  isOpen={isUserMenuOpen}
                  onOpenChange={setIsUserMenuOpen}
                  onSelect={() => setIsUserMenuOpen(false)}
                  popperProps={{ position: 'right' }}
                  toggle={(toggleRef) => (
                    <MenuToggle
                      ref={toggleRef}
                      isExpanded={isUserMenuOpen}
                      onClick={() => setIsUserMenuOpen((open) => !open)}
                      icon={<UserIcon />}
                      className="provider-admin-masthead-account-toggle"
                      aria-label="Alex Johnson, Provider Admin"
                    >
                      <span className="provider-admin-masthead-account">
                        <span className="provider-admin-masthead-account__name">Alex Johnson</span>
                        <Label color="grey" isCompact className="provider-admin-masthead-account__role">
                          Provider Admin
                        </Label>
                      </span>
                    </MenuToggle>
                  )}
                >
                  <DropdownList>
                    <DropdownItem
                      value="user-preferences"
                      icon={<CogIcon />}
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        setIsPreferencesModalOpen(true)
                      }}
                    >
                      User preferences
                    </DropdownItem>
                    <Divider />
                    <DropdownItem
                      value="logout"
                      onClick={() => {
                        clearProviderOnboardingState()
                        navigate('/')
                      }}
                    >
                      Log out
                    </DropdownItem>
                  </DropdownList>
                </Dropdown>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  )

  const sidebar = showNavigation ? (
    <PageSidebar>
      <PageSidebarBody isFilled>
        <Nav
          aria-label="Provider admin"
          onSelect={(_event, item) => {
            const navId = resolveProviderAdminNavId(String(item.itemId) as ProviderAdminNavId)
            onNavChange?.(navId)
          }}
        >
          <NavList>
            {AI_GRID_FLAT_NAV.map((item) => (
              <NavItem
                key={item.id}
                itemId={item.id}
                isActive={activeNavId === item.id}
                to="#"
                preventDefault
              >
                {item.label}
              </NavItem>
            ))}
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  ) : undefined

  return (
    <>
      <Page
        masthead={header}
        sidebar={sidebar}
        isManagedSidebar={showNavigation}
        isContentFilled={isContentFilled}
        className={[
          showNavigation ? 'provider-admin-shell-page' : undefined,
          workspaceTransition === 'entering' ? 'provider-admin-shell-page--entering' : undefined,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <PageSection
          isFilled={isContentFilled}
          isWidthLimited={!showNavigation}
          isCenterAligned={!showNavigation}
          className="provider-admin-shell__main"
        >
          {workspaceTransition !== 'idle' ? (
            <div
              className={`provider-admin-publishing-overlay provider-admin-publishing-overlay--${workspaceTransition}`}
              aria-live="polite"
              aria-busy="true"
            >
              <Spinner size="xl" aria-label="Publishing catalog item" />
            </div>
          ) : null}
          <div className="provider-admin-shell__content">{children}</div>
        </PageSection>
      </Page>
      <UserPreferencesModal
        isOpen={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
      />
    </>
  )
}
