import { catalogRepository } from "./catalog-store.mjs";
import { resolveContactSettings } from "../packages/core/contact.mjs";

export async function contactSettings() {
  return resolveContactSettings(
    await catalogRepository.getContactSettings(),
    process.env.WHATSAPP_NUMBER || "",
  );
}
