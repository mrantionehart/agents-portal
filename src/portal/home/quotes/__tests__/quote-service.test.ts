import {
  dayOfYear,
  resolveDailyQuote,
  getTodaysQuote,
  FALLBACK_QUOTE,
  type DailyQuote,
} from "@/src/portal/home/quotes/quote-service";

describe("dayOfYear (America/New_York)", () => {
  it("Jan 1 → 1", () => {
    expect(dayOfYear(new Date("2026-01-01T12:00:00Z"))).toBe(1);
  });

  it("Dec 31 (non-leap) → 365", () => {
    expect(dayOfYear(new Date("2026-12-31T12:00:00Z"))).toBe(365);
  });

  it("Dec 31 (leap year) → 366", () => {
    expect(dayOfYear(new Date("2028-12-31T12:00:00Z"))).toBe(366);
  });

  it("uses local (ET) calendar day, not UTC — a late-UTC instant is still the prior ET day", () => {
    // 02:00 UTC on Jan 2 is 21:00 ET on Jan 1 → still day 1.
    expect(dayOfYear(new Date("2026-01-02T02:00:00Z"))).toBe(1);
  });

  it("today's example date (2026-07-28) resolves to 209", () => {
    expect(dayOfYear(new Date("2026-07-28T16:00:00Z"))).toBe(209);
  });
});

describe("resolveDailyQuote fallback chain", () => {
  const todayQuote: DailyQuote = { quote: "Today.", author: "Tony Hart" };
  const firstQuote: DailyQuote = { quote: "Number one.", author: "Tony Hart" };

  it("returns today's quote when present", async () => {
    const fetchByDay = jest.fn(async (day: number) => (day !== 1 ? todayQuote : firstQuote));
    const result = await resolveDailyQuote(fetchByDay, new Date("2026-07-28T16:00:00Z"));
    expect(result).toEqual(todayQuote);
    expect(fetchByDay).toHaveBeenCalledWith(209);
  });

  it("falls back to quote #1 when today's is missing", async () => {
    const fetchByDay = jest.fn(async (day: number) => (day === 1 ? firstQuote : null));
    const result = await resolveDailyQuote(fetchByDay, new Date("2026-07-28T16:00:00Z"));
    expect(result).toEqual(firstQuote);
    expect(fetchByDay).toHaveBeenCalledWith(1);
  });

  it("falls back to the hardcoded quote when both are missing", async () => {
    const fetchByDay = jest.fn(async () => null);
    const result = await resolveDailyQuote(fetchByDay, new Date("2026-07-28T16:00:00Z"));
    expect(result).toEqual(FALLBACK_QUOTE);
  });
});

describe("getTodaysQuote (Supabase wiring)", () => {
  function reader(row: DailyQuote | null) {
    const maybeSingle = jest.fn(async () => ({ data: row }));
    const limit = jest.fn(() => ({ maybeSingle }));
    const eq2 = jest.fn(() => ({ limit }));
    const eq1 = jest.fn(() => ({ eq: eq2 }));
    const select = jest.fn(() => ({ eq: eq1 }));
    const from = jest.fn(() => ({ select }));
    return { from } as never;
  }

  it("returns the row from the daily_quotes lookup", async () => {
    const row: DailyQuote = { quote: "The agent who follows up wins.", author: "Tony Hart" };
    const result = await getTodaysQuote(reader(row), new Date("2026-07-28T16:00:00Z"));
    expect(result).toEqual(row);
  });

  it("falls back to the hardcoded quote when the table returns nothing", async () => {
    const result = await getTodaysQuote(reader(null), new Date("2026-07-28T16:00:00Z"));
    expect(result).toEqual(FALLBACK_QUOTE);
  });
});
