# PR Summary: Stale-Write Conflict Handling for Administration Forms

**Issue:** #146

**Branch:** `feat/add-stale-write-conflict-handling-to-administration-forms`

## Overview

This PR implements comprehensive stale-write conflict detection and resolution for administration forms (Organization, Issuer, and future TrustedSource). The system prevents silent data loss when forms are submitted after the underlying resource has changed on the server.

## Architecture & Design

### Key Components

1. **Revision Tracking System** (`lib/api/revision-tracking.ts`)
   - Generic `WithRevision<T>` type for adding revision metadata to any entity
   - `captureRevision()` - captures entity state at load time with hash and timestamp
   - `createEntityHash()` - generates deterministic revision identifier from entity state
   - Works with JSON hashing for now; easily swappable for actual ETags when backend supports it

2. **API Conflict Detection** (`lib/api/client.ts`)
   - New `ApiConflictError` exception class for 409 Conflict responses
   - Enhanced error handling automatically detects and throws conflicts
   - Server optionally includes `currentEntity` in 409 response for comparison

3. **Shared Conflict Resolution Component** (`components/forms/resolve-conflict-dialog.tsx`)
   - Single dialog component used across all entity types
   - Shows server vs. local values side-by-side with categorized conflicts:
     - "Changed on server only" - user should see these
     - "Changed by you only" - your edits
     - "Conflicting changes (both changed)" - highlighted warning
   - Three user actions:
     - **Keep Editing** - closes dialog, preserves local edits for further review
     - **Reload from Server** - discards local edits, loads fresh server state
     - **Retry with My Changes** - submits local edits again with current revision

4. **Conflict Resolution Hook** (`hooks/use-conflict-resolution.ts`)
   - `useConflictResolution()` manages conflict state and flows
   - Integrates with form submit handlers
   - Handles reload and retry operations
   - Properly manages loading states

### Data Flow

```
Load Form
  ↓
getEntity() with captureRevision() → entity with __revision and __loadedAt
  ↓
User Edits
  ↓
Form Submit
  ↓
updateEntity(data + __revision)
  ↓
Server checks revision match
  ├─ Match: Success ✓
  └─ Mismatch: 409 Conflict
       ↓
       apiClient() throws ApiConflictError
       ↓
       showConflict() with server vs. local comparison
       ↓
       User chooses action
       ├─ Keep Editing: Close dialog, preserve edits
       ├─ Reload: Fresh server data
       └─ Retry: Submit again with current revision
```

## Implementation Details

### Organization Forms (`components/organizations/`)
- Updated `organization-list.tsx` to catch `ApiConflictError` on status updates
- Uses `useConflictResolution()` hook to manage conflict state
- Renders `ResolveConflictDialog` when conflicts occur
- Revision tracking included in all update requests

### Issuer Forms (`components/issuers/`)
- Updated `issuer-list.tsx` with same conflict handling pattern as organizations
- Updated `issuer-management.tsx` to use `IssuerWithRevision` types
- Maintains organization relationships during conflict resolution

### Trusted-Source Forms (Template)
- Created `docs/CONFLICT_HANDLING_GUIDE.md` with complete integration template
- Provides code examples for API, list, and management components
- Scalable pattern - when trusted-source forms are built, follow template to get conflict handling automatically

## Testing

Comprehensive Jest/RTL test coverage includes:

### Component Tests
- **ResolveConflictDialog** (`components/forms/__tests__/resolve-conflict-dialog.test.tsx`)
  - Dialog rendering with title and description
  - Conflict value display and categorization
  - Button callbacks (retry, reload, abandon)
  - Disabled state during retry
  - Field label formatting
  - ARIA attributes for accessibility

- **Organization List Conflicts** (`components/organizations/__tests__/organization-list-conflict.test.tsx`)
  - Conflict detection and UI rendering
  - Server vs. local value display
  - Reload, retry, and abandon flows
  - Revision tracking through updates
  - Authorization scenarios

- **Issuer List Conflicts** (`components/issuers/__tests__/issuer-list-conflict.test.tsx`)
  - Same coverage as organizations
  - Organization relationship handling
  - Independent issuers (no organization)
  - Unknown organization scenarios

### Hook Tests
- **useConflictResolution** (`hooks/__tests__/use-conflict-resolution.test.ts`)
  - Initial state
  - Conflict detection and display
  - Field categorization (server-only, local-only, both)
  - Reload callback and state management
  - Retry callback and state management
  - Abandon callback
  - Error handling and recovery
  - Field label formatting

### Utility Tests
- **Revision Tracking** (`lib/api/__tests__/revision-tracking.test.ts`)
  - Hash stability for same entity
  - Different hashes for different states
  - Entity field preservation
  - Custom loadedAt timestamps
  - Revision consistency
  - extractRevision() function
  - isConflictError() detection
  - Full integration flows

