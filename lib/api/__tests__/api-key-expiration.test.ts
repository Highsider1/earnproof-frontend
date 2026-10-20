/**
 * @jest-environment jsdom
 */

import {
  getExpirationStatus,
  isApiKeyValid,
  requiresExpirationAction,
  EXPIRATION_VERY_SOON_MS,
  EXPIRATION_SOON_MS,
  type ExpirationWarningTier,
} from "../api-key-expiration";

describe("API Key Expiration Utilities", () => {
  const now = new Date("2026-09-23T12:00:00.000Z").getTime();

  describe("getExpirationStatus", () => {
    describe("with no expiration date", () => {
      it("returns active tier for null expiresAt", () => {
        const status = getExpirationStatus(null, now);
        expect(status.tier).toBe("active");
        expect(status.isExpired).toBe(false);
        expect(status.isActive).toBe(true);
        expect(status.millisecondsUntilExpiry).toBeNull();
      });

      it("returns active tier for undefined expiresAt", () => {
        const status = getExpirationStatus(undefined, now);
        expect(status.tier).toBe("active");
        expect(status.isExpired).toBe(false);
        expect(status.isActive).toBe(true);
        expect(status.millisecondsUntilExpiry).toBeNull();
      });
    });

    describe("expired keys", () => {
      it("returns expired tier when expiresAt is in the past", () => {
        const pastDate = new Date(now - 1000).toISOString();
        const status = getExpirationStatus(pastDate, now);
        expect(status.tier).toBe("expired");
        expect(status.isExpired).toBe(true);
        expect(status.isActive).toBe(false);
        expect(status.millisecondsUntilExpiry).toBe(-1000);
      });

      it("returns expired tier at exact expiration moment", () => {
        const exactTime = new Date(now).toISOString();
        const status = getExpirationStatus(exactTime, now);
        expect(status.tier).toBe("expired");
        expect(status.isExpired).toBe(true);
      });

      it("returns expired tier for Date object in the past", () => {
        const pastDate = new Date(now - 5000);
        const status = getExpirationStatus(pastDate, now);
        expect(status.tier).toBe("expired");
        expect(status.isExpired).toBe(true);
      });

      it("returns expired tier for milliseconds in the past", () => {
        const pastMs = now - 10000;
        const status = getExpirationStatus(pastMs, now);
        expect(status.tier).toBe("expired");
        expect(status.isExpired).toBe(true);
      });
    });

    describe("expiring-very-soon tier (2 days or less)", () => {
      it("returns expiring-very-soon tier when less than 2 days remain", () => {
        // 1 day remaining
        const oneDay = now + 24 * 60 * 60 * 1000;
        const status = getExpirationStatus(new Date(oneDay).toISOString(), now);
        expect(status.tier).toBe("expiring-very-soon");
        expect(status.isExpired).toBe(false);
        expect(status.isActive).toBe(false);
      });

      it("returns expiring-very-soon at exactly 2 days", () => {
        const twoDays = now + EXPIRATION_VERY_SOON_MS;
        const status = getExpirationStatus(new Date(twoDays).toISOString(), now);
        expect(status.tier).toBe("expiring-very-soon");
      });

      it("transitions from expiring-very-soon to expiring-soon just after 2 days", () => {
        const justAfterTwoDays = now + EXPIRATION_VERY_SOON_MS + 1;
        const status = getExpirationStatus(new Date(justAfterTwoDays).toISOString(), now);
        expect(status.tier).toBe("expiring-soon");
      });

      it("returns expiring-very-soon for 1 second remaining", () => {
        const oneSecond = now + 1000;
        const status = getExpirationStatus(new Date(oneSecond).toISOString(), now);
        expect(status.tier).toBe("expiring-very-soon");
      });
    });

    describe("expiring-soon tier (7 days or less, but more than 2 days)", () => {
      it("returns expiring-soon tier when 3 days remain", () => {
        const threeDays = now + 3 * 24 * 60 * 60 * 1000;
        const status = getExpirationStatus(new Date(threeDays).toISOString(), now);
        expect(status.tier).toBe("expiring-soon");
        expect(status.isExpired).toBe(false);
        expect(status.isActive).toBe(true);
      });

      it("returns expiring-soon tier at exactly 7 days", () => {
        const sevenDays = now + EXPIRATION_SOON_MS;
        const status = getExpirationStatus(new Date(sevenDays).toISOString(), now);
        expect(status.tier).toBe("expiring-soon");
      });

      it("transitions from expiring-soon to active just after 7 days", () => {
        const justAfterSevenDays = now + EXPIRATION_SOON_MS + 1;
        const status = getExpirationStatus(new Date(justAfterSevenDays).toISOString(), now);
        expect(status.tier).toBe("active");
      });

      it("returns expiring-soon for 5 days remaining", () => {
        const fiveDays = now + 5 * 24 * 60 * 60 * 1000;
        const status = getExpirationStatus(new Date(fiveDays).toISOString(), now);
        expect(status.tier).toBe("expiring-soon");
      });
    });

    describe("active tier (more than 7 days)", () => {
      it("returns active tier when more than 7 days remain", () => {
        const tenDays = now + 10 * 24 * 60 * 60 * 1000;
        const status = getExpirationStatus(new Date(tenDays).toISOString(), now);
        expect(status.tier).toBe("active");
        expect(status.isExpired).toBe(false);
        expect(status.isActive).toBe(true);
      });

      it("returns active tier for far future dates", () => {
        const oneYear = now + 365 * 24 * 60 * 60 * 1000;
        const status = getExpirationStatus(new Date(oneYear).toISOString(), now);
        expect(status.tier).toBe("active");
      });

      it("returns active tier for 90 days remaining", () => {
        const ninetyDays = now + 90 * 24 * 60 * 60 * 1000;
        const status = getExpirationStatus(new Date(ninetyDays).toISOString(), now);
        expect(status.tier).toBe("active");
      });
    });

    describe("timezone determinism", () => {
      it("produces same result regardless of how Date is constructed", () => {
        const isoString = "2026-10-15T12:00:00.000Z";
        const timestamp = new Date(isoString).getTime();
        const dateObject = new Date(isoString);

        const statusFromString = getExpirationStatus(isoString, now);
        const statusFromMs = getExpirationStatus(timestamp, now);
        const statusFromDate = getExpirationStatus(dateObject, now);

        expect(statusFromString.tier).toBe(statusFromMs.tier);
        expect(statusFromMs.tier).toBe(statusFromDate.tier);
        expect(statusFromString.millisecondsUntilExpiry).toBe(statusFromMs.millisecondsUntilExpiry);
        expect(statusFromMs.millisecondsUntilExpiry).toBe(statusFromDate.millisecondsUntilExpiry);
      });

      it("uses UTC for comparison, not local timezone", () => {
        // All times are in UTC, so comparison should be consistent
        const utcTime = "2026-10-15T12:00:00.000Z";
        const status1 = getExpirationStatus(utcTime, now);
        const status2 = getExpirationStatus(utcTime, now);

        expect(status1).toEqual(status2);
      });
    });

    describe("edge cases", () => {
      it("handles invalid date strings gracefully", () => {
        const status = getExpirationStatus("invalid-date", now);
        expect(status.tier).toBe("active");
        expect(status.isExpired).toBe(false);
        expect(status.isActive).toBe(true);
        expect(status.millisecondsUntilExpiry).toBeNull();
      });

      it("handles NaN gracefully", () => {
        const status = getExpirationStatus(NaN, now);
        expect(status.tier).toBe("active");
        expect(status.isExpired).toBe(false);
      });

      it("accepts Date object for now parameter", () => {
        const nowDate = new Date(now);
        const futureDate = new Date(now + 1000);
        const status = getExpirationStatus(futureDate, nowDate);
        expect(status.millisecondsUntilExpiry).toBe(1000);
      });

      it("uses Date.now() by default when now is not provided", () => {
        jest.useFakeTimers();
        jest.setSystemTime(now);

        const futureDate = new Date(now + 5000).toISOString();
        const status = getExpirationStatus(futureDate);

        expect(status.millisecondsUntilExpiry).toBe(5000);

        jest.useRealTimers();
      });
    });
  });

  describe("isApiKeyValid", () => {
    it("returns true for keys without expiration", () => {
      expect(isApiKeyValid(null, now)).toBe(true);
      expect(isApiKeyValid(undefined, now)).toBe(true);
    });

    it("returns true for keys with future expiration", () => {
      const futureDate = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
      expect(isApiKeyValid(futureDate, now)).toBe(true);
    });

    it("returns false for expired keys", () => {
      const pastDate = new Date(now - 1000).toISOString();
      expect(isApiKeyValid(pastDate, now)).toBe(false);
    });

    it("returns false at exact expiration moment", () => {
      const exactTime = new Date(now).toISOString();
      expect(isApiKeyValid(exactTime, now)).toBe(false);
    });

    it("returns true for keys expiring soon but not yet expired", () => {
      const soonDate = new Date(now + 1 * 24 * 60 * 60 * 1000).toISOString();
      expect(isApiKeyValid(soonDate, now)).toBe(true);
    });
  });

  describe("requiresExpirationAction", () => {
    it("returns false for keys without expiration", () => {
      expect(requiresExpirationAction(null, now)).toBe(false);
      expect(requiresExpirationAction(undefined, now)).toBe(false);
    });

    it("returns false for keys with ample time remaining", () => {
      const futureDate = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(requiresExpirationAction(futureDate, now)).toBe(false);
    });

    it("returns true for expired keys", () => {
      const pastDate = new Date(now - 1000).toISOString();
      expect(requiresExpirationAction(pastDate, now)).toBe(true);
    });

    it("returns true for keys expiring very soon (within 2 days)", () => {
      const oneDay = new Date(now + 1 * 24 * 60 * 60 * 1000).toISOString();
      expect(requiresExpirationAction(oneDay, now)).toBe(true);
    });

    it("returns true for keys expiring soon (3-7 days)", () => {
      const fiveDays = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(requiresExpirationAction(fiveDays, now)).toBe(true);
    });

    it("returns false for keys expiring in 8+ days", () => {
      const tenDays = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
      expect(requiresExpirationAction(tenDays, now)).toBe(false);
    });
  });

  describe("threshold boundary crossing", () => {
    it("correctly handles transition from active to expiring-soon at 7-day boundary", () => {
      // Exactly 7 days
      const sevenDayStatus = getExpirationStatus(
        new Date(now + EXPIRATION_SOON_MS).toISOString(),
        now,
      );
      expect(sevenDayStatus.tier).toBe("expiring-soon");

      // Just before 7 days (6.999 days)
      const justBeforeStatus = getExpirationStatus(
        new Date(now + EXPIRATION_SOON_MS - 1).toISOString(),
        now,
      );
      expect(justBeforeStatus.tier).toBe("expiring-soon");

      // Just after 7 days (7.001 days)
      const justAfterStatus = getExpirationStatus(
        new Date(now + EXPIRATION_SOON_MS + 1).toISOString(),
        now,
      );
      expect(justAfterStatus.tier).toBe("active");
    });

    it("correctly handles transition from expiring-soon to expiring-very-soon at 2-day boundary", () => {
      // Exactly 2 days
      const twoDayStatus = getExpirationStatus(
        new Date(now + EXPIRATION_VERY_SOON_MS).toISOString(),
        now,
      );
      expect(twoDayStatus.tier).toBe("expiring-very-soon");

      // Just before 2 days (1.999 days)
      const justBeforeStatus = getExpirationStatus(
        new Date(now + EXPIRATION_VERY_SOON_MS - 1).toISOString(),
        now,
      );
      expect(justBeforeStatus.tier).toBe("expiring-very-soon");

      // Just after 2 days (2.001 days)
      const justAfterStatus = getExpirationStatus(
        new Date(now + EXPIRATION_VERY_SOON_MS + 1).toISOString(),
        now,
      );
      expect(justAfterStatus.tier).toBe("expiring-soon");
    });

    it("correctly handles transition from expiring-very-soon to expired at 0-second boundary", () => {
      // 1 millisecond before expiry
      const beforeExpiryStatus = getExpirationStatus(
        new Date(now + 1).toISOString(),
        now,
      );
      expect(beforeExpiryStatus.tier).toBe("expiring-very-soon");

      // At exact expiry moment
      const atExpiryStatus = getExpirationStatus(
        new Date(now).toISOString(),
        now,
      );
      expect(atExpiryStatus.tier).toBe("expired");

      // 1 millisecond after expiry
      const afterExpiryStatus = getExpirationStatus(
        new Date(now - 1).toISOString(),
        now,
      );
      expect(afterExpiryStatus.tier).toBe("expired");
    });
  });

  describe("fake timer integration", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("correctly updates tier when clock advances within same threshold", () => {
      const expiryDate = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();

      const statusBefore = getExpirationStatus(expiryDate);
      expect(statusBefore.tier).toBe("expiring-soon");

      // Advance clock by 1 day (still within expiring-soon)
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);

      const statusAfter = getExpirationStatus(expiryDate);
      expect(statusAfter.tier).toBe("expiring-soon");
      expect(statusAfter.millisecondsUntilExpiry).toBeLessThan(statusBefore.millisecondsUntilExpiry!);
    });

    it("correctly updates tier when clock crosses threshold boundary", () => {
      const expiryDate = new Date(now + 2.5 * 24 * 60 * 60 * 1000).toISOString();

      const statusBefore = getExpirationStatus(expiryDate);
      expect(statusBefore.tier).toBe("expiring-very-soon");

      // Advance clock by 1 day (now 1.5 days remaining, still very soon)
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      const statusMiddle = getExpirationStatus(expiryDate);
      expect(statusMiddle.tier).toBe("expiring-very-soon");

      // Advance clock by 1 day (now 0.5 days remaining, still very soon)
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      const statusEnd = getExpirationStatus(expiryDate);
      expect(statusEnd.tier).toBe("expiring-very-soon");
    });

    it("correctly updates tier when clock advances past expiration", () => {
      const expiryDate = new Date(now + 1 * 24 * 60 * 60 * 1000).toISOString();

      const statusBefore = getExpirationStatus(expiryDate);
      expect(statusBefore.tier).toBe("expiring-very-soon");

      // Advance clock past expiration
      jest.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);

      const statusAfter = getExpirationStatus(expiryDate);
      expect(statusAfter.tier).toBe("expired");
      expect(statusAfter.isExpired).toBe(true);
    });
  });
});
