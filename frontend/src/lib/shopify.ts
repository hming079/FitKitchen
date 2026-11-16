export const SHOPIFY_API_VERSION = "2026-10";
const SHOPIFY_STORE_DOMAIN = "fitfuel-kitchen-0npus-gngjckd4.myshopify.com";
const SHOPIFY_STOREFRONT_TOKEN = "1c8e467cce7e5229c2c0276026771c82";
const STOREFRONT_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

export interface ShopifyPrice {
  amount: string;
  currencyCode: string;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: ShopifyPrice;
  availableForSale: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  tags: string[];
  priceRange: { minVariantPrice: ShopifyPrice };
  images: { edges: Array<{ node: { url: string; altText: string | null } }> };
  variants: { edges: Array<{ node: ShopifyVariant }> };
}

interface StorefrontResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

const productFields = `
  id title description handle tags
  priceRange { minVariantPrice { amount currencyCode } }
  images(first: 5) { edges { node { url altText } } }
  variants(first: 10) {
    edges {
      node { id title price { amount currencyCode } availableForSale selectedOptions { name value } }
    }
  }
`;

export async function storefrontApiRequest<T>(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(STOREFRONT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 402) {
    throw new Error("Shopify checkout is unavailable until the store is on an active billing plan.");
  }
  if (!response.ok) throw new Error(`Shopify request failed (${response.status}).`);

  const result = (await response.json()) as StorefrontResponse<T>;
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join(" "));
  if (!result.data) throw new Error("Shopify returned no storefront data.");
  return result.data;
}

export async function getShopifyProducts() {
  const query = `query GetProducts($first: Int!) { products(first: $first) { edges { node { ${productFields} } } } }`;
  const data = await storefrontApiRequest<{
    products: { edges: Array<{ node: ShopifyProduct }> };
  }>(query, { first: 50 });
  return data.products.edges.map(({ node }) => node);
}

export async function getShopifyProduct(handle: string) {
  const query = `query GetProduct($handle: String!) { product(handle: $handle) { ${productFields} } }`;
  const data = await storefrontApiRequest<{ product: ShopifyProduct | null }>(query, { handle });
  return data.product;
}

export function productMacros(tags: string[]) {
  const values: Record<string, string> = {};
  for (const tag of tags) {
    const match = tag.match(/^(calories|kcal|protein|carbs|carbohydrates|fat)[\s:_-]+(\d+(?:\.\d+)?)$/i);
    if (!match) continue;
    const matchedKey = match[1];
    const matchedValue = match[2];
    if (!matchedKey || !matchedValue) continue;
    const key = matchedKey.toLowerCase();
    const name = key === "kcal" ? "calories" : key === "carbohydrates" ? "carbs" : key;
    values[name] = matchedValue;
  }
  return values;
}

export function productGoal(tags: string[]) {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  if (normalizedTags.some((tag) => ["goal:bulk", "bulk", "goal:build"].includes(tag))) return "Bulk";
  if (normalizedTags.some((tag) => ["goal:cut", "cut", "goal:lean"].includes(tag))) return "Cut";
  if (normalizedTags.some((tag) => ["goal:maintain", "maintain", "goal:maintenance"].includes(tag))) return "Maintain";
  return null;
}

export function formatPrice(price: ShopifyPrice) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: price.currencyCode,
    maximumFractionDigits: 0,
  }).format(Number(price.amount));
}