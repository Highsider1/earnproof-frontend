"use client";

import { useCallback, useState } from "react";
import { createAuthChallenge, verifyAuthChallenge, type AuthChallenge } from "@/lib/api/auth";
import { connectFreighterWallet, signFreighterMessage } from "@/lib/wallet/freighter-sign";
import {
  completeWalletRotation,
  isWalletAlreadyAssigned,
  areBothChallengesValid,
  WalletAlreadyAssignedError,
} from "@/lib/wallet-rotation/store";
import { clearStoredSession } from "@/lib/session";

type RotationStep =
  | "idle"
  | "verifying-current"
  | "current-verified"
  | "verifying-replacement"
  | "ready-to-confirm"
  | "completing"
  | "completed"
  | "error";

interface VerifiedWallet {
  address: string;
  challenge: AuthChallenge;
}

export function WalletRotationFlow({
  currentWalletAddress,
  onRotationCompleted,
}: {
  currentWalletAddress: string;
  onRotationCompleted: (newAddress: string) => void;
}) {
  const [step, setStep] = useState<RotationStep>("idle");
  const [current, setCurrent] = useState<VerifiedWallet | null>(null);
  const [replacement, setReplacement] = useState<VerifiedWallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyWallet = useCallback(
    async (expectedAddress?: string): Promise<VerifiedWallet | null> => {
      const controller = new AbortController();
      const address = await connectFreighterWallet();
      if (!address) {
        setError("Wallet connection failed. Check your Freighter extension and try again.");
        return null;
      }
      if (expectedAddress && address !== expectedAddress) {
        setError(
          `Connected wallet (${shortAddress(address)}) does not match the current account wallet (${shortAddress(expectedAddress)}). Reconnect the correct wallet.`,
        );
        return null;
      }

      const challenge = await createAuthChallenge(address, controller.signal);
      const signature = await signFreighterMessage(challenge.message, address);
      if (!signature) {
        setError("Wallet did not return a signature. The request may have been cancelled.");
        return null;
      }

      // Proof of control is the successful challenge/verify round trip
      // itself — a valid signature over a fresh, backend-issued challenge.
      await verifyAuthChallenge(
        { challengeId: challenge.id, walletAddress: address, signature },
        controller.signal,
      );

      return { address, challenge };
    },
    [],
  );

  const handleVerifyCurrent = useCallback(async () => {
    setError(null);
    setStep("verifying-current");
    try {
      const verified = await verifyWallet(currentWalletAddress);
      if (!verified) {
        setStep("error");
        return;
      }
      setCurrent(verified);
      setStep("current-verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify current wallet.");
      setStep("error");
    }
  }, [currentWalletAddress, verifyWallet]);

  const handleVerifyReplacement = useCallback(async () => {
    setError(null);
    setStep("verifying-replacement");
    try {
      const verified = await verifyWallet();
      if (!verified) {
        setStep("error");
        return;
      }
      if (verified.address === currentWalletAddress) {
        setError("The replacement wallet must be different from the current wallet.");
        setStep("error");
        return;
      }
      if (isWalletAlreadyAssigned(verified.address)) {
        setError("This wallet address is already assigned to another account.");
        setStep("error");
        return;
      }
      setReplacement(verified);
      setStep("ready-to-confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify replacement wallet.");
      setStep("error");
    }
  }, [currentWalletAddress, verifyWallet]);

  const handleConfirmRotation = useCallback(() => {
    if (!current || !replacement) return;
    setError(null);
    setStep("completing");
    try {
      if (
        !areBothChallengesValid(current.challenge.expiresAt, replacement.challenge.expiresAt)
      ) {
        setError(
          "One of the proof-of-control challenges has expired. Please start the rotation again.",
        );
        setStep("error");
        return;
      }

      completeWalletRotation(current.address, replacement.address);

      // Successful rotation invalidates stale wallet and session state
      // (#169's own acceptance criterion) — the session token was issued
      // for the old wallet identity.
      clearStoredSession();

      setStep("completed");
      onRotationCompleted(replacement.address);
    } catch (err) {
      if (err instanceof WalletAlreadyAssignedError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to complete rotation.");
      }
      setStep("error");
    }
  }, [current, replacement, onRotationCompleted]);

  const handleCancel = useCallback(() => {
    setStep("idle");
    setCurrent(null);
    setReplacement(null);
    setError(null);
  }, []);

  if (step === "completed") {
    return (
      <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-5">
        <h3 className="text-lg font-semibold text-emerald-100">Wallet Rotated</h3>
        <p className="mt-2 text-sm leading-6 text-emerald-200">
          Your account is now associated with{" "}
          <span className="font-mono">{shortAddress(replacement!.address)}</span>. Please
          reconnect to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Rotate Wallet Address</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Prove control of your current wallet, then your replacement wallet, to
          rotate the address associated with this account.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {error}
          </p>
        </div>
      )}

      <ol className="grid gap-3 text-sm">
        <li className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-950 p-3">
          <span className="text-slate-300">
            1. Verify current wallet ({shortAddress(currentWalletAddress)})
          </span>
          {current ? (
            <span className="text-xs font-semibold text-emerald-300">Verified</span>
          ) : (
            <button
              onClick={() => void handleVerifyCurrent()}
              disabled={step === "verifying-current"}
              className="h-8 rounded border border-cyan-300/30 px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-300/10 transition disabled:opacity-50"
              type="button"
            >
              {step === "verifying-current" ? "Verifying..." : "Verify"}
            </button>
          )}
        </li>

        <li className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-950 p-3">
          <span className="text-slate-300">
            2. Verify replacement wallet
            {replacement ? ` (${shortAddress(replacement.address)})` : ""}
          </span>
          {replacement ? (
            <span className="text-xs font-semibold text-emerald-300">Verified</span>
          ) : (
            <button
              onClick={() => void handleVerifyReplacement()}
              disabled={!current || step === "verifying-replacement"}
              className="h-8 rounded border border-cyan-300/30 px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-300/10 transition disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
            >
              {step === "verifying-replacement" ? "Verifying..." : "Verify"}
            </button>
          )}
        </li>
      </ol>

      {current && replacement && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-xs font-semibold text-amber-100">Before you confirm</p>
          <p className="mt-1 text-xs text-amber-200">
            Rotating will end your current session on this device and any other
            active sessions. You will need to reconnect with the new wallet.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleConfirmRotation}
          disabled={!current || !replacement || step === "completing"}
          className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          {step === "completing" ? "Completing..." : "Confirm rotation"}
        </button>
        <button
          onClick={handleCancel}
          className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white transition hover:bg-white/5"
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
