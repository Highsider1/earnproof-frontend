import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ComponentProps } from "react";
import ContactPage from "./page";

// Mock Next.js Image component
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: ComponentProps<"img">) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/contact",
}));

describe("ContactPage", () => {
  const windowOpenSpy = jest
    .spyOn(window, "open")
    .mockImplementation(() => null);

  beforeEach(() => {
    windowOpenSpy.mockClear();
  });

  afterAll(() => {
    windowOpenSpy.mockRestore();
  });

  it("renders the contact page with heading and form", () => {
    render(<ContactPage />);

    expect(screen.getByText("Contact us")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Send a message to the EarnProof team. We'll respond via email."
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Reply email")).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("displays validation errors when form is submitted empty", async () => {
    render(<ContactPage />);

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Name must be at least 2 characters")
      ).toBeInTheDocument();
      expect(screen.getByText("Email is required")).toBeInTheDocument();
      expect(
        screen.getByText("Message must be at least 10 characters")
      ).toBeInTheDocument();
    });
  });

  it("validates email format correctly", async () => {
    render(<ContactPage />);

    const emailInput = screen.getByLabelText("Reply email");
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.blur(emailInput);

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.submit(submitButton.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(
        screen.getByText("Please enter a valid email address")
      ).toBeInTheDocument();
    });
  });

  it("validates name length constraints", async () => {
    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name");

    // Test minimum length
    fireEvent.change(nameInput, { target: { value: "A" } });
    fireEvent.blur(nameInput);

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Name must be at least 2 characters")
      ).toBeInTheDocument();
    });

    // Test maximum length
    const longName = "A".repeat(101);
    fireEvent.change(nameInput, { target: { value: longName } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Name must not exceed 100 characters")
      ).toBeInTheDocument();
    });
  });

  it("validates message length constraints", async () => {
    render(<ContactPage />);

    const messageInput = screen.getByLabelText("Message");

    // Test minimum length
    fireEvent.change(messageInput, { target: { value: "Short" } });
    fireEvent.blur(messageInput);

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Message must be at least 10 characters")
      ).toBeInTheDocument();
    });

    // Test maximum length
    const longMessage = "A".repeat(1001);
    fireEvent.change(messageInput, { target: { value: longMessage } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Message must not exceed 1000 characters")
      ).toBeInTheDocument();
    });
  });

  it("displays character count for message field", () => {
    render(<ContactPage />);

    const messageInput = screen.getByLabelText("Message");
    fireEvent.change(messageInput, { target: { value: "Hello world" } });

    expect(screen.getByText("11/1000")).toBeInTheDocument();
  });

  it("clears errors when user corrects input", async () => {
    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name");
    const submitButton = screen.getByRole("button", { name: /send message/i });

    // Submit with empty name
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Name must be at least 2 characters")
      ).toBeInTheDocument();
    });

    // Correct the input
    fireEvent.change(nameInput, { target: { value: "John Doe" } });

    await waitFor(() => {
      expect(
        screen.queryByText("Name must be at least 2 characters")
      ).not.toBeInTheDocument();
    });
  });

  it("opens mailto link with correct data on valid submission", async () => {
    render(<ContactPage />);

    // Fill form with valid data
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByLabelText("Reply email"), {
      target: { value: "john@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "technical" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "This is a test message with enough characters." },
    });

    const submitButton = screen.getByRole("button", { name: /send message/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    });

    const mailtoLink = String(windowOpenSpy.mock.calls[0][0]);
    expect(mailtoLink).toContain("mailto:contact@earnproof.com");
    expect(mailtoLink).toContain("TECHNICAL");
    expect(mailtoLink).toContain("John%20Doe");
    expect(windowOpenSpy).toHaveBeenCalledWith(mailtoLink, "_self");
  });

  it("shows how it works information banner", () => {
    render(<ContactPage />);

    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(
      screen.getByText(/opens your default email client/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No message content is stored or transmitted/i)
    ).toBeInTheDocument();
  });

  it("has all category options available", () => {
    render(<ContactPage />);

    const categorySelect = screen.getByLabelText("Category") as HTMLSelectElement;

    expect(categorySelect).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "General inquiry" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Technical support" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Business partnership" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Security issue" })).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(<ContactPage />);

    const nameInput = screen.getByLabelText("Name");
    const emailInput = screen.getByLabelText("Reply email");
    const categorySelect = screen.getByLabelText("Category");
    const messageInput = screen.getByLabelText("Message");

    expect(nameInput).toHaveAttribute("id", "name");
    expect(emailInput).toHaveAttribute("id", "email");
    expect(categorySelect).toHaveAttribute("id", "category");
    expect(messageInput).toHaveAttribute("id", "message");
  });
});
