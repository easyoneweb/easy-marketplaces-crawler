# Easy-Crawler

EasyOneWeb Project: Easy-Crawler. For website crawling and scraping. It is used for crawling marketplaces such as Wildeberries and OZON.

## Setup

Make sure to install the dependencies:

```bash
npm install
```

For PlaywrightCrawler to work, make sure to install Playwright's dependecies, including browsers binaries:

```bash
npx playwright install --with-deps
```

Environment variables should be put in .env file before building for production. See Environment variables section for more information.

## Development Server

Start the development server on `http://localhost:${PORT}`:

```bash
npm run dev
```

## Production

Build the application for production:

```bash
npm run build
```

Locally preview production build:

```bash
npm run preview
```

## Environment variables

Application is using environment variables. You have to define:

- NODE_ENV (development or production)
- PORT (on which the server will run locally)
- DEBUG (enables verbose console output for both crawlers, default false)
- WB_SELLER_URL (seller's main page on Wildberries, empty = WB crawler skipped)
- WB_CRAWLER_CRON (cron time for running wb crawler task, default is every 12th hour: 0 */12 * * *)
- OZON_SELLER_URL (seller's main page on OZON, empty = OZON crawler skipped)
- OZON_CRAWLER_CRON (cron time for running ozon crawler task, default is every 12th hour: 0 */12 * * *)
- CRAWLEE_MEMORY_MBYTES (allowed memory pool to use by Crawlee library, default is 4096).

You can define all needed variables in .env file in root folder of this application.

## Additional information

Easy-Crawler is built on NodeJS (^18.20.2), ExpressJS (^4). Please, before proceed be sure to check official documentation on corresponding technology.

# Copyright

EasyOneWeb LLC 2020 - 2024. All rights reserved. See LICENSE.md for licensing and usage information.

# TODO:

- [x] Released: version 1.1.0. Original task: SAVE EXPORT JSON DATA BY OUR CLASS! NOT BY CRAWLEE STORAGE! Because data persists in datasets, which creates dublicate data in wb-result.json and ozon-result.json!
- [ ] **OZON catalog crawler: not production-ready.** The OZON seller page requires browser cookies to bypass anti-bot challenges. The catalog API integration (`entrypoint-api.bx`) is partially implemented but blocked by OZON's anti-bot measures. Currently only extracts ~8 products via SSR fallback instead of the full ~300 seller catalog. See AGENTS.md for technical details.
- [ ] locate warehouse stock of the product
- [ ] migrate scraping from cheerio to PlayWright's locator
