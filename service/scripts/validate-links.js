#!/usr/bin/env node
/**
 * Anthracite Tech Link Validator — Build Pipeline
 * Checks for broken internal links, cross-file anchors, malformed URLs,
 * unreachable external href links, and placeholder values.
 *
 * Usage:
 *   node scripts/validate-links.js [path/to/file.html]
 *   node scripts/validate-links.js --strict-external
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

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

const PLACEHOLDERS = [
  'REPLACE_WITH_GSC_CODE',
  'REPLACE_ME',
  'TODO',
  'FIXME',
  'YOUR_',
  'changeme',
  '000-000-0000'
];

// ═══════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════

function findHtmlFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      files.push(...findHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractLinks(html) {
  const links = [];
  const aRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = aRegex.exec(html)) !== null) {
    links.push({ type: 'anchor', url: match[1], raw: match[0] });
  }
  return links;
}

function extractSrcUrls(html) {
  const urls = [];
  const srcRegex = /(?:src|href)=["'](https?:\/\/[^"']+)["']/gi;
  let match;
  while ((match = srcRegex.exec(html)) !== null) {
    urls.push({ type: 'external', url: match[1] });
  }
  return urls;
}

function extractTelLinks(html) {
  const tels = [];
  const telRegex = /href=["']tel:([^"]*)["']/gi;
  let match;
  while ((match = telRegex.exec(html)) !== null) {
    tels.push(match[1]);
  }
  return tels;
}

function extractSmsLinks(html) {
  const sms = [];
  const smsRegex = /href=["']sms:([^"]*)["']/gi;
  let match;
  while ((match = smsRegex.exec(html)) !== null) {
    sms.push(match[1]);
  }
  return sms;
}

function extractMailtoLinks(html) {
  const mails = [];
  const mailRegex = /href=["']mailto:([^"]*)["']/gi;
  let match;
  while ((match = mailRegex.exec(html)) !== null) {
    mails.push(match[1]);
  }
  return mails;
}

function checkPlaceholders(html) {
  const found = [];
  PLACEHOLDERS.forEach(ph => {
    const regex = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      const before = html.substring(Math.max(0, match.index - 50), match.index);
      if (/placeholder=["'][^"']*$/.test(before)) continue;
      const around = html.substring(Math.max(0, match.index - 20), match.index + ph.length + 20);
      if (/var\s+placeholder|let\s+placeholder|const\s+placeholder/.test(around)) continue;
      // Skip code comparisons against placeholder strings (e.g., !== 'YOUR_' or .startsWith('YOUR_'))
      if (/!==\s*['"]YOUR_|===\s*['"]YOUR_|\.startsWith\(['"]YOUR_|\.includes\(['"]YOUR_/.test(around)) continue;

      const line = html.substring(0, match.index).split('\n').length;
      found.push({ placeholder: ph, line, context: html.substring(Math.max(0, match.index - 30), match.index + ph.length + 30).replace(/\n/g, ' ') });
    }
  });
  return found;
}

function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function extractAllIds(html) {
  const ids = new Set();
  const idRegex = /\sid=["']([^"']+)["']/gi;
  let match;
  while ((match = idRegex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

function parseLinkType(url) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { type: 'external', url };
  }
  if (url.startsWith('mailto:')) return { type: 'mailto', url };
  if (url.startsWith('tel:')) return { type: 'tel', url };
  if (url.startsWith('sms:')) return { type: 'sms', url };
  if (url === '#') return { type: 'empty-hash', url };
  if (url.startsWith('#')) return { type: 'fragment', id: url.slice(1) };

  const hashIndex = url.indexOf('#');
  const filePart = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : null;

  if (/\.html?$/i.test(filePart)) {
    return { type: 'cross-file', file: filePart, fragment };
  }

  return { type: 'internal-path', path: url, fragment };
}

function requestUrl(url, method, timeoutMs, maxRedirects) {
  return new Promise((resolve) => {
    if (maxRedirects <= 0) {
      resolve({ ok: false, status: 'TOO_MANY_REDIRECTS' });
      return;
    }

    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'User-Agent': 'Anthracite Tech-LinkValidator/1.0',
        'Accept': '*/*'
      }
    };

    const req = client.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        requestUrl(redirectUrl, method, timeoutMs, maxRedirects - 1).then(resolve);
        return;
      }

      res.resume(); // consume body to free connection
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
    });

    req.on('error', (err) => resolve({ ok: false, status: 'ERROR', error: err.message }));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ ok: false, status: 'TIMEOUT' });
    });
    req.end();
  });
}

