import "server-only";
import { isShopifyConfigured } from "./client";
import type { CodCheckoutInput } from "./cod-validation";

export type CodShippingRate = { handle: string; title: string; price: string; currencyCode: string };

function adminConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_ADMIN_API_VERSION || process.env.SHOPIFY_API_VERSION || "2026-07";
  return { domain, token, apiVersion };
}

async function adminFetch<T>(query: string, variables: Record<string, unknown>) {
  const config = adminConfig();
  if (!isShopifyConfigured() || !config.domain || !config.token) throw new Error("Custom checkout is not configured yet.");
  const response = await fetch(`https://${config.domain}/admin/api/${config.apiVersion}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": config.token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (!response.ok || payload.errors?.length || !payload.data) throw new Error(payload.errors?.map((error) => error.message).join("; ") || "Shopify order request failed.");
  return payload.data;
}

function splitName(fullName: string) {
  const parts = fullName.split(/\s+/);
  return { firstName: parts.shift() || fullName, lastName: parts.join(" ") || "-" };
}

function shippingAddress(input: CodCheckoutInput) {
  const { firstName, lastName } = splitName(input.customer.fullName);
  return { firstName, lastName, address1: input.customer.address1, address2: input.customer.address2 || undefined, city: input.customer.city, province: input.customer.state, zip: input.customer.postalCode, countryCode: "IN", phone: input.customer.phone };
}

function lineItems(input: CodCheckoutInput) {
  return input.lines.map((line) => ({ variantId: line.merchandiseId, quantity: line.quantity }));
}

const DRAFT_ORDER_CALCULATE = `#graphql
  mutation PadmaDraftOrderCalculate($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        availableShippingRates {
          handle
          title
          price { amount currencyCode }
        }
      }
      userErrors { field message }
    }
  }
`;

const DRAFT_ORDER_CREATE = `#graphql
  mutation PadmaDraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id }
      userErrors { field message }
    }
  }
`;

const DRAFT_ORDER_COMPLETE = `#graphql
  mutation PadmaDraftOrderComplete($id: ID!, $paymentPending: Boolean) {
    draftOrderComplete(id: $id, paymentPending: $paymentPending) {
      draftOrder { order { id name displayFinancialStatus } }
      userErrors { field message }
    }
  }
`;

type UserError = { field?: string[]; message: string };
type CalculatedResponse = { draftOrderCalculate: { calculatedDraftOrder: { availableShippingRates: CodShippingRate[] } | null; userErrors: UserError[] } };

async function calculate(input: CodCheckoutInput) {
  const result = await adminFetch<CalculatedResponse>(DRAFT_ORDER_CALCULATE, { input: { lineItems: lineItems(input), email: input.customer.email, phone: input.customer.phone, shippingAddress: shippingAddress(input) } });
  if (result.draftOrderCalculate.userErrors.length || !result.draftOrderCalculate.calculatedDraftOrder) throw new Error(result.draftOrderCalculate.userErrors.map((error) => error.message).join("; ") || "Shopify could not calculate delivery options.");
  return result.draftOrderCalculate.calculatedDraftOrder.availableShippingRates;
}

export async function calculateCodShippingRates(input: CodCheckoutInput) {
  return calculate(input);
}

export async function createCodOrder(input: CodCheckoutInput) {
  if (!input.shippingRateHandle) throw new Error("Choose a delivery option before placing your order.");
  const rates = await calculate(input);
  const rate = rates.find((candidate) => candidate.handle === input.shippingRateHandle);
  if (!rate) throw new Error("That delivery option is no longer available. Please choose again.");
  const created = await adminFetch<{ draftOrderCreate: { draftOrder: { id: string } | null; userErrors: UserError[] } }>(DRAFT_ORDER_CREATE, {
    input: {
      lineItems: lineItems(input), email: input.customer.email, phone: input.customer.phone, shippingAddress: shippingAddress(input),
      shippingLine: { title: rate.title, price: rate.price, code: rate.handle },
      note: "Pay on Delivery order placed through the Padma website.", tags: ["padma-custom-checkout", "pay-on-delivery"],
    },
  });
  if (created.draftOrderCreate.userErrors.length || !created.draftOrderCreate.draftOrder) throw new Error(created.draftOrderCreate.userErrors.map((error) => error.message).join("; ") || "Shopify could not create the order.");
  const completed = await adminFetch<{ draftOrderComplete: { draftOrder: { order: { id: string; name: string; displayFinancialStatus: string } | null } | null; userErrors: UserError[] } }>(DRAFT_ORDER_COMPLETE, { id: created.draftOrderCreate.draftOrder.id, paymentPending: true });
  if (completed.draftOrderComplete.userErrors.length || !completed.draftOrderComplete.draftOrder?.order) throw new Error(completed.draftOrderComplete.userErrors.map((error) => error.message).join("; ") || "Shopify could not complete the order.");
  return completed.draftOrderComplete.draftOrder.order;
}
