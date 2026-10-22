# Stale-Write Conflict Handling Guide

This document explains the stale-write conflict detection and resolution system implemented in the EarnProof frontend for administration forms (Organization, Issuer, and future TrustedSource forms).

## Overview

The conflict handling system prevents silent data loss when multiple users or concurrent operations modify the same resource. When a form loads, it captures a revision identifier. If the underlying resource changes before submission, the system detects this and shows the user both the server's current state and their unsaved local changes, allowing them to decide how to proceed.

## Architecture

### Components

1. **Revision Tracking** (`lib/api/revision-tracking.ts`)
   - Generic `WithRevision<T>` type for adding revision fields to any entity
   - `captureRevision()` function to tag entities at load time with revision hash and timestamp
   - `extractRevision()` to include revision info in update requests
   - `createEntityHash()` for deterministic revision identification

2. **API Client** (`lib/api/client.ts`)
   - `ApiConflictError` exception class for 409 Conflict responses
   - Enhanced error handling to detect and throw conflicts
   - Server can optionally include `currentEntity` in 409 response for comparison

3. **Conflict Resolution Dialog** (`components/forms/resolve-conflict-dialog.tsx`)
   - Shared component for displaying conflicts across all entity types
   - Shows server vs. local values side-by-side
   - Three user actions: Keep Editing, Reload from Server, or Retry with My Changes
   - Categorizes conflicts by type (server-only change, local-only change, both changed)
   - Preserves local edits throughout the flow

4. **Conflict Resolution Hook** (`hooks/use-conflict-resolution.ts`)
   - `useConflictResolution()` hook for managing conflict state and flow
   - Handles reload and retry operations
   - Integrates with form submit handlers

### Data Flow

```
1. Load Entity
   ├─ getEntity() calls API
   ├─ captureRevision() tags response with __revision and __loadedAt
   └─ Form displays with captured revision in local state

2. User Edits and Submits
   ├─ Submit handler calls updateEntity() with __revision
   └─ API client sends revision info to backend

3. Backend Detects Conflict
   ├─ Server compares revision with current entity version
   ├─ If mismatch: returns 409 with currentEntity
   └─ If match: update succeeds, returns new entity with new __revision

4. Handle Conflict Response
   ├─ apiClient() catches 409, throws ApiConflictError
   ├─ Form catch handler calls showConflict()
   ├─ ResolveConflictDialog renders with server vs. local comparison

5. User Chooses Action
   ├─ "Keep Editing": Close dialog, preserve local edits
   ├─ "Reload from Server": Call onReloadEntity, discard local edits
   └─ "Retry with My Changes": Call onRetrySubmit with local form state
```

## Integration Pattern

### For Organization and Issuer Forms (Already Implemented)

The pattern is implemented in:
- `lib/api/organizations.ts` / `lib/api/issuers.ts` - API functions
- `components/organizations/organization-list.tsx` / `components/issuers/issuer-list.tsx` - List with conflict handling
- `components/organizations/organization-management.tsx` / `components/issuers/issuer-management.tsx` - Management component

### For Future TrustedSource Forms (Template)

Follow this pattern when implementing trusted-source conflict handling:

#### 1. Create/Update API Module (`lib/api/trusted-sources.ts`)

```typescript
import { apiClient, bearer, retryRead, retryMutation } from "./client";
import { captureRevision } from "./revision-tracking";
import type { TrustedSource } from "./generated/v1";

export type TrustedSourceWithRevision = WithRevision<TrustedSource>;

export type UpdateTrustedSourceRequest = {
  name?: string;
  status?: TrustedSource["status"];
  // ... other fields
};

export type UpdateTrustedSourceRequestWithRevision = UpdateTrustedSourceRequest & {
  __revision?: string;
};

export async function getTrustedSources(
  token: string,
  signal: AbortSignal
): Promise<TrustedSourceWithRevision[]> {
  return retryRead(async (signal) => {
    const sources = await apiClient<TrustedSource[]>({
      path: "/trusted-sources",
      method: "GET",
      headers: bearer(token),
      signal,
    });
    return sources.map(source => captureRevision(source));
  }, signal);
}

export async function updateTrustedSource(
  token: string,
  sourceId: string,
  request: UpdateTrustedSourceRequest | UpdateTrustedSourceRequestWithRevision,
  signal: AbortSignal
): Promise<TrustedSourceWithRevision> {
  return retryMutation(async (signal) => {
    const source = await apiClient<TrustedSource>({
      path: `/trusted-sources/${sourceId}`,
      method: "PATCH",
      headers: bearer(token),
      body: JSON.stringify(request),
      signal,
    });
    return captureRevision(source);
  }, signal);
}
```