async function checkExternalUrl(url, timeoutMs = 8000) {
  let result = await requestUrl(url, 'HEAD', timeoutMs, 5);
  if (result.status === 405 || result.status === 501) {
    result = await requestUrl(url, 'GET', timeoutMs, 5);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// Per-file validation
// ═══════════════════════════════════════════════════════════════

async function validateFile(filePath, allFileIds, strictExternal) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const baseDir = path.dirname(filePath);
  const relPath = path.relative(process.cwd(), filePath);

  let errors = 0;
  let warnings = 0;

  console.log(`${ANSI.bold}${ANSI.cyan}▶ ${relPath}${ANSI.reset}`);

  // ── Placeholders ─────────────────────────────────────────
  const placeholders = checkPlaceholders(html);
  if (placeholders.length === 0) {
    console.log(`  ${ANSI.green}✓${ANSI.reset} No placeholder values found`);
  } else {
    placeholders.forEach(p => {
      console.log(`  ${ANSI.red}✗${ANSI.reset} Line ${p.line}: "${p.placeholder}"`);
      console.log(`      ${ANSI.gray}${p.context}${ANSI.reset}`);
      errors++;
    });
  }

  // ── Categorise links ─────────────────────────────────────
  const links = extractLinks(html);
  const sameFileIds = allFileIds.get(path.resolve(filePath));

  const crossFileLinks = [];
  const fragmentLinks = [];
  const internalPaths = [];
  const externalLinks = [];
  const emptyHashLinks = [];

  links.forEach(l => {
    const parsed = parseLinkType(l.url);
    if (parsed.type === 'cross-file') {
      crossFileLinks.push({ ...l, ...parsed });
    } else if (parsed.type === 'fragment') {
      fragmentLinks.push({ ...l, ...parsed });
    } else if (parsed.type === 'internal-path') {
      internalPaths.push({ ...l, ...parsed });
    } else if (parsed.type === 'external') {
      externalLinks.push({ ...l, ...parsed });
    } else if (parsed.type === 'empty-hash') {
      emptyHashLinks.push(l);
    } else if (parsed.type === 'sms') {
      // SMS links are validated separately like tel links
    }
  });

  // ── Internal paths (non-HTML) ────────────────────────────
  if (internalPaths.length > 0) {
    console.log(`${ANSI.bold}  Internal Path Checks:${ANSI.reset}`);
    internalPaths.forEach(l => {
      const targetPath = path.join(baseDir, l.path);
      const exists = fs.existsSync(targetPath);
      const status = exists ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.red}✗${ANSI.reset}`;
      if (!exists) errors++;
      console.log(`    ${status} ${l.url} ${exists ? 'EXISTS' : 'MISSING'}`);
    });
  }

  // ── Cross-file references ────────────────────────────────
  if (crossFileLinks.length > 0) {
    console.log(`${ANSI.bold}  Cross-File Link Checks:${ANSI.reset}`);
    for (const l of crossFileLinks) {
      const targetPath = path.resolve(baseDir, l.file);
      const exists = fs.existsSync(targetPath);

      if (!exists) {
        console.log(`    ${ANSI.red}✗${ANSI.reset} ${l.url} FILE MISSING`);
        errors++;
        continue;
      }

      let fragmentOk = null;
      if (l.fragment !== null && l.fragment !== '') {
        const targetIds = allFileIds.get(targetPath);
        if (targetIds) {
          fragmentOk = targetIds.has(l.fragment);
        }
      }

      if (fragmentOk === false) {
        console.log(`    ${ANSI.red}✗${ANSI.reset} ${l.url} FILE EXISTS, ANCHOR #${l.fragment} MISSING`);
        errors++;
      } else if (fragmentOk === true) {
        console.log(`    ${ANSI.green}✓${ANSI.reset} ${l.url} FILE EXISTS, ANCHOR #${l.fragment} FOUND`);
      } else {
        console.log(`    ${ANSI.green}✓${ANSI.reset} ${l.url} FILE EXISTS${l.fragment ? ` (anchor not checked: ${l.fragment})` : ''}`);
      }
    }
  }

  // ── Same-file fragments ──────────────────────────────────
  if (fragmentLinks.length > 0) {
    console.log(`${ANSI.bold}  Fragment Link Checks:${ANSI.reset}`);
    fragmentLinks.forEach(l => {
      const exists = sameFileIds.has(l.id);
      const status = exists ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.red}✗${ANSI.reset}`;
      if (!exists) errors++;
      console.log(`    ${status} #${l.id} ${exists ? 'FOUND' : 'MISSING'}`);
    });
  }

  // ── Empty-hash links ─────────────────────────────────────
  if (emptyHashLinks.length > 0) {
    console.log(`${ANSI.bold}  Empty Hash Link Checks:${ANSI.reset}`);
    emptyHashLinks.forEach(l => {
      if (/id=["'](?:gbp|yelp|review|js-|dynamic)/.test(l.raw)) {
        console.log(`    ${ANSI.gray}○ # (dynamic link with id, skipped)${ANSI.reset}`);
      } else {
        console.log(`    ${ANSI.red}✗${ANSI.reset} # (empty hash without dynamic id) MISSING`);
        errors++;
      }
    });
  }

  // ── External href reachability ───────────────────────────
  if (externalLinks.length > 0) {
    console.log(`${ANSI.bold}  External HREF Reachability Checks:${ANSI.reset}`);
    for (const l of externalLinks) {
      // Strip fragment before HTTP request
      const url = l.url.replace(/#.*$/, '');
      const result = await checkExternalUrl(url);

      if (result.ok) {
        console.log(`    ${ANSI.green}✓${ANSI.reset} ${url} (${result.status})`);
      } else {
        const isError = strictExternal;
        const icon = isError ? `${ANSI.red}✗` : `${ANSI.yellow}⚠`;
        const label = isError ? 'BROKEN' : 'UNREACHABLE';
        if (isError) errors++; else warnings++;
        const detail = result.error ? `: ${result.error}` : '';
        console.log(`    ${icon}${ANSI.reset} ${url} ${label} (${result.status}${detail})`);
      }
    }
  }

  // ── External src/href format ─────────────────────────────
  const srcExternals = extractSrcUrls(html);
  const badSrcUrls = srcExternals.filter(e => !validateUrl(e.url));
  if (badSrcUrls.length > 0) {
    console.log(`${ANSI.bold}  External URL Format Checks:${ANSI.reset}`);
    badSrcUrls.forEach(u => {
      console.log(`    ${ANSI.red}✗${ANSI.reset} Malformed URL: ${u.url}`);
      errors++;
    });
  }

  // ── Tel links ────────────────────────────────────────────
  const tels = extractTelLinks(html);
  if (tels.length > 0) {
    console.log(`${ANSI.bold}  Telephone Link Checks:${ANSI.reset}`);
    tels.forEach(t => {
      const isValid = /^\+?[\d\s\-\(\)\.]+$/.test(t);
      const status = isValid ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.yellow}⚠${ANSI.reset}`;
      if (!isValid) warnings++;
      console.log(`    ${status} tel:${t} ${isValid ? 'OK' : 'VERIFY FORMAT'}`);
    });
  }

  // ── SMS links ────────────────────────────────────────────
  const smsLinks = extractSmsLinks(html);
  if (smsLinks.length > 0) {
    console.log(`${ANSI.bold}  SMS Link Checks:${ANSI.reset}`);
    smsLinks.forEach(s => {
      const isValid = /^\+?[\d\s\-\(\)\.]+$/.test(s);
      const status = isValid ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.yellow}⚠${ANSI.reset}`;
      if (!isValid) warnings++;
      console.log(`    ${status} sms:${s} ${isValid ? 'OK' : 'VERIFY FORMAT'}`);
    });
  }

  // ── Mailto links ─────────────────────────────────────────
  const mails = extractMailtoLinks(html);
  if (mails.length > 0) {
    console.log(`${ANSI.bold}  Email Link Checks:${ANSI.reset}`);
    mails.forEach(m => {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m);
      const status = isValid ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.yellow}⚠${ANSI.reset}`;
      if (!isValid) warnings++;
      console.log(`    ${status} mailto:${m} ${isValid ? 'OK' : 'VERIFY FORMAT'}`);
    });
  }

  return { errors, warnings };
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const strictExternal = args.includes('--strict-external');
  const fileArgs = args.filter(a => !a.startsWith('--'));

  let htmlFiles;
  if (fileArgs.length > 0) {
    htmlFiles = fileArgs.map(f => path.resolve(f));
  } else {
    const serviceDir = path.join(__dirname, '..');
    htmlFiles = findHtmlFiles(serviceDir);
  }

  htmlFiles = htmlFiles.filter(f => fs.existsSync(f));

  if (htmlFiles.length === 0) {
    console.error(`${ANSI.red}Error: No HTML files found.${ANSI.reset}`);
    process.exit(1);
  }

  console.log(`${ANSI.bold}${ANSI.blue}╔══════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}║       Anthracite Tech Link Validator — Build Pipeline                 ║${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}╚══════════════════════════════════════════════════════════════╝${ANSI.reset}`);
  console.log();
  console.log(`${ANSI.gray}Scanning ${htmlFiles.length} HTML file(s)…${ANSI.reset}`);
  console.log();

  // Pre-load all IDs from every HTML file so cross-file anchors can be verified.
  const allFileIds = new Map();
  for (const filePath of htmlFiles) {
    const html = fs.readFileSync(filePath, 'utf-8');
    allFileIds.set(path.resolve(filePath), extractAllIds(html));
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const filePath of htmlFiles) {
    const result = await validateFile(filePath, allFileIds, strictExternal);
    totalErrors += result.errors;
    totalWarnings += result.warnings;
    console.log();
  }

  console.log(`${ANSI.bold}Summary:${ANSI.reset} ${totalErrors === 0 ? ANSI.green : ANSI.red}${totalErrors} errors${ANSI.reset}, ${ANSI.yellow}${totalWarnings} warnings${ANSI.reset}`);
  console.log();

  if (totalErrors > 0) {
    console.log(`${ANSI.red}${ANSI.bold}✗ Link validation failed. Fix errors before deploying.${ANSI.reset}`);
    process.exit(1);
  } else {
    console.log(`${ANSI.green}${ANSI.bold}✓ Link validation passed.${ANSI.reset}`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
