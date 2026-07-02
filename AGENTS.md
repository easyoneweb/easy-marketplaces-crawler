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

- `src/server.ts` — Express entry point; starts cron jobs on boot
- `src/lib/cron.ts` — Two cron tasks (`wbCrawlerTask`, `ozonCrawlerTask`); they are created with `scheduled: false`, so `.start()` must be called explicitly (done in `server.ts`)
- `src/lib/helpers.ts` — Cheerio-based HTML parsers (`getWBProductData`, `getOzonProductData`) that extract `Product` types
- `src/lib/wildberries/wb-crawler.ts` — Paginates the seller page, collects product card links via Cheerio, pushes to Crawlee Dataset
- `src/lib/wildberries/wb-files.ts` — Re-reads the Dataset JSON, then crawls each product page to save `.html` and `.json` to `public/`
- `src/lib/ozon/ozon-crawler.ts` — Same pattern as WB but for OZON
- `src/lib/ozon/ozon-files.ts` — Same pattern as WB files
- `types/index.d.ts` — `Data`, `Product`, `Image`, `Param`, `ParamBlock` types
- `types/puppeteer-extra-plugin-stealth.d.ts` — Custom ambient declaration for the stealth plugin (no `@types/` package exists)

## Architecture: two-phase crawl

1. **Catalog crawl** (e.g. `WBCrawler`): paginates seller pages, extracts product card links, saves `{ url, links }` to Crawlee's Dataset.
2. **Product crawl** (e.g. `WBFiles`): reads the Dataset JSON, visits each product URL, extracts data via Cheerio, writes `.html` + `.json` per product to `src/public/`.

Crawled output lands in `src/public/` (gitignored). The Dataset JSON is written to `src/public/data/wb-result.json` and `src/public/data/ozon-result.json`.

## Environment variables

Loaded from `.env` (gitignored). Required vars:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Express listen port | `3000` |
| `WB_SELLER_URL` | WB seller catalog start URL | (none) |
| `WB_CRAWLER_CRON` | Cron schedule for WB crawl | `0 */12 * * *` |
| `WB_MAX_REQUESTS` | Max pages per crawl | `1000` |
| `WB_MAX_CONCURRENCY` | Concurrent browser tabs | `100` |
| `WB_SCROLL_TIMES` | Vertical scrolls per page | `15` |
| `WB_TIME_BETWEEN_SCROLLS` | ms between scrolls | `500` |
| `WB_ADDITIONAL_PARAMS_BUTTON_NAME` | Button text for popup | `Все характеристики и описание` |
| `OZON_SELLER_URL` | OZON seller catalog start URL | (none) |
| `OZON_CRAWLER_CRON` | Cron schedule for OZON crawl | `0 */12 * * *` |
| `OZON_MAX_REQUESTS` | Max pages per crawl | `1000` |
| `OZON_MAX_CONCURRENCY` | Concurrent browser tabs | `100` |
| `OZON_SCROLL_TIMES` | Vertical scrolls per page | `15` |
| `OZON_TIME_BETWEEN_SCROLLS` | ms between scrolls | `500` |
| `CRAWLEE_MEMORY_MBYTES` | Crawlee memory pool (MB) | `2048` |

## Gotchas

- **WB uses stealth plugin** (`playwright-extra` + `puppeteer-extra-plugin-stealth`), OZON does not. WB also sets `useFingerprints: true` and a custom Chrome UA. OZON uses `PostmanRuntime/7.39.0` UA.
- **Different viewport sizes**: WB `1920x1080`, OZON `1700x1300`.
- **No `cheerio` in dependencies** — it's a transitive dependency of Crawlee. If using `import { load } from 'cheerio'`, make sure Crawlee is installed.
- **Output files** are written to `src/public/` which is gitignored. The `data/` subdirectory is not excluded by `.gitignore` but lives under `public/` so it's covered.
- **The Dataset is dropped before each crawl** (`await dataset.drop()`) to avoid appending to stale data.
- **WBFiles has a `SAFEGUARD_MAX_REQUESTS = 10`** — max requests is `links.length + 10` to tolerate retries.

## Code style

- 2-space indentation, Unix line endings, single quotes, semicolons required
- `strict: true` in TypeScript
- ESLint auto-fix on save (VS Code setting)
- No formatter (e.g. Prettier) configured
