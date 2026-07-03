#!/usr/bin/env node
/**
 * Anthracite Tech HTML Filesystem Audit Tool
 *
 * Scans directories for HTML files, categorizes them by feature/type,
 * and detects capabilities such as date filtering, localStorage usage,
 * charts, booking forms, analytics, and API integration.
 *
 * Usage:
 *   node scripts/audit-html-filesystem.js [directory] [--json]
 *   node scripts/audit-html-filesystem.js .               # default: service root
 *   node scripts/audit-html-filesystem.js . --json        # machine-readable output
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/* ── Feature detectors ─────────────────────────────────────────────────── */

function detectFeatures(html, filePath) {
  const basename = path.basename(filePath).toLowerCase();
  const title = extractTitle(html) || '';
  const description = extractDescription(html) || '';
  const textPreview = (title + ' ' + description).toLowerCase();

  const features = {
    dateRangeFilter: /date-filter|getDateFilter|applyDateFilter|onPresetChange|onCustomDateChange/i.test(html),
    localStorage: /localStorage\.(getItem|setItem|removeItem)/i.test(html),
    charts: /\bchart\b|\.bar-chart|\bcanvas\b|svg.*sparkline|area chart/i.test(html),
    bookingForm: /booking|schedule.*appointment|book.*now|inline-booking/i.test(html),
    apiIntegration: /fetch\s*\(|XMLHttpRequest|axios|api\//i.test(html),
    schemaOrg: /schema\.org|application\/ld\+json/i.test(html),
    emailTemplate: /email-templates/i.test(filePath) || (/<table[\s\S]*?\{\{[a-z_]+\}\}/i.test(html) && /template|email template/i.test(html)),
    analyticsDashboard: /dashboard|analytics|management reporting|performance data|aggregate.*data/i.test(textPreview),
    technicianTool: /technician|repair guide|step-by-step diagnostics/i.test(textPreview),
    locationPage: /locations\//i.test(filePath),
    redirectPage: /meta\s+http-equiv=["']refresh["']/i.test(html) || /window\.location\.replace/i.test(html),
    emergencyRepair: basename.includes('emergency') || /emergency (repair|tech)|same-day tech repair|urgent tech repair/i.test(textPreview),
    remoteSupport: basename.includes('remote') || /remote (tech support|troubleshooting|screen-sharing)/i.test(textPreview),
    openGraph: /og:title|og:description|og:image/i.test(html),
    twitterCard: /twitter:card/i.test(html),
    responsiveImages: /srcset|sizes=/i.test(html),
    serviceWorker: /navigator\.serviceWorker/i.test(html),
    web3Forms: /web3forms/i.test(html),
    emailJs: /emailjs/i.test(html)
  };

  // Refine: email templates are a distinct category
  if (features.emailTemplate) {
    features.bookingForm = false;
    features.analyticsDashboard = false;
  }

  // Refine: redirect pages are minimal
  if (features.redirectPage) {
    features.analyticsDashboard = false;
    features.technicianTool = false;
  }

  return features;
}

function categorize(filePath, features, title, description) {
  const basename = path.basename(filePath);
  const dir = path.dirname(filePath);
  const combined = ((description || '') + ' ' + (title || '')).toLowerCase();

  if (features.emailTemplate) return 'email-template';
  if (features.locationPage) return 'location-page';
  if (features.redirectPage) return 'redirect';
  if (basename === 'index.html' || basename === 'index.htm') return 'landing-page';
  if (features.emergencyRepair && features.bookingForm) return 'emergency-booking';
  if (features.emergencyRepair) return 'emergency-info';
  if (features.remoteSupport && features.bookingForm) return 'remote-booking';
  if (features.remoteSupport) return 'remote-support';
  if (features.charts || features.dateRangeFilter) return 'analytics-dashboard';
  if (features.analyticsDashboard && (features.charts || features.localStorage)) return 'analytics-dashboard';
  if (features.technicianTool && /guide|checklist|workflow/i.test(combined)) return 'technician-tool';
  if (features.bookingForm) return 'booking-page';
  if (/repair.?process|how.it.works/i.test(combined)) return 'process-info';

  return 'informational';
}

/* ── File scanning ─────────────────────────────────────────────────────── */

function findHtmlFiles(dir, exclude = []) {
  const results = [];

  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relative = path.relative(dir, fullPath);

      if (exclude.some(pattern => relative.includes(pattern))) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

function extractTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

function extractDescription(html) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return match ? match[1].trim() : null;
}

function extractCanonical(html) {
  const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
  return match ? match[1].trim() : null;
}

function extractLocalStorageKeys(html) {
  const keys = new Set();
  const regex = /localStorage\.(?:getItem|setItem|removeItem)\s*\(\s*["']([^"']+)["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    keys.add(m[1]);
  }
  return Array.from(keys).sort();
}

/* ── CLI helpers ───────────────────────────────────────────────────────── */

function printHelp() {
  console.log(`
${ANSI.bold}Usage:${ANSI.reset} node scripts/audit-html-filesystem.js [directory] [options]

${ANSI.bold}Options:${ANSI.reset}
  --json                     Output machine-readable JSON
  --category <cat>           Filter to a single category (e.g. analytics-dashboard)
  --has-feature <feature>    Only show files that have this feature
  --missing-feature <feat>   Only show files missing this feature
  --help                     Show this help message

${ANSI.bold}Examples:${ANSI.reset}
  node scripts/audit-html-filesystem.js .
  node scripts/audit-html-filesystem.js . --json
  node scripts/audit-html-filesystem.js . --category analytics-dashboard
  node scripts/audit-html-filesystem.js . --category analytics-dashboard --missing-feature dateRangeFilter
  node scripts/audit-html-filesystem.js . --has-feature bookingForm

${ANSI.bold}Known categories:${ANSI.reset}
  landing-page, analytics-dashboard, technician-tool, booking-page,
  remote-booking, remote-support, emergency-booking, emergency-info,
  location-page, process-info, informational, email-template, redirect

${ANSI.bold}Known features:${ANSI.reset}
  dateRangeFilter, localStorage, charts, bookingForm, apiIntegration,
  schemaOrg, analyticsDashboard, technicianTool, openGraph, responsiveImages,
  serviceWorker, web3Forms, emailJs, emailTemplate, locationPage, redirectPage,
  emergencyRepair, remoteSupport, twitterCard
`);
}

/* ── Reporting ─────────────────────────────────────────────────────────── */

function buildInventory(dir, files) {
  const inventory = [];

  for (const filePath of files) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const relative = path.relative(dir, filePath);
    const title = extractTitle(html);
    const description = extractDescription(html);
    const canonical = extractCanonical(html);
    const features = detectFeatures(html, filePath);
    const category = categorize(filePath, features, title || '', description || '');
    const localStorageKeys = features.localStorage ? extractLocalStorageKeys(html) : [];

    inventory.push({
      path: relative,
      basename: path.basename(filePath),
      sizeBytes: fs.statSync(filePath).size,
      title,
      description: description ? description.substring(0, 120) + (description.length > 120 ? '…' : '') : null,
      canonical,
      category,
      features,
      localStorageKeys: localStorageKeys.slice(0, 8), // cap for readability
      localStorageKeyCount: localStorageKeys.length
    });
  }

  return inventory;
}

function printTextReport(dir, inventory) {
  console.log(`${ANSI.bold}${ANSI.blue}╔══════════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}║       Anthracite Tech HTML Filesystem Audit                                   ║${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}║       ${ANSI.gray}${dir}${ANSI.blue} ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}╚══════════════════════════════════════════════════════════════════════╝${ANSI.reset}`);
  console.log();

  // Group by category
  const byCategory = {};
  for (const item of inventory) {
    byCategory[item.category] = byCategory[item.category] || [];
    byCategory[item.category].push(item);
  }

  const categoryOrder = [
    'landing-page',
    'analytics-dashboard',
    'technician-tool',
    'booking-page',
    'remote-booking',
    'remote-support',
    'emergency-booking',
    'emergency-info',
    'location-page',
    'process-info',
    'informational',
    'email-template',
    'redirect'
  ];

  for (const cat of categoryOrder) {
    const items = byCategory[cat];
    if (!items || items.length === 0) continue;

    const label = cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    console.log(`${ANSI.bold}${ANSI.cyan}▸ ${label} (${items.length})${ANSI.reset}`);

    for (const item of items) {
      const sizeKb = (item.sizeBytes / 1024).toFixed(1);
      const featFlags = [];
      if (item.features.dateRangeFilter) featFlags.push('date-filter');
      if (item.features.localStorage) featFlags.push(`localStorage(${item.localStorageKeyCount})`);
      if (item.features.charts) featFlags.push('charts');
      if (item.features.bookingForm) featFlags.push('booking');
      if (item.features.apiIntegration) featFlags.push('api');
      if (item.features.schemaOrg) featFlags.push('schema');
      if (item.features.analyticsDashboard) featFlags.push('analytics');
      if (item.features.technicianTool) featFlags.push('tech-tool');
      if (item.features.openGraph) featFlags.push('og');

      const flagStr = featFlags.length ? ` ${ANSI.gray}[${featFlags.join(', ')}]${ANSI.reset}` : '';
      console.log(`  ${ANSI.green}●${ANSI.reset} ${ANSI.bold}${item.basename}${ANSI.reset} (${sizeKb} KB)${flagStr}`);
      if (item.title) {
        console.log(`    ${ANSI.gray}${item.title}${ANSI.reset}`);
      }
      if (item.localStorageKeys.length > 0) {
        console.log(`    ${ANSI.gray}  keys: ${item.localStorageKeys.join(', ')}${item.localStorageKeyCount > 8 ? ' …' : ''}${ANSI.reset}`);
      }
    }
    console.log();
  }

  // Summary
  const total = inventory.length;
  const withDateFilter = inventory.filter(i => i.features.dateRangeFilter).length;
  const withLocalStorage = inventory.filter(i => i.features.localStorage).length;
  const withCharts = inventory.filter(i => i.features.charts).length;
  const withBooking = inventory.filter(i => i.features.bookingForm).length;
  const withApi = inventory.filter(i => i.features.apiIntegration).length;

  console.log(`${ANSI.bold}Summary:${ANSI.reset}`);
  console.log(`  Total HTML files audited: ${total}`);
  console.log(`  With date-range filter:   ${withDateFilter}`);
  console.log(`  With localStorage usage:  ${withLocalStorage}`);
  console.log(`  With charts:              ${withCharts}`);
  console.log(`  With booking forms:       ${withBooking}`);
  console.log(`  With API integration:     ${withApi}`);
  console.log();
}

function printJsonReport(inventory) {
  console.log(JSON.stringify(inventory, null, 2));
}

/* ── Main ──────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    dir: '.',
    json: false,
    category: null,
    hasFeature: null,
    missingFeature: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--category':
        opts.category = args[++i];
        break;
      case '--has-feature':
        opts.hasFeature = args[++i];
        break;
      case '--missing-feature':
        opts.missingFeature = args[++i];
        break;
      default:
        if (!arg.startsWith('--') && fs.existsSync(path.resolve(arg))) {
          opts.dir = arg;
        }
        break;
    }
  }

  return opts;
}

function main() {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const targetDir = path.resolve(opts.dir);

  if (!fs.existsSync(targetDir)) {
    console.error(`${ANSI.red}Error: Directory not found: ${targetDir}${ANSI.reset}`);
    process.exit(1);
  }

  const excludePatterns = ['node_modules', '.git', '.herenow', 'tests'];
  const htmlFiles = findHtmlFiles(targetDir, excludePatterns);

  if (htmlFiles.length === 0) {
    console.error(`${ANSI.yellow}No HTML files found in ${targetDir}${ANSI.reset}`);
    process.exit(0);
  }

  let inventory = buildInventory(targetDir, htmlFiles);

  // Apply category filter
  if (opts.category) {
    inventory = inventory.filter(i => i.category === opts.category);
    if (inventory.length === 0) {
      console.error(`${ANSI.yellow}No files match category "${opts.category}".${ANSI.reset}`);
      process.exit(0);
    }
  }

  // Apply feature filters
  if (opts.hasFeature) {
    inventory = inventory.filter(i => i.features[opts.hasFeature] === true);
    if (inventory.length === 0) {
      console.error(`${ANSI.yellow}No files have feature "${opts.hasFeature}".${ANSI.reset}`);
      process.exit(0);
    }
  }

  if (opts.missingFeature) {
    inventory = inventory.filter(i => i.features[opts.missingFeature] !== true);
    if (inventory.length === 0) {
      console.error(`${ANSI.yellow}No files are missing feature "${opts.missingFeature}".${ANSI.reset}`);
      process.exit(0);
    }
  }

  if (opts.json) {
    printJsonReport(inventory);
  } else {
    printTextReport(targetDir, inventory);
  }
}

main();
