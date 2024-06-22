# Easy-Crawler
EasyOneWeb Project: Easy-Crawler. For website crawling and scraping. It is used for crawling marketplaces such as Wildeberries and OZON.

## Setup

Make sure to install the dependencies:

```bash
npm install
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

Application is using environment variables. You have to define: NODE_ENV (development or production), PORT (on which the server will run locally), WB_SELLER_URL (seller's main page on Wildberries), WB_MAX_REQUESTS (max requests to be made per crawl), WB_SCROLL_TIMES (how many times to vertically scroll of the page by 2000px), WB_TIME_BETWEEN_SCROLLS (time in ms between each scroll, try different numbers to achieve full page load including execution of javascript and service workers), WB_ADDITIONAL_PARAMS_BUTTON_NAME (text content of the button for popup show on Wildberries website). You can define all needed variables in .env file in root folder of this application.

## Additional information

Easy-Crawler is built on NodeJS (^18.20.2), ExpressJS (^4). Please, before proceed be sure to check official documentation on corresponding technology.

# Copyright

EasyOneWeb LLC 2020 - 2024. All rights reserved. See LICENSE.md for licensing and usage information.

# TODO:
- migrate scraping from cheerio to PlayWright's locator
