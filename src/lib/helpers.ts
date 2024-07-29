import { load } from 'cheerio';
import type { Product, Image, Param, ParamBlock } from '../../types';

export function getWBProductData(content: string): Product {
  const $ = load(content);

  const title: string = $('h1.product-page__title').text().trim();
  let price: string = $('p.mini-product__price.wallet-price').text().trim();
  const images: Array<Image> = [];
  const params: Array<Param> = [];
  const additionalParams: Array<ParamBlock> = [];
  const description: string = $('p.option__text').text().trim();

  $('div.slide__content.img-plug img').each(function() {
    let url = $(this).prop('src');
    url = url?.replace('c246x328', 'c516x688');

    if (!url) url = '';

    images.push({ url: url });
  });

  $('div.product-page__options table.product-params__table tr').each(function() {
    const paramName = $(this).find('th').text().trim();
    const paramValue = $(this).find('td').text().trim();

    params.push({ name: paramName, value: paramValue });
  });

  $('div.popup__content table.product-params__table').each(function() {
    const paramBlock: ParamBlock = {
      name: $(this).find('caption').text().trim(),
      params: []
    };
    
    $(this).find('tr').each(function() {
      const paramName = $(this).find('th').text().trim();
      const paramValue = $(this).find('td').text().trim();

      paramBlock.params.push({ name: paramName, value: paramValue });
    });

    additionalParams.push(paramBlock);
  });
  
  if (!price) price = '0';

  return {
    title: title,
    price: price,
    images: images,
    params: params,
    additionalParams: additionalParams,
    description: description
  };
}


export function getOzonProductData(content: string): Product {
  const $ = load(content);

  const title: string = $('[data-widget="webProductHeading"] h1').text().trim();
  let price: string = $('[data-widget="webPrice"] div div button span div div div div span').text().trim();
  const images: Array<Image> = [];
  const params: Array<Param> = [];
  const additionalParams: Array<ParamBlock> = [];
  const description: string = $('#section-description div div div div').text().trim();

  $('[data-widget=webGallery] div div div div div div div div div div div img').each(function() {
    let src = $(this).attr('src');
    
    if (src) {
      src = src.replace('wc50', 'wc1000');
      images.push({ url: src });
    }
  });

  // КОМПЛЕКТАЦИЯ! Характеристика достается отдельно от остальных
  const paramName = $('#section-description div div div h3').text().trim();
  const paramValue = $('#section-description div div div p').text().trim();
  params.push({ name: paramName, value: paramValue });

  $('#section-characteristics div div div dl').each(function() {
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
    description: description
  };
}