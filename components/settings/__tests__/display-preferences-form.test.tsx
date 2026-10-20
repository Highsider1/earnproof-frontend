/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { DisplayPreferencesForm } from "../display-preferences-form";
import { getStorageValue, setStorageValue } from "@/lib/storage";

jest.mock("@/lib/storage", () => {
  const actual = jest.requireActual("@/lib/storage");
  return {
    ...actual,
    getStorageValue: jest.fn(),
    setStorageValue: jest.fn(),
  };
});

const mockedGetStorageValue = getStorageValue as jest.Mock;
const mockedSetStorageValue = setStorageValue as jest.Mock;

describe("DisplayPreferencesForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetStorageValue.mockReturnValue(null);
    document.documentElement.removeAttribute("data-motion");
    document.documentElement.removeAttribute("data-contrast");
  });

  it("renders both preference groups defaulting to System", () => {
    render(<DisplayPreferencesForm />);

    expect(
      screen.getByRole("radiogroup", { name: "Reduced motion" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "High contrast" })
    ).toBeInTheDocument();

    const [motionSystem] = screen.getAllByRole("radio", {
      name: "System",
    }) as HTMLInputElement[];
    expect(motionSystem.checked).toBe(true);
  });

  it("loads a previously saved preference from storage", () => {
    mockedGetStorageValue.mockReturnValue({
      data: { reducedMotion: "enabled", highContrast: "enabled" },
    });

    render(<DisplayPreferencesForm />);

    const motionEnabled = screen.getAllByRole("radio", {
      name: "Enabled",
    })[0] as HTMLInputElement;
    expect(motionEnabled.checked).toBe(true);
  });

  it("persists and applies the reduced-motion preference when changed", () => {
    render(<DisplayPreferencesForm />);

    const [motionEnabled] = screen.getAllByRole("radio", { name: "Enabled" });
    fireEvent.click(motionEnabled);

    expect(document.documentElement.dataset.motion).toBe("reduced");
    expect(mockedSetStorageValue).toHaveBeenCalledWith(
      "DISPLAY_PREFERENCES",
      { data: { reducedMotion: "enabled", highContrast: "system" } }
    );
  });

  it("persists and applies the high-contrast preference when changed", () => {
    render(<DisplayPreferencesForm />);

    const [, contrastEnabled] = screen.getAllByRole("radio", {
      name: "Enabled",
    });
    fireEvent.click(contrastEnabled);

    expect(document.documentElement.dataset.contrast).toBe("high");
    expect(mockedSetStorageValue).toHaveBeenCalledWith(
      "DISPLAY_PREFERENCES",
      { data: { reducedMotion: "system", highContrast: "enabled" } }
    );
  });

  it("clears the motion override when set back to disabled", () => {
    render(<DisplayPreferencesForm />);

    const [motionDisabled] = screen.getAllByRole("radio", { name: "Disabled" });
    fireEvent.click(motionDisabled);

    expect(document.documentElement.dataset.motion).toBe("full");
  });
});
