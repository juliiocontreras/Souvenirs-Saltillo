import { catalogRepository } from "../lib/catalog-store.mjs";
import Storefront from "./components/Storefront";
import { readStoreFilters } from "../packages/core/storefront.mjs";
import { contactSettings } from "../lib/contact-settings.mjs";
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
  let whatsappNumber = "";
  try {
    ({ whatsappNumber } = await contactSettings());
  } catch {
    // A settings outage must not publish a stale or unverified destination.
  }
  return (
    <Storefront
      products={products}
      unavailable={unavailable}
      whatsappNumber={whatsappNumber}
      initialFilters={readStoreFilters(await searchParams)}
    />
  );
}