#### 2. Create List Component (`components/trusted-sources/trusted-source-list.tsx`)

```typescript
import { useCallback, useState } from "react";
import { updateTrustedSource, getTrustedSource } from "@/lib/api/trusted-sources";
import { ResolveConflictDialog } from "@/components/forms/resolve-conflict-dialog";
import { ApiConflictError } from "@/lib/api/client";
import { useConflictResolution } from "@/hooks/use-conflict-resolution";
import type { TrustedSourceWithRevision } from "@/lib/api/trusted-sources";

export function TrustedSourceList({
  sources,
  loading,
  token,
  onSourceUpdated,
}: {
  sources: TrustedSourceWithRevision[];
  loading: boolean;
  token: string;
  onSourceUpdated: (source: TrustedSourceWithRevision) => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    conflict,
    isRetrying,
    isReloading,
    showConflict,
    handleReload,
    handleRetry,
    handleAbandon,
  } = useConflictResolution({
    onReloadEntity: async () => {
      if (!sourceId) return;
      try {
        const controller = new AbortController();
        const source = await getTrustedSource(token, sourceId, controller.signal);
        onSourceUpdated(source);
      } finally {
        setActionLoading(null);
      }
    },
    onRetrySubmit: async (formState) => {
      if (!sourceId) return;
      try {
        const controller = new AbortController();
        const updated = await updateTrustedSource(
          token,
          sourceId,
          {
            ...formState,
            __revision: (formState as any).__revision,
          },
          controller.signal
        );
        onSourceUpdated(updated);
      } finally {
        setActionLoading(null);
      }
    },
  });

  const handleStatusUpdate = useCallback(async (
    sourceId: string,
    newStatus: TrustedSourceWithRevision["status"],
    source: TrustedSourceWithRevision
  ) => {
    setActionLoading(sourceId);
    setError(null);

    try {
      const controller = new AbortController();
      const updated = await updateTrustedSource(
        token,
        sourceId,
        {
          status: newStatus,
          __revision: source.__revision,
        },
        controller.signal
      );
      onSourceUpdated(updated);
    } catch (err) {
      if (err instanceof ApiConflictError) {
        const intendedState = { ...source, status: newStatus };
        showConflict(err, intendedState, ["status", "name"]);
      } else {
        setError("Failed to update trusted source status. Please try again.");
      }
    } finally {
      setActionLoading(null);
    }
  }, [token, onSourceUpdated, showConflict]);

  // ... rest of component with ResolveConflictDialog rendering
}
```

#### 3. Create Management Component (`components/trusted-sources/trusted-source-management.tsx`)

Follow the same pattern as `IssuerManagement` or `OrganizationManagement`:
- Load sources with revision tracking
- Manage list state
- Handle creation and updates
- Pass conflict handler to list component

## Key Implementation Notes

1. **Revision Tracking**: Currently uses a JSON hash since ETags aren't in the API. Can be easily switched to use actual ETags when backend supports them - just update `captureRevision()` and `createEntityHash()`.

2. **Conflict Comparison**: The `showConflict()` hook accepts:
   - `error`: The `ApiConflictError` from the API
   - `localFormState`: Current form state before submission (not just changed fields)
   - `entityFields`: Optional array of fields to compare (defaults to all server fields)

3. **Local Edit Preservation**: Local edits are stored in `conflict.localFormState` and can be edited/reviewed before retry. They're never auto-overwritten.

4. **Authorization**: The conflict UI respects field visibility based on what the server returns and what the user is authorized to see. No additional checks needed - if a field isn't in the server response, it won't appear in the conflict dialog.

5. **Accessibility**: The conflict dialog has proper ARIA attributes, focus management, and keyboard support (Escape to abandon).

## Testing Strategy

Each form should include tests for:
1. **Normal Submit** - No conflict, update succeeds
2. **Conflict Detection** - 409 response triggers conflict UI
3. **Reload Flow** - User selects "Reload from Server", fresh data loaded
4. **Retry Flow** - User selects "Retry with My Changes", local state submitted again
5. **Abandon Flow** - User closes dialog, local edits preserved
6. **Authorization** - Conflict flow respects existing permissions

See test examples in `components/__tests__/` for reference implementations.

## Backend Expectations

The backend should:
1. Return 409 Conflict when `__revision` in request doesn't match current entity version
2. Include `currentEntity` in 409 response body for client-side comparison
3. Include `submittedData` in 409 response if available for debugging
4. Perform actual update if revision matches or is omitted (backward compatibility)

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
