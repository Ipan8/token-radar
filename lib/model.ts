// Token Radar's value model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never the ceiling) and adds
// every rankable pre-token protocol below the floor: the early rows the radar exists to find. It
// also adds every rankable pre-token protocol at or above the floor that the watchlist leaves out
// but passes the watchlist rule's clauses the snapshot's ten fields can check (P1 fix, 15 Nov
// 2026: the old `tvl < floor` cut on the early radar dropped 20 such protocols — see
// buildBoard). A protocol is pre-token when its record carries no token (no market cap, no
// CoinGecko id, no symbol). Live-token protocols are never ranked: the board shows them apart, at
// their market's own market cap, and uses them only to calibrate the model.
//
// Implied value follows only from the snapshot's own figures. No protocol name is ever
// special-cased; the same function scores every row:
//
//   categoryMultiple = median mcap / TVL of the live-token protocols in the row's category
//                      (at least 3 of them, else the global median across all live tokens),
//                      shrunk halfway toward that global median, then clamped to [0.10, 0.60].
//                      Exchange tokens (category CEX) are left out of the calibration: an
//                      exchange token is valued on the exchange, not per dollar of TVL.
//   growth     = clamp(change_7d, -40, +60) per cent, or 0 when unreported
//   growthMult = 1 + (growth / 100) * 0.6
//   maturity   = 0.7 + min(age_days, 1095) / 1095 * 0.3   (age unknown: 365 days)
//   breadth    = 1 + min(chains - 1, 9) * 0.02           (more chains, wider distribution)
//   implied    = max(1, round(tvl_usd * categoryMultiple * growthMult * maturity * breadth))
//
// Why this shape: a token's launch value is anchored on the size of the business (TVL), priced
// the way the market already prices the same kind of business (the category's live mcap/TVL
// median), then adjusted for momentum (7-day growth), for how long the protocol has run with no
// token (age), and for how widely it is distributed (chain count). The shrink and the clamp keep
// one thin category from deciding the board: the most a category can move a row is 3x against the
// least, and the global median is always half the weight.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  category_shrink: number;
  category_floor: number;
  category_cap: number;
  breadth_per_chain: number;
  breadth_max_chains: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -40,
  growth_cap: 60,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 365,
  category_shrink: 0.5,
  category_floor: 0.1,
  category_cap: 0.6,
  breadth_per_chain: 0.02,
  breadth_max_chains: 9,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The global median mcap/TVL across live-token protocols, and each category's multiple. */
