import { isMasaleProduct } from '@azela-pos/shared';

const PRODUCT_IMAGES = '/book/products';

/** Keyword → fallback image when POS has no photo (first match wins). */
const IMAGE_RULES: Array<{ match: RegExp; src: string }> = [
  { match: /breast|boneless breast/i, src: `${PRODUCT_IMAGES}/breast.jpg` },
  { match: /drumstick|drum stick/i, src: `${PRODUCT_IMAGES}/drumstick.jpg` },
  { match: /lollipop|lolli/i, src: `${PRODUCT_IMAGES}/lollipop.jpg` },
  { match: /wing/i, src: `${PRODUCT_IMAGES}/wings.jpg` },
  { match: /liver/i, src: `${PRODUCT_IMAGES}/liver.jpg` },
  { match: /gizzard|giblet/i, src: `${PRODUCT_IMAGES}/gizzard.jpg` },
  { match: /carcus|carcass/i, src: `${PRODUCT_IMAGES}/carcus.jpg` },
  { match: /\beggs?\b/i, src: `${PRODUCT_IMAGES}/egg.jpg` },
  { match: /tandoor|hot tandoor|grill/i, src: `${PRODUCT_IMAGES}/tandoor.jpg` },
  { match: /leg boneless|boneless leg/i, src: `${PRODUCT_IMAGES}/breast.jpg` },
  { match: /\bleg\b|thigh/i, src: `${PRODUCT_IMAGES}/leg.jpg` },
  { match: /whole|full chicken/i, src: `${PRODUCT_IMAGES}/whole.jpg` },
  { match: /curry|kheema|keema|mince|cut/i, src: `${PRODUCT_IMAGES}/curry.jpg` },
];

const DEFAULT_CUT = `${PRODUCT_IMAGES}/curry.jpg`;

/**
 * Resolve a catalog image for the book page.
 * Prefer POS Product.imageUrl (URL or data URL). Masale never get photos.
 */
export function resolveBookProductImage(opts: {
  name: string;
  categoryName?: string | null;
  imageUrl?: string | null;
}): string | null {
  if (isMasaleProduct(opts.categoryName, opts.name)) return null;

  const url = (opts.imageUrl || '').trim();
  if (url) return url;

  const name = opts.name || '';
  for (const rule of IMAGE_RULES) {
    if (rule.match.test(name)) return rule.src;
  }

  return DEFAULT_CUT;
}
