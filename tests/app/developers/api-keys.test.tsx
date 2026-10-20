/**
 * Tests for API Keys admin route
 * Coverage: visual rendering, interactions, authorization, accessibility
 */

import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ReactNode } from 'react';
import ApiKeysPage from '@/app/developers/api-keys/page';
import {
  renderAsAdmin,
  renderAsDeveloper,
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

// Mock the API key management component
jest.mock('@/components/developers/api-key-management', () => ({
  ApiKeyManagement: () => {
    return <div data-testid="api-key-management">API Key Management</div>;
  },
}));

describe('ApiKeysPage', () => {
  setupAuthHelpers();

  describe('VISUAL/RENDERING - Page Structure', () => {
    it('renders page heading with correct title and description', () => {
      renderAsAdmin(<ApiKeysPage />);

      expect(screen.getByRole('heading', { name: 'API Key Management' })).toBeInTheDocument();
      expect(
        screen.getByText(/Create and manage API keys with scoped permissions/)
      ).toBeInTheDocument();
      expect(screen.getByText('Developer tools')).toBeInTheDocument();
    });

    it('renders the API key management component', () => {
      renderAsAdmin(<ApiKeysPage />);

      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
    });

    it('has semantic section structure', () => {
      const { container } = renderAsAdmin(<ApiKeysPage />);

      expect(container.querySelectorAll('section')).toHaveLength(1);
      expect(container.querySelectorAll('header')).toHaveLength(1);
    });
  });

  describe('VISUAL/RENDERING - Authentication States', () => {
    it('mocked component renders regardless of auth state', () => {
      renderUnauthenticated(<ApiKeysPage />);

      // Mock always renders, auth handled by actual component
      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
    });

    it('read-only user sees mocked component', () => {
      renderAsReadOnly(<ApiKeysPage />);

      // Mock renders for all users since actual auth is in ApiKeyManagement
      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
    });
  });

  describe('AUTHORIZATION', () => {
    it('allows admin to render page', () => {
      renderAsAdmin(<ApiKeysPage />);

      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
    });

    it('allows developer to render page', () => {
      renderAsDeveloper(<ApiKeysPage />);

      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
    });

    it('allows read-only to render page (auth in component)', () => {
      renderAsReadOnly(<ApiKeysPage />);

      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
    });

    it('allows unauthenticated to render page (auth in component)', () => {
      renderUnauthenticated(<ApiKeysPage />);

      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
    });
  });

  describe('RESPONSIVE DESIGN', () => {
    it('renders correctly on mobile viewport (390px)', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 390,
      });

      const { container } = renderAsAdmin(<ApiKeysPage />);

      // Component should be present and not crash on mobile
      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });

    it('renders correctly on desktop viewport (1440px)', () => {
      // Set desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1440,
      });

      const { container } = renderAsAdmin(<ApiKeysPage />);

      // Component should be present
      expect(screen.getByTestId('api-key-management')).toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });
  });

  describe('ACCESSIBILITY', () => {
    it('has proper heading hierarchy', () => {
      renderAsAdmin(<ApiKeysPage />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('API Key Management');
    });

    it('page heading section is semantic header', () => {
      const { container } = renderAsAdmin(<ApiKeysPage />);

      const headers = container.querySelectorAll('header');
      expect(headers.length).toBeGreaterThan(0);
    });
  });
});
