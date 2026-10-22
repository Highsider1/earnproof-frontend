/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useDeploymentMetadataGate } from "../use-deployment-metadata-gate";
import * as deploymentMetadata from "../deployment-metadata";

jest.mock("../deployment-metadata", () => ({
  ...jest.requireActual("../deployment-metadata"),
  verifyDeploymentMetadata: jest.fn(),
}));

const mockedVerify = deploymentMetadata.verifyDeploymentMetadata as jest.MockedFunction<
  typeof deploymentMetadata.verifyDeploymentMetadata
>;

describe("useDeploymentMetadataGate", () => {
  beforeEach(() => {
    mockedVerify.mockReset();
  });

  it("runs the action when verification is valid", async () => {
    mockedVerify.mockResolvedValue({
      status: "valid",
      metadata: {
        networkPassphrase: "x",
        contractAddresses: [],
        artifactVersion: "1.0.0",
        issuedAt: new Date().toISOString(),
        signature: "sig",
      },
    });

    const { result } = renderHook(() => useDeploymentMetadataGate());
    const action = jest.fn();

    await act(async () => {
      await result.current.runIfVerified(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.state?.status).toBe("valid");
  });

  it("does not run the action when verification is unavailable", async () => {
    mockedVerify.mockResolvedValue({ status: "unavailable", reason: "network error" });

    const { result } = renderHook(() => useDeploymentMetadataGate());
    const action = jest.fn();

    await act(async () => {
      await result.current.runIfVerified(action);
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.state?.status).toBe("unavailable");
  });

  it("does not run the action when verification is malformed", async () => {
    mockedVerify.mockResolvedValue({ status: "malformed", reason: "bad signature" });

    const { result } = renderHook(() => useDeploymentMetadataGate());
    const action = jest.fn();

    await act(async () => {
      await result.current.runIfVerified(action);
    });

    expect(action).not.toHaveBeenCalled();
  });

  it("returns the verification result to the caller", async () => {
    mockedVerify.mockResolvedValue({ status: "unavailable", reason: "network error" });

    const { result } = renderHook(() => useDeploymentMetadataGate());

    let returned: deploymentMetadata.DeploymentMetadataState | undefined;
    await act(async () => {
      returned = await result.current.runIfVerified(jest.fn());
    });

    expect(returned?.status).toBe("unavailable");
  });

  it("sets isChecking while verification is in flight and clears it afterward", async () => {
    let resolveVerify!: (value: deploymentMetadata.DeploymentMetadataState) => void;
    mockedVerify.mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve;
      }),
    );

    const { result } = renderHook(() => useDeploymentMetadataGate());

    let runPromise!: Promise<deploymentMetadata.DeploymentMetadataState>;
    act(() => {
      runPromise = result.current.runIfVerified(jest.fn());
    });

    expect(result.current.isChecking).toBe(true);

    await act(async () => {
      resolveVerify({ status: "unavailable", reason: "x" });
      await runPromise;
    });

    expect(result.current.isChecking).toBe(false);
  });

  it("re-verifies on every call rather than caching a prior 'valid' result", async () => {
    mockedVerify.mockResolvedValue({
      status: "valid",
      metadata: {
        networkPassphrase: "x",
        contractAddresses: [],
        artifactVersion: "1.0.0",
        issuedAt: new Date().toISOString(),
        signature: "sig",
      },
    });

    const { result } = renderHook(() => useDeploymentMetadataGate());

    await act(async () => {
      await result.current.runIfVerified(jest.fn());
      await result.current.runIfVerified(jest.fn());
    });

    expect(mockedVerify).toHaveBeenCalledTimes(2);
  });
});
