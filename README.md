# Token Radar

[![make.fun](https://img.shields.io/badge/make.fun-token--radar--01-blue)](https://make.fun/bounty/token-radar-01)
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

The farm plan is derived the same way, from each protocol's category, chains, TVL and age:
seven steps, each with what it costs and how long it takes.

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
