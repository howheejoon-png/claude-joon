# Mahjong Tally

**Every point accounted for.**

Mahjong Tally is an offline-first Progressive Web App for four friends playing Singapore Mahjong. Record each hand in a few taps. It calculates every payment from *your* house rules and keeps a double-entry ledger in integer cents. At the end of the night it tells everyone exactly who pays whom.

- Installable on iPhone and Android, works fully offline after the first load
- No account, no backend: games are stored only on the device (IndexedDB)
- Every balance is derived from the ledger and verified to net to exactly $0.00

---

## Features

| Area | What you get |
| --- | --- |
| **Game setup** | Four players (default *Player A–D*), East/South/West/North seats, optional starting dealer, per-game rules |
| **House rules** | Editable payout table for every tai from min to max (discarder / others / self-draw), discard liability, 包 liable player, payout caps, rounding, dealer bonuses, and configurable special-hand, flower/animal and penalty rules. Must be confirmed before the first game; saved for reuse |
| **Record round** | Winner → 自摸 Self Draw / 放炮 Discard Win → tai → optional conditions → payment preview with **Balance verification: PASSED** → Confirm. Drawn rounds (流局) are supported |
| **Live scoreboard** | 2×2 player cards (net, wins, losses, seat, dealer), total balance, current round, duration, biggest win, recent rounds, persistent **All Balances Tallied** indicator |
| **History** | Expandable per-round breakdown (per-player amounts, itemised transactions with calculation steps, rules used). Undo last, edit, delete, restore from “Recently deleted” |
| **Settlement** | Totals, net balances, verification, and a payment plan that is guaranteed to use the fewest transfers. Copy, share via the share sheet or WhatsApp (never sent automatically), export `.txt` + `.csv` |
| **Live sharing** | One link (or QR code) for the whole table. Each phone opens it, taps **which player they are**, and sees their own balance first, with what they'd pay or receive. Anyone can record, edit or undo rounds from their own phone. Every phone updates within a few seconds, keeps working offline, and catches up when back online. History shows who recorded each round, and the app warns if two phones enter the same hand. |
| **Settings** | Theme (auto/dark/light), players & seats, current-game rules, default house rules, explicit **re-score past rounds** with preview, reset, saved games, JSON backup export/import |

---

## How the money is kept correct

Correctness was the first priority. The scoring and accounting code is pure TypeScript in `src/engine/`, with no React, storage, clock or randomness. All of it is unit-tested.

1. **Integer cents everywhere.** Money is a `Cents` integer. Parsing (`parseMoney`) and formatting (`formatCents`) use string and integer arithmetic only. Floating-point currency never appears.
2. **Double-entry ledger.** Each payment is a `LedgerTransaction` with a payer and a receiver. It produces a matching debit (−) and credit (+) posting (`toPostings`).
3. **`validateLedger(transactions)`** checks for:
   - a missing, unknown, or self-paying payer or receiver;
   - non-integer, zero or negative amounts;
   - duplicate IDs and unknown rounds;
   - unmatched postings;
   - any round or the whole ledger not netting to exactly 0.

   It returns structured issues that name the offending transaction or round.
4. **Single source of truth.** Balances are never stored. They are always recomputed from the transactions of non-deleted rounds, so editing, deleting or restoring any round recomputes every total deterministically.
5. **Commit guard.** A round, edit, delete or restore is rejected if the resulting ledger would fail validation. Nothing is "corrected" silently.
6. **Audit.** Each round stores its inputs and a snapshot of the rules and seating used. The health check re-scores every round from those and compares the result with the saved transactions. Any tampering shows **Balance Error Detected**.
7. **Rules snapshots.** Changing rules mid-game only affects *new* rounds. Re-scoring history is a separate, explicit action that shows a before/after preview first.
8. **Settlement.** It finds the largest partition of players into zero-sum groups using an exact bitmask DP, then settles each group greedily. That gives the proven minimum number of transfers (non-zero players minus groups). No player both pays and receives, so there are no circular transfers.

### Scoring model (and assumptions)

Singapore groups pay differently, so **nothing about payouts is hard-coded**. The bundled $0.30 / $0.60 doubling table is clearly labelled as an *example* and must be confirmed or edited before the first game.

