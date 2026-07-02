import { load } from 'cheerio';
import type {
  Product,
  Image,
  Param,
  ParamBlock,
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
): Product {
  const $ = load(content);

  const title: string = cardJson.imt_name || '';

  let price: string = $('ins.price__lower-price.wallet-price').text().trim();
  if (!price) {
    price = $('.priceBlockFinalPrice--iToZR').text().trim();
  }

  const images: Array<Image> = [];
  $('.product-card__img-wrap.img-plug img.j-thumbnail').each(function () {
    const url = $(this).attr('data-src-pb') || $(this).attr('src') || '';
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

  return {
    title: title,
    price: price,
    images: images,
    params: params,
    additionalParams: additionalParams,
    description: description,
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
