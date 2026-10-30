# MemeRadar 5.2 — Crypto Signal Intelligence

A futuristic, read-only multi-chain token discovery and research terminal. MemeRadar helps users triage emerging token pairs, understand market activity, monitor watchlists, compare assets, keep a research journal, track manual positions, and request third-party contract screening where supported.

**MemeRadar is not a wallet, exchange, trading bot, investment adviser, or guarantee of token safety.** It never asks for seed phrases or private keys, never signs transactions, and never places trades.

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm start
```

Open <http://localhost:3000>. No `npm install` is needed; the server uses Node.js built-in modules.

To use a different port:

```bash
PORT=3001 npm start
```

On Windows PowerShell:

```powershell
$env:PORT=3001
npm start
```

## Product modules

- **Command Center:** radar visualization, feed status, activity leaders, attention-flag snapshot, latest finds.
- **Discover:** DexScreener latest token profiles, contract/name search, promoted labels, filters, sorting, market activity index, pair inspection and CSV export.
- **Trending:** ranks the currently loaded snapshot by transaction activity.
- **Watchlist:** browser-local saved assets, threshold alerts between refreshes, optional browser notifications, alert history and export.
- **Portfolio Watch:** manually entered positions with estimated mark-to-market value and unrealized P/L based on available pair prices. Optional wallet connection is separate and read-only.
- **Compare:** side-by-side comparison for up to three assets.
- **Research Journal:** local notes for thesis, observations and invalidation; Markdown export.
- **Security Lab:** requests GoPlus Token Security data for supported EVM networks and Solana, then displays each returned check as clear, risk, or unknown. Missing fields remain unknown.
- **Radar Academy:** short research lessons with local-only XP; XP has no monetary value.
- **PWA shell:** installable manifest and cached static app shell; API market data remains online-only.

## Data sources and security setup

### Market data — DexScreener

MemeRadar uses public DexScreener endpoints for latest token profiles, pair snapshots, and token search. Provider coverage, latency, availability and rate limits are outside MemeRadar's control. The latest-profiles endpoint is not a complete index of every newly created token or every DEX pair.

### Contract screening — GoPlus (optional credentials)

The Security Lab calls the GoPlus Token Security API for supported chains. Coverage and fields differ by chain and token. GoPlus may require an access token. If a scan fails, MemeRadar displays **Scan unavailable — not a clean result**. It does not turn provider errors into green checks.

To configure credentials:

1. Obtain GoPlus developer credentials and an access token from the official [GoPlus documentation](https://docs.gopluslabs.io/).
2. Set `GOPLUS_ACCESS_TOKEN` in the environment where the Node server runs. Do not put credentials in `public/`, browser JavaScript, screenshots, or a public repository.
3. Restart the server and try a supported contract again.

Example PowerShell session:

```powershell
$env:GOPLUS_ACCESS_TOKEN="YOUR_ACCESS_TOKEN"
npm start
```

The token is read only by the backend. MemeRadar does not embed it into the browser. If you do not configure it, the security scan may return an authorization error; market discovery still works independently.

Supported EVM chain identifiers configured in this build include Ethereum, BNB Chain, Polygon, Arbitrum, Optimism, Base, Avalanche, Fantom, Linea, zkSync, Mantle, Blast, Mode, Celo, Gnosis, opBNB and Scroll. GoPlus coverage can vary; a configured chain identifier does not guarantee that every token is supported. Solana screening is requested through GoPlus's Solana endpoint (Beta).

## What the Radar Activity Index means

The 0–100 Radar Activity Index is an explainable market-observation heuristic, not a security score, audit, buy signal, or investment recommendation. It uses these weighted components:

- Liquidity depth: 25 points
- Transaction activity: 20 points
- 24-hour volume: 20 points
- Buy/sell balance: 15 points
- Pair history: 10 points
- Volume/liquidity relationship: 10 points

Missing provider fields receive no points. Attention flags can include thin liquidity, sell pressure, unusually high volume relative to liquidity, sharp price declines, very new pairs, or missing fields. These flags are prompts for investigation, not proof of fraud. Absence of flags does not mean a token is safe. Promoted tokens are labelled because paid boosts can affect visibility.

## Local data and privacy

Watchlist entries, comparison selections, manual positions, alert history, research notes, and Academy progress are stored in the browser's `localStorage` on the current device/browser profile. They are not synced to an account or server. Clearing site data can remove them. Do not use the journal to store secrets.

Browser notifications are optional and require the browser's permission. Price alerts compare snapshots only while this page is open and refreshes are running; they are not exchange-grade real-time alerts. Portfolio values are rough estimates based on the best available public pair snapshot and do not include fees, slippage, taxes, execution venue differences, or realized P/L.

## API routes

- `GET /api/health` — service and provider status.
- `GET /api/latest` — latest profiles enriched with best available pair snapshots.
- `GET /api/search?q=...` — DexScreener pair search.
- `GET /api/token/:chain/:address` — pair snapshots for a token address.
- `GET /api/security/:chain/:address` — GoPlus security report where available.

The server includes request rate limiting, short-lived in-memory caching, stale-cache fallback for cached upstream data, request timeouts, response security headers, path traversal protection, and input validation. For public production hosting, add HTTPS termination, persistent rate limiting, monitoring, structured logs, secret management, backups, privacy/legal review, and provider-specific usage controls.

## Important limitations

- No full smart-contract audit, bytecode review, transaction simulation, or guarantee of sellability.
- No guaranteed holder graph, deployer history, whale tracking, liquidity-lock verification, or social sentiment feed in this build.
- The Security Lab only displays the third-party fields actually returned. Unknown is not equivalent to safe.
- Market data may be stale, incomplete, manipulated, or unavailable.
- No private-key handling, no signatures, no token approvals, and no trade execution.


## Wallet connection (read-only)

Clicking Connect Wallet directly calls the real wallet provider exposed by the browser (EIP-1193 for EVM or the injected Solana provider). It requests account access from the installed/unlocked wallet; MemeRadar never creates a virtual or demo wallet. If no provider is injected, the app explains that a wallet extension or wallet dApp browser is required. The connection only reads the public account address and network; it does not request signatures, token approvals, seed phrases or transactions. WalletConnect QR pairing is not configured in this build. Clicking the connected address clears the local UI session; revoke site permissions in the wallet to fully revoke browser access.

## Deploy free with GitHub + Cloudflare Pages

This repository includes a Cloudflare Pages Functions adapter for the existing API. The original `server.js` remains available for local Node.js use; the Cloudflare deployment serves the same `public/` frontend and routes `/api/*` to `functions/api/[[path]].js`.

### GitHub-connected deployment

1. Create a GitHub repository and upload the **contents** of this project folder (so `public/`, `functions/`, `package.json`, and `wrangler.toml` are at the repository root).
2. In Cloudflare, open **Workers & Pages → Create application → Pages → Connect to Git** and select the repository.
3. Set the production branch to `main` (or whichever branch you use).
4. Set **Build command** to `exit 0` and **Build output directory** to `public`. Leave the root directory at `/`.
5. Deploy. Cloudflare will publish the static app and its Pages Function routes.
6. Optional: in the Pages project, add `GOPLUS_ACCESS_TOKEN` as an environment variable/secret if you have a GoPlus token. Never commit the real token to GitHub.

Every push to the production branch triggers a new deployment. Other branches can be used for preview deployments.

### Free-plan notes

- Static asset delivery and Pages Functions have different usage limits. Check the current Cloudflare Workers/Pages plan limits before a public launch.
- The API adapter uses isolate-local short-lived caching and best-effort per-isolate rate limiting; this is not a globally shared rate limiter or persistent cache.
- Watchlists, notes, manual positions, alerts, and Academy progress remain in each visitor's browser `localStorage`; they do not sync between devices.
- External DexScreener and GoPlus availability/rate limits still apply. The free plan is not an unlimited guarantee.
- The original Node server is retained for local development and other Node hosts; Cloudflare runs the Pages Function adapter instead.

Run `npm test` locally before pushing changes. It checks both the original Node server and the Cloudflare API adapter.
