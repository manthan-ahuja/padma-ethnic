export type CheckoutLine = { merchandiseId: string; quantity: number };
export type CustomerDetails = {
  fullName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
export type CodCheckoutInput = { lines: CheckoutLine[]; customer: CustomerDetails; shippingRateHandle?: string };

function text(value: unknown, label: string, max = 120) {
  const result = String(value ?? "").trim();
  if (!result || result.length > max) throw new Error(`${label} is required.`);
  return result;
}

export function parseCodCheckoutInput(value: unknown): CodCheckoutInput {
  if (!value || typeof value !== "object") throw new Error("Checkout details are invalid.");
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 100 || input.lines.some((line) => {
    if (!line || typeof line !== "object") return true;
    const item = line as Record<string, unknown>;
    return typeof item.merchandiseId !== "string" || !item.merchandiseId.startsWith("gid://shopify/ProductVariant/") || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20;
  })) throw new Error("Cart lines are invalid.");

  const rawCustomer = input.customer;
  if (!rawCustomer || typeof rawCustomer !== "object") throw new Error("Delivery details are required.");
  const customer = rawCustomer as Record<string, unknown>;
  const email = text(customer.email, "Email", 254).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.");
  const phone = text(customer.phone, "Phone", 25);
  if (!/^[+\d][\d ()-]{6,24}$/.test(phone)) throw new Error("Enter a valid phone number.");
  return {
    lines: input.lines as CheckoutLine[],
    shippingRateHandle: typeof input.shippingRateHandle === "string" ? input.shippingRateHandle.trim().slice(0, 300) || undefined : undefined,
    customer: {
      fullName: text(customer.fullName, "Full name"),
      email,
      phone,
      address1: text(customer.address1, "Address line 1"),
      address2: String(customer.address2 ?? "").trim().slice(0, 120),
      city: text(customer.city, "City"),
      state: text(customer.state, "State"),
      postalCode: text(customer.postalCode, "Postal code", 16),
      country: text(customer.country, "Country", 80),
    },
  };
}
