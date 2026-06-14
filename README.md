# Rummage Marketplace

A static HTML/CSS/JavaScript marketplace that uses Supabase for secure seller accounts, shared listings, and uploaded item images.

The frontend can still be hosted on GitHub Pages and served through Cloudflare. Supabase provides the shared storage and enforces which seller can edit which item.

## What Changed

- Buyers can view shared listings.
- Sellers must sign in before creating listings.
- Every item has an `owner_id` tied to the logged-in Supabase user.
- Supabase Row Level Security prevents sellers from editing or deleting other sellers' items.
- Images upload to a public Supabase Storage bucket named `listing-images`.

## Files

- `index.html` - app structure
- `styles.css` - responsive styling
- `app.js` - Supabase auth, marketplace reads, seller-only writes
- `config.js` - Supabase project URL and public anon key
- `supabase-schema.sql` - all database tables, storage bucket, and security policies
- `supabase-step-1-tables.sql` - tables only, easier to run first
- `supabase-step-2-item-policies.sql` - seller ownership policies
- `supabase-step-3-storage.sql` - image bucket and upload policies
- `CNAME` - GitHub Pages custom domain: `S4C.rummagesale.runyourai.pro`
- `.nojekyll` - GitHub Pages compatibility

## Supabase Setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase-step-1-tables.sql`.
4. Run `supabase-step-2-item-policies.sql`.
5. Run `supabase-step-3-storage.sql`.
6. Open **Project Settings > API**.
7. Copy the Project URL and anon public key.
8. Put them in `config.js`:

```js
window.RUMMAGE_SUPABASE = {
  url: "https://your-project.supabase.co",
  anonKey: "your-public-anon-key",
};
```

The anon key is meant to be public in browser apps. Security comes from the Row Level Security policies in Supabase.

## Auth Settings

In Supabase, open **Authentication > Providers** and make sure Email is enabled.

For the smoothest first test, you can temporarily allow email signups and either:

- keep email confirmation on, then confirm from the seller's email inbox, or
- turn confirmation off during testing.

For production, email confirmation should normally stay on.

## GitHub Pages

1. Put the files from this folder at the root of a GitHub repository.
2. In GitHub, open **Settings > Pages**.
3. Choose the branch that contains `index.html`.
4. Confirm the custom domain is `S4C.rummagesale.runyourai.pro`.

## Cloudflare DNS

1. In Cloudflare DNS for `runyourai.pro`, create a `CNAME` record:

```text
Name: S4C.rummagesale
Target: YOUR-GITHUB-USERNAME.github.io
Proxy: DNS only to start
```

2. After GitHub Pages verifies the domain, you can turn the Cloudflare proxy on if desired.
3. Use SSL/TLS mode **Full**.

## Security Model

The browser does not decide who owns an item. Supabase does.

The important policy is:

```sql
auth.uid() = owner_id
```

That means a seller can only update or delete listings attached to their own login. Even if someone edits the JavaScript in their browser, Supabase should reject cross-seller writes.
