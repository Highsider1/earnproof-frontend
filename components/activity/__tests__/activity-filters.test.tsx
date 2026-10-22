/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityFilters } from "../activity-filters";

describe("ActivityFilters", () => {
  it("calls onChange with the selected category", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ActivityFilters filter={{}} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Category"), "key");
    expect(onChange).toHaveBeenCalledWith({ category: "key", outcome: undefined });
  });

  it("calls onChange with the selected outcome", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ActivityFilters filter={{}} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Outcome"), "failure");
    expect(onChange).toHaveBeenCalledWith({ category: undefined, outcome: "failure" });
  });

  it("does not show a clear button when no filters are active", () => {
    render(<ActivityFilters filter={{}} onChange={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows and wires up a clear button when a filter is active", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<ActivityFilters filter={{ category: "auth" }} onChange={onChange} />);

    const clearButton = screen.getByRole("button", { name: "Clear filters" });
    await user.click(clearButton);
    expect(onChange).toHaveBeenCalledWith({});
  });
});