| Rule | Behaviour |
| --- | --- |
| Self-draw | All three opponents pay the table's *Self-draw each* amount. If 包 is enabled and a liable player is chosen, that player pays every share alone. |
| Discard win | *Discarder only*: the discarder pays the *Discarder* amount. *Shared*: the discarder pays *Discarder* and the other two each pay *Others each*. For "shooter pays for all", enter the full amount in the Discarder column. |
| Tai | Buttons run from min to max tai. Extra tai from dealer or special-hand rules are capped at max tai. |
| Order of calculation | Table amount → multipliers → per-payer extras (winner bonus, dealer bonus/surcharge) → rounding → cap |
| Rounding | *Exact* (the default) never rounds. A fractional-cent result is rejected with an explanation. Nearest/up/down round **each payment** to the chosen increment. Payer and receiver see the same amount, so totals still balance. |
| Caps | Apply to hand payments only. *Per payer* caps each payment. *Per hand* caps the winner's total and splits it between payers by largest remainder, so the parts sum exactly to the cap. Because the cap runs after rounding, a capped payment may not land on the rounding increment. |
| Kongs, flowers & animals | Recorded in their own step of *Record round* and paid straight away, whoever wins, including in drawn rounds. Default set (amounts scale with the base unit; shown at a $3 / $6 game): **kong from a discard** — the discarder pays $6; **self-drawn kong** — everyone pays $2; **own flower** — everyone pays $2; **someone else's flower** — that flower's owner pays the drawer $2; **own spirit animal** — everyone pays $2; **cat & mouse pair** and **chicken & centipede pair** — everyone pays $2 (other animal combinations pay nothing). Every amount is editable, and rules saved before this set existed are upgraded with one tap (**Update kong, flower & animal payouts**). Never capped or rounded. |
| Manual adjustments | One-off transfers (payer, receiver, amount, note) for anything else agreed at the table. |
| Per-payer extras | Winner bonus and dealer bonus apply to every *paying* player, including one whose table amount is $0 in shared mode. |
| 包 liability | The liable player pays every share exactly as calculated, including another player's dealer surcharge. |
| Dealer suggestion | The next dealer is pre-selected assuming the dealer keeps the deal on a dealer win or a draw, and passes E→S→W→N otherwise. It is only a default and has no financial effect unless dealer bonuses are on. |

---

## Project structure

```
src/
  models/types.ts        Strict domain types (Player, GameSession, ScoringConfiguration,
                         Round, WinningMethod, LedgerTransaction, Balance, SettlementTransfer …)
  engine/
    scoring.ts           RoundInput + rules → transfers (pure)
    ledger.ts            postings, validateLedger, validatePostings, computeBalances
    settlement.ts        minimum-transfer settlement plan
    validation.ts        rules / players / round-input validation with actionable messages
    game.ts              pure game operations: record, edit, delete, restore, undo, rescore …
    audit.ts             game health check (ledger + re-computation audit)
  config/defaults.ts     example rules (labelled), table generator, seat labels
  sync/
    ops.ts               serialisable game operations + deterministic reducer
    share.ts             push / pull / replay of a shared game's log
    remote.ts            Supabase RPC transport (+ in-memory transport for tests)
  storage/
    db.ts                IndexedDB (idb) with versioned schema migrations, backup import/export
    schema.ts            document migrations, backup parsing & verification
  app/                   store (state + autosave), hash router, App shell
  components/            UI primitives, sheets/dialogs/toasts, rules editor, domain widgets
  pages/                 Landing, NewGame, Rules, Dashboard, RecordRound, History, Settlement, Settings, Games
  utils/                 money (integer cents), ids, time, text/CSV reports
  tests/                 Vitest unit, property-based and storage tests
e2e/                     Playwright end-to-end tests (production build, incl. offline)
scripts/                 icon generator
```

---

## Development

Requirements: Node.js 20+ (developed on Node 22).

```bash
cd mahjong-tally
npm install
npm run dev          # http://localhost:5173 (service worker disabled in dev)
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run typecheck` | TypeScript strict type check |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit + property-based tests (172 tests) |
| `npm run test:e2e` | Playwright end-to-end tests against the production build |
| `npm run build` | Type check + production build into `dist/` (with service worker) |
| `npm run preview` | Serve the production build on http://localhost:4173 |
| `npm run check` | typecheck + lint + unit tests + build |
| `npm run icons` | Regenerate PWA icons in `public/` from `scripts/icon-svg.mjs` |

### Tests

- **Unit tests** (`src/tests/`) cover:
  - self-draw and discard in both liability modes, every tai value, and the max-tai cap;
  - dealer bonuses, custom tables, rounding modes and exact-mode rejection;
  - per-payer and per-hand caps, 包, instant bonuses and penalties, manual adjustments, and draws;
  - undo, edit, delete, restore, reset and rescore;
  - zero balances and fractional-dollar amounts as cents;
  - session restoration through IndexedDB (`fake-indexeddb`), backup round trips, and migrations;
  - invalid configurations, and 14 kinds of ledger corruption.
