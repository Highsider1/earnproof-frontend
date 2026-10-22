/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArtifactExport } from "@/components/proofs/artifact-export";
import { buildCredentialExport } from "@/lib/credentials/export";
import hiddenFixture from "@/tests/exports/fixtures/hidden-credential.json";
import disclosedFixture from "@/tests/exports/fixtures/disclosed-credential.json";

describe("ArtifactExport", () => {
  const originalClipboard = navigator.clipboard;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    jest.restoreAllMocks();
  });

  it("lists included fields and can cancel without copying", async () => {
    const user = userEvent.setup();
    render(
      <ArtifactExport
        plan={buildCredentialExport({
          credential: hiddenFixture.credential,
          proof: hiddenFixture.proof,
        })}
        title="Export credential JSON"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export credential JSON" }));
    expect(screen.getByRole("dialog", { name: "Confirm export" })).toBeInTheDocument();
    expect(screen.getByText("credential.proof.signature")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("warns when optional disclosure is present", async () => {
    const user = userEvent.setup();
    render(
      <ArtifactExport
        plan={buildCredentialExport({
          credential: disclosedFixture.credential,
          proof: disclosedFixture.proof,
        })}
        title="Export credential JSON"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Export credential JSON" }));
    expect(screen.getByText(/optional amount disclosure/)).toBeInTheDocument();
    expect(screen.getByText(/optional sender or source disclosure/)).toBeInTheDocument();
  });

  it("announces clipboard denial and keeps retry available", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: jest.fn().mockRejectedValue(new Error("denied")),
      },
    });
    render(
      <ArtifactExport
        plan={buildCredentialExport({
          credential: hiddenFixture.credential,
          proof: hiddenFixture.proof,
        })}
        title="Export credential JSON"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Export credential JSON" }));
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Clipboard copy was blocked/);
    expect(screen.getByRole("button", { name: "Copy" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download" })).toBeEnabled();
  });

  it("downloads with the safe filename", async () => {
    const click = jest.fn();
    URL.createObjectURL = jest.fn(() => "blob:earnproof-export") as typeof URL.createObjectURL;
    URL.revokeObjectURL = jest.fn();
    const createElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === "a") {
        element.click = click;
      }
      return element;
    });

    const user = userEvent.setup();
    render(
      <ArtifactExport
        plan={buildCredentialExport({
          credential: hiddenFixture.credential,
          proof: hiddenFixture.proof,
        })}
        title="Export credential JSON"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Export credential JSON" }));
    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(screen.getAllByText(/Download started\./)).toHaveLength(2);
  });

  it("blocks the download and offers retry when the digest does not match", async () => {
    const click = jest.fn();
    const createElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === "a") {
        element.click = click;
      }
      return element;
    });

    const plan = {
      ...buildCredentialExport({
        credential: hiddenFixture.credential,
        proof: hiddenFixture.proof,
      }),
      digest: { algorithm: "SHA-256", value: "0".repeat(64) },
    };

    const user = userEvent.setup();
    render(<ArtifactExport plan={plan} title="Export credential JSON" />);

    await user.click(screen.getByRole("button", { name: "Export credential JSON" }));
    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/integrity check did not match/i),
    );
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Retry download" })).toBeInTheDocument();
  });

  it("fails closed and does not download when the digest algorithm is unsupported", async () => {
    const click = jest.fn();
    const createElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === "a") {
        element.click = click;
      }
      return element;
    });

    const plan = {
      ...buildCredentialExport({
        credential: hiddenFixture.credential,
        proof: hiddenFixture.proof,
      }),
      digest: { algorithm: "MD5", value: "deadbeef" },
    };

    const user = userEvent.setup();
    render(<ArtifactExport plan={plan} title="Export credential JSON" />);

    await user.click(screen.getByRole("button", { name: "Export credential JSON" }));
    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/unsupported integrity algorithm/i),
    );
    expect(click).not.toHaveBeenCalled();
  });

  it("verifies and downloads when a matching digest is supplied", async () => {
    const click = jest.fn();
    URL.createObjectURL = jest.fn(() => "blob:earnproof-export") as typeof URL.createObjectURL;
    URL.revokeObjectURL = jest.fn();
    const createElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === "a") {
        element.click = click;
      }
      return element;
    });

    const basePlan = buildCredentialExport({
      credential: hiddenFixture.credential,
      proof: hiddenFixture.proof,
    });
    const bytes = new TextEncoder().encode(basePlan.body);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    const validDigest = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const plan = { ...basePlan, digest: { algorithm: "SHA-256", value: validDigest } };

    const user = userEvent.setup();
    render(<ArtifactExport plan={plan} title="Export credential JSON" />);

    await user.click(screen.getByRole("button", { name: "Export credential JSON" }));
    await user.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(screen.getAllByText("Download started. Integrity verified.")).toHaveLength(2);
  });

  it("cancelling the export dialog never downloads anything", async () => {
    const click = jest.fn();
    const createElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === "a") {
        element.click = click;
      }
      return element;
    });

    const user = userEvent.setup();
    render(
      <ArtifactExport
        plan={buildCredentialExport({
          credential: hiddenFixture.credential,
          proof: hiddenFixture.proof,
        })}
        title="Export credential JSON"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Export credential JSON" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(click).not.toHaveBeenCalled();
    expect(screen.queryByText(/Download started/)).not.toBeInTheDocument();
  });
});
