# Anthracite Tech Co. Website

Static website for **Anthracite Tech Co.** — a tech repair, support, and IT services company.

**Domain:** [anthracitetechco.com](https://anthracitetechco.com)  
**Repo:** https://github.com/diablowrx2/anthracitetech

---

## 📖 Background

This project was migrated from the `eztech` project (EZTech Repairs). All references, branding, and domains were updated:

| From | To |
|------|-----|
| EZTech Repairs | **Anthracite Tech Co.** |
| `eztechrepairs.com` | **anthracitetechco.com** |
| `eztech` (code prefix) | **anthracitetech** |

---

## 🗂️ What's Included

### Pages (20 HTML files)

| Page | File |
|------|------|
| Homepage | `service/index.html` |
| Emergency Repair | `service/emergency-repair.html` |
| Repair Process | `service/repair-process.html` |
| Tech Guide | `service/tech-guide.html` |
| Job Summary | `service/job-summary.html` |
| Nationwide Remote Support | `service/nationwide-remote.html` |
| Remote Troubleshooting | `service/remote-troubleshooting.html` |
| Remote Troubleshooting Booking | `service/remote-troubleshooting-booking.html` |
| Remote Troubleshooting (Dedicated) | `service/remote-troubleshooting-dedicated.html` |
| Remote Support | `service/remote-support.html` |
| **Location pages** (8 cities) | `service/locations/*.html` |

**Cities:** Camp Hill, Carlisle, Harrisburg, Hershey, Lancaster, Lebanon, Mechanicsburg, York

### Assets & Static Files
- `favicon.svg`, `hero-bg.png`
- `robots.txt`, `sitemap.xml`
- `js/schema-validator.js`, `js/jszip.min.js`
- `vendor/` — html2canvas, jspdf, email.min.js
- `email-templates/post-service-followup.html`

### Build & Validation Tools

| Script | Purpose |
|--------|---------|
| `validate:schemas` | Validates JSON-LD Schema.org markup |
| `validate:html` | Checks HTML structure, accessibility, SEO |
| `validate:links` | Checks for broken internal/external links |
| `build` | Runs all validations + copies deployable files to `dist/` |
| `audit:html` | Audits all HTML files by feature category |
| `search` | Searches codebase for features, functions, localStorage keys |

---

## 🚀 Quick Start

```bash
cd service

# Validate everything
npm run validate

# Full build (validate + copy to dist/)
npm run build
```

Build output goes to `service/dist/` — that's your deployable folder.

---

## 🏗️ Architecture

This is a **frontend-only static site**. The backend (Express API, SQLite, systemd service) was removed during migration — it will be rebuilt later on the hosting machine.

```
anthracitetech/
├── service/                    # All website files
│   ├── *.html                  # Pages
│   ├── locations/              # City landing pages
│   ├── js/                     # Client-side JS
│   ├── scripts/                # Build & validation tools
│   ├── vendor/                 # Third-party libs
│   ├── email-templates/        # HTML email templates
│   ├── dist/                   # Build output (gitignored)
│   └── .github/workflows/      # CI validation on push
├── docs/                       # Business docs (kept from eztech)
│   ├── device-repair-processes.md
│   ├── gbp-optimization-checklist.md
│   └── ...
└── AGENTS.md                   # Agent guidelines for this codebase
```

---

## ✅ CI / GitHub Actions

On every push to `master`, GitHub Actions runs:
1. Schema validation
2. HTML validation
3. Link validation
4. Build artifact generation

Artifacts are uploaded and retained for 7 days.

---

## 🌐 Deployment

1. Build: `cd service && npm run build`
2. Copy `service/dist/` contents to your web host
3. Point `anthracitetechco.com` DNS to the host

No server-side runtime required — all pages are self-contained static HTML with inline CSS/JS.

---

## 📝 Notes

- All pages use inline CSS/JS (no bundler needed)
- Schema.org JSON-LD markup is embedded for SEO
- Booking forms store to `localStorage` as fallback (API backend TBD)
- `service/dist/` is gitignored — build locally before deploying
