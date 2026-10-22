import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileNav } from "@/components/layout/mobile-nav";

const items = [
  { href: "/proofs", label: "Proofs" },
  { href: "/issuers", label: "Issuers" },
];

function renderMenu() {
  return render(<MobileNav isActive={(href) => href === "/proofs"} items={items} />);
}

describe("MobileNav", () => {
  it("announces its state and exposes the active route", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Toggle main navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(screen.getByRole("dialog", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByText("Main navigation opened.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proofs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes with Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Toggle main navigation" });
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Close main navigation" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Main navigation" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("traps forward and reverse tab navigation inside the open menu", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Toggle main navigation" }));
    const close = screen.getByRole("button", { name: "Close main navigation" });
    const lastLink = screen.getByRole("link", { name: "Issuers" });

    close.focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(lastLink).toHaveFocus();

    await user.keyboard("{Tab}");
    expect(close).toHaveFocus();
  });
});
