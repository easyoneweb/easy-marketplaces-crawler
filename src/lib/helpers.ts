import { load } from 'cheerio';
import type {
  Product,
  Image,
  Param,
  ParamBlock,
  StockInfo,
  WBCardJsonResponse,
} from '../../types';

export function buildCardJsonUrl(imagePbUrl: string): string | null {
  const match = imagePbUrl.match(
    /https:\/\/basket-(\d+)\.wbbasket\.ru\/vol(\d+)\/part(\d+)\/(\d+)\//,
  );
  if (!match) return null;

  const [, cluster, vol, part, nmId] = match;
  return `https://basket-${cluster}.wbbasket.ru/vol${vol}/part${part}/${nmId}/info/ru/card.json`;
}

export function getWBProductData(
  cardJson: WBCardJsonResponse,
  content: string,
  stockData?: Array<StockInfo>,
): Product {
  const $ = load(content);

  let title: string = cardJson.imt_name || '';

  if (!title) {
    title = $('h1').first().text().trim();
    if (!title || title === 'Что-то не так...') {
      const excludeWords = [
        '₽',
        'оцен',
        'вопрос',
        'артикул',
        'вид ',
        'жизнен',
        'гибрид',
        'солнеч',
        'сортов',
        'характеристик',
        'возврат',
        'семена',
        'в каталог',
        'хорошая',
        'купить',
        'добавить',
        'июл',
        'склад',
        'главная',
        'хиты',
        'похожие',
        'загружаем',
        'шт.',
        'цена',
      ];
      $('[class*="mo-typography"][class*="body"]').each(function () {
        if (title) return;
        const text = $(this).text().trim();
        const lowerText = text.toLowerCase();
        if (
          text.length > 10 &&
          text.length < 120 &&
          !excludeWords.some((w) => lowerText.includes(w))
        ) {
          title = text;
        }
      });
    }
  }

  let price: string = $('ins.price__lower-price.wallet-price')
    .first()
    .text()
    .trim();
  if (!price) {
    price = $('.priceBlockFinalPrice--iToZR').first().text().trim();
  }

  const images: Array<Image> = [];
  const candidateImages = new Map<string, { url: string; isBig: boolean }>();
  $('img').each(function () {
    const url = $(this).attr('src') || $(this).attr('data-src-pb') || '';
    const isBig = url.includes('/images/big/');
    const isProduct = url.includes('/images/c246x328/');
    if (url && (isBig || isProduct)) {
      const idMatch = url.match(/\/(\d+)\.webp$/);
      const imageId = idMatch ? idMatch[1] : url;
      const existing = candidateImages.get(imageId);
      if (!existing || (isBig && !existing.isBig)) {
        candidateImages.set(imageId, { url, isBig });
      }
    }
  });
  candidateImages.forEach(({ url }) => {
    images.push({ url: url });
  });

  const params: Array<Param> = (cardJson.options || []).map((opt) => ({
    name: opt.name,
    value: opt.value,
  }));

  const additionalParams: Array<ParamBlock> = (
    cardJson.grouped_options || []
  ).map((group) => ({
    name: group.group_name,
    params: group.options.map((opt) => ({
      name: opt.name,
      value: opt.value,
    })),
  }));

  const description: string = cardJson.description || '';

  if (!price) price = '0';

  const stock: Array<StockInfo> = stockData || [];

  if (!stock.length) {
    $('[class*="delivery"], [class*="order-delivery"]').each(function () {
      const text = $(this).text().trim();
      const info: StockInfo = {};

      const qtyMatch = text.match(/осталось\s*(\d+)\s*шт/i);
      if (qtyMatch) {
        info.quantity = parseInt(qtyMatch[1], 10);
        info.quantityText = qtyMatch[0];
      }

      if (text.includes('Склад Wildberries') || text.includes('склад WB')) {
        info.warehouseName = 'WB';
      } else if (
        text.includes('Склад продавца') ||
        text.includes('склад продавца')
      ) {
        info.warehouseName = 'seller';
      }

      const daysMatch = text.match(/(\d+)\s*(?:день|дня|дней)/i);
      if (daysMatch) {
        info.deliveryDays = parseInt(daysMatch[1], 10);
      }

      if (Object.keys(info).length > 0) {
        stock.push(info);
      }
    });
  }

  return {
    title: title,
    price: price,
    images: images,
    params: params,
    additionalParams: additionalParams,
    description: description,
    stock: stock.length > 0 ? stock : undefined,
  };
}

export function getOzonProductData(content: string): Product {
  const $ = load(content);

  const title: string = $('[data-widget="webProductHeading"] h1').text().trim();
  let price: string = $(
    '[data-widget="webPrice"] div div button span div div div div span',
  )
    .text()
    .trim();
  const images: Array<Image> = [];
  const params: Array<Param> = [];
  const additionalParams: Array<ParamBlock> = [];
  const description: string = $('#section-description div div div div')
    .text()
    .trim();

  $(
    '[data-widget=webGallery] div div div div div div div div div div div img',
  ).each(function () {
    let src = $(this).attr('src');

    if (src) {
      src = src.replace('wc50', 'wc1000');
      images.push({ url: src });
    }
  });

  const paramName = $('#section-description div div div h3').text().trim();
  const paramValue = $('#section-description div div div p').text().trim();
  params.push({ name: paramName, value: paramValue });

  $('#section-characteristics div div div dl').each(function () {
    const paramName = $(this).find('dt').text().trim();
    const paramValue = $(this).find('dd').text().trim();
    params.push({ name: paramName, value: paramValue });
  });

  if (!price) price = '0';

  return {
    title: title,
    price: price,
    images: images,
    params: params,
    additionalParams: additionalParams,
    description: description,
  };
}

export function createRequestQueueUrlArray(links: Array<string>) {
  return links.map((link) => {
    return {
      url: link,
    };
  });
}
