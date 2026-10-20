/**
 * @jest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { usePrintMode } from "@/lib/use-print-mode";

type Listener = (event: MediaQueryListEvent) => void;

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();

  const mql = {
    get matches() {
      return matches;
    },
    media: "print",
    onchange: null,
    addEventListener: jest.fn((_event: string, listener: Listener) => {
      listeners.add(listener);
    }),
    removeEventListener: jest.fn((_event: string, listener: Listener) => {
      listeners.delete(listener);
    }),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };

  window.matchMedia = jest.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;

  return {
    setMatches(value: boolean) {
      matches = value;
      for (const listener of listeners) {
        listener({ matches: value } as MediaQueryListEvent);
      }
    },
    mql,
  };
}

describe("usePrintMode", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("reflects the print media query's initial state", () => {
    installMatchMedia(true);
    const { result } = renderHook(() => usePrintMode());
    expect(result.current).toBe(true);
  });

  it("starts false when not printing", () => {
    installMatchMedia(false);
    const { result } = renderHook(() => usePrintMode());
    expect(result.current).toBe(false);
  });

  it("updates when the print media query changes (entering and leaving print preview)", () => {
    const { setMatches } = installMatchMedia(false);
    const { result } = renderHook(() => usePrintMode());
    expect(result.current).toBe(false);

    act(() => {
      setMatches(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      setMatches(false);
    });
    expect(result.current).toBe(false);
  });

  it("does not throw when matchMedia is unavailable", () => {
    // @ts-expect-error -- simulating an environment without matchMedia
    delete window.matchMedia;
    const { result } = renderHook(() => usePrintMode());
    expect(result.current).toBe(false);
  });

  it("removes its media query listener on unmount", () => {
    const { mql } = installMatchMedia(false);
    const { unmount } = renderHook(() => usePrintMode());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
