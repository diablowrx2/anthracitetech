# Anthracite Tech Service Hub — Architecture Plan

## Overview

A tech repair business landing page for Anthracite Tech Co.. Single-page site with
hero, pricing cards, booking form, and contact footer. Originally a React/Vite
app rebuilt as a self-contained static HTML file.

---

## Current State

Single `index.html` file (~40KB) with all CSS and JS inline. No build step, no
framework dependencies. Google Fonts CDN for Inter + Outfit.

Backend API implemented in `api/` (Node.js + Express + better-sqlite3):
- `POST /api/book` — Create repair booking
- `GET /api/track/:ticketId` — Track booking status
- `GET /api/admin/bookings` — List bookings (admin)
- `PATCH /api/admin/bookings/:ticketId/status` — Update status
- `DELETE /api/admin/bookings/:ticketId` — Delete booking
- `GET /api/admin/stats` — Booking statistics
- `POST /api/enterprise-inquiry` — Create enterprise inquiry
- `GET /api/enterprise-inquiry/:inquiryId` — Get inquiry status
- `GET /api/admin/enterprise-inquiries` — List inquiries (admin)
- `PATCH /api/admin/enterprise-inquiries/:inquiryId/status` — Update inquiry status
- `GET /health` — Health check

Static files are served by the same Express server (`express.static`).

---

## Sections & Features

### 1. Sticky Header
- Fixed position, transparent → solid background on scroll
- Logo (wrench icon + brand text)
- Desktop nav: Services, Pricing, Book Repair (pill CTA)
- Mobile: hamburger menu toggle

### 2. Hero Section
- Full viewport height (90vh) with gradient overlays
- Animated "Same-day repairs available" badge (ping dot)
- Gradient text heading "Fast & Right."
- Two CTA buttons with smooth scroll anchors
- Three trust badges: Free Diagnostics, House Calls, Fast Turnaround

### 3. Pricing Section
- 4 service category cards in responsive grid (1→2→4 columns)
- Each card: watermark icon, service list with prices, hover glow effect
- Categories: PC & Laptop, Smartphones, Game Consoles, Tablets & iPads
- Custom Work banner with CTA link
- Scroll-triggered fade-in animation (IntersectionObserver)

### 4. Booking Form
- Glass-morphism card (backdrop blur, semi-transparent bg)
- Fields: Name, Email, Phone, Device Brand/Model, Device Category (select),
  Service Needed (dependent select), Issue Description (textarea)
- House Call checkbox (+$50 surcharge)
- Dependent dropdown: Service options populate based on category selection
- Form submission: client-side validation, success toast, form reset
- API call: `POST /api/book` (same-origin relative when served by API server)
- Fallback: stores to `localStorage` under `anthracitetech_leads` if API unreachable

### 4a. Enterprise Inquiry Modal
- Trigger: `#enterpriseModalTrigger` ("Get Business Quote" button in pricing section)
- Modal: `#enterpriseModal`
- Form ID: `#enterpriseForm`
- Fields: Company Name, Contact Name, Business Email, Phone, Company Size, Service Needed, Project Details
- API call: `POST /api/enterprise-inquiry`
- Success: Toast shows inquiry ID (e.g., `EZT-EXXXXX`), modal closes, form resets
- Error: Toast shows error message; submit button re-enabled

### 5. Footer
- 3-column grid: Brand info, Contact details, Business hours
- Phone, email, address with SVG icons
- Hours: Mon-Fri 9-7, Sat 10-5, Sun Closed

---

## Interactive Features (Vanilla JS)

| Feature | Implementation |
|---------|---------------|
| Sticky header | scroll event listener, toggles `.scrolled` class at 40px |
| Mobile menu | hamburger toggle, shows/hides nav overlay |
| Dependent dropdowns | Category→Service mapping object, enables/disables service select |
| Form submission | preventDefault, validates, calls `POST /api/book`, shows toast, resets |
| Enterprise inquiry | Modal trigger `#enterpriseModalTrigger`, form `#enterpriseForm`, calls `POST /api/enterprise-inquiry` |
| Scroll animations | IntersectionObserver on `.animate-on-scroll` elements |
| Smooth scrolling | `scroll-behavior: smooth` + JS for anchor links |

---

## Service-to-Category Mapping

```
PC/Laptop     → Hardware Diagnosis, Virus Removal, Screen Replacement, Data Recovery, Other
iPhone        → Screen Replacement, Battery Replacement, Charging Port Repair, Other
Android Phone → Screen Replacement, Battery Replacement, Charging Port Repair, Other
Nintendo Switch → Joy-Con Drift Fix, HDMI Port Repair, Disc Drive Repair, Internal Cleaning, Other
PlayStation   → HDMI Port Repair, Disc Drive Repair, Internal Cleaning, Other
Xbox          → HDMI Port Repair, Disc Drive Repair, Internal Cleaning, Other
iPad/Tablet   → Screen Replacement, Battery Replacement, Charging Port Repair, Other
Other         → Diagnostic Service, Other
```

