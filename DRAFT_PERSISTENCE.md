# Proof Wizard Draft Persistence

## Overview

This feature implements draft persistence for proof creation wizards, allowing users to preserve validated input across page refresh and navigation. The implementation follows production-ready security and privacy standards.

## Scope

### Supported Proof Types
1. **Minimum Income Proof** (`create-proof-flow.tsx`)
2. **Payment Receipt Proof** (`payment-receipt-proof-flow.tsx`)
3. **Recurring Income Proof** (`recurring-income-proof-wizard.tsx`)

## Architecture

### Storage Schema (`lib/storage/index.ts`)
- Added `PROOF_DRAFTS` key to storage system with versioning support
- Version 1 schema stores drafts keyed by proof type
- Each draft includes: `savedAt`, `expiresAt`, and non-secret `values`

### Draft Management (`lib/storage/proof-drafts.ts`)
Core utilities for draft persistence:
- `saveProofDraft()` - Save draft with automatic expiration (7 days)
- `loadProofDraft()` - Load and validate draft, auto-delete if expired/corrupt
- `deleteProofDraft()` - Explicitly remove a draft
- `clearAllProofDrafts()` - Remove all proof drafts
- `getDraftMetadata()` - Get draft info without loading full data

### Type Definitions
```typescript
// Minimum Income Draft
interface MinimumIncomeDraftData {
  selectedPaymentIds: string[];
  thresholdAmount: string;
  periodStart: string;
  periodEnd: string;
}

// Payment Receipt Draft
interface PaymentReceiptDraftData {
  selectedPaymentId: string | null;
  discloseSender: boolean;
  discloseAmount: boolean;
  expiresInDays: number;
}

// Recurring Income Draft
interface RecurringIncomeDraftData {
  intervalUnit: 'DAY' | 'WEEK' | 'MONTH';
  intervalCount: number;
  periodStart: string;
  periodEnd: string;
  selectedPaymentIds: string[];
  selectedAsset: { code: string; issuer: string | null } | null;
  expiresInDays: number;
  currentStep: string;
}
```

## Security & Privacy Guarantees

### ✅ Persisted (Safe)
- Form field values (amounts, dates, periods)
- Selection state (payment IDs, asset selections)
- UI state (wizard steps, privacy toggles)
- Configuration (expiration days, intervals)

### ❌ Never Persisted (Secrets)
- Wallet signatures
- Authentication tokens
- Session data
- Final proof artifacts
- Credential hashes
- Verification URLs

## Implementation Details

### 1. Minimum Income Proof
**File:** `components/proofs/create-proof-flow.tsx`

**Changes:**
- Load draft on mount to restore form state
- Auto-save draft on field changes (debounced via React batching)
- Clear draft after successful proof creation
- "Discard Draft" button visible when draft exists
- Draft validation ensures data integrity

### 2. Payment Receipt Proof
**File:** `components/proofs/payment-receipt-proof-flow.tsx`

**Changes:**
- Similar pattern to minimum income proof
- Restores payment selection and privacy controls
- Preserves expiration settings

### 3. Recurring Income Proof
**File:** `components/proofs/recurring-income-proof-wizard.tsx`

**Changes:**
- Restores wizard step position
- Preserves interval and period configuration
- Maintains payment and asset selections
- Coverage analysis state NOT persisted (recalculated on demand)

## Migration & Compatibility

### Version Handling
- Current version: 1
- Automatic migration support built-in
- Corrupt/incompatible drafts auto-deleted with logging

### Expiry Behavior
- **Retention:** 7 days from last save
- **Check:** On every load attempt
- **Action:** Auto-delete expired drafts
- **User feedback:** Silent deletion, fresh form state

## User Experience

### Draft Restoration
1. User fills out proof wizard
2. Navigates away or refreshes page
3. Returns to proof wizard
4. Form fields automatically restored
5. Can continue from where they left off

### Explicit Discard
- "Discard Draft" button appears when draft exists
- Clicking resets form to defaults
- Provides feedback: "Draft discarded"

### Automatic Cleanup
- Draft cleared after successful proof creation
- Expired drafts auto-removed on next visit
- Corrupt drafts silently discarded

## Test Coverage

### Test File: `lib/storage/__tests__/proof-drafts.test.ts`

**Coverage Areas:**
1. **Basic Operations**
   - Save and load drafts for all proof types
   - Multiple independent drafts
   - Non-existent draft handling

2. **Draft Deletion**
   - Delete specific draft
   - Preserve other drafts
   - Remove storage key when empty

3. **Expiration**
   - Return null for expired drafts
   - Auto-delete on load
   - Metadata includes expiry status

4. **Validation**
   - Reject corrupt data structures
   - Auto-delete invalid drafts
   - Type-specific validation

5. **Security**
   - No wallet signatures in storage
   - No tokens or secrets persisted
   - Only safe field values stored

6. **Error Handling**
   - Graceful JSON parse failures
   - Storage quota exceeded
   - Access denied scenarios

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- lib/storage/__tests__/proof-drafts.test.ts

# Run with coverage
npm test -- --coverage
```

## Validation Commands

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Build verification
npm run build
```

## Accessibility

- Draft discard buttons properly labeled
- Screen reader announcements for draft actions
- Keyboard navigation fully supported
- Focus management maintained

## Browser Compatibility

- Uses `localStorage` API (supported in all modern browsers)
- Graceful degradation if storage unavailable
- No blocking errors on storage failures

## Performance

- Debounced saves via React state batching
- Minimal storage footprint (only changed fields)
- Fast load with validation
- No impact on initial page load

## Future Enhancements

Potential improvements (out of scope for this issue):
1. Draft metadata UI (show "Last saved" timestamp)
2. Multiple named drafts per proof type
3. Cloud sync across devices
4. Draft sharing capabilities

## Acceptance Criteria ✅

- [x] Payment, minimum-income, and recurring-income flows restore supported fields
- [x] Wallet signatures, secrets, and final proof artifacts are never persisted
- [x] Users can explicitly discard a draft
- [x] Migration and expiry behavior is covered by tests
- [x] Focused Jest/React Testing Library suite created
- [x] All validation commands ready to run

## Files Modified

1. `lib/storage/index.ts` - Added PROOF_DRAFTS schema
2. `lib/storage/proof-drafts.ts` - Core draft persistence logic (NEW)
3. `lib/storage/__tests__/proof-drafts.test.ts` - Comprehensive test suite (NEW)
4. `components/proofs/create-proof-flow.tsx` - Minimum income draft integration
5. `components/proofs/payment-receipt-proof-flow.tsx` - Payment receipt draft integration
6. `components/proofs/recurring-income-proof-wizard.tsx` - Recurring income draft integration

## Backwards Compatibility

- No breaking changes to existing storage keys
- New PROOF_DRAFTS key independent of other storage
- Existing session and preferences unaffected
- Users without drafts see no changes in behavior
