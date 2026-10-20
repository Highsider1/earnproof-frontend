import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateSupportedAssetForm } from "../create-supported-asset-form";

beforeEach(() => {
  window.localStorage.clear();
});

describe("CreateSupportedAssetForm", () => {
  it("creates a native asset with no issuer", async () => {
    const onCreated = jest.fn();
    render(<CreateSupportedAssetForm onAssetCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/Asset code/), { target: { value: "XLM" } });
    fireEvent.click(screen.getByRole("button", { name: "Add supported asset" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ assetCode: "XLM", assetIssuer: null }),
      );
    });
  });

  it("disables the issuer field once the asset code is XLM", () => {
    render(<CreateSupportedAssetForm onAssetCreated={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Asset code/), { target: { value: "XLM" } });

    expect(screen.getByLabelText(/Issuer/)).toBeDisabled();
  });

  it("creates an issued asset with a valid issuer", async () => {
    const onCreated = jest.fn();
    render(<CreateSupportedAssetForm onAssetCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/Asset code/), { target: { value: "USDC" } });
    fireEvent.change(screen.getByLabelText(/Issuer/), {
      target: { value: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add supported asset" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          assetCode: "USDC",
          assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        }),
      );
    });
  });

  it("rejects an issued asset with no issuer (negative case)", async () => {
    const onCreated = jest.fn();
    render(<CreateSupportedAssetForm onAssetCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/Asset code/), { target: { value: "USDC" } });
    fireEvent.click(screen.getByRole("button", { name: "Add supported asset" }));

    await waitFor(() => {
      expect(
        screen.getByText(/requires a valid Stellar issuer address/i),
      ).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("rejects a malformed issuer address (negative/boundary case)", async () => {
    const onCreated = jest.fn();
    render(<CreateSupportedAssetForm onAssetCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/Asset code/), { target: { value: "USDC" } });
    fireEvent.change(screen.getByLabelText(/Issuer/), { target: { value: "not-an-address" } });
    fireEvent.click(screen.getByRole("button", { name: "Add supported asset" }));

    await waitFor(() => {
      expect(onCreated).not.toHaveBeenCalled();
    });
  });

  it("rejects a duplicate network+code+issuer combination (conflict state)", async () => {
    const onCreated = jest.fn();
    render(<CreateSupportedAssetForm onAssetCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/Asset code/), { target: { value: "USDC" } });
    fireEvent.change(screen.getByLabelText(/Issuer/), {
      target: { value: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add supported asset" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText(/Asset code/), { target: { value: "USDC" } });
    fireEvent.change(screen.getByLabelText(/Issuer/), {
      target: { value: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add supported asset" }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("clears the form after a successful submission", async () => {
    render(<CreateSupportedAssetForm onAssetCreated={jest.fn()} />);

    const codeInput = screen.getByLabelText(/Asset code/) as HTMLInputElement;
    fireEvent.change(codeInput, { target: { value: "XLM" } });
    fireEvent.click(screen.getByRole("button", { name: "Add supported asset" }));

    await waitFor(() => expect(codeInput.value).toBe(""));
  });
});
