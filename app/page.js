import { catalogRepository } from "../lib/catalog-store.mjs";
import Storefront from "./components/Storefront";
import { readStoreFilters } from "../packages/core/storefront.mjs";
import "./storefront-fonts.css";
import "./storefront.css";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams }) {
  let products = [],
    unavailable = false;
  try {
    products = await catalogRepository.listPublicProducts();
  } catch {
    unavailable = true;
  }
  return (
    <Storefront
      products={products}
      unavailable={unavailable}
      whatsappNumber={process.env.WHATSAPP_NUMBER || ""}
      initialFilters={readStoreFilters(await searchParams)}
    />
  );
}
