/** @jest-environment jsdom */
import {
  getRecent,
  pushRecent,
  getFavorites,
  toggleFavorite,
  isFavorite,
} from "../local-store";

describe("local-store — storage safety (favorites + recent)", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns empty arrays by default (no seed)", () => {
    expect(getRecent()).toEqual([]);
    expect(getFavorites()).toEqual([]);
  });

  it("recent: newest-first, dedupes, caps at 5", () => {
    ["a", "b", "c", "d", "e", "f", "a"].forEach((f) => pushRecent(f));
    const r = getRecent();
    expect(r[0]).toBe("a");
    expect(r).toHaveLength(5);
    expect(r).not.toContain("b"); // evicted past the cap
  });

  it("favorites: toggle on then off", () => {
    toggleFavorite("x");
    expect(isFavorite("x")).toBe(true);
    toggleFavorite("x");
    expect(isFavorite("x")).toBe(false);
  });

  it("malformed localStorage value → returns [] (never throws)", () => {
    window.localStorage.setItem("hf.library.recent.v1", "{ not json");
    expect(getRecent()).toEqual([]);
    // valid JSON but not an array of strings → []
    window.localStorage.setItem("hf.library.favorites.v1", '{"a":1}');
    expect(getFavorites()).toEqual([]);
    window.localStorage.setItem("hf.library.recent.v1", "[1, 2, null]");
    expect(getRecent()).toEqual([]); // non-string entries filtered out
  });

  it("write failure (quota / private browsing) is swallowed, never throws", () => {
    const spy = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    expect(() => pushRecent("x")).not.toThrow();
    expect(() => toggleFavorite("y")).not.toThrow();
    spy.mockRestore();
  });
});
