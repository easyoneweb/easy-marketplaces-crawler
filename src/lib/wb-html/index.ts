import fs from 'fs';
import { PlaywrightCrawler } from "crawlee";

type Data = [
  {
    url: string,
    links: Array<string>
  }
]

export class HTML {
  constructor() {}

  async saveHtmlDocs() {
    this.#removeCurrentHtmlFiles();

    const data = JSON.parse(fs.readFileSync(__dirname + '/../../public/data/result.json').toString()) as unknown as Data;
    let links: Array<string> = [];

    data.forEach(item => {
      links = [...links, ...item.links];
    });

    const crawler = await this.#createCrawler(links.length);
    await crawler.run(links);
  }

  async #createCrawler(maxRequests: number) {
    const SAFEGUARD_MAX_REQUESTS = 10;

    return new PlaywrightCrawler({
      async requestHandler({ request, page }) {
        await page.waitForTimeout(500);

        const url = request.loadedUrl;
        const content = await page.content();

        fs.writeFileSync(__dirname + '/../../public/' + url.split('/')[4] + '.html', content);
      },
      maxRequestsPerCrawl: maxRequests + SAFEGUARD_MAX_REQUESTS
    });
  }

  #removeCurrentHtmlFiles(): void {
    const files = fs.readdirSync(__dirname + '/../../public');

    files.forEach(file => {
      if (file === 'data') return;
      
      fs.unlinkSync(__dirname + '/../../public/' + file);
    });
  }
}