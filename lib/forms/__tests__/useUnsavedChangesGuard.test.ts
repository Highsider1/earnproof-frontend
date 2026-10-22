/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useUnsavedChangesGuard } from "../useUnsavedChangesGuard";
import { readFormDraft } from "../drafts";

describe("useUnsavedChangesGuard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("navigates immediately when the form is pristine", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ formId: "f1", isDirty: false })
    );
    const navigate = jest.fn();

    act(() => result.current.guardedNavigate(navigate));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBeNull();
  });

  it("pauses navigation and shows a pending prompt when the form is dirty", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ formId: "f1", isDirty: true })
    );
    const navigate = jest.fn();

    act(() => result.current.guardedNavigate(navigate));

    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.pending).not.toBeNull();
  });

  it("stay() cancels the pending navigation without discarding anything", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ formId: "f1", isDirty: true })
    );
    const navigate = jest.fn();

    act(() => result.current.guardedNavigate(navigate));
    act(() => result.current.pending?.stay());

    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });

  it("discard() proceeds with the navigation and clears the pending prompt", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ formId: "f1", isDirty: true })
    );
    const navigate = jest.fn();

    act(() => result.current.guardedNavigate(navigate));
    act(() => result.current.pending?.discard());

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBeNull();
  });

  it("saveDraft() persists the draft and then proceeds with the navigation", () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ formId: "f1", isDirty: true })
    );
    const navigate = jest.fn();

    act(() => result.current.guardedNavigate(navigate));
    act(() => result.current.pending?.saveDraft({ amount: 100 }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(readFormDraft("f1")?.values).toEqual({ amount: 100 });
  });

  it("clearDraft() removes a previously saved draft for this form only", () => {
    const { result, rerender } = renderHook(
      ({ isDirty }) => useUnsavedChangesGuard({ formId: "f1", isDirty }),
      { initialProps: { isDirty: true } }
    );

    act(() => result.current.guardedNavigate(jest.fn()));
    act(() => result.current.pending?.saveDraft({ amount: 100 }));
    expect(result.current.loadDraft()).not.toBeNull();

    rerender({ isDirty: false });
    act(() => result.current.clearDraft());

    expect(result.current.loadDraft()).toBeNull();
  });

  it("does not prompt on beforeunload when the form is pristine", () => {
    renderHook(() => useUnsavedChangesGuard({ formId: "f1", isDirty: false }));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = jest.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it("prompts on beforeunload when the form is dirty", () => {
    renderHook(() => useUnsavedChangesGuard({ formId: "f1", isDirty: true }));

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = jest.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("multiple mounted guards for different forms do not clobber each other's drafts", () => {
    const guardA = renderHook(() =>
      useUnsavedChangesGuard({ formId: "form-a", isDirty: true })
    );
    const guardB = renderHook(() =>
      useUnsavedChangesGuard({ formId: "form-b", isDirty: true })
    );

    act(() => guardA.result.current.guardedNavigate(jest.fn()));
    act(() => guardA.result.current.pending?.saveDraft({ field: "a" }));

    act(() => guardB.result.current.guardedNavigate(jest.fn()));
    act(() => guardB.result.current.pending?.saveDraft({ field: "b" }));

    expect(guardA.result.current.loadDraft()?.values).toEqual({ field: "a" });
    expect(guardB.result.current.loadDraft()?.values).toEqual({ field: "b" });
  });
});
