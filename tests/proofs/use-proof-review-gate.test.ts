/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useProofReviewGate } from "@/lib/proofs/useProofReviewGate";

type Payload = { amount: number; note: string };

describe("useProofReviewGate", () => {
  it("starts with no reviewed payload and not confirmed", () => {
    const { result } = renderHook(() => useProofReviewGate<Payload>());
    expect(result.current.reviewedPayload).toBeNull();
    expect(result.current.isConfirmed).toBe(false);
  });

  it("openReview freezes the given payload and starts unconfirmed", () => {
    const { result } = renderHook(() => useProofReviewGate<Payload>());
    act(() => result.current.openReview({ amount: 100, note: "a" }));

    expect(result.current.reviewedPayload).toEqual({ amount: 100, note: "a" });
    expect(result.current.isConfirmed).toBe(false);
  });

  it("confirm() marks the review as confirmed", () => {
    const { result } = renderHook(() => useProofReviewGate<Payload>());
    act(() => result.current.openReview({ amount: 100, note: "a" }));
    act(() => result.current.confirm());

    expect(result.current.isConfirmed).toBe(true);
  });

  it("cancel() clears the reviewed payload and confirmation", () => {
    const { result } = renderHook(() => useProofReviewGate<Payload>());
    act(() => result.current.openReview({ amount: 100, note: "a" }));
    act(() => result.current.confirm());
    act(() => result.current.cancel());

    expect(result.current.reviewedPayload).toBeNull();
    expect(result.current.isConfirmed).toBe(false);
  });

  it("refreshLiveSnapshot does nothing while no review is open", () => {
    const { result } = renderHook(() => useProofReviewGate<Payload>());
    act(() => result.current.refreshLiveSnapshot({ amount: 999, note: "z" }));

    expect(result.current.reviewedPayload).toBeNull();
  });

  it("refreshLiveSnapshot with an unchanged payload keeps confirmation intact", () => {
    const { result } = renderHook(() => useProofReviewGate<Payload>());
    const payload = { amount: 100, note: "a" };
    act(() => result.current.openReview(payload));
    act(() => result.current.confirm());

    act(() => result.current.refreshLiveSnapshot({ amount: 100, note: "a" }));

    expect(result.current.isConfirmed).toBe(true);
  });

  it("refreshLiveSnapshot with a changed payload invalidates confirmation (changes after review invalidate it)", () => {
    const { result } = renderHook(() => useProofReviewGate<Payload>());
    act(() => result.current.openReview({ amount: 100, note: "a" }));
    act(() => result.current.confirm());

    act(() => result.current.refreshLiveSnapshot({ amount: 200, note: "a" }));

    expect(result.current.isConfirmed).toBe(false);
    // The frozen payload itself is untouched by drift detection — only the
    // confirmation is revoked, forcing the user to review the new value.
    expect(result.current.reviewedPayload).toEqual({ amount: 100, note: "a" });
  });

  it("reset() clears everything for the next submission attempt", () => {
    const { result } = renderHook(() => useProofReviewGate<Payload>());
    act(() => result.current.openReview({ amount: 100, note: "a" }));
    act(() => result.current.confirm());
    act(() => result.current.reset());

    expect(result.current.reviewedPayload).toBeNull();
    expect(result.current.isConfirmed).toBe(false);
  });
});
