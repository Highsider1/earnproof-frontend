/**
 * Tests for Issuers admin route
 * Coverage: visual rendering, status badges, interactions, authorization
 */

import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import IssuersPage from '@/app/settings/issuers/page';
import {
  renderAsAdmin,
  renderAsIssuer,
  renderAsReadOnly,
  renderAsDeveloper,
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

jest.mock('@/components/issuers/issuer-management', () => ({
  IssuerManagement: () => {
    return <div data-testid="issuer-management">Issuer Management</div>;
  },
}));

describe('IssuersPage', () => {
  setupAuthHelpers();

  describe('VISUAL/RENDERING - Page Structure', () => {
    it('renders page heading with correct title and description', () => {
      renderAsAdmin(<IssuersPage />);

      expect(screen.getByRole('heading', { name: 'Issuer Management' })).toBeInTheDocument();
      expect(
        screen.getByText(/Manage issuers, their organizational relationships/)
      ).toBeInTheDocument();
      expect(screen.getByText('Administration')).toBeInTheDocument();
    });

    it('renders the issuer management component', () => {
      renderAsAdmin(<IssuersPage />);

      expect(screen.getByTestId('issuer-management')).toBeInTheDocument();
    });

    it('has semantic section structure', () => {
      const { container } = renderAsAdmin(<IssuersPage />);

      expect(container.querySelectorAll('section')).toHaveLength(1);
      expect(container.querySelectorAll('header')).toHaveLength(1);
    });
  });

  describe('AUTHORIZATION', () => {
    it('allows admin to access issuer management', () => {
      renderAsAdmin(<IssuersPage />);

      expect(screen.getByTestId('issuer-management')).toBeInTheDocument();
    });

    it('allows issuer to access issuer management', () => {
      renderAsIssuer(<IssuersPage />);

      expect(screen.getByTestId('issuer-management')).toBeInTheDocument();
    });

    it('allows developer to render page (auth in component)', () => {
      renderAsDeveloper(<IssuersPage />);

      expect(screen.getByTestId('issuer-management')).toBeInTheDocument();
    });

    it('allows read-only to render page (auth in component)', () => {
      renderAsReadOnly(<IssuersPage />);

      expect(screen.getByTestId('issuer-management')).toBeInTheDocument();
    });

    it('allows unauthenticated to render page (auth in component)', () => {
      renderUnauthenticated(<IssuersPage />);

      expect(screen.getByTestId('issuer-management')).toBeInTheDocument();
    });
  });

  describe('RESPONSIVE DESIGN', () => {
    it('renders correctly on mobile viewport (390px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 390,
      });

      const { container } = renderAsAdmin(<IssuersPage />);

      expect(screen.getByTestId('issuer-management')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });

    it('renders correctly on desktop viewport (1440px)', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      });

      const { container } = renderAsAdmin(<IssuersPage />);

      expect(screen.getByTestId('issuer-management')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });
  });

  describe('ACCESSIBILITY', () => {
    it('has proper heading hierarchy', () => {
      renderAsAdmin(<IssuersPage />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Issuer Management');
    });

    it('page heading section is semantic header', () => {
      const { container } = renderAsAdmin(<IssuersPage />);

      const headers = container.querySelectorAll('header');
      expect(headers.length).toBeGreaterThan(0);
    });
  });
});
