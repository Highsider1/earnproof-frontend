import {
  CREDENTIAL_EXPORT_FILENAME,
  VERIFICATION_LINK_EXPORT_FILENAME,
  buildCredentialExport,
  buildVerificationLinkExport,
  isSafeExportFilename,
  serializeCredentialJson,
} from "@/lib/credentials/export";
import hiddenFixture from "@/tests/exports/fixtures/hidden-credential.json";
import disclosedFixture from "@/tests/exports/fixtures/disclosed-credential.json";

describe("safe credential export", () => {
  it("uses a fixed filename with no wallet, payment reference, proof id, or user text", () => {
    const plan = buildCredentialExport({
      credential: hiddenFixture.credential,
      proof: hiddenFixture.proof,
    });
    expect(plan.filename).toBe(CREDENTIAL_EXPORT_FILENAME);
    expect(isSafeExportFilename(plan.filename)).toBe(true);
    expect(plan.filename).not.toMatch(/G[A-Z0-9]{10,}/);
    expect(plan.filename).not.toContain(hiddenFixture.proof.id);
    expect(plan.filename).not.toContain("wallet");
  });

  it("lists public API fields and does not warn when income and sources stay hidden", () => {
    const plan = buildCredentialExport({
      credential: hiddenFixture.credential,
      proof: hiddenFixture.proof,
    });
    expect(plan.includedFields).toEqual(
      expect.arrayContaining([
        "credential.subject.walletHash",
        "credential.proof.signature",
        "proof.id",
      ]),
    );
    expect(plan.warnings).toEqual([]);
    const parsed = JSON.parse(plan.body) as {
      credential: { privacy: { exactIncomeHidden: boolean } };
    };
    expect(parsed.credential.privacy.exactIncomeHidden).toBe(true);
  });

  it("warns when optional sender or amount disclosure is present", () => {
    const plan = buildCredentialExport({
      credential: disclosedFixture.credential,
      proof: disclosedFixture.proof,
    });
    expect(plan.warnings.map((warning) => warning.field).sort()).toEqual(["amount", "sender"]);
  });

  it("preserves signature-critical bytes when raw JSON is supplied", () => {
    const rawJson = JSON.stringify({
      credential: hiddenFixture.credential,
      proof: hiddenFixture.proof,
    });
    const body = serializeCredentialJson({
      value: { mutated: true },
      rawJson,
    });
    expect(body).toBe(rawJson);
    expect(JSON.parse(body).credential.proof.signature).toBe(
      hiddenFixture.credential.proof.signature,
    );
  });

  it("round-trips exported JSON without reformatting the signature fields", () => {
    const plan = buildCredentialExport({
      credential: hiddenFixture.credential,
      proof: hiddenFixture.proof,
    });
    const parsed = JSON.parse(plan.body) as typeof hiddenFixture;
    const again = serializeCredentialJson({ value: parsed });
    expect(JSON.parse(again).credential.proof).toEqual(hiddenFixture.credential.proof);
    expect(JSON.parse(again).credential.proof.credentialHash).toBe(
      hiddenFixture.credential.proof.credentialHash,
    );
  });

  it("exports verification links with a safe filename", () => {
    const plan = buildVerificationLinkExport(
      "https://app.earnproof.example/verify?proof=EP-FIXT-0001",
    );
    expect(plan.filename).toBe(VERIFICATION_LINK_EXPORT_FILENAME);
    expect(isSafeExportFilename(plan.filename)).toBe(true);
    expect(plan.body).toContain("/verify?proof=EP-FIXT-0001");
  });
});
