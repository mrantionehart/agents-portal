// ============================================================================
// From The Hart — daily quote service
// ============================================================================
// One motivational quote per day, the same for everyone. Deterministic by
// day-of-year so there is no scheduling, no rotation, no state. Read-only.
//
// The DB shape can grow (categories, tags, featured dates) without changing the
// public return shape — callers only ever receive { quote, author }.
// ============================================================================

export interface DailyQuote {
  quote: string;
  author: string;
}

// Last-resort fallback if the table is empty (day-of-year AND #1 both missing).
// The seed guarantees 365 rows, so this should never surface in practice.
export const FALLBACK_QUOTE: DailyQuote = {
  quote: "Because choices matter — make today count.",
  author: "Tony Hart",
};

/**
 * Day of the year (1–366) for `date`, evaluated in a fixed timezone so the quote
 * flips at local midnight and every viewer sees the same one on the same day.
 * Defaults to America/New_York (HartFelt's market).
 */
export function dayOfYear(date: Date, timeZone = "America/New_York"): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const y = get("year"), m = get("month"), d = get("day");
  const startOfYear = Date.UTC(y, 0, 1);
  const today = Date.UTC(y, m - 1, d);
  return Math.floor((today - startOfYear) / 86_400_000) + 1;
}

/**
 * Resolve the quote for a given date from a day-keyed fetcher, applying the
 * fallback chain: today's quote → quote #1 → hardcoded fallback. Pure aside from
 * the injected fetcher, so the fallback behavior is unit-testable without a DB.
 */
export async function resolveDailyQuote(
  fetchByDay: (dayOfYear: number) => Promise<DailyQuote | null>,
  date: Date = new Date(),
): Promise<DailyQuote> {
  const today = await fetchByDay(dayOfYear(date));
  if (today) return today;
  const first = await fetchByDay(1);
  if (first) return first;
  return FALLBACK_QUOTE;
}

// Minimal structural type for the one query we make — avoids coupling the
// service to the full Supabase client type.
interface QuoteReader {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          limit(n: number): { maybeSingle(): Promise<{ data: DailyQuote | null }> };
        };
      };
    };
  };
}

/** Fetch today's quote from Supabase (one indexed lookup + fallback). */
export async function getTodaysQuote(
  supabase: QuoteReader,
  date: Date = new Date(),
): Promise<DailyQuote> {
  return resolveDailyQuote(async (day) => {
    const { data } = await supabase
      .from("daily_quotes")
      .select("quote, author")
      .eq("active", true)
      .eq("day_of_year", day)
      .limit(1)
      .maybeSingle();
    return data ?? null;
  }, date);
}