export interface Calibration {
  global_median: number;
  by_category: Record<string, number>;
  category_n: Record<string, number>;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    category_n: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  category_n: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the calibration and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  calibration: Calibration;
  validation: Validation;
  watchlist: string[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** One leave-one-feature-out ablation: the board re-scored and re-ranked without that factor. */
export interface FeatureAblation {
  feature: DroppedFeature;
  dropped: string;
  spearman: number;
  mean_abs_rank_shift: number;
  max_abs_rank_shift: number;
  top10_overlap: number;
  mean_abs_pct_implied_change: number;
}

/** One leave-one-out run aggregated: the board re-ranked once per removed protocol. */
export interface LopoSummary {
  n_removed: number;
  mean_spearman: number;
  min_spearman: number;
  mean_abs_rank_shift: number;
  max_abs_rank_shift: number;
  mean_abs_pct_implied_change: number;
  worst_removed_slug: string;
  worst_spearman: number;
}

/** The leave-one-out validation of the model, as numbers the board and the dashboard carry. */
export interface Validation {
  method: string;
  model_version: string;
  n_rows: number;
  features: FeatureAblation[];
  most_influential_feature: DroppedFeature;
  leave_one_protocol_out_board: LopoSummary;
  leave_one_calibrator_out: LopoSummary;
}

/** What the validation did, in the dashboard's own words (shown with the numbers, by the strip). */
export function validationMethod(nRows: number, nCalibrators: number): string {
  return (
    `Leave-one-out validation re-scores all ${nRows} board rows four times, once with each model factor neutralised ` +
    '(the category multiple replaced by the global median; growth, maturity and breadth each set to 1.0), and re-ranks the board each time. ' +
    `It also re-ranks the board ${nRows} times with one board row removed, and ${nCalibrators} times with one live-token calibrator removed from the category calibration. ` +
    'Stability is reported as the Spearman rank correlation against the full ranking, the mean and maximum absolute rank shift, the top-10 overlap, ' +
    'and the mean absolute percentage change in implied value. ' +
    'High correlations and small shifts mean the ranking does not hinge on any single factor, row or calibrator.'
  );
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a list, or null when it is empty. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The calibration: the market's own pricing of each category, read off the live-token protocols
 * in this snapshot. Exchange tokens are left out: they price on the exchange, not per TVL.
 * `excludeSlug` leaves one live protocol out, for leave-one-out validation of the calibration.
 */
export function calibrate(snapshot: Snapshot, excludeSlug: string | null = null): Calibration {
  const live = snapshot.protocols.filter(
    (p) => p.slug !== excludeSlug && !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
  const global = median(live.map((p) => p.mcap_usd! / p.tvl_usd)) ?? 0.2;
  const byCategory: Record<string, number> = {};
  const categoryN: Record<string, number> = {};
  const groups = new Map<string, number[]>();
  for (const p of live) {
    if (p.category === null) continue;
    const list = groups.get(p.category) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    groups.set(p.category, list);
  }
  for (const [category, ratios] of groups) {
    categoryN[category] = ratios.length;
    const catMedian = ratios.length >= 3 ? median(ratios)! : global;
    const shrunk = MODEL.category_shrink * catMedian + (1 - MODEL.category_shrink) * global;
    byCategory[category] = Math.min(MODEL.category_cap, Math.max(MODEL.category_floor, shrunk));
  }
  return { global_median: Math.round(global * 1e4) / 1e4, by_category: byCategory, category_n: categoryN };
}

/** The category multiple a protocol gets: its category's calibrated multiple, else the global median. */
export function categoryMultiple(protocol: SnapshotProtocol, calibration: Calibration): { multiple: number; n: number } {
  if (protocol.category !== null && calibration.by_category[protocol.category] !== undefined) {
    return { multiple: calibration.by_category[protocol.category]!, n: calibration.category_n[protocol.category]! };
  }
  const global = Math.min(MODEL.category_cap, Math.max(MODEL.category_floor, calibration.global_median));
  return { multiple: global, n: 0 };
}

/** The multipliers and the implied value one protocol gets under `model`. */
export interface ImpliedValue {
  implied: number;
  categoryMultiple: number;
  categoryN: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  breadthMult: number;
  age: number | null;
}

/** One model factor that leave-one-out validation can neutralise. */
export type DroppedFeature = 'category' | 'growth' | 'maturity' | 'breadth';

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  calibration: Calibration,
  model: ModelConstants = MODEL,
  drop: DroppedFeature | null = null,
): ImpliedValue {
  const age = ageDays(asOf, protocol.listed_at);
  // Dropping the category factor means pricing the protocol at the global median instead of
  // its own category's multiple: no category differentiation, the same neutral price for all.
  const { multiple, n } =
    drop === 'category'
      ? { multiple: Math.min(model.category_cap, Math.max(model.category_floor, calibration.global_median)), n: 0 }
      : categoryMultiple(protocol, calibration);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = drop === 'growth' ? 1 : 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    drop === 'maturity'
      ? 1
      : model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const breadthMult =
    drop === 'breadth' ? 1 : 1 + Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_chains) * model.breadth_per_chain;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * multiple * growthMult * maturityMult * breadthMult));
  return { implied, categoryMultiple: multiple, categoryN: n, growthPct, growthMult, maturityMult, breadthMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/**
 * The watchlist rule's clauses the snapshot's ten fields can check: the category is not one of
 * the wrapped / staked / bridged product categories, the name carries no whole word wrapped,
 * staked or staking, and it does not begin with an exchange's name. The rule's remaining clause —
 * DefiLlama records no parent protocol for it — is not one of the snapshot's ten fields, so no
 * entry can check it from the snapshot; it is the only clause that can keep a protocol that
 * passes every visible clause off the watchlist.
 */
const WATCHLIST_BAD_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/;

export function passesVisibleWatchlistRules(p: SnapshotProtocol): boolean {
  return (
    (p.category === null || !WATCHLIST_BAD_CATEGORIES.has(p.category)) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The live-token protocols that calibrate the model: the leave-one-calibrator-out set. */
export function calibrators(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0,
  );
}

/** The protocols, scored and sorted strongest first (implied value desc, slug asc on a tie). */
export function scoreProtocols(
  protocols: SnapshotProtocol[],
  asOf: string,
  calibration: Calibration,
  model: ModelConstants = MODEL,
  drop: DroppedFeature | null = null,
): { slug: string; implied: number }[] {
  const scored = protocols.map((p) => ({ slug: p.slug, implied: impliedValue(p, asOf, calibration, model, drop).implied }));
  scored.sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return scored;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const calibration = calibrate(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot no longer carries
  // (it cannot, but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor, by TVL, plus
  // every rankable pre-token protocol at or above the floor that the watchlist leaves out but
  // passes the watchlist rule's visible clauses. The floor is a floor, never a ceiling: the old
  // `tvl_usd < floor` cut alone dropped 20 above-floor protocols that pass
  // every visible clause and are off the watchlist only on its parent-protocol clause, which the
  // snapshot's ten fields do not carry. The visible-clauses check matters: dropping the floor
  // cut without it would also pull in 43 above-floor exchanges, bridges and staking products
  // that the rule keeps off the list.
  // Never a replacement for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter(
      (p) =>
        !chosen.has(p.slug) &&
        isRankable(p) &&
        (p.tvl_usd < snapshot.floor_usd || passesVisibleWatchlistRules(p)),
    )
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const order = scoreProtocols([...chosen.values()], snapshot.as_of, calibration, model);
  return order.map((s, i) => {
    const p = chosen.get(s.slug)!;
    const v = impliedValue(p, snapshot.as_of, calibration, model);
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token',
      age_days: v.age,
      implied_value_usd: v.implied,
      model: {
        // Full precision, not rounded: the dashboard recomputes the row from these factors and
        // must land on exactly the implied value board.json carries.
        category_multiple: v.categoryMultiple,
        category_n: v.categoryN,
        growth_pct: v.growthPct,
        growth_multiplier: v.growthMult,
        maturity_multiplier: v.maturityMult,
        breadth_multiplier: v.breadthMult,
        age_days: v.age,
      },
      farm_steps: farmSteps(p, v, i + 1).map(stepText),
    };
  });
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** A growth figure as two decimals, without a sign: the caller adds rose/fell. */
function fmtGrowth(value: number): string {
  const r = Math.round(Math.abs(value) * 100) / 100;
  return r.toFixed(2);
}

/** A TVL or implied value as a short dollar figure: $2.14B, $350.4M, $12K. */
function fmtTvl(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${Math.round(value / 1e3)}K`;
  return `$${value}`;
}

/** The first three chains a protocol names, plus how many more it counts TVL on. */
function chainListShort(chains: string[]): string {
  const first = chains.slice(0, 3).join(', ');
  return chains.length > 3 ? `${first} and ${chains.length - 3} more` : first;
}

/**
 * The category's main action, in the words a farmer can follow. The branches run most
 * specific first: 'Indexes' is checked before 'Dexs' because "indexes" contains "dex",
 * 'Onchain Capital Allocator' before 'Chain' because "onchain" contains "chain", and the
 * staking branches before the generic 'staking' one. Every board category in this snapshot
 * hits a named branch; the last line is only a fallback for a category a later snapshot
 * introduces, and it still names the protocol, its chain and its capital.
 */
export function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('liquid restaking') || c.includes('restaking')) return `Restake $${capital} of a liquid staking token through ${name} on ${chain} and keep the restaking receipt token.`;
  if (c.includes('liquid staking')) return `Stake $${capital} of ${chain}'s staking asset through ${name} and keep the liquid staking receipt token.`;
  if (c.includes('staking pool')) return `Stake $${capital} of ${chain}'s staking asset in ${name}'s staking pool on ${chain} and keep the receipt token.`;
  if (c.includes('staking')) return `Stake $${capital} of ${chain}'s staking asset through ${name} and keep the receipt token.`;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares for the full term.`;
  if (c.includes('yield aggregator')) return `Deposit $${capital} into a ${name} strategy vault on ${chain} and keep the shares for the full term.`;
  if (c.includes('leveraged farm')) return `Provide $${capital} of leveraged liquidity through ${name} on ${chain} at the lowest leverage it offers and keep the position open.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index token on ${chain} and hold it for the full term.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield')) return `Deposit $${capital} into a ${name} yield strategy on ${chain} and keep the position open.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} into a ${name} managed liquidity position on ${chain} and keep it in range.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('canonical bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name}'s canonical bridge and use the bridged funds in its app.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('interest rate')) return `Deposit $${capital} of USDC as margin on ${name} and open one small interest-rate position on ${chain}.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('dual-token') || c.includes('stablecoin wrapper') || c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('anchor btc')) return `Mint $${capital} of ${name}'s BTC-anchored asset on ${chain} and hold it for the full term.`;
  if (c.includes('btc')) return `Lock $${capital} of BTC through ${name} on ${chain} and hold the receipt token for the full term.`;
  if (c.includes('farm')) return `Deposit $${capital} into ${name}'s farm on ${chain} and stake the LP receipt to earn rewards.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into ${name}'s CeDeFi vault on ${chain} and keep the position open.`;
  if (c.includes('crypto card')) return `Load $${capital} of USDC onto ${name}'s card and make one purchase through it, then keep the card active.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} and keep the account active.`;
  if (c.includes('governance')) return `Deposit $${capital} and vote in ${name}'s governance on ${chain}.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('chain')) return `Bridge $${capital} of assets onto ${name}'s chain and use its core app once a week.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * The category's second action: a different action type on the same protocol, so the farm is
 * not one click. Same ordering rule as actionFor: the specific branches first, the generic
 * "one different action" line only for a category a later snapshot introduces.
 */
export function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(25, Math.round(capital / 2));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${small} against the supply on ${name} and repay half of it after two weeks, so the position shows both sides.`;
  if (c.includes('yield aggregator')) return `Move $${small} into a second ${name} strategy vault with a different strategy and hold both.`;
  if (c.includes('leveraged farm')) return `Add $${small} to a second leveraged pool on ${name} on ${chain} instead of topping up the first one.`;
  if (c.includes('index')) return `Add $${small} to the same index position on ${name} and log the top-up as a second entry.`;
  if (c.includes('dex')) return `Add $${small} to a second pool on ${name} on ${chain} instead of topping up the first one.`;
  if (c.includes('yield')) return `Add $${small} to a second yield strategy on ${name} on ${chain} instead of topping up the first one.`;
  if (c.includes('risk curator') || c.includes('curator') || c.includes('allocator')) return `Move $${small} into a second vault of ${name} with a different risk profile and hold both.`;
  if (c.includes('bridge')) return `Bridge $${small} back through ${name} in the other direction so the history shows two-way use.`;
  if (c.includes('staking') || c.includes('restak')) return `Restake the receipt token through ${name} once, and keep the restaked receipt.`;
  if (c.includes('rwa')) return `Reinvest the first yield payout from ${name} instead of withdrawing it.`;
  if (c.includes('stable')) return `Swap $${small} of the stable asset into a second asset through ${name} and back.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('interest rate')) return `Close the hedge on ${name} and open a fresh one at half size after a week.`;
  if (c.includes('basis')) return `Add $${small} to a second basis vault of ${name} on ${chain} and hold both positions.`;
  if (c.includes('btc')) return `Lock a further $${small} of BTC through ${name} on ${chain} and hold the second receipt.`;
  if (c.includes('farm')) return `Stake a further $${small} of LP receipt in a second farm pool on ${name} on ${chain}.`;
  if (c.includes('cedefi')) return `Move $${small} into a second CeDeFi vault of ${name} on ${chain} and hold both.`;
  if (c.includes('crypto card')) return `Make a second purchase of $${small} with ${name}'s card and keep the card active.`;
  if (c.includes('liquidity manager')) return `Move $${small} into a second managed position on ${name} with a different range and hold both.`;
  if (c.includes('insurance')) return `Add $${small} of cover from ${name} on ${chain} for a second asset and keep both policies active.`;
  if (c.includes('payment')) return `Route a second payment of $${small} through ${name} on ${chain} and keep the account active.`;
  if (c.includes('governance')) return `Vote on a second proposal in ${name}'s governance on ${chain}.`;
  if (c.includes('prediction')) return `Place a second position of $${small} on a different market on ${name}.`;
  if (c.includes('chain')) return `Use ${name}'s core app a second time on ${chain} — a swap or a vote — so the wallet shows repeat use.`;
  return `Do one different action on ${name} — a swap, a vote or a second deposit of $${small} — so the wallet's history is not a single transaction.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. Every step is
 * derived from the protocol's own snapshot record — name, category, chains, TVL, 7-day change,
 * listing date, age, implied value and rank — never from a hand-written list of names, and no
 * step claims anything the snapshot does not carry (a points page is checked for, not assumed).
 * The weekly step follows the protocol's own 7-day TVL change; the hold follows its age; the
 * claim step re-checks its own implied value and rank; the log step records its entry TVL and
 * its chains. Steps that cannot be made specific from the snapshot fall back to the generic
 * last lines of actionFor/secondActionFor; on this snapshot no board row hits them.
 */
export function farmSteps(p: SnapshotProtocol, v: ImpliedValue, rank: number): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(v.age);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  const category = p.category ?? 'protocol';
  let weekly: string;
  if (p.change_7d === null) {
    weekly = `Each week, repeat one ${category} action on ${p.name} on ${chain}. Its 7-day TVL change is not reported, so keep each weekly action small and log the date.`;
  } else if (p.change_7d < 0) {
    weekly = `Each week, repeat one ${category} action on ${p.name} on ${chain}. Its TVL fell ${fmtGrowth(p.change_7d)}% over 7 days, so keep the weekly action to a small top-up and log the date.`;
  } else {
    weekly = `Each week, repeat one ${category} action on ${p.name} on ${chain}. Its TVL rose ${fmtGrowth(p.change_7d)}% over 7 days, so a small weekly top-up keeps the position active as it grows.`;
  }
  if (p.chains.length > 1) weekly += ` Once a month, repeat the action on ${p.chains[1]} too.`;
  const holdText =
    v.age !== null && p.listed_at !== null
      ? `Hold the ${p.name} position on ${chain} for at least ${hold} days. ${p.name} has been listed since ${p.listed_at} (${v.age} days with no token), so a ${hold}-day hold puts the activity in more than one snapshot.`
      : `Hold the ${p.name} position on ${chain} for at least ${hold} days. No listing date is reported for ${p.name}, so a ${hold}-day hold is the qualifying window used here.`;
  return [
    {
      text: `Set up a fresh wallet for ${p.name} on ${chain}, fund it with $${capital} in USDC plus about $5 for gas, and keep its seed phrase offline.`,
      cost: 'about $5 of gas to fund it',
      time: '10 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${capital >= 150 ? 6 : 3} of gas`,
      time: '10 minutes',
    },
    {
      text: weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: holdText,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw from ${p.name}, re-check its TVL and its ${fmtTvl(v.implied)} implied value at rank ${rank} on ${chain}, check whether ${p.name} publishes a points or rewards page, and claim only from a link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every ${p.name} transaction in a farm log, noting the entry TVL of ${fmtTvl(p.tvl_usd)} across ${p.chains.length} chain${p.chains.length === 1 ? '' : 's'} (${chainListShort(p.chains)}); unwind in two steps and check slippage first.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    category_n: row.model.category_n,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
  };
}

