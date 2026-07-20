# AGENTS.md

## Project

Easy-Crawler — a Node.js/TypeScript marketplace scraper for Wildberries (WB) and OZON. Uses Crawlee (`PlaywrightCrawler`) + Cheerio for HTML parsing. Crawls seller catalog pages to collect product links, then visits each product page to extract data. Runs via cron on an Express server.

## Commands

```bash
npm run build        # npx tsc → dist/
npm start            # node dist/server.js (production)
npm run dev          # nodemon + ts-node, ignores public/* and storage/*
npm run lint         # eslint on .ts,.js
npm run lintfix      # eslint --fix
npx tsc --noEmit     # type-check only (no built-in script)
npx playwright install --with-deps  # required before first run
```

**No test suite exists.** There is no `preview` script despite README mentioning it.

## Key files (not obvious from filenames)

- `src/server.ts` — Express entry point; conditionally starts cron jobs on boot (only if `*_SELLER_URL` env var is set)
- `src/lib/cron.ts` — Two cron tasks (`wbCrawlerTask`, `ozonCrawlerTask`); created with `scheduled: false` so `.start()` must be called explicitly (done in `server.ts`). Handlers skip execution early if the corresponding `*_SELLER_URL` is empty.
- `src/lib/helpers.ts` — Contains `getWBProductData` (uses WB card.json API + Cheerio for price/images), `getOzonProductData` (Cheerio-based), `buildCardJsonUrl`, and `createRequestQueueUrlArray`
- `src/lib/wildberries/wb-crawler.ts` — Infinite-scrolls the seller catalog page, collects product card links + image URLs (for API construction) via Cheerio, pushes to Crawlee Dataset
- `src/lib/wildberries/wb-files.ts` — Re-reads the Dataset JSON, crawls each product page, fetches WB card.json API for structured data, saves `.html` + `.json` to `public/`
- `src/lib/ozon/ozon-crawler.ts` — Same pattern as WB but for OZON
- `src/lib/ozon/ozon-files.ts` — Same pattern as WB files
- `types/index.d.ts` — `Data`, `Product`, `Image`, `Param`, `ParamBlock` types
- `types/puppeteer-extra-plugin-stealth.d.ts` — Custom ambient declaration for the stealth plugin (no `@types/` package exists)

## Architecture: two-phase crawl

1. **Catalog crawl** (e.g. `WBCrawler`, `OZONCrawler`): OZON uses the `entrypoint-api.bx/page/json/v2` API with cookie-authenticated `page.evaluate` fetch calls to paginate through all seller products. Falls back to browser-based infinite scroll with overlay dismissal if the API fails. WB uses infinite scroll with stability detection. Both dump debug HTML + screenshots on anti-bot detection. **⚠️ OZON catalog not production-ready**: the API integration returns 403 from both `page.request` and browser `fetch()` — OZON's anti-bot measures block direct API calls. Only the SSR fallback works (~8 products per crawl). Full catalog crawling requires intercepting the browser service worker's API responses via `page.on('response')`, which is not yet implemented. Product crawl is similarly affected — product pages trigger anti-bot challenges without valid browser cookies.
2. **Product crawl** (e.g. `WBFiles`, `OZONFiles`): reads the Dataset JSON, for each product fetches structured data (WB: card.json API + stock API; OZON: Cheerio-only), writes `.html` + `.json` per product to `src/public/`.

Crawled output lands in `src/public/` (gitignored). The Dataset JSON is written to `src/public/data/wb-result.json` and `src/public/data/ozon-result.json`.

## Environment variables

Loaded from `.env` (gitignored). Required vars:

| Variable                | Purpose                                                      | Default        |
| ----------------------- | ------------------------------------------------------------ | -------------- |
| `PORT`                  | Express listen port                                          | `3000`         |
| `DEBUG`                 | Enables verbose console output for both crawlers             | `false`        |
| `WB_SELLER_URL`         | WB seller catalog start URL (empty = WB crawler skipped)     | (none)         |
| `WB_CRAWLER_CRON`       | Cron schedule for WB crawl                                   | `0 */12 * * *` |
| `OZON_SELLER_URL`       | OZON seller catalog start URL (empty = OZON crawler skipped) | (none)         |
| `OZON_CRAWLER_CRON`     | Cron schedule for OZON crawl                                 | `0 */12 * * *` |
| `CRAWLEE_MEMORY_MBYTES` | Crawlee memory pool (MB)                                     | `2048`         |

## Gotchas

- **WB uses stealth plugin with Chromium** (`playwright-extra` + `puppeteer-extra-plugin-stealth`), OZON now uses the same. WB viewport `1920x1080`, OZON `1700x1300`.
- **Different viewport sizes**: WB `1920x1080`, OZON `1700x1300`.
- **Both crawlers have anti-bot detection**: wait 60s for a key selector (`a.product-card__link.j-card-link` for WB, `a[href*="/product/"]` for OZON). If absent, dump debug HTML + screenshot to `storage/debug/` and push empty links.
- **Both use infinite-scroll stability detection**: scroll to bottom, wait 2s, count cards; stop when card count is stable for 3 iterations (max 50). WB uses `scrollTo`, OZON uses `scrollTo` + "Show more" button click fallback.
- **Both are single-page infinite-scroll**: `maxRequestsPerCrawl: 1`, `maxConcurrency: 1` for catalog crawl. Product crawl: `maxConcurrency: 5`.
- **No `cheerio` in dependencies** — it's a transitive dependency of Crawlee. If using `import { load } from 'cheerio'`, make sure Crawlee is installed.
- **Output files** are written to `src/public/` which is gitignored. The `data/` subdirectory is not excluded by `.gitignore` but lives under `public/` so it's covered.
- **The Dataset is dropped before each crawl** (`await dataset.drop()`) to avoid appending to stale data.
- **WBFiles has a `SAFEGUARD_MAX_REQUESTS = 10`** — max requests is `links.length + 10` to tolerate retries.
- **Crawlers are skipped when their URL is empty**: both `server.ts` (won't `.start()` the cron timer) and `cron.ts` (handler returns early) guard against empty `*_SELLER_URL`. To disable a crawler, leave its URL blank in `.env`.
- **WB product data comes from `card.json` API**: `getWBProductData()` reads structured data from `https://basket-{n}.wbbasket.ru/vol{vol}/part{part}/{nmId}/info/ru/card.json`. The API URL is derived from `data-src-pb` image URLs collected during catalog crawl. Cheerio is still used for price and image extraction as fallback.
- **`SellerPageLinks.links` is now `CardData[]`** (with `href`, `nmId`, `imagePbUrl` fields), not `string[]`. OZON crawler extracts `nmId` from the numeric product ID in the URL (e.g. `/product/slug-2839131925/` → `nmId: "2839131925"`).
- **⚠️ OZON crawler is not production-ready.** The catalog crawl extracts only ~8 products (SSR fallback) instead of the full seller catalog (~300). The API integration (`entrypoint-api.bx`) returns 403 from both `page.request` and browser `fetch()`. The planned fix is intercepting the browser service worker's API responses via `page.on('response')`. Product crawl returns empty data (`title="?"`) because product pages also trigger anti-bot challenges. Browser cookies from a real Firefox session are required for any crawl to work (see `storage/ozon-cookies.json`).

## Code style

- 2-space indentation, Unix line endings, single quotes, semicolons required
- `strict: true` in TypeScript
- ESLint auto-fix on save (VS Code setting)
- No formatter (e.g. Prettier) configured