## Key Design Decisions

1. **Revision Tracking via JSON Hash**
   - Backend doesn't currently provide ETags
   - Using stable JSON hash as revision identifier
   - Can be swapped for actual ETags by updating `captureRevision()` and `createEntityHash()`
   - Future-proof: minimal changes needed when backend adds ETag support

2. **Local Edit Preservation**
   - Local unsaved values stored throughout conflict resolution
   - Never auto-overwritten in either direction
   - User explicitly chooses to reload (discard) or retry (keep)

3. **Reusable Dialog Component**
   - Single `ResolveConflictDialog` used by all entity types
   - Accepts generic conflict array with field names and labels
   - No entity-type-specific logic
   - Easy to add to new forms

4. **Hook-based Integration**
   - `useConflictResolution()` integrates with existing form patterns
   - Minimal changes needed to existing form components
   - Cleanly separates conflict logic from component state

5. **Authorization Preservation**
   - Conflict UI respects what backend returns
   - If a field isn't in server response, it won't appear in conflict dialog
   - No additional permission checks needed

## Files Changed

### New Files
- `lib/api/revision-tracking.ts` - Revision tracking utilities
- `components/forms/resolve-conflict-dialog.tsx` - Shared conflict dialog
- `hooks/use-conflict-resolution.ts` - Conflict resolution hook
- `docs/CONFLICT_HANDLING_GUIDE.md` - Implementation guide for future entities
- Test files:
  - `components/forms/__tests__/resolve-conflict-dialog.test.tsx`
  - `hooks/__tests__/use-conflict-resolution.test.ts`
  - `components/organizations/__tests__/organization-list-conflict.test.tsx`
  - `components/issuers/__tests__/issuer-list-conflict.test.tsx`
  - `lib/api/__tests__/revision-tracking.test.ts`

### Modified Files
- `lib/api/client.ts` - Added `ApiConflictError`, enhanced error handling
- `lib/api/organizations.ts` - Added revision tracking to get/update functions
- `lib/api/issuers.ts` - Added revision tracking to get/update functions
- `components/organizations/organization-list.tsx` - Integrated conflict handling
- `components/organizations/organization-management.tsx` - Updated to use `OrganizationWithRevision`
- `components/issuers/issuer-list.tsx` - Integrated conflict handling
- `components/issuers/issuer-management.tsx` - Updated to use `IssuerWithRevision`

## Validation Commands

After dependencies are installed, run these commands to validate:

```bash
# Type checking (catch TypeScript errors)
npm run typecheck

# Linting (code style and quality)
npm run lint

# Build (ensure all code compiles)
npm run build

# Run conflict handling tests
npm run test -- --testPathPattern="conflict|revision-tracking" --run

# Or run all tests for affected components
npm run test -- components/forms components/organizations components/issuers hooks/use-conflict-resolution lib/api --run
```

## Backward Compatibility

- All changes are additive
- Existing form flows continue to work unchanged if no conflicts occur
- New revision tracking fields (`__revision`, `__loadedAt`) don't affect non-conflict scenarios
- Can be safely deployed without backend changes (conflicts won't occur until backend sends 409)

## Migration Path for Backend

When backend is ready to support conflict detection:

1. Backend returns 409 status when `__revision` in request doesn't match current entity
2. Include `currentEntity` in 409 response body (optional but recommended for UX)
3. Frontend automatically detects 409 and shows conflict UI
4. No frontend changes needed

Example 409 response:
```json
{
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Resource was modified after you loaded this form",
  "currentEntity": {
    "id": "org-123",
    "name": "Updated Name",
    "status": "SUSPENDED"
  },
  "submittedData": {
    "status": "ACTIVE"
  }
}
```

## Future Enhancements

1. **ETag Support** - Replace JSON hash with actual ETags from backend
2. **Trusted-Source Forms** - Follow template in `CONFLICT_HANDLING_GUIDE.md`
3. **Conflict Analytics** - Track how often conflicts occur to identify problem areas
4. **Optimistic Locking** - Extend pattern to other data-modifying operations
5. **Merge Strategies** - Allow field-by-field merge decisions (advanced)

## Accessibility

- Conflict dialog has proper ARIA attributes (role, labelledby, describedby)
- Focus management (initial focus on retry button)
- Keyboard support (Escape to abandon)
- Clear visual distinction for conflicting fields (amber warning)
- Screen reader friendly labels and descriptions

## Security

- No sensitive data exposed in revision tracking
- Revision hash doesn't leak information about entity state
- Local edits only stored in component memory, not persisted
- No additional attack surface introduced

## Performance

- Minimal overhead (JSON hash creation on load/update)
- Hash creation is O(n) where n = JSON size (negligible for typical entities)
- No additional API calls unless conflict occurs
- Dialog rendering is efficient with memoized comparisons

---

**Closes #146**
