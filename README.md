# Padma Ethnic Frontend

A premium, mobile-first Next.js storefront for Padma Ethnic. Shopify supplies the live catalog and inventory when configured; Padma accounts persist authentication, carts, addresses and order-history records in a dedicated customer database.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4 foundation with a custom editorial design system
- Lucide icons
- Auth.js (NextAuth) with Google OAuth
- libSQL for customer accounts, carts, addresses and orders
- Vitest + Testing Library
- Puppeteer Core for real-Chrome interaction QA

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Quality checks

```bash
npm test
npm run lint
npm run build
```

Expanded browser QA (start the production or development server first):

```bash
npm run qa:expanded
```

The suite checks desktop and mobile overflow, key homepage sections, collection results, search, product variant selection, persistent cart behavior and every new editorial route. Screenshots are written to `qa/expanded-*.png`.

## Routes

### Commerce discovery

- `/collections/all`
- `/collections/sarees`
- `/collections/kurta-sets`
- `/collections/lehengas`
- `/collections/co-ords`
- `/collections/new-arrivals`
- `/collections/bestsellers`
- `/collections/festive-wear`
- `/collections/wedding-edit`
- `/collections/sale`
- `/search`
- `/cart`
- `/wishlist`
- `/account`
- `/products/[id]`

### Brand and editorial

- `/about`
- `/our-craft`
- `/lookbook`
- `/journal`
- `/journal/[slug]`

## Delivered frontend features

- Responsive editorial homepage with occasion, curated-path, price, wedding, trust, founder and community sections
- Category collection pages with size, colour, material, price and occasion filters
- Sort controls and progressive “Load more” catalog presentation
- Availability integration seam that does not invent live stock
- Search across names, categories, colours and materials
- Search suggestions, popular searches, persistent recent searches and no-result recommendations
- Account-connected cart with anonymous-to-account merging and colour/size variant lines
- Dedicated cart page with quantities, removals, totals, shipping progress and Shopify-hosted checkout handoff when configured
- Shared browser-persistent wishlist and recently viewed products
- Product full-screen image viewer, fit/model notes, size validation, quantity controls, share action, delivery-pincode validation and sticky mobile add-to-bag bar
- Complete-the-look recommendations and an honest verified-review empty state
- About, craft, lookbook and journal experiences with dynamic article routes
- Responsive navigation, metadata, reduced-motion support and accessible control labels
- Google OAuth plus email/password login and signup with signed JWT sessions
- Account dashboard with saved addresses and customer-owned order history

## Deliberately not represented as live

The following require Shopify or an equivalent commerce backend and external services. Their UI states do not claim to be operational:

- Live inventory and low-stock messaging
- Back-in-stock subscriptions
- Checkout, payment, tax and discount validation while Shopify credentials are absent
- Pincode serviceability, courier ETA and COD eligibility
- Verified customer reviews and customer photographs
- Newsletter delivery and first-order offers
- Live Instagram feed
- Shopify customer-profile synchronization and historical Shopify-order importing
- Cross-device wishlist synchronization

## Shopify backend integration

The storefront now includes a server-only Shopify Storefront API adapter. When the required environment variables exist, Shopify becomes authoritative for product names, handles, descriptions, images, prices, variants and availability. Product selections carry Shopify variant IDs into the browser cart, and the cart page creates a real Shopify Cart before redirecting to Shopify-hosted checkout.

When the variables are absent, the website intentionally stays in `local-preview` mode and checkout remains disabled. A configured Shopify request failure is surfaced rather than silently mixing stale local prices with live data.

### Shopify Admin setup

1. Create or open the Padma Ethnic Shopify store.
2. In Shopify Admin, add the **Headless** sales channel (preferred) or create a custom storefront app.
3. Create a storefront and grant only these Storefront API permissions:
   - unauthenticated product/catalog read access,
   - unauthenticated inventory read access,
   - unauthenticated checkout/cart write access.
4. Copy the **Storefront API access token**. Do not use or expose an Admin API token.
5. Copy `.env.example` to `.env.local` and replace the placeholder values locally:

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your-storefront-token
SHOPIFY_API_VERSION=2026-07
```

6. Restart `npm run dev`. Do not commit `.env.local`.
7. Publish every product to the Headless/custom storefront sales channel. Draft or unpublished products will not appear.

### Product data conventions

Use Shopify product handles as storefront URLs: `/products/<handle>`.

Set Shopify **Product type** to one of:

- `Sarees`
- `Kurta Sets`
- `Lehengas`
- `Co-ords`

Use tags such as `New`, `Bestseller`, `Festive`, `Wedding`, `Everyday`, `Limited`, and `Sale` to drive curated storefront views and badges. Create actual Shopify variants for every size/colour combination; a variant without a real Shopify merchandise ID cannot enter live checkout.

The adapter optionally reads these product metafields in namespace `custom`:

- `material`
- `care`
- `included`
- `origin`
- `delivery_estimate`
- `sku`

Shopify Admin controls the catalog and inventory. Account carts, addresses and Padma order records use the customer database; wishlist and recently viewed data remain browser-local. Shopify customer-profile synchronization, historical Shopify-order importing, verified-review tooling, back-in-stock subscriptions, logistics-specific pincode checks, newsletters and Instagram require separate integrations.

## Google sign-in setup

The `/account` route supports Google OAuth and email/password accounts through Auth.js. It authenticates the custom Padma website; it does not automatically create or sign in a Shopify customer.

1. Create a **Web application** OAuth client in Google Cloud Console.
2. Add these authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://YOUR_DOMAIN/api/auth/callback/google`
3. Add these variables to `.env.local` (and to the production host's secret environment):

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

4. Restart the server. Never commit `.env.local` or expose the client secret to browser code.

## Customer data storage

Local development defaults to `.data/padma.db`, which is ignored by Git. Passwords are stored as salted scrypt hashes; raw passwords and OAuth secrets are never persisted in the database.

For a deployed or multi-instance website, configure a durable libSQL/Turso database instead of the local file:

```env
CUSTOMER_DATABASE_URL=libsql://YOUR_DATABASE.turso.io
CUSTOMER_DATABASE_AUTH_TOKEN=your-server-only-token
```

The authenticated account APIs enforce ownership for carts, addresses and orders. Future Shopify order integrations should call the server-side `recordOrder` repository method only after payment/order verification. Until that checkout synchronization is connected, **My orders** truthfully shows an empty state and does not invent Shopify history.

### Security model

- Shopify tokens are used only by server modules and the server checkout route.
- Customer database credentials are server-only, and password hashes use Node.js scrypt with unique random salts.
- A Google identity is bound to its stable Google subject. It is never silently attached to an email/password account with the same email; explicit linking would require a separately verified flow.
- Credential attempts and registration are throttled per server instance. A distributed production deployment should add a shared edge/server rate limiter.
- Account cart, address and order endpoints derive ownership from the signed server session rather than request-supplied user IDs.
- Cart writes are serialized by the client and protected by server-side version checks to prevent stale tabs from silently overwriting newer account data.
- No Admin API credential is required by this storefront.
- The checkout endpoint accepts only Shopify ProductVariant GIDs and bounded integer quantities.
- Shopify revalidates inventory, totals, tax, delivery and discounts before payment.
- Payment details are collected only by Shopify-hosted checkout.

## Content and asset note

The product names, descriptions, prices and imagery remain editorial prototype content. The current asset set contains one representative image per look, not verified front, back, side, detail or video assets for every SKU. Product cards and galleries therefore avoid presenting unrelated photographs as alternate views. Replace the prototype catalog with licensed Padma assets and confirmed product facts before launch.
