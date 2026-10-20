/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import EmbedNotFound from "../not-found";

describe("EmbedNotFound", () => {
  it("renders a scoped, chrome-free not-found state for an unsupported embed path (e.g. an unsupported widget version)", () => {
    render(<EmbedNotFound />);

    expect(screen.getByRole("alert")).toHaveTextContent("Verification widget not found");
    expect(
      screen.getByRole("main", { name: "EarnProof proof verification" }),
    ).toBeInTheDocument();
    // Must not pull in the marketing-styled global 404 (PublicShell nav,
    // "Return home" link, help-centre link) — none of that belongs inside a
    // relying-party-embedded iframe.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