- **Property-based tests** (`fast-check`) run random sequences of record/edit/delete/restore/undo/rescore operations over random valid house rules. After every operation they assert `sum(balances) === 0`, `validateLedger(...).ok` and a healthy audit. They also check that the settlement plan clears every balance using exactly the brute-force-verified minimum number of transfers.
- **End-to-end tests** (`e2e/`) drive the built app in a phone-sized Chromium:
  - house-rule confirmation and game creation;
  - self-draw, discard and draw rounds with exact amounts;
  - edit, undo, restore and delete;
  - settlement;
  - persistence across reload and new tabs;
  - **offline use** after the first load;
  - the web manifest.

  Playwright is pinned to the version matching the locally installed Chromium. On another machine, run `npx playwright install chromium` first.

---

## Building & deployment

```bash
npm run build
```

`dist/` is a fully static site. Host it on any static host over **HTTPS**, which service workers and installation require. Netlify, Vercel, Cloudflare Pages, GitHub Pages and S3/CloudFront all work.

**GitHub Pages (set up in this repo):** `.github/workflows/deploy-mahjong-tally.yml` runs the unit tests, builds the app and publishes it to **https://howheejoon-png.github.io/claude-joon/** on every push to `master` that changes `mahjong-tally/`. One-time setup: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. You can also run it manually from the **Actions** tab (*Deploy Mahjong Tally → Run workflow*).

- The build uses relative paths (`base: './'`) and hash routing, so it works at a domain root or in a sub-folder (e.g. GitHub Pages project sites) without server rewrites.
- The service worker precaches the app shell and every built asset. No third-party requests are made or cached, and no fonts are fetched.
- When a new version is deployed, open apps show an **Update** prompt instead of reloading mid-game.

---

## Installing on a phone

**iPhone / iPad (Safari):** open the site → tap **Share** → **Add to Home Screen** → **Add**.

**Android (Chrome):** open the site → tap **⋮** → **Install app** (or **Add to Home screen**). Chrome may also offer an install banner.

The installed app opens full-screen without browser chrome, respects the iPhone notch and home-indicator safe areas, and works offline. The same steps are available in the app under *Install app* (start screen) and *Settings → Install on your phone*.

---

## Live sharing

Every change to a game is a small operation (`src/sync/ops.ts`): record, edit, delete, restore, rules change, and so on. A local game just applies it. A shared game also appends it to an ordered, append-only log on the server. Every phone replays the same log through the same pure scoring engine, so every phone computes the **identical** ledger. There is no merging of balances and no "last write wins".

- **Server:** the Supabase project `yxmzafodsreliuwpjoau` (free plan, Singapore). Two tables, `mt_games` and `mt_ops`, are not readable directly. Phones use only two functions: `mt_append_op`, which is idempotent per operation id so retries never double-count, and `mt_get_ops`. The schema is in `supabase/migrations/`.
- **Access:** the game code in the link is a random 144-bit secret. There are no accounts. The publishable API key in `src/sync/remote.ts` is public by design, and you can override it with `VITE_SYNC_URL` / `VITE_SYNC_KEY` at build time.
- **Sync:** `src/sync/share.ts` pushes this phone's queued operations, pulls new ones every 3 seconds while the app is open, and replays them. Changes made offline stay queued on the phone. If another phone's change makes yours impossible (for example, you edited a round someone else deleted), every phone skips it the same way and you get a message.
- **Free-plan note:** Supabase pauses free projects after about a week with no activity. Scoring keeps working on each phone and changes stay queued. Sharing resumes once the project is restored in the Supabase dashboard.
- **Tests:** `src/tests/sync.test.ts` includes a randomized test in which three phones record, edit and delete while going offline, and must always converge to one exact, balanced ledger. `e2e/sharing.spec.ts` drives two real browsers sharing one game. `LIVE_SYNC=1 npx vitest run src/tests/live.test.ts` checks the real server.

## Data & privacy

- Every game is saved in the browser's IndexedDB on the device after every change. The app also asks the browser for persistent storage.
- Games you **don't** share never leave the phone.
- Games you **share live** are also stored in the app's own Supabase database (see *Live sharing* below), so the other phones can follow them and a phone that lost its data gets the game back by opening the link again. Only someone with the link can read or change a shared game.
- WhatsApp sharing only opens your share sheet or a `wa.me` link with the text pre-filled. You review and send it yourself.
- Clearing site data deletes your games. Use **Settings → Export backup** regularly. Imports are fully verified (structure, migrations, ledger validation and audit) before anything is written, and corrupted backups are rejected with an explanation.
