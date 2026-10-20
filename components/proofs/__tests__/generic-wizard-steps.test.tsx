/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { GenericWizardSteps } from "../generic-wizard-steps";

const STEPS = ["one", "two", "three"] as const;
const LABELS = { one: "One", two: "Two", three: "Three" };

describe("GenericWizardSteps", () => {
  const mockOnStepChange = jest.fn();
  const mockCanProceedToStep = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all provided steps with their labels", () => {
    mockCanProceedToStep.mockReturnValue(false);

    render(
      <GenericWizardSteps
        steps={STEPS}
        labels={LABELS}
        currentStep="one"
        onStepChange={mockOnStepChange}
        canProceedToStep={mockCanProceedToStep}
      />,
    );

    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
    expect(screen.getByText("Three")).toBeInTheDocument();
  });

  it("marks the current step with aria-current", () => {
    mockCanProceedToStep.mockReturnValue(false);

    render(
      <GenericWizardSteps
        steps={STEPS}
        labels={LABELS}
        currentStep="two"
        onStepChange={mockOnStepChange}
        canProceedToStep={mockCanProceedToStep}
      />,
    );

    const currentStepButton = screen.getByRole("button", { name: "2" });
    expect(currentStepButton).toHaveAttribute("aria-current", "step");
  });

  it("disables Next when canProceedToStep returns false", () => {
    mockCanProceedToStep.mockReturnValue(false);

    render(
      <GenericWizardSteps
        steps={STEPS}
        labels={LABELS}
        currentStep="one"
        onStepChange={mockOnStepChange}
        canProceedToStep={mockCanProceedToStep}
      />,
    );

    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("navigates forward when canProceedToStep allows it", () => {
    mockCanProceedToStep.mockImplementation((step: string) => step === "one");

    render(
      <GenericWizardSteps
        steps={STEPS}
        labels={LABELS}
        currentStep="one"
        onStepChange={mockOnStepChange}
        canProceedToStep={mockCanProceedToStep}
      />,
    );

    fireEvent.click(screen.getByText("Next"));
    expect(mockOnStepChange).toHaveBeenCalledWith("two");
  });

  it("always allows navigating back to a completed step", () => {
    mockCanProceedToStep.mockReturnValue(false);

    render(
      <GenericWizardSteps
        steps={STEPS}
        labels={LABELS}
        currentStep="three"
        onStepChange={mockOnStepChange}
        canProceedToStep={mockCanProceedToStep}
      />,
    );

    const firstStepButton = screen.getAllByRole("button").find((button) => button.querySelector("svg"));
    fireEvent.click(firstStepButton!);
    expect(mockOnStepChange).toHaveBeenCalledWith("one");
  });

  it("shows Complete on the last step instead of Next", () => {
    mockCanProceedToStep.mockReturnValue(false);

    render(
      <GenericWizardSteps
        steps={STEPS}
        labels={LABELS}
        currentStep="three"
        onStepChange={mockOnStepChange}
        canProceedToStep={mockCanProceedToStep}
      />,
    );

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("disables Previous on the first step", () => {
    mockCanProceedToStep.mockReturnValue(false);

    render(
      <GenericWizardSteps
        steps={STEPS}
        labels={LABELS}
        currentStep="one"
        onStepChange={mockOnStepChange}
        canProceedToStep={mockCanProceedToStep}
      />,
    );

    expect(screen.getByText("Previous")).toBeDisabled();
  });
});
