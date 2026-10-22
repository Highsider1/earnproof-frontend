/**
 * @jest-environment jsdom
 */

import { classifySyncOutcome, syncPayments } from "../payments";
import { apiClient } from "../client";

jest.mock("../client", () => ({
  ...jest.requireActual("../client"),
  apiClient: jest.fn(),
}));

const mockedApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

describe("classifySyncOutcome", () => {
  it("classifies a run with no changes at all as a no-op", () => {
    expect(classifySyncOutcome({ created: 0, updated: 0, skipped: 0 })).toBe("noop");
  });

  it("classifies missing counts (undefined) the same as zero", () => {
    expect(classifySyncOutcome({})).toBe("noop");
  });

  it("classifies a run with any skipped payments as partial", () => {
    expect(classifySyncOutcome({ created: 3, updated: 0, skipped: 1 })).toBe("partial");
    expect(classifySyncOutcome({ created: 0, updated: 0, skipped: 5 })).toBe("partial");
  });

  it("classifies a run with created/updated and zero skipped as complete", () => {
    expect(classifySyncOutcome({ created: 5, updated: 2, skipped: 0 })).toBe("complete");
    expect(classifySyncOutcome({ created: 0, updated: 1, skipped: 0 })).toBe("complete");
  });
});

describe("syncPayments", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("posts to /payments/sync with a bearer token and returns the result", async () => {
    mockedApiClient.mockResolvedValue({ created: 2, updated: 1, skipped: 0 });
    const controller = new AbortController();

    const result = await syncPayments("token-123", controller.signal);

    expect(result).toEqual({ created: 2, updated: 1, skipped: 0 });
    expect(mockedApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/payments/sync",
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
      }),
    );
  });

  it("does not retry on failure (mutations are never auto-retried)", async () => {
    mockedApiClient.mockRejectedValue(new Error("sync failed"));
    const controller = new AbortController();

    await expect(syncPayments("token-123", controller.signal)).rejects.toThrow("sync failed");
    expect(mockedApiClient).toHaveBeenCalledTimes(1);
  });
});
