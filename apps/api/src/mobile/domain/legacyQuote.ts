import type { Quote } from './quote.js';

/**
 * Keeps app builds shipped before the earlier-price removal (commit b0a6774) working.
 *
 * Those builds validate every quote with zod schemas that still REQUIRE `hasPriceChanges` on the
 * quote and `previousRatePaise` on each line. Without them the quote fails to parse and checkout
 * shows "Couldn't load this". Both fields are constant here (false / null), so they carry no
 * price-change information and the current app simply ignores them.
 *
 * Remove once old app builds are no longer in use.
 */
export function withLegacyQuoteFields(quote: Quote) {
  return {
    ...quote,
    hasPriceChanges: false as const,
    lines: quote.lines.map((line) => ({ ...line, previousRatePaise: null as number | null })),
  };
}
