/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { EmploymentPeriodConfigStep } from "../employment-period-config-step";

describe("EmploymentPeriodConfigStep", () => {
  const onPeriodStartChange = jest.fn();
  const onPeriodEndChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls onPeriodStartChange when the start date changes", () => {
    render(
      <EmploymentPeriodConfigStep
        periodStart="2026-01-01"
        periodEnd="2026-04-01"
        continuityLengthMonths={3}
        onPeriodStartChange={onPeriodStartChange}
        onPeriodEndChange={onPeriodEndChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Period Start"), { target: { value: "2026-02-01" } });
    expect(onPeriodStartChange).toHaveBeenCalledWith("2026-02-01");
  });

  it("shows an error when the period is inverted", () => {
    render(
      <EmploymentPeriodConfigStep
        periodStart="2026-04-01"
        periodEnd="2026-01-01"
        continuityLengthMonths={3}
        onPeriodStartChange={onPeriodStartChange}
        onPeriodEndChange={onPeriodEndChange}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Period end must be after period start.");
  });

  it("warns when the span is shorter than the configured continuity length", () => {
    render(
      <EmploymentPeriodConfigStep
        periodStart="2026-01-01"
        periodEnd="2026-02-01"
        continuityLengthMonths={6}
        onPeriodStartChange={onPeriodStartChange}
        onPeriodEndChange={onPeriodEndChange}
      />,
    );

    expect(screen.getByText(/shorter than the configured continuity length/i)).toBeInTheDocument();
  });

  it("does not warn when the span covers the continuity length", () => {
    render(
      <EmploymentPeriodConfigStep
        periodStart="2026-01-01"
        periodEnd="2026-07-01"
        continuityLengthMonths={3}
        onPeriodStartChange={onPeriodStartChange}
        onPeriodEndChange={onPeriodEndChange}
      />,
    );

    expect(screen.queryByText(/shorter than the configured continuity length/i)).not.toBeInTheDocument();
  });

  it("does not show an error when dates are not yet set", () => {
    render(
      <EmploymentPeriodConfigStep
        periodStart=""
        periodEnd=""
        continuityLengthMonths={3}
        onPeriodStartChange={onPeriodStartChange}
        onPeriodEndChange={onPeriodEndChange}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
