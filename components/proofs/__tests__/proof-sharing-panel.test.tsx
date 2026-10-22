/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProofSharingPanel } from "../proof-sharing-panel";

describe("ProofSharingPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a link, reveals the token once, then shows it in the active list after dismissal", async () => {
    render(<ProofSharingPanel proofId="proof-1" userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Create share link/i }));

    await waitFor(() => expect(screen.getByLabelText("Share token")).toBeInTheDocument());
    const tokenValue = (screen.getByLabelText("Share token") as HTMLInputElement).value;
    expect(tokenValue.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /I've saved the token/i }));

    await waitFor(() => expect(screen.getByText("ACTIVE")).toBeInTheDocument());
    expect(screen.queryByLabelText("Share token")).not.toBeInTheDocument();
  });

  it("does not create a link when the user never clicks create (cancellation)", () => {
    render(<ProofSharingPanel proofId="proof-1" userId="user-1" />);
    expect(screen.getByText(/No share links have been created/i)).toBeInTheDocument();
  });

  it("revokes an active link and reflects REVOKED status", async () => {
    render(<ProofSharingPanel proofId="proof-1" userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Create share link/i }));
    await waitFor(() => expect(screen.getByLabelText("Share token")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /I've saved the token/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /^Revoke$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^Revoke$/i }));

    await waitFor(() => expect(screen.getByText("REVOKED")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^Revoke$/i })).not.toBeInTheDocument();
  });

  it("persists created links across remounts for the same proof and user", async () => {
    const { unmount } = render(<ProofSharingPanel proofId="proof-1" userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Create share link/i }));
    await waitFor(() => expect(screen.getByLabelText("Share token")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /I've saved the token/i }));
    await waitFor(() => expect(screen.getByText("ACTIVE")).toBeInTheDocument());

    unmount();

    render(<ProofSharingPanel proofId="proof-1" userId="user-1" />);
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("does not show links created for a different proof", async () => {
    const { unmount } = render(<ProofSharingPanel proofId="proof-1" userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Create share link/i }));
    await waitFor(() => expect(screen.getByLabelText("Share token")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /I've saved the token/i }));
    await waitFor(() => expect(screen.getByText("ACTIVE")).toBeInTheDocument());

    unmount();

    render(<ProofSharingPanel proofId="proof-2" userId="user-1" />);
    expect(screen.getByText(/No share links have been created/i)).toBeInTheDocument();
  });
});
