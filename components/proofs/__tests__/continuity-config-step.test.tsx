/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ContinuityConfigStep } from "../continuity-config-step";

describe("ContinuityConfigStep", () => {
  const onContinuityLengthMonthsChange = jest.fn();
  const onGapPolicyChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the current continuity length", () => {
    render(
      <ContinuityConfigStep
        continuityLengthMonths={6}
        gapPolicy="SHORT_GAPS"
        onContinuityLengthMonthsChange={onContinuityLengthMonthsChange}
        onGapPolicyChange={onGapPolicyChange}
      />,
    );

    expect(screen.getByLabelText(/Continuity length/i)).toHaveValue(6);
  });

  it("calls onContinuityLengthMonthsChange when the input changes", () => {
    render(
      <ContinuityConfigStep
        continuityLengthMonths={3}
        gapPolicy="SHORT_GAPS"
        onContinuityLengthMonthsChange={onContinuityLengthMonthsChange}
        onGapPolicyChange={onGapPolicyChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Continuity length/i), { target: { value: "12" } });
    expect(onContinuityLengthMonthsChange).toHaveBeenCalledWith(12);
  });

  it("renders all gap policy options", () => {
    render(
      <ContinuityConfigStep
        continuityLengthMonths={3}
        gapPolicy="SHORT_GAPS"
        onContinuityLengthMonthsChange={onContinuityLengthMonthsChange}
        onGapPolicyChange={onGapPolicyChange}
      />,
    );

    expect(screen.getByText("No gaps")).toBeInTheDocument();
    expect(screen.getByText("Short gaps tolerated")).toBeInTheDocument();
    expect(screen.getByText("Extended gaps tolerated")).toBeInTheDocument();
  });

  it("marks the selected gap policy as checked", () => {
    render(
      <ContinuityConfigStep
        continuityLengthMonths={3}
        gapPolicy="EXTENDED_GAPS"
        onContinuityLengthMonthsChange={onContinuityLengthMonthsChange}
        onGapPolicyChange={onGapPolicyChange}
      />,
    );

    expect(screen.getByRole("radio", { name: /Extended gaps tolerated/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /No gaps/i })).not.toBeChecked();
  });

  it("calls onGapPolicyChange when a different policy is selected", () => {
    render(
      <ContinuityConfigStep
        continuityLengthMonths={3}
        gapPolicy="SHORT_GAPS"
        onContinuityLengthMonthsChange={onContinuityLengthMonthsChange}
        onGapPolicyChange={onGapPolicyChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /No gaps/i }));
    expect(onGapPolicyChange).toHaveBeenCalledWith("NO_GAPS");
  });
});
