# Token Radar

[![make.fun](https://img.shields.io/badge/make.fun-token--radar--01-blue)](https://make.fun/bounty/token-radar-01)
[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Ipan8/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Ipan8/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![Node](https://img.shields.io/badge/node-%3E%3D22.18-green)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A token launch radar: it reads a sealed DefiLlama snapshot of 758 protocols, ranks the
pre-token ones by an implied value, and hands in a web dashboard that shows the board, a
detail view for each protocol, and the steps to farm it.

## What it does

`main.ts` (Node 22, standard library only) reads `/input/snapshot.json`, scores every
pre-token protocol, and writes:

- `board.json` — 226 ranked rows (the 40-protocol watchlist, plus 186 pre-token protocols
  below the watchlist floor found by TVL), each with its rank, implied value and a 7-step
  farm plan.
- `data.js` + `dashboard/` — the static page (no network): sortable, filterable board,
  per-protocol detail drawer, a separate Live token view, and the model panel.
- `screenshots/` — three renders of the page: the board, a protocol detail, a filtered view.
  The repository stores them base64-encoded (one line each, `*.png.b64`) because the
  submission channel carries text only; `main.ts` decodes them back to real PNGs when it
  writes `/output/screenshots`, byte for byte the renders shown here.
- `dossier.json` — what the judge reads, built by `vendor/makefun-board.ts`.

## The value model (radar-2)

Implied value follows only from the snapshot's own figures. No protocol name is
special-cased; the same function scores every row:

```
implied = round( tvl_usd
  x categoryMultiple   (median mcap/TVL of live tokens in the category,
                        shrunk halfway to the global median, clamped to [0.10, 0.60])
  x (1 + clamp(change_7d, -40, +60) / 100 x 0.6)
  x (0.7 + min(age_days, 1095) / 1095 x 0.3)
  x (1 + min(chains - 1, 9) x 0.02) )
```

The category multiple is the market pricing the same kind of business: it is read off the
live-token protocols in this snapshot, never guessed. Exchange tokens are left out of the
calibration, because an exchange token is valued on the exchange, not per dollar of TVL.
Live-token protocols are set aside at their market cap — the board never ranks them — and
their mcap/TVL ratios are what calibrate the pre-token values.

The farm plan is derived the same way, from each protocol's category, chains, TVL, 7-day
change, listing date, age, implied value and rank: seven steps, each with what it costs and
how long it takes. The main and second actions follow the protocol's category (a named
branch for every category on the board); the weekly step follows its own 7-day TVL change;
the hold follows its age and listing date; the claim step re-checks its own implied value
and rank; the log step records its entry TVL and its chains.

## Leave-one-out validation

`validateModel` in `lib/model.ts` re-scores the board four times with one model factor
neutralised at a time (category multiple to the global median; growth, maturity and breadth
to 1.0), re-ranks it once per board row removed (226 runs), and re-scores it once per
live-token calibrator removed (119 runs). The numbers land in `board.json`'s top-level
`validation` field and in `data.js` (`DATA.validation`, with a `method` string for the
dashboard strip): Spearman rank correlation against the full ranking, mean and maximum
absolute rank shift, top-10 overlap, and mean absolute percentage change in implied value.
The board-row sweep is near-trivial by construction — a row's implied value depends only
on its own figures and the live-token calibration, so removing one only compresses the ranks
below it — and is reported as such; the calibrator sweep is the one that can move values.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

Then open `out/dashboard/index.html` in a browser (it reads `out/data.js`, no network).

## Check it

```sh
node cli/makefun.mjs check --kit . --repo .
```

## License

MIT — see [LICENSE](LICENSE).
