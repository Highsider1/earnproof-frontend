import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormattingPreferences } from "@/components/settings/formatting-preferences";

describe("FormattingPreferences", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("renders the default locale and UTC before any preference is stored", async () => {
    render(<FormattingPreferences />);

    await waitFor(() => {
      expect(screen.getByLabelText("Language and region")).toHaveValue("en-US");
    });
    expect(screen.getByLabelText("Time zone")).toHaveValue("UTC");
  });

  it("notes that only one language currently ships", async () => {
    render(<FormattingPreferences />);

    expect(
      await screen.findByText(/EarnProof currently supports one language/i),
    ).toBeInTheDocument();
  });

  it("persists a time zone selection and reflects it in the preview", async () => {
    const user = userEvent.setup();
    render(<FormattingPreferences />);

    const select = await screen.findByLabelText("Time zone");
    await user.selectOptions(select, "America/New_York");

    expect(select).toHaveValue("America/New_York");
    expect(window.localStorage.getItem("earnproof.preferences.timeZone")).toBe(
      "America/New_York",
    );
    expect(screen.getByText("(America/New_York)")).toBeInTheDocument();
  });

  it("shows a stored time zone preference on a later render", async () => {
    window.localStorage.setItem("earnproof.preferences.timeZone", "Europe/Berlin");

    render(<FormattingPreferences />);

    await waitFor(() => {
      expect(screen.getByLabelText("Time zone")).toHaveValue("Europe/Berlin");
    });
  });

  it("warns when storage is unavailable instead of silently losing the choice", async () => {
    const user = userEvent.setup();
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    try {
      render(<FormattingPreferences />);
      const select = await screen.findByLabelText("Time zone");

      await act(async () => {
        await user.selectOptions(select, "Asia/Tokyo");
      });

      expect(
        await screen.findByText(/blocked saving preferences/i),
      ).toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});
