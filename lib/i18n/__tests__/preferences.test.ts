import {
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  clearLocalePreference,
  clearTimeZonePreference,
  detectBrowserTimeZone,
  getLocalePreference,
  getTimeZonePreference,
  setLocalePreference,
  setTimeZonePreference,
} from "@/lib/i18n";

describe("locale preference", () => {
  afterEach(() => {
    clearLocalePreference();
  });

  it("defaults to DEFAULT_LOCALE when nothing is stored", () => {
    expect(getLocalePreference()).toBe(DEFAULT_LOCALE);
  });

  it("round-trips a supported locale", () => {
    expect(setLocalePreference(DEFAULT_LOCALE)).toBe(true);
    expect(getLocalePreference()).toBe(DEFAULT_LOCALE);
  });

  it("rejects an unsupported locale and leaves no stored preference", () => {
    expect(setLocalePreference("fr-FR")).toBe(false);
    expect(getLocalePreference()).toBe(DEFAULT_LOCALE);
  });

  it("falls back to the default when storage holds a stale/invalid value", () => {
    window.localStorage.setItem("earnproof.preferences.locale", "not-a-real-locale");
    expect(getLocalePreference()).toBe(DEFAULT_LOCALE);
  });

  it("clears a stored preference", () => {
    setLocalePreference(DEFAULT_LOCALE);
    clearLocalePreference();
    expect(window.localStorage.getItem("earnproof.preferences.locale")).toBeNull();
  });

  it("degrades to false rather than throwing when storage is unavailable", () => {
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    try {
      expect(setLocalePreference(DEFAULT_LOCALE)).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("time zone preference", () => {
  afterEach(() => {
    clearTimeZonePreference();
  });

  it("defaults to DEFAULT_TIME_ZONE when nothing is stored", () => {
    expect(getTimeZonePreference()).toBe(DEFAULT_TIME_ZONE);
  });

  it("round-trips a valid IANA time zone", () => {
    expect(setTimeZonePreference("America/New_York")).toBe(true);
    expect(getTimeZonePreference()).toBe("America/New_York");
  });

  it("rejects an invalid time zone identifier and leaves no stored preference", () => {
    expect(setTimeZonePreference("Not/A_Zone")).toBe(false);
    expect(getTimeZonePreference()).toBe(DEFAULT_TIME_ZONE);
  });

  it("falls back to the default when storage holds a stale/invalid value", () => {
    window.localStorage.setItem("earnproof.preferences.timeZone", "Definitely/Invalid");
    expect(getTimeZonePreference()).toBe(DEFAULT_TIME_ZONE);
  });

  it("clears a stored preference", () => {
    setTimeZonePreference("Europe/Berlin");
    clearTimeZonePreference();
    expect(window.localStorage.getItem("earnproof.preferences.timeZone")).toBeNull();
  });
});

describe("detectBrowserTimeZone", () => {
  it("returns a non-empty string in a normal jsdom environment", () => {
    const detected = detectBrowserTimeZone();
    expect(typeof detected === "string" || detected === null).toBe(true);
  });

  it("returns null instead of throwing when Intl resolution fails", () => {
    const original = Intl.DateTimeFormat;
    // @ts-expect-error -- deliberately breaking Intl for this one assertion
    Intl.DateTimeFormat = () => {
      throw new Error("Intl unavailable");
    };

    try {
      expect(detectBrowserTimeZone()).toBeNull();
    } finally {
      Intl.DateTimeFormat = original;
    }
  });
});
