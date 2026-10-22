import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { SupportedAssetList } from "../supported-asset-list";
import { createSupportedAsset, setSupportedAssetStatus } from "@/lib/supported-assets/store";

beforeEach(() => {
  window.localStorage.clear();
});

describe("SupportedAssetList", () => {
  it("shows an empty state when there are no assets", () => {
    render(<SupportedAssetList assets={[]} loading={false} onAssetUpdated={jest.fn()} />);

    expect(
      screen.getByText("No supported assets yet. Add your first one above."),
    ).toBeInTheDocument();
  });

  it("shows 'Native asset' instead of an issuer address for XLM", () => {
    const record = createSupportedAsset({ assetCode: "XLM", network: "testnet" });

    render(<SupportedAssetList assets={[record]} loading={false} onAssetUpdated={jest.fn()} />);

    expect(screen.getByText("Native asset")).toBeInTheDocument();
  });

  it("truncates the issuer address for an issued asset", () => {
    const record = createSupportedAsset({
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      network: "testnet",
    });

    render(<SupportedAssetList assets={[record]} loading={false} onAssetUpdated={jest.fn()} />);

    expect(screen.getByText("GA5ZSEJY...34K4KZVN")).toBeInTheDocument();
  });

  it("requires confirmation before deactivating (destructive-action requirement)", () => {
    const record = createSupportedAsset({ assetCode: "XLM", network: "testnet" });
    const onUpdated = jest.fn();

    render(<SupportedAssetList assets={[record]} loading={false} onAssetUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("deactivates only after confirming, and shows downstream impact copy", async () => {
    const record = createSupportedAsset({ assetCode: "XLM", network: "testnet" });
    const onUpdated = jest.fn();

    render(<SupportedAssetList assets={[record]} loading={false} onAssetUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(
      screen.getByText(/Existing proofs and payments referencing it remain unaffected/i),
    ).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate", hidden: true }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: "INACTIVE" }));
    });
  });

  it("cancelling deactivation does not change status", () => {
    const record = createSupportedAsset({ assetCode: "XLM", network: "testnet" });
    const onUpdated = jest.fn();

    render(<SupportedAssetList assets={[record]} loading={false} onAssetUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel", hidden: true }));

    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("restores focus to the row's toggle button after confirming", async () => {
    const record = createSupportedAsset({ assetCode: "XLM", network: "testnet" });

    render(<SupportedAssetList assets={[record]} loading={false} onAssetUpdated={jest.fn()} />);

    const toggleButton = screen.getByRole("button", { name: "Deactivate" });
    toggleButton.focus();
    fireEvent.click(toggleButton);
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate", hidden: true }));

    await waitFor(() => {
      expect(document.activeElement).toBe(toggleButton);
    });
  });

  it("shows an Activate action for an inactive asset", () => {
    const created = createSupportedAsset({ assetCode: "XLM", network: "testnet" });
    const record = setSupportedAssetStatus(created.id, "INACTIVE");

    render(<SupportedAssetList assets={[record]} loading={false} onAssetUpdated={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  it("shows a 'previously deactivated' note once an asset is reactivated (historical identifiability)", () => {
    const created = createSupportedAsset({ assetCode: "XLM", network: "testnet" });
    const inactive = setSupportedAssetStatus(created.id, "INACTIVE");
    const reactivated = setSupportedAssetStatus(inactive.id, "ACTIVE");

    render(
      <SupportedAssetList assets={[reactivated]} loading={false} onAssetUpdated={jest.fn()} />,
    );

    expect(screen.getByText(/Previously deactivated/i)).toBeInTheDocument();
  });
});
