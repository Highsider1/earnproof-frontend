/**
 * Stable test fixtures for admin routes
 * All timestamps are fixed ISO strings (never use Date.now())
 * All data uses fixtures, never inline objects
 */

export const ADMIN_USER = {
  id: 'test-admin-001',
  email: 'admin@test.example',
  role: 'ADMIN',
  name: 'Test Admin',
  walletAddress: 'GBXXXADMINWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX6ZQ',
  walletHash: 'admin-wallet-hash-001',
};

export const DEVELOPER_USER = {
  id: 'test-developer-001',
  email: 'developer@test.example',
  role: 'DEVELOPER',
  name: 'Test Developer',
  walletAddress: 'GBXXXDEVELOPERWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX7ZQ',
  walletHash: 'developer-wallet-hash-001',
};

export const ISSUER_USER = {
  id: 'test-issuer-001',
  email: 'issuer@test.example',
  role: 'ISSUER',
  name: 'Test Issuer',
  walletAddress: 'GBXXXISSUERWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX8ZQ',
  walletHash: 'issuer-wallet-hash-001',
};

export const READONLY_USER = {
  id: 'test-readonly-001',
  email: 'readonly@test.example',
  role: 'WORKER',
  name: 'Test Reader',
  walletAddress: 'GBXXXREADONLYWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX9ZQ',
  walletHash: 'readonly-wallet-hash-001',
};

export const MOCK_API_KEYS = [
  {
    id: 'key-001',
    name: 'Test API Key 1',
    prefix: 'ep_test_xxxx',
    scopes: ['verification:read', 'proofs:read'],
    expiresAt: '2025-01-15T10:00:00.000Z',
  },
  {
    id: 'key-002',
    name: 'Test API Key 2',
    prefix: 'ep_test_yyyy',
    scopes: ['proofs:create'],
    expiresAt: null,
  },
  {
    id: 'key-003',
    name: 'Production Key With Very Long Name That Should Not Overflow In The UI',
    prefix: 'ep_prod_zzzz',
    scopes: ['verification:read', 'proofs:create', 'proofs:read', 'webhooks:manage'],
    expiresAt: '2026-12-31T23:59:59.000Z',
  },
];

export const MOCK_ORGANIZATIONS = [
  {
    id: 'org-001',
    name: 'Test Organization Alpha',
    slug: 'test-org-alpha',
    status: 'ACTIVE' as const,
    website: 'https://alpha.example.com',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'org-002',
    name: 'Test Organization Beta',
    slug: 'test-org-beta',
    status: 'PENDING' as const,
    website: null,
    createdAt: '2024-01-05T00:00:00.000Z',
  },
  {
    id: 'org-003',
    name: 'Test Organization Gamma With A Very Long Name That Tests Text Overflow',
    slug: 'test-org-gamma',
    status: 'SUSPENDED' as const,
    website: 'https://gamma.example.com',
    createdAt: '2024-01-10T00:00:00.000Z',
  },
];

export const MOCK_ISSUERS = [
  {
    id: 'issuer-001',
    name: 'Test Issuer Alpha',
    status: 'ACTIVE' as const,
    organizationId: 'org-001',
  },
  {
    id: 'issuer-002',
    name: 'Test Issuer Beta',
    status: 'PENDING' as const,
    organizationId: 'org-001',
  },
  {
    id: 'issuer-003',
    name: 'Test Issuer Gamma',
    status: 'SUSPENDED' as const,
    organizationId: 'org-002',
  },
  {
    id: 'issuer-004',
    name: 'Test Issuer Delta With Very Long Name That Tests UI Wrapping Behavior',
    status: 'ACTIVE' as const,
    organizationId: 'org-002',
  },
];

export const MOCK_TRUSTEDSOURCES = [
  {
    id: 'source-001',
    name: 'Test Trusted Source',
    url: 'https://test.example.com',
    status: 'ACTIVE' as const,
  },
  {
    id: 'source-002',
    name: 'Production Trusted Source',
    url: 'https://prod.example.com',
    status: 'ACTIVE' as const,
  },
];

export const VALID_TEST_TOKEN = 'test-token-admin-001';
export const DEVELOPER_TEST_TOKEN = 'test-token-developer-001';
export const ISSUER_TEST_TOKEN = 'test-token-issuer-001';
export const READONLY_TEST_TOKEN = 'test-token-readonly-001';

export function createMockSession(user: typeof ADMIN_USER, token: string) {
  return {
    token,
    user: {
      id: user.id,
      role: user.role,
      walletAddress: user.walletAddress,
      walletHash: user.walletHash,
    },
  };
}

export const MOCK_ADMIN_SESSION = createMockSession(ADMIN_USER, VALID_TEST_TOKEN);
export const MOCK_DEVELOPER_SESSION = createMockSession(
  DEVELOPER_USER,
  DEVELOPER_TEST_TOKEN
);
export const MOCK_ISSUER_SESSION = createMockSession(ISSUER_USER, ISSUER_TEST_TOKEN);
export const MOCK_READONLY_SESSION = createMockSession(
  READONLY_USER,
  READONLY_TEST_TOKEN
);
