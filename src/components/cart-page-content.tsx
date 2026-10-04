"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MAX_CART_QUANTITY } from "@/lib/cart";
import type { Product } from "@/lib/types";
import { useCommerce } from "./commerce-provider";
import { ProductCard } from "./product-card";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const freeShippingTarget = 10000;
type CodForm = { fullName: string; email: string; phone: string; address1: string; address2: string; city: string; state: string; postalCode: string };
type CodShippingRate = { handle: string; title: string; price: string; currencyCode: string };
const emptyCodForm: CodForm = { fullName: "", email: "", phone: "", address1: "", address2: "", city: "", state: "", postalCode: "" };

export function CartPageContent({ products }: { products: Product[] }) {
  const { cart, setQuantity, removeFromCart } = useCommerce();
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [showCodCheckout, setShowCodCheckout] = useState(false);
  const [codForm, setCodForm] = useState<CodForm>(emptyCodForm);
  const [shippingRates, setShippingRates] = useState<CodShippingRate[]>([]);
  const [selectedShippingRate, setSelectedShippingRate] = useState("");
  const [orderName, setOrderName] = useState("");
  const remaining = Math.max(0, freeShippingTarget - cart.subtotal);
  const recommendation = products.find((product) => !cart.items.some((item) => item.product.id === product.id));
  const checkoutReady = cart.items.length > 0 && cart.items.every((item) => item.product.source === "shopify" && item.selection?.variantId);

  const startCheckout = () => {
    if (!checkoutReady) return;
    setCheckoutError("");
    setShowCodCheckout(true);
  };

  const updateField = (field: keyof CodForm, value: string) => { setCodForm((current) => ({ ...current, [field]: value })); setShippingRates([]); setSelectedShippingRate(""); };

  async function placeCodOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutPending(true);
    setCheckoutError("");
    try {
      const payload = { lines: cart.items.map((item) => ({ merchandiseId: item.selection?.variantId, quantity: item.quantity })), customer: { ...codForm, country: "India" }, ...(selectedShippingRate ? { shippingRateHandle: selectedShippingRate } : {}) };
      if (!selectedShippingRate) {
        const ratesResponse = await fetch("/api/shopify/cod-checkout/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const ratesResult = await ratesResponse.json() as { rates?: CodShippingRate[]; error?: string };
        if (!ratesResponse.ok || !ratesResult.rates?.length) throw new Error(ratesResult.error || "No delivery options are available for this address.");
        setShippingRates(ratesResult.rates);
        return;
      }
      const response = await fetch("/api/shopify/cod-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { order?: { name?: string }; error?: string };
      if (!response.ok || !result.order) throw new Error(result.error || "Unable to place your order.");
      cart.items.forEach((item) => removeFromCart(item.lineId ?? item.product.id));
      setOrderName(result.order.name || "your order");
      setShowCodCheckout(false);
      setCodForm(emptyCodForm);
      setShippingRates([]);
      setSelectedShippingRate("");
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to place your order right now.");
    } finally {
      setCheckoutPending(false);
    }
  }

  return <main className="full-cart-page">
    <header className="cart-page-title"><p className="eyebrow">Your selection</p><h1>Shopping bag <span>({cart.itemCount})</span></h1></header>
    {orderName ? <section className="cod-order-success" role="status"><p className="eyebrow">Order confirmed</p><h2>Thank you for your order.</h2><p>Your Pay on Delivery order <strong>{orderName}</strong> has been received. We will contact you at the details provided to confirm delivery.</p><Link className="primary-cta" href="/collections/all">Continue shopping <ArrowRight size={15} /></Link></section> : cart.items.length === 0 ? <div className="cart-empty-page"><h2>Your bag is waiting</h2><p>Discover pieces designed for celebrations and every day between them.</p><Link className="primary-cta" href="/collections/all">Explore the collection <ArrowRight size={15} /></Link></div> : <div className="cart-page-grid">
      <section className="cart-page-items" aria-label="Items in your bag">
        <div className="shipping-progress"><Truck size={18} /><div><strong>{remaining ? `${money.format(remaining)} away from complimentary delivery` : "Complimentary delivery unlocked"}</strong><span><i style={{ width: `${Math.min(100, cart.subtotal / freeShippingTarget * 100)}%` }} /></span></div></div>
        {cart.items.map((item) => { const id = item.lineId ?? item.product.id; const options = item.selection ? [item.selection.color.toLowerCase() === "default" ? "" : item.selection.color, item.selection.size].filter(Boolean).join(" · ") : ""; return <article key={id} className="cart-page-item"><Link href={`/products/${item.product.id}`} className="cart-page-image"><Image src={item.product.image} alt={item.product.name} fill sizes="140px" /></Link><div><p>{item.product.category}</p><h2>{item.product.name}</h2>{options && <span>{options}</span>}<strong>{money.format(item.product.price)}</strong><div className="cart-page-quantity"><button onClick={() => setQuantity(id, item.quantity - 1)} aria-label={`Decrease ${item.product.name} quantity`}><Minus size={14} /></button><span>{item.quantity}</span><button disabled={item.quantity >= MAX_CART_QUANTITY} onClick={() => setQuantity(id, item.quantity + 1)} aria-label={`Increase ${item.product.name} quantity`}><Plus size={14} /></button></div><button className="remove-item" onClick={() => removeFromCart(id)}>Remove</button></div></article>; })}
      </section>
      <aside className="order-summary"><p className="eyebrow">Order summary</p><div><span>Subtotal</span><strong>{money.format(cart.subtotal)}</strong></div><div><span>Delivery</span><span>Confirmed during checkout</span></div><p className="discount-note">Pay securely on delivery. No online payment is collected on this website.</p><button type="button" className="checkout-button" disabled={!checkoutReady || checkoutPending} onClick={startCheckout}>{checkoutReady ? "Proceed to checkout" : "Checkout opens after Shopify connection"} <ArrowRight size={16} /></button>{checkoutError && <p className="selection-message is-error" role="alert">{checkoutError}</p>}{showCodCheckout && <form className="cod-checkout-form" onSubmit={placeCodOrder}><div className="cod-checkout-heading"><p className="eyebrow">Pay on Delivery</p><h2>Delivery details</h2><p>Complete your order directly on the Padma website.</p></div><label>Full name<input required value={codForm.fullName} onChange={(event) => updateField("fullName", event.target.value)} autoComplete="name" /></label><label>Email<input required type="email" value={codForm.email} onChange={(event) => updateField("email", event.target.value)} autoComplete="email" /></label><label>Phone<input required type="tel" value={codForm.phone} onChange={(event) => updateField("phone", event.target.value)} autoComplete="tel" /></label><label>Address line 1<input required value={codForm.address1} onChange={(event) => updateField("address1", event.target.value)} autoComplete="address-line1" /></label><label>Address line 2 <span>(optional)</span><input value={codForm.address2} onChange={(event) => updateField("address2", event.target.value)} autoComplete="address-line2" /></label><div className="cod-checkout-fields"><label>City<input required value={codForm.city} onChange={(event) => updateField("city", event.target.value)} autoComplete="address-level2" /></label><label>State<input required value={codForm.state} onChange={(event) => updateField("state", event.target.value)} autoComplete="address-level1" /></label></div><label>Postal code<input required inputMode="numeric" value={codForm.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} autoComplete="postal-code" /></label><p className="cod-payment-note"><ShieldCheck size={15} /> Payment method: <strong>Pay on Delivery only</strong></p>{shippingRates.length > 0 && <fieldset className="cod-shipping-rates"><legend>Choose delivery</legend>{shippingRates.map((rate) => <label key={rate.handle} className="cod-shipping-rate"><input required type="radio" name="shippingRate" value={rate.handle} checked={selectedShippingRate === rate.handle} onChange={() => setSelectedShippingRate(rate.handle)} /><span>{rate.title}</span><strong>{rate.price === "0.0" || rate.price === "0" ? "Complimentary" : money.format(Number(rate.price))}</strong></label>)}</fieldset>}<button className="checkout-button" type="submit" disabled={checkoutPending || (shippingRates.length > 0 && !selectedShippingRate)}>{checkoutPending ? (shippingRates.length ? "Loading delivery options…" : "Placing order…") : shippingRates.length ? "Place Pay on Delivery order" : "See delivery options"}</button><button className="cod-cancel" type="button" onClick={() => setShowCodCheckout(false)} disabled={checkoutPending}>Back to bag</button></form>}<p className="integration-note"><ShieldCheck size={16} /> Shopify revalidates product availability and pricing before the order is created.</p></aside>
    </div>}
    {recommendation && !orderName && <section className="cart-recommendation"><p className="eyebrow">You may also love</p><h2>One more considered piece</h2><div><ProductCard product={recommendation} /></div></section>}
  </main>;
}
