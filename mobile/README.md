# Oasis Mobile

React Native (Expo) companion app for the Oasis website — Agrotourism & Wellness in Crete. It mirrors the public site's functionality (admin excluded) and talks to the **same backend**: the Next.js API routes and Supabase project that power youroasis.gr.

## Features

- **Home** — hero, promo banner, signature experiences, philosophy, ways to journey, newsletter signup
- **Experiences** — full catalog with date-range + party-size availability filtering, bespoke/private card
- **Experience detail** — gallery, what's included / what to bring, policies, meeting points (opens Maps), guest reviews, share & favorite
- **Booking flow** — availability calendar with seat buckets → guest details (ages, dietary chips, primary contact) → payment (promo/gift-card codes, VAT split, Stripe Checkout in an in-app browser) → confirmation with reference, ticket PDF, calendar and Apple Wallet links
- **My Bookings** — upcoming/history tabs, search, detail screen with QR check-in ticket
- **Guest Portal** — find any booking by reference + last name; pay outstanding balance, reschedule, change pickup point, request cancellation (with the site's refund-eligibility rules)
- **Auth** — login, registration, forgot/reset password (Supabase)
- **Profile** — dashboard, member status, account settings (password-confirmed edits), delete account
- **Content** — Our Story, Retreats, Private Gatherings + dark-themed inquiry form, Contact (3 inquiry types), Privacy/Terms/Cancellation policies

## Setup

```bash
cd mobile
npm install
cp .env.example .env   # then fill in the Supabase URL + anon key
npx expo start
```

Press `i` for the iOS simulator. The app runs in Expo Go — no native build needed.

### Configuration notes

- `EXPO_PUBLIC_API_URL` defaults to `https://youroasis.gr`. Point it at `http://localhost:3000` to develop against a local `npm run dev` of the website.
- Auth: the website's API authenticates via Supabase SSR **cookies** and never reads bearer tokens, so the app synthesizes the exact `sb-<ref>-auth-token` cookie (`src/lib/authCookie.ts`) from its Supabase session when calling protected routes (`/api/me`, `/api/my-bookings`, `/api/favorites`, `/api/account/update`, `/api/auth/delete-account`).
- Payments use the site's `mode: "checkout"` flow — Stripe Checkout opens in an in-app browser, and the confirmation screen polls the draft and calls `/api/bookings/drafts/[id]/confirm` with the Stripe session id, exactly like the website's confirmation page does.
- Sign-up and forgot-password call the site's endpoints first; if the server demands a reCAPTCHA (`DISABLE_CAPTCHA` unset), the app falls back to direct Supabase `signUp` / `resetPasswordForEmail`.
