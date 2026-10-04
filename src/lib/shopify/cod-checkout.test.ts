import { describe, expect, it } from "vitest";
import { parseCodCheckoutInput } from "./cod-validation";

const valid = {
  lines: [{ merchandiseId: "gid://shopify/ProductVariant/11", quantity: 1 }],
  customer: {
    fullName: "Manthan Ahuja",
    email: "manthan@example.com",
    phone: "9820081628",
    address1: "1 Private Lane",
    address2: "",
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400001",
    country: "India",
  },
};

describe("parseCodCheckoutInput", () => {
  it("accepts a valid pay-on-delivery checkout", () => {
    expect(parseCodCheckoutInput(valid)).toEqual(valid);
  });

  it("preserves the selected Shopify shipping-rate handle", () => {
    expect(parseCodCheckoutInput({ ...valid, shippingRateHandle: "rate-handle" }).shippingRateHandle).toBe("rate-handle");
  });

  it("rejects malformed lines and incomplete delivery details", () => {
    expect(() => parseCodCheckoutInput({ ...valid, lines: [{ merchandiseId: "local-product", quantity: 1 }] })).toThrow("Cart lines are invalid");
    expect(() => parseCodCheckoutInput({ ...valid, customer: { ...valid.customer, postalCode: "" } })).toThrow("Postal code");
    expect(() => parseCodCheckoutInput({ ...valid, customer: { ...valid.customer, email: "not-an-email" } })).toThrow("email");
  });
});
