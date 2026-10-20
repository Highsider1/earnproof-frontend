/**
 * @jest-environment jsdom
 */

import { saveFormDraft, readFormDraft, clearFormDraft } from "../drafts";

describe("form drafts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no draft has been saved", () => {
    expect(readFormDraft("form-a")).toBeNull();
  });

  it("saves and reads back a draft for a form", () => {
    saveFormDraft("form-a", { name: "Acme" });
    const draft = readFormDraft("form-a");
    expect(draft?.values).toEqual({ name: "Acme" });
    expect(typeof draft?.savedAt).toBe("string");
  });

  it("keeps multiple forms' drafts independent of each other", () => {
    saveFormDraft("form-a", { name: "Acme" });
    saveFormDraft("form-b", { name: "Globex" });

    expect(readFormDraft("form-a")?.values).toEqual({ name: "Acme" });
    expect(readFormDraft("form-b")?.values).toEqual({ name: "Globex" });
  });

  it("clearing one form's draft does not affect another form's draft", () => {
    saveFormDraft("form-a", { name: "Acme" });
    saveFormDraft("form-b", { name: "Globex" });

    clearFormDraft("form-a");

    expect(readFormDraft("form-a")).toBeNull();
    expect(readFormDraft("form-b")?.values).toEqual({ name: "Globex" });
  });

  it("replacing a draft for the same form overwrites the previous one", () => {
    saveFormDraft("form-a", { name: "Acme" });
    saveFormDraft("form-a", { name: "Acme Updated" });

    expect(readFormDraft("form-a")?.values).toEqual({ name: "Acme Updated" });
  });

  it("clearing the only remaining draft removes the storage key entirely", () => {
    saveFormDraft("form-a", { name: "Acme" });
    clearFormDraft("form-a");

    expect(localStorage.getItem("earnproof.form-drafts")).toBeNull();
  });
});
