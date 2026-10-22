import { keygenAsync, signAsync } from "@noble/ed25519";
import { encodeEd25519PublicKey } from "../test-strkey-helper";

jest.mock("@/lib/api/client", () => ({
  apiClient: jest.fn(),
}));

const originalEnv = { ...process.env };

async function withFreshModule<T>(
  envOverrides: Record<string, string | undefined>,
  fn: (mod: typeof import("../deployment-metadata")) => Promise<T>,
): Promise<T> {
  jest.resetModules();
  process.env = { ...originalEnv, ...envOverrides };
  const mod = await import("../deployment-metadata");
  return fn(mod);
}

interface SignedFixtureInput {
  networkPassphrase: string;
  contractAddresses: string[];
  artifactVersion: string;
  issuedAt: string;
}

async function buildSignedFixture(secretKey: Uint8Array, fields: SignedFixtureInput) {
  const canonical = JSON.stringify(fields);
  const signature = await signAsync(new TextEncoder().encode(canonical), secretKey);
  return {
    ...fields,
    signature: Buffer.from(signature).toString("base64"),
  };
}

describe("verifyDeploymentMetadata", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 'valid' for a correctly signed, fresh, matching document", async () => {
    const { secretKey, publicKey } = await keygenAsync();
    const signerAddress = encodeEd25519PublicKey(publicKey);

    const fields: SignedFixtureInput = {
      networkPassphrase: "Test SDF Network ; September 2015",
      contractAddresses: ["CONTRACTA", "CONTRACTB"],
      artifactVersion: "1.2.3",
      issuedAt: new Date().toISOString(),
    };
    const document = await buildSignedFixture(secretKey, fields);

    await withFreshModule(
      {
        NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: signerAddress,
        NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: fields.networkPassphrase,
        NEXT_PUBLIC_ARTIFACT_VERSION: fields.artifactVersion,
        NEXT_PUBLIC_EXPECTED_CONTRACT_ADDRESSES: fields.contractAddresses.join(","),
      },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue(document);

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("valid");
        expect(mod.blocksProtectedWorkflow(result)).toBe(false);
      },
    );
  });

  it("returns 'stale' when the document is older than the max age", async () => {
    const { secretKey, publicKey } = await keygenAsync();
    const signerAddress = encodeEd25519PublicKey(publicKey);

    const fields: SignedFixtureInput = {
      networkPassphrase: "Test SDF Network ; September 2015",
      contractAddresses: ["CONTRACTA"],
      artifactVersion: "1.2.3",
      issuedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    };
    const document = await buildSignedFixture(secretKey, fields);

    await withFreshModule(
      {
        NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: signerAddress,
        NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: fields.networkPassphrase,
        NEXT_PUBLIC_ARTIFACT_VERSION: fields.artifactVersion,
        NEXT_PUBLIC_EXPECTED_CONTRACT_ADDRESSES: fields.contractAddresses.join(","),
      },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue(document);

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("stale");
        if (result.status === "stale") {
          expect(result.ageMs).toBeGreaterThan(mod.DEPLOYMENT_METADATA_MAX_AGE_MS);
        }
        expect(mod.blocksProtectedWorkflow(result)).toBe(true);
      },
    );
  });

  it("returns 'mismatched' when the network passphrase doesn't match", async () => {
    const { secretKey, publicKey } = await keygenAsync();
    const signerAddress = encodeEd25519PublicKey(publicKey);

    const fields: SignedFixtureInput = {
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      contractAddresses: ["CONTRACTA"],
      artifactVersion: "1.2.3",
      issuedAt: new Date().toISOString(),
    };
    const document = await buildSignedFixture(secretKey, fields);

    await withFreshModule(
      {
        NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: signerAddress,
        NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
        NEXT_PUBLIC_ARTIFACT_VERSION: fields.artifactVersion,
        NEXT_PUBLIC_EXPECTED_CONTRACT_ADDRESSES: fields.contractAddresses.join(","),
      },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue(document);

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("mismatched");
        if (result.status === "mismatched") {
          expect(result.mismatches).toEqual([
            expect.objectContaining({ field: "networkPassphrase" }),
          ]);
        }
        expect(mod.blocksProtectedWorkflow(result)).toBe(true);
      },
    );
  });

  it("returns 'mismatched' listing every differing field, not just the first", async () => {
    const { secretKey, publicKey } = await keygenAsync();
    const signerAddress = encodeEd25519PublicKey(publicKey);

    const fields: SignedFixtureInput = {
      networkPassphrase: "Public Global Stellar Network ; September 2015",
      contractAddresses: ["WRONG_CONTRACT"],
      artifactVersion: "9.9.9",
      issuedAt: new Date().toISOString(),
    };
    const document = await buildSignedFixture(secretKey, fields);

    await withFreshModule(
      {
        NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: signerAddress,
        NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
        NEXT_PUBLIC_ARTIFACT_VERSION: "1.2.3",
        NEXT_PUBLIC_EXPECTED_CONTRACT_ADDRESSES: "CONTRACTA",
      },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue(document);

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("mismatched");
        if (result.status === "mismatched") {
          expect(result.mismatches).toHaveLength(3);
          expect(result.mismatches.map((m) => m.field).sort()).toEqual(
            ["artifactVersion", "contractAddresses", "networkPassphrase"].sort(),
          );
        }
      },
    );
  });

  it("returns 'malformed' when the signature doesn't verify (tampered field)", async () => {
    const { secretKey, publicKey } = await keygenAsync();
    const signerAddress = encodeEd25519PublicKey(publicKey);

    const fields: SignedFixtureInput = {
      networkPassphrase: "Test SDF Network ; September 2015",
      contractAddresses: ["CONTRACTA"],
      artifactVersion: "1.2.3",
      issuedAt: new Date().toISOString(),
    };
    const document = await buildSignedFixture(secretKey, fields);
    // Tamper with a field after signing - the signature no longer covers this content.
    const tampered = { ...document, artifactVersion: "9.9.9" };

    await withFreshModule(
      {
        NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: signerAddress,
        NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: fields.networkPassphrase,
        NEXT_PUBLIC_ARTIFACT_VERSION: fields.artifactVersion,
        NEXT_PUBLIC_EXPECTED_CONTRACT_ADDRESSES: fields.contractAddresses.join(","),
      },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue(tampered);

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("malformed");
        expect(mod.blocksProtectedWorkflow(result)).toBe(true);
      },
    );
  });

  it("returns 'malformed' for a document signed by a different key than configured", async () => {
    const { secretKey: attackerKey } = await keygenAsync();
    const { publicKey: trustedPublicKey } = await keygenAsync();
    const signerAddress = encodeEd25519PublicKey(trustedPublicKey);

    const fields: SignedFixtureInput = {
      networkPassphrase: "Test SDF Network ; September 2015",
      contractAddresses: ["CONTRACTA"],
      artifactVersion: "1.2.3",
      issuedAt: new Date().toISOString(),
    };
    // Signed by an untrusted key, not the one configured as the trusted signer.
    const document = await buildSignedFixture(attackerKey, fields);

    await withFreshModule(
      {
        NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: signerAddress,
        NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: fields.networkPassphrase,
        NEXT_PUBLIC_ARTIFACT_VERSION: fields.artifactVersion,
        NEXT_PUBLIC_EXPECTED_CONTRACT_ADDRESSES: fields.contractAddresses.join(","),
      },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue(document);

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("malformed");
      },
    );
  });

  it("returns 'malformed' when no signer key is configured (never treated as 'skip verification')", async () => {
    const { secretKey } = await keygenAsync();
    const fields: SignedFixtureInput = {
      networkPassphrase: "Test SDF Network ; September 2015",
      contractAddresses: ["CONTRACTA"],
      artifactVersion: "1.2.3",
      issuedAt: new Date().toISOString(),
    };
    const document = await buildSignedFixture(secretKey, fields);

    await withFreshModule(
      {
        NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: undefined,
        NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: fields.networkPassphrase,
        NEXT_PUBLIC_ARTIFACT_VERSION: fields.artifactVersion,
        NEXT_PUBLIC_EXPECTED_CONTRACT_ADDRESSES: fields.contractAddresses.join(","),
      },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue(document);

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("malformed");
      },
    );
  });

  it("returns 'malformed' for a document missing required fields", async () => {
    await withFreshModule(
      { NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: "GATESTKEY" },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue({ networkPassphrase: "foo" });

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("malformed");
      },
    );
  });

  it("returns 'malformed' for a document with the wrong field types", async () => {
    await withFreshModule(
      { NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: "GATESTKEY" },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue({
          networkPassphrase: "Test SDF Network ; September 2015",
          contractAddresses: "not-an-array",
          artifactVersion: "1.2.3",
          issuedAt: new Date().toISOString(),
          signature: "abc",
        });

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("malformed");
      },
    );
  });

  it("returns 'malformed' for a document with an invalid issuedAt date", async () => {
    await withFreshModule(
      { NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: "GATESTKEY" },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue({
          networkPassphrase: "Test SDF Network ; September 2015",
          contractAddresses: [],
          artifactVersion: "1.2.3",
          issuedAt: "not-a-date",
          signature: "abc",
        });

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("malformed");
      },
    );
  });

  it("returns 'malformed' for a non-object response (e.g. a plain string or null)", async () => {
    await withFreshModule(
      { NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: "GATESTKEY" },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockResolvedValue(null);

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("malformed");
      },
    );
  });

  it("returns 'unavailable' when the request fails (network error, timeout, 404)", async () => {
    await withFreshModule(
      { NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY: "GATESTKEY" },
      async (mod) => {
        const { apiClient } = await import("@/lib/api/client");
        (apiClient as jest.Mock).mockRejectedValue(new Error("network error"));

        const result = await mod.verifyDeploymentMetadata();
        expect(result.status).toBe("unavailable");
        expect(mod.blocksProtectedWorkflow(result)).toBe(true);
      },
    );
  });
});
