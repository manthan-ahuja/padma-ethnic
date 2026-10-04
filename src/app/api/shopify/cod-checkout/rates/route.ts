import { NextResponse } from "next/server";
import { calculateCodShippingRates } from "@/lib/shopify/cod-checkout";
import { parseCodCheckoutInput } from "@/lib/shopify/cod-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = parseCodCheckoutInput(await request.json());
    const rates = await calculateCodShippingRates(input);
    return NextResponse.json({ rates });
  } catch (error) {
    console.error("Custom checkout shipping-rate calculation failed", error);
    const message = error instanceof Error ? error.message : "Unable to calculate delivery options.";
    const status = message === "Custom checkout is not configured yet." ? 503 : 400;
    return NextResponse.json({ error: status === 503 ? "Pay on Delivery checkout is being configured. Please try again later." : message }, { status });
  }
}
