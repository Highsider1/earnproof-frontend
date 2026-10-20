/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { ErrorReference } from "@/components/common/error-reference";
import { ApiError } from "@/lib/errors";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
});

describe("ErrorReference", () => {
  it("renders error with request ID", () => {
    const error = new ApiError({
      status: 500,
      message: "Internal server error",
      requestId: "req-12345678-abcd",
    });

    render(<ErrorReference error={error} />);

    expect(screen.getByText("Internal server error")).toBeInTheDocument();
    expect(screen.getByText(/Request ID:/)).toBeInTheDocument();
    expect(screen.getByText(/req-12345678-abcd/)).toBeInTheDocument();
  });

  it("renders simple error without request ID", () => {
    const error = new Error("Something went wrong");

    render(<ErrorReference error={error} />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.queryByText(/Request ID:/)).not.toBeInTheDocument();
  });

  it("shows copy button when request ID is present", () => {
    const error = new ApiError({
      status: 500,
      message: "Error",
      requestId: "req-12345678",
    });

    render(<ErrorReference error={error} />);

    const copyButton = screen.getByRole("button", {
      name: "Copy error reference",
    });
    expect(copyButton).toBeInTheDocument();
  });
});
