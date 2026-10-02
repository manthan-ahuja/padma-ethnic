"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { AccountAuth } from "./account-auth";
import { AccountDashboard } from "./account-dashboard";
import { useCommerce } from "./commerce-provider";
import type { CustomerAddress, CustomerAddressInput, CustomerOrder } from "@/lib/customer-store";

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Something went wrong");
  return body;
}

export function AccountExperience({ configured }: { configured: boolean }) {
  const { data: session, status } = useSession();
  const { cart, cartSyncStatus, cartSyncError, disconnectCart, retryCartSync } = useCommerce();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [ordersUnavailable, setOrdersUnavailable] = useState(false);
  const [addressesUnavailable, setAddressesUnavailable] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [dataAttempt, setDataAttempt] = useState(0);
  const activeUserId = useRef<string | null>(session?.user?.id ?? null);
  useLayoutEffect(() => {
    activeUserId.current = session?.user?.id ?? null;
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    let cancelled = false;

    void Promise.allSettled([
      fetch("/api/account/addresses").then((response) => responseJson<{ addresses: CustomerAddress[] }>(response)),
      fetch("/api/account/orders").then((response) => responseJson<{ orders: CustomerOrder[] }>(response)),
    ]).then(([addressResult, orderResult]) => {
      if (cancelled) return;
      const errors: string[] = [];
      if (addressResult.status === "fulfilled") {
        setAddresses(addressResult.value.addresses);
        setAddressesUnavailable(false);
      }
      else {
        setAddresses([]);
        setAddressesUnavailable(true);
        errors.push(addressResult.reason instanceof Error ? addressResult.reason.message : "Addresses unavailable");
      }
      if (orderResult.status === "fulfilled") {
        setOrders(orderResult.value.orders);
        setOrdersUnavailable(false);
      }
      else {
        setOrders([]);
        setOrdersUnavailable(true);
        errors.push(orderResult.reason instanceof Error ? orderResult.reason.message : "Order history unavailable");
      }
      setLoadError(errors.join(" "));
      setLoadedUserId(userId);
      setLoadingData(false);
    });

    return () => { cancelled = true; };
  }, [dataAttempt, session?.user?.id]);

  if (status === "loading") {
    return <div className="account-card account-loading" role="status">Loading your account…</div>;
  }

  if (!session?.user) {
    return (
      <AccountAuth
        googleConfigured={configured}
        onGoogle={() => void signIn("google", { callbackUrl: "/account" })}
        onCredentials={async (mode, credentials) => {
          if (mode === "signup") {
            await responseJson(await fetch("/api/account/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(credentials),
            }));
            return;
          }
          const result = await signIn("credentials", {
            email: credentials.email,
            password: credentials.password,
            redirect: false,
          });
          if (!result?.ok) throw new Error("Unable to sign in with those details.");
        }}
      />
    );
  }

  if (loadedUserId !== session.user.id || loadingData || cartSyncStatus === "idle" || cartSyncStatus === "connecting") {
    return <div className="account-card account-loading" role="status">Loading your Padma account…</div>;
  }
  const currentUserId = session.user.id;

  return (
    <>
      {loadError && (
        <p className="account-page-error" role="alert">
          {loadError} <button type="button" onClick={() => {
            setLoadingData(true);
            setLoadError("");
            setDataAttempt((value) => value + 1);
          }}>Retry</button>
        </p>
      )}
      {cartSyncStatus === "error" && (
        <p className="account-page-error" role="alert">
          {cartSyncError} <button type="button" onClick={retryCartSync}>Reconnect cart</button>
        </p>
      )}
      <AccountDashboard
        user={session.user}
        cartCount={cart.itemCount}
        orders={orders}
        addresses={addresses}
        ordersUnavailable={ordersUnavailable}
        addressesUnavailable={addressesUnavailable}
        onSaveAddress={async (address: CustomerAddressInput) => {
          const mutationUserId = currentUserId;
          const result = await responseJson<{ address: CustomerAddress }>(await fetch("/api/account/addresses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(address),
          }));
          if (activeUserId.current !== mutationUserId) return;
          setAddresses((current) => [result.address, ...current.filter((item) => item.id !== result.address.id)].map((item) => ({
            ...item,
            isDefault: result.address.isDefault ? item.id === result.address.id : item.isDefault,
          })));
        }}
        onDeleteAddress={async (id) => {
          const mutationUserId = currentUserId;
          const response = await fetch(`/api/account/addresses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Unable to remove address");
          if (activeUserId.current !== mutationUserId) return;
          const refreshed = await responseJson<{ addresses: CustomerAddress[] }>(await fetch("/api/account/addresses"));
          if (activeUserId.current !== mutationUserId) return;
          setAddresses(refreshed.addresses);
        }}
        onSignOut={() => {
          disconnectCart();
          void signOut({ callbackUrl: "/" });
        }}
      />
    </>
  );
}
