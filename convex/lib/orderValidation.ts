export const MAX_ITEMS = 25;
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type OrderItemInput = {
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  preferredVendor?: string;
  estimatedAmountMinor: number;
  substitutionAllowed: boolean;
  notes?: string;
};

export function normalizeText(value: string, max: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > max)
    throw new Error(`Must be ${max} characters or fewer`);
  return normalized;
}

export function validateBilling(
  responsibility: "client" | "internal",
  clientReference?: string,
) {
  const reference = normalizeText(clientReference ?? "", 160);
  if (responsibility === "client" && !reference) {
    throw new Error("Client reference is required for client-billed orders");
  }
  return responsibility === "client" ? reference : undefined;
}

export function validateItems(items: OrderItemInput[]) {
  if (items.length < 1 || items.length > MAX_ITEMS) {
    throw new Error(`Orders require 1 to ${MAX_ITEMS} items`);
  }
  return items.map((item) => {
    const name = normalizeText(item.name, 120);
    const specification = normalizeText(item.specification, 1000);
    const unit = normalizeText(item.unit, 40);
    if (!name || !specification || !unit)
      throw new Error("Each item requires a name, specification, and unit");
    if (
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100000
    )
      throw new Error("Item quantity is invalid");
    if (
      !Number.isSafeInteger(item.estimatedAmountMinor) ||
      item.estimatedAmountMinor < 0
    )
      throw new Error(
        "Item estimate must use non-negative integer minor units",
      );
    return {
      ...item,
      name,
      specification,
      unit,
      preferredVendor:
        normalizeText(item.preferredVendor ?? "", 160) || undefined,
      notes: normalizeText(item.notes ?? "", 1000) || undefined,
    };
  });
}

export function computeLeadTime(
  now: number,
  requiredAt: number,
  leadTimeMinutes: number,
) {
  if (!Number.isFinite(requiredAt))
    throw new Error("Required date and time is invalid");
  if (!Number.isSafeInteger(leadTimeMinutes) || leadTimeMinutes < 0)
    throw new Error("Lead time is invalid");
  const earliestCompliantAt = now + leadTimeMinutes * 60_000;
  return { earliestCompliantAt, isLate: requiredAt < earliestCompliantAt };
}

export function validateAttachment(mediaType: string, byteSize: number) {
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      mediaType as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  )
    throw new Error("Only JPEG, PNG, and WebP reference images are allowed");
  if (
    !Number.isSafeInteger(byteSize) ||
    byteSize < 1 ||
    byteSize > MAX_ATTACHMENT_BYTES
  )
    throw new Error("Reference images must be 8 MB or smaller");
}
