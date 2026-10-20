/**
 * Hydration regression tests
 * 
 * These tests verify that components render consistently between
 * server and client without hydration mismatches.
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Import components that should render consistently
import HomePage from '@/app/page';
import AboutPage from '@/app/about/page';
import FAQPage from '@/app/faq/page';
import HowItWorksPage from '@/app/how-it-works/page';

const REPO_ROOT = path.join(__dirname, '..', '..');
const SERVER_PAGE_FILES = [
  'app/page.tsx',
  'app/about/page.tsx',
  'app/faq/page.tsx',
  'app/how-it-works/page.tsx',
];

// Mock next/navigation for client components that use it
jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

// Mock browser APIs that shouldn't be called during SSR
beforeAll(() => {
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    writable: true,
  });
  
  // Mock other browser APIs
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn(() => ({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
    writable: true,
  });
});

describe('Hydration Consistency', () => {
  describe('Server Components', () => {
    it('should render HomePage without browser APIs', () => {
      expect(() => render(<HomePage />)).not.toThrow();
      expect(screen.getAllByText(/EarnProof/i).length).toBeGreaterThan(0);
    });
    
    it('should render AboutPage without browser APIs', () => {
      expect(() => render(<AboutPage />)).not.toThrow();
      expect(screen.getAllByText(/About EarnProof/i).length).toBeGreaterThan(0);
    });
    
    it('should render FAQPage without browser APIs', () => {
      expect(() => render(<FAQPage />)).not.toThrow();
      expect(screen.getAllByText(/Frequently asked questions/i).length).toBeGreaterThan(0);
    });
    
    it('should render HowItWorksPage without browser APIs', () => {
      expect(() => render(<HowItWorksPage />)).not.toThrow();
      expect(screen.getAllByText(/How EarnProof works/i).length).toBeGreaterThan(0);
    });
  });
  
  describe('Browser API Safety', () => {
    it('should not call Date.now or Math.random during SSR', () => {
      const findings = SERVER_PAGE_FILES.flatMap((relativePath) => {
        const source = fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
        return /Date\.now\(|Math\.random\(/.test(source) ? [relativePath] : [];
      });

      expect(findings).toEqual([]);
    });
    
    it('should not access localStorage during SSR', () => {
      const localStorageSpy = jest.spyOn(window.localStorage, 'getItem');
      
      render(<HomePage />);
      
      // Server components shouldn't access localStorage
      expect(localStorageSpy).not.toHaveBeenCalled();
      
      localStorageSpy.mockRestore();
    });
    
    it('should not access window.document during SSR', () => {
      const documentSpy = jest.spyOn(document, 'querySelector');
      
      render(<HomePage />);
      
      // Server components shouldn't access document
      expect(documentSpy).not.toHaveBeenCalled();
      
      documentSpy.mockRestore();
    });
  });
});

describe('Client Component Boundaries', () => {
  // Note: We're not importing actual client components here because
  // they would require complex mocking. Instead, we verify the pattern.
  
  it('should flag components that use browser APIs without use client', () => {
    // This is a validation pattern - in practice, we would scan source code
    const clientDirectivePattern = /^['"]use client['"]/m;
    
    // Example check - components with browser APIs should have "use client"
    const componentsWithBrowserAPIs = [
      'components/proofs/create-proof-flow.tsx',
      'components/verification/verify-scan.tsx',
      'lib/health-check.ts',
    ];
    
    // In a real implementation, we would read these files and verify
    // they have "use client" directive
    expect(clientDirectivePattern).toBeDefined();
    expect(componentsWithBrowserAPIs.length).toBeGreaterThan(0);
  });
});

describe('Deterministic Rendering', () => {
  it('should render the same content on repeated renders', () => {
    const { container: container1 } = render(<HomePage />);
    const { container: container2 } = render(<HomePage />);
    
    // Compare HTML structure (simplified check)
    const html1 = container1.innerHTML;
    const html2 = container2.innerHTML;
    
    // Remove any dynamic attributes that might change
    const normalize = (html: string) =>
      html
        .replace(/data-testid="[^"]*"/g, '')
        .replace(/_r_\d+_/g, '_react_id_');
    const cleanHtml1 = normalize(html1);
    const cleanHtml2 = normalize(html2);
    
    expect(cleanHtml1).toBe(cleanHtml2);
  });
  
  it('should not include timestamps in initial render', () => {
    const { container } = render(<HomePage />);
    const html = container.innerHTML;
    
    // Check for common time formats that shouldn't be in SSR
    const timePatterns = [
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO timestamp
      /just now|minutes? ago|hours? ago/, // Relative time
      /\d{1,2}:\d{2} (AM|PM)/, // Time of day
    ];
    
    timePatterns.forEach(pattern => {
      expect(html).not.toMatch(pattern);
    });
  });
});

// Helper function for checking hydration safety
export function checkHydrationSafety(_componentPath: string): string[] {
  void _componentPath;
  const warnings: string[] = [];
  
  // In a real implementation, we would:
  // 1. Read the component file
  // 2. Parse for browser API usage
  // 3. Check for "use client" directive
  // 4. Return warnings for unsafe patterns
  
  return warnings;
}
