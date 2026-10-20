/**
 * Synthetic sensitive values used to prove the telemetry contract redacts
 * them. Every value here is fabricated — no real wallet, credential, token
 * or payment record appears in this repository.
 *
 * `SENSITIVE_VALUES` is the battery every serialized event is checked
 * against: if any of these strings survives into a transmitted payload, the
 * contract is broken.
 */

export const WALLET_ADDRESS = "GAJDTKQJKPGNQC6NHXQEV2YVFXDIZFEQ7RXAWXLWDFVLYSPWJOWWCYU7";
export const WALLET_SECRET = "SBGRHZNSJIPQMZ3BLQKPUEBLIHVXCPXOR2VJZ3FDMDMOI7ORAXHRUXFQ";
export const CONTRACT_ID = "CA5UUS7TPPZSJBTAZE5UEDMDMOI7ORAXHRUXFQGRHZNSJIPQMZ3BLQKP";
export const BEARER_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ3b3JrZXItNDIiLCJpYXQiOjE3MDAwMDAwMDB9.QWxsWW91ck5vbmNlQXJlQmVsb25nVG9Vcw";
export const PROOF_ID = "EP-8A42-91DC";
export const PROOF_BODY = JSON.stringify({
  credentialSubject: { id: "did:key:z6MkfakeSubject", income: "4200.00" },
  proof: { jws: "eyJhbGciOiJFZERTQSJ9..fakeSignatureValue" },
});
export const PAYMENT_PAN = "4111111111111111";
export const PAYMENT_AMOUNT_STROOPS = "42000000000";
export const EMAIL = "worker@example.invalid";
export const TX_HASH = "9f2c1d4b8a7e6f503c2b1a09d8e7f6a5b4c3d2e1f009a8b7c6d5e4f312233445";
export const PRIVATE_KEY_PEM =
  "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----";
export const FULL_URL = "https://api.earnproof.test/v1/proofs?proofId=EP-8A42-91DC&token=abc123";

export const SENSITIVE_VALUES = [
  WALLET_ADDRESS,
  WALLET_SECRET,
  CONTRACT_ID,
  BEARER_TOKEN,
  PROOF_ID,
  PAYMENT_PAN,
  PAYMENT_AMOUNT_STROOPS,
  EMAIL,
  TX_HASH,
  FULL_URL,
  "credentialSubject",
  "BEGIN PRIVATE KEY",
] as const;

/**
 * Error messages shaped like the ones this app's own code and the browser
 * actually produce when something goes wrong mid-workflow.
 */
export const REPRESENTATIVE_ERRORS: ReadonlyArray<{ label: string; error: Error }> = [
  {
    label: "network failure from fetch",
    error: new TypeError("Failed to fetch"),
  },
  {
    label: "API failure naming the full request URL",
    error: new Error(`EarnProof API request failed for ${FULL_URL}`),
  },
  {
    label: "wallet rejection naming the connected address",
    error: new Error(`Freighter rejected signing for account ${WALLET_ADDRESS}`),
  },
  {
    label: "validation error echoing a pasted credential",
    error: new Error(`Invalid credential payload: ${PROOF_BODY}`),
  },
  {
    label: "authorization failure echoing a bearer token",
    error: new Error(`Unauthorized: bearer ${BEARER_TOKEN} is expired`),
  },
  {
    label: "payment record echoed into a message",
    error: new Error(`Payment ${PAYMENT_PAN} for ${PAYMENT_AMOUNT_STROOPS} stroops was declined`),
  },
  {
    label: "proof id echoed into a message",
    error: new Error(`Proof ${PROOF_ID} could not be verified (tx ${TX_HASH})`),
  },
  {
    label: "contact form error echoing an email address",
    error: new Error(`Could not deliver message for ${EMAIL}`),
  },
  {
    label: "key material echoed into a message",
    error: new Error(`Failed to parse ${PRIVATE_KEY_PEM}`),
  },
  {
    label: "JSON parse failure from a proxy error page",
    error: new SyntaxError("Unexpected token < in JSON at position 0"),
  },
  {
    label: "aborted request",
    error: new DOMException("The operation was aborted.", "AbortError"),
  },
];
