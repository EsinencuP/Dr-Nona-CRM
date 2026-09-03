import productsData from "@/data/products.json";

export const products = productsData
  .filter((product) => product.publicationStatus === "published")
  .map((product) => ({
    slug: product.slug,
    name: product.officialName,
    sku: product.sku,
    category: product.category,
  }));

const productNameMap = new Map(products.map((product) => [product.slug, product.name]));

export function getProductName(slug: string) {
  return productNameMap.get(slug) ?? slug;
}
