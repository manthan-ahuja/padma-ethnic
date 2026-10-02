import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountExperience } from "./account-experience";
import { signIn } from "next-auth/react";

const auth = vi.hoisted(() => ({
  value: {
    data: { user: { id: "account-a", name: "Alice", email: "alice@example.com" } },
    status: "authenticated",
  } as {
    data: { user: { id: string; name: string; email: string } } | null;
    status: "authenticated" | "unauthenticated" | "loading";
  },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => auth.value,
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("./commerce-provider", () => ({
  useCommerce: () => ({
    cart: { items: [], itemCount: 0, subtotal: 0 },
    cartSyncStatus: "synced",
    cartSyncError: "",
    disconnectCart: vi.fn(),
    retryCartSync: vi.fn(),
  }),
}));

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body } as Response);
}

describe("AccountExperience", () => {
  beforeEach(() => {
    vi.mocked(signIn).mockReset();
    auth.value = {
      data: { user: { id: "account-a", name: "Alice", email: "alice@example.com" } },
      status: "authenticated",
    };
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const userId = auth.value.data?.user?.id;
      if (userId === "account-a" && url.includes("addresses")) {
        return jsonResponse({ addresses: [{
          id: "address-a", label: "Home", fullName: "Alice Address", phone: "9820081628",
          address1: "1 Private Lane", address2: "", city: "Mumbai", state: "Maharashtra",
          postalCode: "400001", country: "India", isDefault: true,
        }] });
      }
      if (userId === "account-a" && url.includes("orders")) return jsonResponse({ orders: [] });
      if (userId === "account-b" && url.includes("addresses")) return jsonResponse({ addresses: [] });
      if (userId === "account-b" && url.includes("orders")) return jsonResponse({ error: "Order history unavailable" }, false);
      throw new Error(`Unexpected request: ${url}`);
    }));
  });

  it("does not apply an address mutation after the session changes", async () => {
    let resolveSave!: (response: Response) => void;
    const delayedSave = new Promise<Response>((resolve) => { resolveSave = resolve; });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "POST") return delayedSave;
      if (url.includes("addresses")) return jsonResponse({ addresses: [] });
      if (url.includes("orders")) return jsonResponse({ orders: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const view = render(<AccountExperience configured />);
    await screen.findByText("Welcome, Alice.");
    await user.click(screen.getByRole("button", { name: "My addresses" }));
    await user.click(screen.getByRole("button", { name: "Add an address" }));
    await user.type(screen.getByLabelText("Full name"), "Alice Private");
    await user.type(screen.getByLabelText("Phone"), "9820081628");
    await user.type(screen.getByLabelText("Address line 1"), "99 Secret Lane");
    await user.type(screen.getByLabelText("City"), "Mumbai");
    await user.type(screen.getByLabelText("State"), "Maharashtra");
    await user.type(screen.getByLabelText("Postal code"), "400001");
    await user.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/account/addresses", expect.objectContaining({ method: "POST" })));

    auth.value = {
      data: { user: { id: "account-b", name: "Bob", email: "bob@example.com" } },
      status: "authenticated",
    };
    view.rerender(<AccountExperience configured />);
    await screen.findByText("Welcome, Bob.");
    resolveSave(await jsonResponse({ address: {
      id: "address-a", label: "Home", fullName: "Alice Private", phone: "9820081628",
      address1: "99 Secret Lane", address2: "", city: "Mumbai", state: "Maharashtra",
      postalCode: "400001", country: "India", isDefault: true,
    } }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    await user.click(screen.getByRole("button", { name: "My addresses" }));
    expect(screen.queryByText("Alice Private")).not.toBeInTheDocument();
    expect(screen.queryByText("99 Secret Lane")).not.toBeInTheDocument();
  });

  it("never renders the previous customer's data after the session changes", async () => {
    const user = userEvent.setup();
    const view = render(<AccountExperience configured />);

    await user.click(await screen.findByRole("button", { name: "My addresses" }));
    expect(await screen.findByText("Alice Address")).toBeInTheDocument();

    auth.value = {
      data: { user: { id: "account-b", name: "Bob", email: "bob@example.com" } },
      status: "authenticated",
    };
    view.rerender(<AccountExperience configured />);

    expect(screen.queryByText("Alice Address")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Order history unavailable"));
    await user.click(screen.getByRole("button", { name: "My orders" }));
    expect(screen.getByRole("heading", { name: "Order history unavailable" })).toBeInTheDocument();
    expect(screen.queryByText("No orders yet")).not.toBeInTheDocument();
  });

  it("creates an account during signup without logging in automatically", async () => {
    auth.value = { data: null, status: "unauthenticated" };
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      if (String(input).includes("/api/account/register")) return jsonResponse({ ok: true });
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<AccountExperience configured />);

    await user.click(screen.getByRole("button", { name: "Sign up" }));
    await user.type(screen.getByLabelText("Name"), "New Customer");
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Account created. Log in with your new details.");
    expect(signIn).not.toHaveBeenCalled();
  });
});
