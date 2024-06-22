import cron from 'node-cron';
import dotenv from 'dotenv';
import { WBCrawler } from '../wb-crawler';
import { HTML } from '../wb-html';

dotenv.config();

export const wbCrawlerTask = cron.schedule('*/120 * * * *', async () => {
  const maxRequests = Number(process.env.WB_MAX_REQUESTS) || 1000;
  const scrollTimes = Number(process.env.WB_SCROLL_TIMES) || 15;
  const timeBetweenScrolls = Number(process.env.WB_TIME_BETWEEN_SCROLLS) || 500;

  const crawler = new WBCrawler().createCrawler(maxRequests, scrollTimes, timeBetweenScrolls);
  const html = new HTML();

  await crawler.run([ process.env.WB_SELLER_URL || '' ]);
  await crawler.exportData(__dirname + '/../../public/data/result.json');
  await html.saveHtmlDocs();
}, {
  scheduled: false
});