---

## Design System

### Colors (HSL)
| Token | Value | Hex approx |
|-------|-------|------------|
| --background | 222 47% 7% | #0c1524 |
| --foreground | 210 40% 98% | #f8fafc |
| --card | 222 47% 11% | #111d30 |
| --primary | 217 91% 60% | #3b82f6 |
| --secondary | 217 32% 17% | #1e293b |
| --muted-foreground | 215 20% 65% | #94a3b8 |
| --border | 217 32% 17% | #1e293b |

### Typography
- **Body:** Inter, 400/500/600 weight
- **Headings:** Outfit, 700/800 weight, tight tracking
- **Scale:** 14px base → 72px hero heading

### Spacing & Layout
- Max width: 80rem (1280px)
- Section padding: 6rem vertical
- Card padding: 1.5rem
- Grid gaps: 1.5rem (cards), 1.5rem (form fields)

### Effects
- Glow border: `box-shadow: 0 0 20px hsl(217 91% 60% / 0.1)`
- Glass card: `backdrop-blur: 24px`, semi-transparent bg
- Gradient text: `background-clip: text` with primary→blue-400
- Ping animation: CSS `@keyframes ping` on dot
- Fade-in: opacity 0→1, translateY 20px→0 with IntersectionObserver

---

## Future Enhancements

### Phase 1 — Backend Integration ✅ DONE
- [x] Connect booking form to a backend API (Node.js/Express + SQLite)
- [x] Store submissions in a database (SQLite via better-sqlite3)
- [x] Form validation with server-side checks
- [ ] Email notifications on form submission (SendGrid, Resend, or SMTP)

### Phase 1a — Enterprise Inquiry ✅ DONE
- [x] Enterprise inquiry modal with explicit form IDs and selectors
- [x] `POST /api/enterprise-inquiry` endpoint with validation
- [x] Enterprise inquiry status tracking (`GET /api/enterprise-inquiry/:id`)

### Phase 2 — Business Features
- [ ] Repair status tracking page (customer enters ticket number)
- [ ] Admin dashboard to manage incoming repair requests
- [ ] Real-time chat widget for customer support
- [ ] Google Maps embed for store location
- [ ] Customer reviews/testimonials section

### Phase 3 — Marketing & SEO
- [ ] Meta tags, Open Graph, structured data (LocalBusiness schema)
- [ ] Sitemap.xml and robots.txt
- [ ] Analytics integration (Google Analytics or Plausible)
- [ ] FAQ section with accordion
- [ ] Blog section for repair tips and SEO content

### Phase 4 — Advanced
- [ ] Online payment integration (Stripe) for deposits
- [ ] Appointment scheduling with calendar integration
- [ ] SMS notifications (Twilio) for repair status updates
- [ ] Parts inventory management
- [ ] Multi-location support

---

## File Structure (Future)

```
anthracitetech/
├── service/
│   ├── index.html          # Current single-file site
│   ├── architecture.md     # This file
│   ├── assets/             # Future: images, icons
│   │   ├── hero-bg.png
│   │   └── favicon.svg
│   ├── css/                # Future: extracted stylesheets
│   │   └── styles.css
│   ├── js/                 # Future: modular scripts
│   │   ├── main.js
│   │   ├── form.js
│   │   └── animations.js
│   └── api/                # Future: serverless functions
│       ├── submit-repair.js
│       └── check-status.js
```

---

## Hosting Options

| Platform | Cost | Notes |
|----------|------|-------|
| Netlify | Free | Drag-and-drop deploy, forms built-in |
| Vercel | Free | Git-based deploys, serverless functions |
| GitHub Pages | Free | Static only, no backend |
| Cloudflare Pages | Free | Fast CDN, workers for API |
| here.now | Free | Instant static hosting via Hermes |

---

## Tools Used to Build This

1. **web_extract** — Scraped the page content and text structure in markdown
2. **browser_navigate** — Loaded the live site for interactive inspection
3. **browser_console** (JS evaluation) — Extracted:
   - Full HTML source (`document.documentElement.outerHTML`)
   - CSS custom properties (computed styles on `:root`)
   - External CSS file content (navigated to the CSS asset URL)
   - External JS bundle content (for understanding React component logic)
4. **browser_vision** — Screenshot capture for visual reference
5. **browser_snapshot** — Accessibility tree for semantic structure and element refs
6. **write_file** — Created the final index.html
7. **delegate_task** — Subagent built the full HTML file from the scraped data