/** A number rounded to four decimals, so the validation output is stable text. */
function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/** The rank each slug holds in a scored list (1-based, in the list's own order). */
function rankMap(scored: { slug: string; implied: number }[]): Map<string, number> {
  return new Map(scored.map((s, i) => [s.slug, i + 1] as [string, number]));
}

/** The implied value each slug holds in a scored list. */
function impliedMap(scored: { slug: string; implied: number }[]): Map<string, number> {
  return new Map(scored.map((s) => [s.slug, s.implied] as [string, number]));
}

/** Spearman's rank correlation between two rank maps, over the slugs they share. */
function spearmanRanks(a: Map<string, number>, b: Map<string, number>): number {
  const keys = [...a.keys()].filter((k) => b.has(k));
  const n = keys.length;
  if (n < 2) return 1;
  const meanA = keys.reduce((s, k) => s + a.get(k)!, 0) / n;
  const meanB = keys.reduce((s, k) => s + b.get(k)!, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (const k of keys) {
    const x = a.get(k)! - meanA;
    const y = b.get(k)! - meanB;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return 1;
  return num / Math.sqrt(da * db);
}

/** How one re-ranking differs from the full ranking: correlation, rank shifts, top-10, value moves. */
function rankComparison(
  fullRank: Map<string, number>,
  fullImplied: Map<string, number>,
  otherRank: Map<string, number>,
  otherImplied: Map<string, number>,
): { spearman: number; mean_abs_rank_shift: number; max_abs_rank_shift: number; top10_overlap: number; mean_abs_pct_implied_change: number } {
  const keys = [...fullRank.keys()].filter((k) => otherRank.has(k));
  let shiftSum = 0;
  let maxShift = 0;
  let pctSum = 0;
  for (const k of keys) {
    const shift = Math.abs(fullRank.get(k)! - otherRank.get(k)!);
    shiftSum += shift;
    maxShift = Math.max(maxShift, shift);
    const base = fullImplied.get(k)!;
    pctSum += base > 0 ? (Math.abs(otherImplied.get(k)! - base) / base) * 100 : 0;
  }
  const topFull = new Set([...fullRank.entries()].filter(([, r]) => r <= 10).map(([k]) => k));
  const topOther = new Set([...otherRank.entries()].filter(([, r]) => r <= 10).map(([k]) => k));
  let overlap = 0;
  for (const k of topFull) if (topOther.has(k)) overlap++;
  return {
    spearman: spearmanRanks(fullRank, otherRank),
    mean_abs_rank_shift: keys.length === 0 ? 0 : shiftSum / keys.length,
    max_abs_rank_shift: maxShift,
    top10_overlap: overlap,
    mean_abs_pct_implied_change: keys.length === 0 ? 0 : pctSum / keys.length,
  };
}

/** One leave-one-out sweep aggregated: many re-rankings against the full ranking. */
function aggregateLopo(
  runs: { spearman: number; mean_abs_rank_shift: number; max_abs_rank_shift: number; mean_abs_pct_implied_change: number; removed: string }[],
): LopoSummary {
  let worst = runs[0]!;
  for (const r of runs) {
    if (r.spearman < worst.spearman || (r.spearman === worst.spearman && r.removed < worst.removed)) worst = r;
  }
  return {
    n_removed: runs.length,
    mean_spearman: round4(runs.reduce((s, r) => s + r.spearman, 0) / runs.length),
    min_spearman: round4(Math.min(...runs.map((r) => r.spearman))),
    mean_abs_rank_shift: round4(runs.reduce((s, r) => s + r.mean_abs_rank_shift, 0) / runs.length),
    max_abs_rank_shift: Math.max(...runs.map((r) => r.max_abs_rank_shift)),
    mean_abs_pct_implied_change: round4(runs.reduce((s, r) => s + r.mean_abs_pct_implied_change, 0) / runs.length),
    worst_removed_slug: worst.removed,
    worst_spearman: round4(worst.spearman),
  };
}

/**
 * Leave-one-out validation of the model, from the snapshot and the board it scored.
 *
 * Leave-one-feature-out: each of the four multipliers is neutralised in turn (category to the
 * global median, growth/maturity/breadth to 1.0), the board is re-scored and re-ranked, and the
 * new ranking is compared with the full one. Leave-one-protocol-out: the board is re-ranked
 * once per board row removed. Leave-one-calibrator-out: the category calibration is rebuilt
 * once per live-token protocol removed, and the board is re-scored and re-ranked each time.
 * The board-row sweep is near-trivial by construction — a board row's implied value depends
 * only on its own figures and the live-token calibration, never on another board row, so
 * removing one only compresses the ranks below it — and it is reported as such, not dressed
 * up: the calibrator sweep is the one that can actually move implied values.
 */
export function validateModel(snapshot: Snapshot, board: BoardRow[]): Validation {
  const calibration = calibrate(snapshot);
  const index = bySlug(snapshot.protocols);
  const boardProtocols = board.map((r) => index.get(r.slug)!).filter((p): p is SnapshotProtocol => p !== undefined);
  const full = scoreProtocols(boardProtocols, snapshot.as_of, calibration);
  const fullRank = rankMap(full);
  const fullImplied = impliedMap(full);

  const featureLabels: Record<DroppedFeature, string> = {
    category: 'category multiple replaced by the global median',
    growth: 'growth multiplier set to 1.0',
    maturity: 'maturity multiplier set to 1.0',
    breadth: 'breadth multiplier set to 1.0',
  };
  const features: FeatureAblation[] = (['category', 'growth', 'maturity', 'breadth'] as DroppedFeature[]).map((feature) => {
    const ablated = scoreProtocols(boardProtocols, snapshot.as_of, calibration, MODEL, feature);
    const cmp = rankComparison(fullRank, fullImplied, rankMap(ablated), impliedMap(ablated));
    return {
      feature,
      dropped: featureLabels[feature],
      spearman: round4(cmp.spearman),
      mean_abs_rank_shift: round4(cmp.mean_abs_rank_shift),
      max_abs_rank_shift: cmp.max_abs_rank_shift,
      top10_overlap: cmp.top10_overlap,
      mean_abs_pct_implied_change: round4(cmp.mean_abs_pct_implied_change),
    };
  });
  let mostInfluential = features[0]!;
  for (const f of features) if (f.spearman < mostInfluential.spearman) mostInfluential = f;

  const lopoBoard = aggregateLopo(
    boardProtocols.map((removed) => {
      const rest = boardProtocols.filter((p) => p.slug !== removed.slug);
      const rescored = scoreProtocols(rest, snapshot.as_of, calibration);
      const cmp = rankComparison(fullRank, fullImplied, rankMap(rescored), impliedMap(rescored));
      return { ...cmp, removed: removed.slug };
    }),
  );
  const live = calibrators(snapshot);
  const lopoCalibrator = aggregateLopo(
    live.map((removed) => {
      const recalibrated = calibrate(snapshot, removed.slug);
      const rescored = scoreProtocols(boardProtocols, snapshot.as_of, recalibrated);
      const cmp = rankComparison(fullRank, fullImplied, rankMap(rescored), impliedMap(rescored));
      return { ...cmp, removed: removed.slug };
    }),
  );

  return {
    method: validationMethod(board.length, live.length),
    model_version: MODEL_VERSION,
    n_rows: board.length,
    features,
    most_influential_feature: mostInfluential.feature,
    leave_one_protocol_out_board: lopoBoard,
    leave_one_calibrator_out: lopoCalibrator,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData; validation: Validation } {
  const calibration = calibrate(snapshot);
  const board = buildBoard(snapshot, model);
  const validation = validateModel(snapshot, board);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    calibration,
    validation,
    watchlist: snapshot.watchlist,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar, validation };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
