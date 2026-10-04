import { NextResponse } from "next/server";
import { createCodOrder } from "@/lib/shopify/cod-checkout";
import { parseCodCheckoutInput } from "@/lib/shopify/cod-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input: ReturnType<typeof parseCodCheckoutInput>;
  try {
    input = parseCodCheckoutInput(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout details are invalid." }, { status: 400 });
  }

  try {
    const order = await createCodOrder(input);
    return NextResponse.json({ order: { id: order.id, name: order.name, financialStatus: order.displayFinancialStatus } });
  } catch (error) {
    console.error("Custom Pay on Delivery checkout failed", error);
    const message = error instanceof Error ? error.message : "Unable to place your order right now.";
    const status = message === "Custom checkout is not configured yet." ? 503 : 502;
    return NextResponse.json({ error: status === 503 ? "Pay on Delivery checkout is being configured. Please try again later." : message }, { status });
  }
}
