/**
 * Tests for Organizations admin route
 * Coverage: visual rendering, interactions, authorization
 */

import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import OrganizationsPage from '@/app/settings/organizations/page';
import {
  renderAsAdmin,
  renderAsIssuer,
  renderAsReadOnly,
  renderUnauthenticated,
  setupAuthHelpers,
} from '@/tests/helpers/auth-helpers';

// Mock layout components
jest.mock('@/components/layout/public-shell', () => ({
  PublicShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/common/page-heading', () => ({
  PageHeading: ({
    title,
    description,
    eyebrow,
  }: {
    title: string;
    description: string;
    eyebrow: string;
  }) => (
    <header>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

jest.mock('@/components/common/production-ui', () => ({
  pageContainer: 'mocked-container',
}));

jest.mock('@/components/organizations/organization-management', () => ({
  OrganizationManagement: () => {
    return <div data-testid="organization-management">Organization Management</div>;
  },
}));

describe('OrganizationsPage', () => {
  setupAuthHelpers();

  describe('VISUAL/RENDERING - Page Structure', () => {
    it('renders page heading with correct title and description', () => {
      renderAsAdmin(<OrganizationsPage />);

      expect(screen.getByRole('heading', { name: 'Organization Management' })).toBeInTheDocument();
      expect(
        screen.getByText(/Manage organizations, their status, and associated metadata/)
      ).toBeInTheDocument();
      expect(screen.getByText('Administration')).toBeInTheDocument();
    });

    it('renders the organization management component', () => {
      renderAsAdmin(<OrganizationsPage />);

      expect(screen.getByTestId('organization-management')).toBeInTheDocument();
    });

    it('has semantic section structure', () => {
      const { container } = renderAsAdmin(<OrganizationsPage />);

      expect(container.querySelectorAll('section')).toHaveLength(1);
      expect(container.querySelectorAll('header')).toHaveLength(1);
    });
  });

  describe('AUTHORIZATION', () => {
    it('allows admin to access organization management', () => {
      renderAsAdmin(<OrganizationsPage />);

      expect(screen.getByTestId('organization-management')).toBeInTheDocument();
    });

    it('allows issuer to access organization management', () => {
      renderAsIssuer(<OrganizationsPage />);

      expect(screen.getByTestId('organization-management')).toBeInTheDocument();
    });

    it('allows read-only to render page (auth in component)', () => {
      renderAsReadOnly(<OrganizationsPage />);

      expect(screen.getByTestId('organization-management')).toBeInTheDocument();
    });

    it('allows unauthenticated to render page (auth in component)', () => {
      renderUnauthenticated(<OrganizationsPage />);

      expect(screen.getByTestId('organization-management')).toBeInTheDocument();
    });
  });

  describe('RESPONSIVE DESIGN', () => {
    it('renders correctly on mobile viewport (390px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 390,
      });

      const { container } = renderAsAdmin(<OrganizationsPage />);

      expect(screen.getByTestId('organization-management')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });

    it('renders correctly on desktop viewport (1440px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      });

      const { container } = renderAsAdmin(<OrganizationsPage />);

      expect(screen.getByTestId('organization-management')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });
  });

  describe('ACCESSIBILITY', () => {
    it('has proper heading hierarchy', () => {
      renderAsAdmin(<OrganizationsPage />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Organization Management');
    });

    it('page heading section is semantic header', () => {
      const { container } = renderAsAdmin(<OrganizationsPage />);

      const headers = container.querySelectorAll('header');
      expect(headers.length).toBeGreaterThan(0);
    });
  });
});
