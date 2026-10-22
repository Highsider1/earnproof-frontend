import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { SessionList } from "../session-list";
import { listActiveSessions, revokeSession } from "@/lib/sessions/store";

const USER_ID = "user-1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("SessionList", () => {
  it("does not render a Sign out button for the current session", () => {
    const sessions = listActiveSessions(USER_ID);

    render(
      <SessionList
        userId={USER_ID}
        sessions={sessions}
        loading={false}
        onSessionsChanged={jest.fn()}
      />,
    );

    const otherCount = sessions.filter((s) => !s.isCurrent).length;
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(otherCount);
  });

  it("requires confirmation before revoking a session", () => {
    const sessions = listActiveSessions(USER_ID);
    const onChanged = jest.fn();

    render(
      <SessionList
        userId={USER_ID}
        sessions={sessions}
        loading={false}
        onSessionsChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]!);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("revokes a session only after confirming, without ending the current session", async () => {
    const sessions = listActiveSessions(USER_ID);
    const onChanged = jest.fn();
    const target = sessions.find((s) => !s.isCurrent)!;

    render(
      <SessionList
        userId={USER_ID}
        sessions={sessions}
        loading={false}
        onSessionsChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]!);
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out", hidden: true }));

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
    const updated = onChanged.mock.calls[0][0];
    expect(updated.some((s: { id: string }) => s.id === target.id)).toBe(false);
    expect(updated.some((s: { isCurrent: boolean }) => s.isCurrent)).toBe(true);
  });

  it("cancelling revoke does not remove the session", () => {
    const sessions = listActiveSessions(USER_ID);
    const onChanged = jest.fn();

    render(
      <SessionList
        userId={USER_ID}
        sessions={sessions}
        loading={false}
        onSessionsChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel", hidden: true }));

    expect(onChanged).not.toHaveBeenCalled();
  });

  it("restores focus to the triggering Sign out button after revoking", async () => {
    const sessions = listActiveSessions(USER_ID);

    render(
      <SessionList
        userId={USER_ID}
        sessions={sessions}
        loading={false}
        onSessionsChanged={jest.fn()}
      />,
    );

    const signOutButtons = screen.getAllByRole("button", { name: "Sign out" });
    const firstButton = signOutButtons[0]!;
    firstButton.focus();
    fireEvent.click(firstButton);
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out", hidden: true }));

    await waitFor(() => {
      expect(document.activeElement).toBe(firstButton);
    });
  });

  it("shows a 'sign out all' action when other sessions exist, and requires confirmation", async () => {
    const sessions = listActiveSessions(USER_ID);
    const onChanged = jest.fn();

    render(
      <SessionList
        userId={USER_ID}
        sessions={sessions}
        loading={false}
        onSessionsChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out all other sessions" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out all", hidden: true }));

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
    const updated = onChanged.mock.calls[0][0];
    expect(updated).toHaveLength(1);
    expect(updated[0].isCurrent).toBe(true);
  });

  it("does not show 'sign out all' when there are no other sessions", () => {
    const sessions = listActiveSessions(USER_ID).filter((s) => s.isCurrent);

    render(
      <SessionList
        userId={USER_ID}
        sessions={sessions}
        loading={false}
        onSessionsChanged={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Sign out all other sessions" }),
    ).not.toBeInTheDocument();
  });

  it("shows an error when a session was concurrently revoked elsewhere before this click resolves", async () => {
    const sessions = listActiveSessions(USER_ID);
    const target = sessions.find((s) => !s.isCurrent)!;
    // Simulate another tab/request revoking it first.
    revokeSession(USER_ID, target.id);

    render(
      <SessionList
        userId={USER_ID}
        sessions={sessions}
        loading={false}
        onSessionsChanged={jest.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]!);
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out", hidden: true }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to revoke session. It may have already been revoked."),
      ).toBeInTheDocument();
    });
  });

  it("shows a loading state when there are no sessions yet and loading is true", () => {
    render(
      <SessionList userId={USER_ID} sessions={[]} loading={true} onSessionsChanged={jest.fn()} />,
    );

    expect(screen.getByText("Loading sessions...")).toBeInTheDocument();
  });
});
