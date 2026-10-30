# MobiPay UI Review — NexLink reference vs. current dashboard and landing page

Date: 2026-10-30

Reference: <https://nexlink.layoutdrop.com/demo/index.html> (NexLink CRM admin template, Bootstrap 5)

Compared against:

- **Dashboard** — `MobiPay/frontend` (React 19 + Vite, hand-written CSS in `styles.css` + `reference.css`)
- **Landing page** — `Mobiwave v26.2` (React + Tailwind + shadcn, live at <https://mobiwave.co.ke>)

> Method: live DOM/computed-style inspection of the reference and landing page, plus source review of both
> codebases. The reference dashboard was rendered and inspected; the MobiPay dashboard was reviewed from
> source only (the local app was not run against a live API for this pass).

---

## 1. Verdict in one paragraph

NexLink is not a better product than ours — it is a **better-presented generic admin**. What makes it feel
premium is a small, disciplined system: one accent colour, one border tone, one radius, one shadow, generous
whitespace, 14px base text, and every card answering "number → trend → context" in the same order. Our
dashboard has more operational substance (payment lifecycle, environment boundary, reconciliation, M-Pesa
readiness) but it is visually flat, typographically too small, and split across two competing stylesheets.
Our landing page is the opposite problem: expressive and animated, but on a third colour system and a
different font hierarchy. The redesign should not copy NexLink's CRM content or its decorative charts — it
should adopt its **presentation discipline**, then re-point it at payments.

---

## 2. The reference, decoded

### Design tokens actually used

| Token | Value |
|---|---|
| Primary | `#5955D1` (indigo) |
| Secondary | `#29294B` |
| Success | `#009966` |
| Info | `#7008E7` |
| Warning | `#F5A70D` |
| Danger | `#F83636` |
| Dark / headings | `#0C243C` |
| Body text | `#696981` |
| Muted / icons | `#97A1C0` |
| Page background | `#FDFDFF` |
| Card surface | `#FFFFFF` |
| Border | `#EEEEF3` (≈0.67px hairline) |
| Radius | 10px cards, 8px buttons, 50% icon buttons |
| Shadow | `0 5px 10px rgba(2, 2, 76, 0.02)` |
| Font | Instrument Sans |
| Base size | 14px / 22.4px (body), 13px controls, ~32px KPI numerals |

### Layout

- 3-layer shell: an icon **rail**, an expandable **nav panel**, and the content column.
- 64–72px top bar: search, a live KPI pill ("Today New Leads 27"), theme toggle, notification/action icons,
  user block with name + role.
- Breadcrumb sits above the grid, not inside the top bar.
- 12-column card grid, ~24px gutters, cards of deliberately different heights.
- Panels are border-only; there is almost no shadow and no gradient background.

### Card anatomy (the part worth stealing)

```
┌─────────────────────────────────────────────┐
│ Label                          [⋯ menu]     │  14px title, muted
│ 5,758  [+2.57%]        ▁▃▅▂▇▄  (sparkline)  │  32px numeral + delta pill
│ ─────────────────────────────────────────── │
│ Vs last month: 1,195                     →  │  footer context + affordance
└─────────────────────────────────────────────┘
```

Every KPI is: **label → big number → delta pill → micro-visualisation → comparison footer**. The user gets
the answer, the direction, the shape of the trend, and the baseline in one glance. Our metric cards stop at
label → number → one line of meta.

### What is genuinely good

1. Visual calm: one accent, hairline borders, almost no shadow.
2. Consistent card rhythm; mixed card sizes keep the page from feeling like a spreadsheet.
3. Clear numeric hierarchy — the number is the loudest thing in every card.
4. Delta pills make direction legible without reading the chart.
5. Search and a global live metric live in the bar, so the shell feels like a working tool.
6. Icon-only controls with generous hit areas.
7. Range switcher (Today / Week / Month) attached to the chart it controls.

### What we must **not** copy

1. **Decorative chart semantics.** "Traffic Sources" is five rounded bars with no axis, no values, no
   legend scale; "Lead Analytics" is a sine wave. In a payments product, a chart without a stated period,
   axis or source is a trust defect, not a style choice.
2. **Three-dot menus that do nothing.** Card menus with Edit/Delete on read-only metrics.
3. **Sales-template content.** Upgrade-to-Pro cards, "New Customers" avatars, retention bars — irrelevant to
   merchant payment operations.
4. **Double navigation** (icon rail + panel). It costs ~100px of width and adds a mode to learn; for eight
   destinations it is overkill.
5. **Tiny label type.** Captions and badges drop to 10–11px in places; our current app already has this
   problem — don't import it.
6. **Gradient bars as brand decoration.** The lilac-to-indigo bars imply magnitude they don't encode.

---

## 3. What we have today

### 3.1 Dashboard (`MobiPay/frontend`)

**Shell** — fixed 258px sidebar (Workspace / Operations / Platform groups + M-Pesa connection card), 64px
sticky top bar with breadcrumb, environment select, notification button, initials avatar; content capped at
1450px.

**Overview** — 4 metric cards (Collected, Payments, Success rate, Needs attention), a 4-step payment
lifecycle strip, a 7-day activity bar chart, a hardcoded system-health panel, and a recent-payments table.

**Visual system**

| Token | Current | Problem |
|---|---|---|
| Font | Inter only | Fine, but no display face; headings are 25–27px and under-weighted vs. content |
| Brand | `#176b5b` (muted teal-green) | Third colour system in the product family (landing blue, landing purple, dashboard green) |
| Background | `#f7f8fa` | Almost invisible separation from white cards |
| Border | `#e5e8ee` | OK |
| Radius | 12px cards / 9px buttons | Slightly inconsistent across two CSS files |
| Shadow | `0 1px 2px … , 0 8px 24px …` | Heavier than reference; combined with 1px borders it looks muddy |
| Base type | 11px body, 9–10px caps labels, 8px table headers | Below comfortable reading size; 8px is not acceptable |
| Body text | `#697386` on white ≈ 4.6:1 | Borderline; `#9aa2b1` captions ≈ 2.9:1 fail WCAG AA |

**Structural weaknesses**

1. **Two stylesheets, two systems.** `styles.css` defines the shell and components; `reference.css` then
   re-skins nearly all of them with a second token set (`--ref-*`). Any redesign must collapse this into one
   token-driven file, or every future change is made twice.
2. **Fake visualisation.** The overview line chart is a skewed CSS border (`.chart-line { transform:
   skewY(-7deg) }`). There is no data behind it.
3. **No trend context.** Metrics show a value and a static caption; no period, no comparison, no sparkline.
4. **Hardcoded health.** "M-Pesa connection — Connected / Callbacks — Healthy / Webhooks — Healthy" is
   literal JSX, while `docs/FRONTEND-UX-AUDIT.md` already flags this as a P1 trust issue.
5. **Uniform panel weight.** Lifecycle strip, activity, health and table all use the same 12px title and
   border, so the eye has no entry point after the metric row.
6. **Dense source, weak extensibility.** `MerchantOperations.tsx` packs several pages into 26 lines of
   one-liner JSX; components (`Metric`, `Head`, `Table`) are local and unshareable.
7. **Landing-page brand gap.** Dashboard says MobiWave Payments in green; the marketing site says MobiWave
   in blue/lilac with Outfit headings. Nothing visually connects them.

### 3.2 Landing page (`Mobiwave v26.2`)

**Current language** — Outfit headings (60px H1 at desktop), Inter body, lilac hero (`#f6f4ff`), dark navy
text (`#172333`), electric-blue primary CTA (`#0084ff`), purple-tinted decorative gradients and dot grids,
a photographic hero illustration, wave divider, framer-motion reveals, and a ~10,300px home page.

**Strengths** — Strong display typography and headline hierarchy; clear value proposition; excellent SEO
structure (per-page meta, guides, service pages); social proof and pricing present.

**Weaknesses**

1. **Accent conflict in a single viewport:** lilac/purple decoration + electric-blue CTA + navy text.
   `#0084ff` on white is ~3.0:1 — fine for large shapes, fails for text-sized links.
2. **Decoration over product.** Hero image is an abstract campaign illustration; there is no product surface
   telling a merchant what the dashboard actually does.
3. **Long, repetitive scroll.** Ten sections with similar card treatments; pricing/FAQ/CTA repeat the same
   visual note.
4. **Different radii, fonts and button shapes** from the app, so clicking "Sign in" feels like leaving the
   brand.
5. **Cards are generic marketing cards** (icon + title + copy) rather than a preview of the real console.

---

## 4. Comparison matrix

| Dimension | NexLink | MobiPay dashboard | MobiWave landing | Redesign target |
|---|---|---|---|---|
| Accent system | 1 indigo | 1 muted green | blue + purple + navy | **1 indigo**, green reserved for success |
| Type scale | 14px base, clear numerals | 11px base, 8px tails | 16px base, 60px display | 14px product / 18px marketing base |
| Numeric hierarchy | Number is loudest | Number is medium | N/A | KPI 32px, tabular figures |
| Card treatment | hairline + 2% shadow | 1px border + 2 shadows | varied, decorative | hairline + 4% shadow |
| Whitespace | generous | compressed | generous | generous |
| Density | low (marketing-ish) | high | low | medium-high, ops-appropriate |
| Charts | decorative/sine wave | fake CSS line + real bars | illustrations only | real Recharts, labelled |
| Nav | rail + panel, 2 layers | 1 sidebar, 3 groups | mega-menu | 1 sidebar, 3 groups, collapsible |
| Truthfulness | low (template data) | mixed (real data + hardcoded health) | n/a | every status sourced or "Unknown" |
| Brand continuity | n/a | disconnected | disconnected | shared tokens across both surfaces |

---

## 5. Redesign direction: "MobiWave Console"

A calm, high-trust fintech console. The reference's restraint, our operational truth, the landing page's
typographic confidence. Concretely:

### 5.1 One brand, three surfaces

Recommend **MobiWave Indigo `#5955D1`** as the single interactive/brand colour for dashboard **and**
landing, with **navy `#0C243C`** for headings and dark surfaces.

Why this one:

- It is already the reference's primary and visually closest to the landing page's existing lilac/purple
  accents (`#7c3aed`, `#6651c9`), so the landing changes least.
- Contrast on white ≈ 5.1:1, usable for links and buttons (unlike `#0084ff` at 3.0:1).
- It is far enough from M-Pesa green that **green can be reserved strictly for success/healthy**, which is
  semantically important in a payments product.

Alternative if brand equity in electric blue is non-negotiable: keep `#0084ff` as the CTA fill only, never
for text, and use indigo exclusively for data series. Do not run both as "primary".

### 5.2 Token set

```css
:root {
  /* brand */
  --brand: #5955D1;
  --brand-hover: #4A46C4;
  --brand-soft: #F1F0FC;
  --brand-border: #D8D6F5;
  --navy: #0C243C;

  /* surfaces */
  --bg: #FDFDFF;
  --surface: #FFFFFF;
  --surface-sunken: #F7F7FB;
  --border: #E9EAF0;
  --border-strong: #D9DBE6;

  /* text */
  --text: #0C243C;
  --text-secondary: #4E5878;
  --text-muted: #7A83A1;     /* ≥4.5:1 on white */
  --text-disabled: #A7AEC4;

  /* semantics — green is success only, never brand */
  --success: #009966;  --success-soft: #EAF8F2;  --success-border: #BFE6D9;
  --warning: #B26A00;  --warning-soft: #FFF7E8;  --warning-border: #F5DFB3;
  --danger:  #D92D20;  --danger-soft:  #FEF3F2;  --danger-border:  #FBD5D1;
  --info:    #7008E7;  --info-soft:    #F6F0FE;

  /* geometry */
  --radius-card: 12px;
  --radius-control: 9px;
  --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgba(12,36,60,.04), 0 6px 16px rgba(12,36,60,.03);
  --shadow-pop:  0 12px 32px rgba(12,36,60,.12);

  /* type */
  --font-ui: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-display: Outfit, var(--font-ui);
  --fs-display: 28px;  /* page H1 */
  --fs-title: 15px;    /* panel title */
  --fs-body: 14px;
  --fs-small: 13px;
  --fs-micro: 12px;    /* hard floor — no 8/9/10px text */
  --fs-kpi: 32px;
  --lh-tight: 1.2;
  --lh-body: 1.5;
}
```

Product keeps **Inter** (already loaded, excellent tabular figures — add `font-variant-numeric: tabular-nums`
to numerals). Marketing keeps **Outfit** for display and Inter for body. That is one type pairing across the
whole estate instead of three.

### 5.3 Spacing and layout

- 8px base; sizes 4 / 8 / 12 / 16 / 24 / 32 / 48.
- Sidebar **248px**, collapsible to a **72px icon rail** (one control, not a second nav layer).
- Top bar **64px**: search (⌘K), environment badge, alerts, account. Breadcrumb moves into the page header.
- Content max **1440px**, gutters 32px desktop / 20px tablet / 16px mobile.
- 12-column grid, 24px gutters; cards may span 3 / 4 / 6 / 8 / 12.

### 5.4 Page blueprints

**Dashboard**

1. Page header: title + "Last updated" + date-range control + primary action ("Request payment").
2. Attention strip (only when non-empty): failed, reversed, unreconciled counts as one clickable row —
   payments products earn trust by surfacing exceptions first.
3. Four KPI cards, each with sparkline, delta pill and comparison footer:
   Collected today · Success rate · Pending confirmations · Needs attention.
4. Row 2: **Collections & success rate** (8 cols, area + line, real period control) · **Payment lifecycle**
   (4 cols, horizontal funnel with counts).
5. Row 3: **Recent payments** (7 cols, dense table, 7 rows, row → detail) · right column stack:
   **M-Pesa connection** card (shortcode, environment, last callback, health = live query or "Unknown") and
   **System health** (4 rows, each linked to its repair surface).
6. Optional row 4: reconciliation snapshot (matched / unmatched / open exceptions) with "Run reconciliation".

**Landing page**

1. Hero: product-led. Headline + subhead + primary/secondary CTA on the left, a **real dashboard card
   composition** (KPI + collections chart + lifecycle) on the right — the same components, not an
   illustration. Keep the wave only as a quiet section divider.
2. Trust strip: client logos + "99.9% delivery / 10M+ messages" stats in the app's card language.
3. Three product pillars (SMS, M-Pesa, WhatsApp/USSD), each showing a small real UI fragment.
4. "How it works" — 3 steps using the lifecycle component.
5. Proof: one testimonial, one case metric; drop the repetitive second testimonial carousel.
6. Pricing summary, FAQ, single CTA band. Cut total height by ~30%.

### 5.5 Component inventory to build once

`Card`, `CardHeader`, `KpiCard` (+ `Sparkline`, `DeltaPill`), `PageHeader`, `RangeTabs`, `DataTable`
(sticky header, row hover, empty/loading/error), `StatusBadge`, `HealthRow`, `LifecycleStrip`,
`AttentionBanner`, `EnvironmentBadge`, `CommandSearch`, `Modal`, `FormField`, `Skeleton`, `EmptyState`,
`Toast`/`aria-live` status.

Add `recharts` to `frontend/package.json` (it is already a root dependency) and delete the CSS chart.

### 5.6 Truthfulness rules

- No status without a source. If a query is missing or stale, render **"Unknown"** with a "Check now"
  action, never "Healthy".
- Environment is read from the active connection and rendered as a badge beside every money-moving action.
- Every number carries period + `last updated`.
- Every chart carries axis, unit, period and an accessible text summary.

### 5.7 Accessibility and quality gates

- Minimum text size 12px; body 14px; caption contrast ≥ 4.5:1.
- Visible focus ring `2px solid #5955D1` with 2px offset on all interactive elements.
- 44×44px minimum touch targets on mobile.
- `prefers-reduced-motion` honoured (already partly done in `reference.css`).
- Tables: `scope="col"`, sortable headers announced, no colour-only status.
- Keyboard: sidebar, modal focus trap, command search.

---

## 6. Sequenced plan

| Phase | Scope | Output |
|---|---|---|
| 0 | Tokens + shell | Collapse `styles.css`/`reference.css` into one token layer; new sidebar/top bar; typography scale |
| 1 | Dashboard | KPI cards with sparklines, attention strip, real charts, live health, lifecycle |
| 2 | Payments + detail | Table states, filters, payment detail timeline, STK modal (preview, idempotency, pending route) |
| 3 | Reconciliation + M-Pesa | Run states, exception drill-down, connection readiness, environment badge |
| 4 | SMS / Developers / Settings | Apply primitives, remove one-off CSS |
| 5 | Landing page | Product-led hero, shared tokens, section cut, mobile pass |
| 6 | Polish | A11y audit, screenshot regression per route at 1440/1024/390, Lighthouse |

Suggested first slice: **Phase 0 + dashboard** — it is the highest-visibility surface and produces the
primitives every other page needs.

---

## 7. Risks / decisions needed

1. **Brand colour** — adopt indigo `#5955D1` everywhere (recommended) or keep electric blue as CTA fill?
2. **Landing repo boundary** — the landing page lives in `Mobiwave v26.2`, outside this repository. Either
   extract a shared tokens package, or mirror a documented token file in both and keep them in sync manually.
3. **Chart library** — Recharts (already present at root, React 19 support) vs. a lighter custom SVG layer.
   Recommend Recharts for speed; revisit only if bundle size becomes a problem.
4. **Data readiness** — live health, reconciliation and lifecycle counts need API fields; until they exist,
   the UI must show "Unknown", not a placeholder success.
5. **Scope of "total redesign"** — visual system only, or also the workflow changes flagged in
   `docs/FRONTEND-UX-AUDIT.md` (P0/P1 items)? The visual rebuild is a good moment to fix those, but it
   roughly doubles the surface.

---

## 8. Implementation log (2026-10-30)

Status: **Phase 0 (tokens + shell), merchant console, platform admin console, and landing hero shipped.**
Payments, customers, M-Pesa, reconciliation, SMS, developers and settings were re-skinned through the shared
primitives. The platform admin surface is documented in `docs/PLATFORM-ADMIN.md`.

### Dashboard (`frontend/`)

- **One stylesheet.** `styles.css` is now the single token-driven system (colours, type scale, radii,
  shadows, spacing, focus rings, responsive rules). `reference.css` is deprecated and no longer imported;
  it is retained only for reference.
- **Shell.** 248px sidebar with a 76px collapsed rail, grouped nav, live M-Pesa status card, sticky topbar
  with a command palette (`⌘K`), read-only environment badge, exception-count bell and account shortcut.
- **Truth fixes.** The environment `<select>` is gone; the badge reads `workspace.environment` from the
  M-Pesa readiness query and renders **“Environment unknown”** on failure. System health is now query-backed
  (credentials, callbacks, SMS delivery, webhook queue) and shows **Unknown** rather than a hardcoded green.
- **Overview.** KPI cards with real sparklines, period-over-period deltas (percentage-point deltas for
  success rate), an exception strip with drill-down links, a lifecycle summary, a labelled SVG area chart
  with an accessible data table, live health and connection panels, and the recent-payments table.
- **Payments.** Search and status filters are synchronised to the URL (`?q=&status=`), and the row menu is
  keyboard-reachable via the customer link. The STK modal now normalises Kenyan numbers, previews the
  shortcode/environment/amount, tracks an `Idempotency-Key`, and ends in a “waiting for the customer” state
  with a link to the payment.
- **Other fixes surfaced during the visual pass:** developer API-key creation moved into a proper toolbar,
  SMS `delivered` renders as a success badge, pending payments use an informational alert (not an error),
  M-Pesa grid handles an odd number of steps, and payment detail links are visible again.

### Landing (`Mobiwave v26.2`)

- Brand tokens moved from electric blue (`#0084ff`) to **MobiWave Indigo `#5955d1`**, with `#4a46c4`
  hover and `#8b87e8` light. All hardcoded blue hexes in `src/` were replaced, including the header hover,
  section labels, button shadows, gradients and scrollbar.
- Hero is now product-led: a two-column layout with the existing headline and a `ConsolePreview`
  component (KPI cards, collections chart, transaction rows, live badges) instead of an abstract
  campaign illustration. Waves were recoloured to the indigo/lavender family.
- Mobile: KPI values no longer wrap, the eyebrow is shortened, and floating cards are hidden below 1024px.

### Deliberate deviations from the plan

1. **Charts are hand-built SVG, not Recharts.** The dashboard needs one area chart and four sparklines;
   a small, dependency-free implementation keeps the bundle flat and gives full control over a11y labels
   and the hidden data table. Revisit if more chart types are added.
2. **No shared token package yet.** The landing lives in a separate folder/repository. The indigo scale,
   surfaces, radii and semantic colours are mirrored by hand and documented in Section 5.2; extracting a
   `@mobiwave/tokens` package is the follow-up if the surfaces keep growing.
3. **Environment switching remains in the M-Pesa workspace.** The shell badge is read-only by design.

### Verification

- `npx tsc -b` and `npx vite build` pass for the dashboard; `npm run build` passes for the landing.
- Headless Chrome passes at 1440, 1024 and 390 for: overview, payments, payment detail, M-Pesa,
  M-Pesa connections, reconciliation, SMS, developers, settings, and the landing hero.
- Console is clean on the overview (no React warnings); no horizontal overflow at 985px or 390px.
- Contrast floor: muted text is now `#6b7594` (≈4.6:1 on white), 12px minimum type, visible 2px focus ring.

### Remaining follow-ups

- Server-side range filtering for the overview (today it aggregates the latest 100 loaded payments and
  labels that explicitly).
- Real health fields for callback/webhook freshness rather than latest-record inference.
- Sortable table headers and a payments-aware command palette.
- Landing `build:deploy` (prerender + validation) and visual-regression snapshots in CI.
- Automated axe pass and a dark-scheme audit.

---

## 9. Platform admin separation (2026-10-30)

Status: **shipped as a separate console and API surface.** The merchant console is unchanged at `/`,
`/payments`, `/customers`, `/reconciliation`, `/mpesa`, `/sms`, `/developers` and `/settings`; platform
administration now lives under `/admin`.

### Surface and shell

- **Routes:** `/admin`, `/admin/merchants`, `/admin/merchants/:id`, `/admin/transactions`,
  `/admin/exceptions`, `/admin/activations`, `/admin/audit`.
- **Shell:** its own dark-navy sidebar, "Platform admin" brand lockup, restricted-access banner, scope badge
  and separate navigation groups (Control / Operations / Governance). It reuses only the shared design
  tokens, primitives and hand-built SVG charts, not the merchant navigation or identity.
- **Code boundary:** `frontend/src/admin/AdminApp.tsx`, `admin/api.ts`, `admin/admin.css` and `admin/pages/*`
  are independent of `App.tsx`, `api.ts` and the merchant pages. `main.tsx` selects the admin shell for
  `/admin*` before rendering the merchant app.
- **Backend boundary:** `server/routes/admin/*`, `lib/platform-admin.ts` and the `/api/admin/*` namespace.
  Admin routes query Neon PostgreSQL directly; they do not call merchant convenience endpoints.

### Authentication and data

- **Admin session:** signed, HTTP-only `mobiwave_platform_admin` cookie, `SameSite=Strict`, `Secure` in
  production, eight-hour lifetime. Merchant `mobiwave_workspace_id` cookies are rejected by admin routes,
  and admin cookies are ignored by merchant routes. Sign-out clears the cookie and writes an audit entry.
- **Configuration:** `ADMIN_USERNAME` / `ADMIN_PASSWORD`, optional `PLATFORM_ADMIN_NAME`, optional
  `PLATFORM_ADMIN_SESSION_SECRET`; platform data additionally requires `DATABASE_URL`.
- **Migration 018:** adds the append-only `platform_admin_audit_logs`, the
  `platform_admin_workspace_summaries` view and the `platform_admin_overview(integer)` RPC, with grants
  restricted to `service_role`.
- **Degraded modes:** before migration 018, overview and merchant summaries fall back to bounded recent
  rows and label the aggregates as degraded. When `DATABASE_URL` is absent, data routes fail fast
  with `503 database_configured:false`; the overview renders a zeroed, explicitly labelled degraded state
  instead of hanging. Database calls time out (default 8s) so an unreachable Neon endpoint cannot leave the
  console on skeletons.
- **Audited actions:** activation decisions, exception decisions, and session start/end. Approving an
  activation moves the request and workspace to `live`; it does not create or rotate Daraja credentials.
  Exception resolution records the decision/note; it does not alter PSP settlement state.

### Verification

- `npm run lint` and `npm --prefix frontend run build` pass.
- Auth checks: invalid credentials return `401`; unauthenticated admin requests return `401`; a merchant
  workspace cookie cannot access `/api/admin/*`; logout clears the session.
- API checks against a local PostgreSQL database: overview, merchants, transactions, exceptions, activations
  and audit return `200`; exception resolution and activation approval mutate state and write audit entries.
- Migration 018 applies cleanly to PostgreSQL 16; the view returns merchant aggregates and
  `platform_admin_overview(14)` returns the expected volume, success, merchant and queue counts.
- Degraded modes: with no `DATABASE_URL` configuration, sign-in stays under 100 ms, the overview returns a
  labelled degraded payload and data routes return `503` immediately. With an unreachable
  database endpoint, the overview returns its degraded state in under 200 ms and the merchant directory
  returns `503` after one request timeout instead of falling through to a second bounded query.
- Headless Chrome at 1440, 1024 and 390: no page-level horizontal overflow on any admin route; full-width
  tables fit at 1440 and wide tables scroll inside their panel at smaller widths. The overview's paired
  panels use a compact date format so the last-payment column stays visible. Merchant routes were checked
  at 390 and desktop.
- Lighthouse on `/admin`: **Accessibility 100, Best Practices 100**, with no console errors. Fixes included
  raising muted-text contrast, darkening success green to `#007a52`, matching the admin brand accessible
  name, and wrapping exception reasons and audit metadata so tables fit at 1440.
- Responsive fixes: admin page-head actions stay on one line, review modals keep their decision footer
  visible, activation methods render as `STK` / `C2B`, and audit action labels render as readable phrases
  rather than raw dot-separated keys.

### Remaining platform-admin follow-ups

- Apply migration 018 to staging/production and run the admin console against the real Neon database.
- Add a table-scroll affordance on small laptops/tablets (the tables are usable but the hidden columns are
  not obvious until the user scrolls).
- Add CI smoke coverage for admin auth separation and the degraded-data states.
- Add a platform-admin-specific command palette and saved filters once the queues grow.
