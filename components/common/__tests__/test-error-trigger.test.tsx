import { render, screen, fireEvent } from "@testing-library/react";
import { TestErrorTrigger } from "../test-error-trigger";

// Mock console.error to avoid test output noise when error is thrown
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe("TestErrorTrigger", () => {
  it("renders outside production builds", () => {
    render(<TestErrorTrigger />);
    
    expect(screen.getByText("Development only")).toBeInTheDocument();
    expect(screen.getByText("Test Error Boundary")).toBeInTheDocument();
  });

  it("throws error when button is clicked", () => {
    // Wrap in error boundary to catch the thrown error
    const ThrowErrorWrapper = () => {
      try {
        return <TestErrorTrigger />;
      } catch (error) {
        return <div>Error caught: {(error as Error).message}</div>;
      }
    };
    
    const { rerender } = render(<ThrowErrorWrapper />);
    
    const button = screen.getByText("Test Error Boundary");
    
    expect(() => fireEvent.click(button)).toThrow("Test error boundary trigger - this is expected behavior for testing");
    rerender(<div />);
  });

  it("uses appropriate styling for development indicator", () => {
    render(<TestErrorTrigger />);
    
    const container = screen.getByText("Development only").parentElement;
    expect(container).toHaveClass("fixed");
    expect(container).toHaveClass("bottom-4");
    expect(container).toHaveClass("right-4");
    
    const button = screen.getByText("Test Error Boundary");
    expect(button).toHaveClass("bg-red-600");
  });
});
