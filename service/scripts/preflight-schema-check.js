#!/usr/bin/env node
/**
 * Pre-flight Schema Check — Infer pattern & scope from existing work
 *
 * Reads JSON-LD structured data from existing location pages, infers the
 * canonical schema pattern, and reports gaps so a "Part N/M" agent knows
 * exactly what remains without asking clarifying questions.
 *
 * Usage:
 *   node scripts/preflight-schema-check.js
 *   node scripts/preflight-schema-check.js --part 3 --of 3
 *   node scripts/preflight-schema-check.js --json
 *   node scripts/preflight-schema-check.js --locations-dir locations/ --data locations/locations-data.json
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
  gray: '\x1b[90m',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    part: null,
    of: null,
    json: false,
    locationsDir: path.join(__dirname, '..', 'locations'),
    dataPath: path.join(__dirname, '..', 'locations', 'locations-data.json'),
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--part') opts.part = parseInt(args[++i], 10);
    else if (a === '--of') opts.of = parseInt(args[++i], 10);
    else if (a === '--json') opts.json = true;
    else if (a === '--locations-dir') opts.locationsDir = args[++i];
    else if (a === '--data') opts.dataPath = args[++i];
  }
  return opts;
}

function extractSchemas(html) {
  const schemas = [];
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => schemas.push({ parsed: true, data: item, raw }));
    } catch (e) {
      schemas.push({ parsed: false, error: e.message, raw: raw.substring(0, 200) });
    }
  }
  return schemas;
}

function hasProp(obj, key) {
  return obj && typeof obj === 'object' && key in obj && obj[key] !== null && obj[key] !== undefined && obj[key] !== '';
}

function getSchemaTypes(schemas) {
  return schemas
    .filter(s => s.parsed)
    .map(s => s.data['@type'])
    .filter(Boolean);
}

function buildCanonicalPattern(pages) {
  const typeFrequency = {};
  const propertyPatterns = {};
  let maxTypes = 0;
  let referencePage = null;

  for (const page of pages) {
    if (!page.schemas.length) continue;
    const types = getSchemaTypes(page.schemas);
    if (types.length > maxTypes) {
      maxTypes = types.length;
      referencePage = page;
    }
    for (const s of page.schemas.filter(s => s.parsed)) {
      const t = s.data['@type'];
      if (!t) continue;
      typeFrequency[t] = (typeFrequency[t] || 0) + 1;
      if (!propertyPatterns[t]) propertyPatterns[t] = {};
      for (const key of Object.keys(s.data)) {
        propertyPatterns[t][key] = (propertyPatterns[t][key] || 0) + 1;
      }
    }
  }

  const canonicalTypes = Object.keys(typeFrequency).sort((a, b) => typeFrequency[b] - typeFrequency[a]);

  return {
    referencePage: referencePage ? referencePage.file : null,
    schemaCount: maxTypes,
    canonicalTypes,
    typeFrequency,
    propertyPatterns,
  };
}

function checkDrift(page, locData, siteData) {
  const drift = [];
  const schemas = page.schemas.filter(s => s.parsed).map(s => s.data);

  const localBusiness = schemas.find(s => s['@type'] === 'LocalBusiness');
  if (localBusiness) {
    const expectedUrl = `${siteData.baseUrl}/locations/${locData.id}.html`;
    const expectedId = `${siteData.baseUrl}/locations/${locData.id}.html#localbusiness`;
    const expectedDesc = `Computer repair, phone repair, and IT support in ${locData.headlineSuffix}.`;

    if (hasProp(localBusiness, 'url') && localBusiness.url !== expectedUrl) {
      drift.push({ type: 'LocalBusiness', field: 'url', expected: expectedUrl, actual: localBusiness.url });
    }
    if (hasProp(localBusiness, '@id') && localBusiness['@id'] !== expectedId) {
      drift.push({ type: 'LocalBusiness', field: '@id', expected: expectedId, actual: localBusiness['@id'] });
    }
    if (hasProp(localBusiness, 'description') && !localBusiness.description.includes(locData.name)) {
      drift.push({ type: 'LocalBusiness', field: 'description', hint: `should mention "${locData.name}"` });
    }
    if (hasProp(localBusiness, 'email') && localBusiness.email !== locData.email) {
      drift.push({ type: 'LocalBusiness', field: 'email', expected: locData.email, actual: localBusiness.email });
    }
    if (hasProp(localBusiness, 'address')) {
      const addr = localBusiness.address;
      if (hasProp(addr, 'addressLocality') && addr.addressLocality !== locData.name) {
        drift.push({ type: 'LocalBusiness', field: 'address.addressLocality', expected: locData.name, actual: addr.addressLocality });
      }
      if (hasProp(addr, 'postalCode') && addr.postalCode !== locData.postalCode) {
        drift.push({ type: 'LocalBusiness', field: 'address.postalCode', expected: locData.postalCode, actual: addr.postalCode });
      }
    }
    if (hasProp(localBusiness, 'geo')) {
      const geo = localBusiness.geo;
      if (hasProp(geo, 'latitude') && Math.abs(geo.latitude - locData.lat) > 0.0001) {
        drift.push({ type: 'LocalBusiness', field: 'geo.latitude', expected: locData.lat, actual: geo.latitude });
      }
      if (hasProp(geo, 'longitude') && Math.abs(geo.longitude - locData.lon) > 0.0001) {
        drift.push({ type: 'LocalBusiness', field: 'geo.longitude', expected: locData.lon, actual: geo.longitude });
      }
    }
  }

  const breadcrumb = schemas.find(s => s['@type'] === 'BreadcrumbList');
  if (breadcrumb && hasProp(breadcrumb, 'itemListElement')) {
    const items = Array.isArray(breadcrumb.itemListElement) ? breadcrumb.itemListElement : [breadcrumb.itemListElement];
    const locItem = items.find(i => i.name === locData.name);
    if (locItem && hasProp(locItem, 'item')) {
      const expectedItem = `${siteData.baseUrl}/locations/${locData.id}.html`;
      if (locItem.item !== expectedItem) {
        drift.push({ type: 'BreadcrumbList', field: 'itemListElement.item', expected: expectedItem, actual: locItem.item });
      }
    }
  }

  const org = schemas.find(s => s['@type'] === 'Organization');
  if (org && hasProp(org, '@id')) {
    const expectedOrgId = `${siteData.baseUrl}/#organization`;
    if (org['@id'] !== expectedOrgId) {
      drift.push({ type: 'Organization', field: '@id', expected: expectedOrgId, actual: org['@id'] });
    }
  }

  // Linked-data graph coherence: LocalBusiness.parentOrganization.@id should match Organization.@id
  if (localBusiness && hasProp(localBusiness, 'parentOrganization')) {
    const po = localBusiness.parentOrganization;
    const poId = typeof po === 'string' ? po : po['@id'];
    if (org && hasProp(org, '@id') && poId !== org['@id']) {
      drift.push({ type: 'LinkedData', field: 'parentOrganization.@id', expected: org['@id'], actual: poId, message: 'LocalBusiness parentOrganization @id does not match Organization @id' });
    }
  }

  return drift;
}

function analyzePage(filePath, locData, siteData) {
  const html = fs.readFileSync(filePath, 'utf8');
  const schemas = extractSchemas(html);
  const types = getSchemaTypes(schemas);
  const parseErrors = schemas.filter(s => !s.parsed);

  const result = {
    file: path.basename(filePath),
    id: locData ? locData.id : null,
    schemaCount: schemas.length,
    types,
    parseErrors: parseErrors.length,
    parseErrorDetails: parseErrors.map(e => e.error),
    schemas,
    drift: locData ? checkDrift({ file: path.basename(filePath), schemas }, locData, siteData) : [],
  };

  return result;
}

function computeScope(gaps, opts) {
  if (!opts.part || !opts.of) return { scoped: gaps, note: 'Use --part N --of M to scope work across parts.' };

  const total = gaps.length;
  if (total === 0) return { scoped: [], note: 'No remaining work. All pages conform to the canonical pattern.' };

  const perPart = Math.ceil(total / opts.of);
  const start = (opts.part - 1) * perPart;
  const end = Math.min(start + perPart, total);
  const scoped = gaps.slice(start, end);

  return {
    scoped,
    note: `Part ${opts.part}/${opts.of}: items ${start + 1}–${end} of ${total} total gaps`,
    total,
    start: start + 1,
    end,
  };
}

function main() {
  const opts = parseArgs();
  const { locationsDir, dataPath } = opts;

  if (!fs.existsSync(dataPath)) {
    console.error(`${ANSI.red}Error: Data file not found: ${dataPath}${ANSI.reset}`);
    process.exit(1);
  }

  if (!fs.existsSync(locationsDir)) {
    console.error(`${ANSI.red}Error: Locations directory not found: ${locationsDir}${ANSI.reset}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const siteData = data.site;
  const locations = data.locations;

  const htmlFiles = fs.readdirSync(locationsDir).filter(f => f.endsWith('.html'));
  const pages = [];

  for (const file of htmlFiles) {
    const filePath = path.join(locationsDir, file);
    const locId = file.replace('.html', '');
    const locData = locations.find(l => l.id === locId) || null;
    pages.push(analyzePage(filePath, locData, siteData));
  }

  const pattern = buildCanonicalPattern(pages);

  // Gaps analysis
  const gaps = [];

  // 1. Missing HTML files
  for (const loc of locations) {
    const file = `${loc.id}.html`;
    if (!htmlFiles.includes(file)) {
      gaps.push({
        severity: 'critical',
        category: 'missing-file',
        file,
        id: loc.id,
        message: `Missing HTML file for location "${loc.name}"`,
        action: `Generate ${file} from template using locations-data.json`,
      });
    }
  }

  // 2. Missing / incomplete schemas on existing files
  for (const page of pages) {
    const locData = locations.find(l => l.id === page.id);
    if (!locData) continue;

    if (page.schemaCount === 0) {
      gaps.push({
        severity: 'critical',
        category: 'missing-schemas',
        file: page.file,
        id: page.id,
        message: `No JSON-LD schemas found`,
        action: `Add ${pattern.canonicalTypes.join(', ')} schemas`,
      });
      continue;
    }

    const missingTypes = pattern.canonicalTypes.filter(t => !page.types.includes(t));
    for (const t of missingTypes) {
      gaps.push({
        severity: 'high',
        category: 'missing-type',
        file: page.file,
        id: page.id,
        message: `Missing schema type: ${t}`,
        action: `Add ${t} schema block`,
      });
    }

    if (page.parseErrors > 0) {
      gaps.push({
        severity: 'critical',
        category: 'parse-error',
        file: page.file,
        id: page.id,
        message: `${page.parseErrors} JSON-LD block(s) failed to parse`,
        action: `Fix JSON syntax errors`,
        details: page.parseErrorDetails,
      });
    }

    for (const d of page.drift) {
      gaps.push({
        severity: 'medium',
        category: 'schema-drift',
        file: page.file,
        id: page.id,
        message: d.message || `${d.type}.${d.field} drift`,
        action: d.hint
          ? `Review ${d.type}.${d.field} — ${d.hint}`
          : `Correct ${d.type}.${d.field} to "${d.expected}"`,
        detail: d,
      });
    }
  }

  const scope = computeScope(gaps, opts);

  const report = {
    meta: {
      locationsDir: path.resolve(locationsDir),
      dataPath: path.resolve(dataPath),
      totalLocations: locations.length,
      totalPages: pages.length,
      part: opts.part,
      of: opts.of,
    },
    pattern: {
      referencePage: pattern.referencePage,
      canonicalSchemaTypes: pattern.canonicalTypes,
      typeFrequency: pattern.typeFrequency,
      expectedSchemaCount: pattern.schemaCount,
    },
    summary: {
      totalGaps: gaps.length,
      critical: gaps.filter(g => g.severity === 'critical').length,
      high: gaps.filter(g => g.severity === 'high').length,
      medium: gaps.filter(g => g.severity === 'medium').length,
    },
    gaps,
    scope: {
      note: scope.note,
      total: scope.total || gaps.length,
      start: scope.start || 1,
      end: scope.end || gaps.length,
      items: scope.scoped,
    },
  };

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.summary.critical > 0 ? 1 : 0);
  }

  const { bold, red, green, yellow, blue, cyan, gray, reset } = ANSI;

  console.log(`${bold}${blue}╔══════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${blue}║      Pre-flight Schema Check — Pattern & Scope Inference     ║${reset}`);
  console.log(`${bold}${blue}╚══════════════════════════════════════════════════════════════╝${reset}`);
  console.log();
  console.log(`  Locations: ${bold}${report.meta.totalLocations}${reset}  |  Pages found: ${bold}${report.meta.totalPages}${reset}`);
  console.log(`  Reference page: ${cyan}${report.pattern.referencePage || 'none'}${reset}`);
  console.log(`  Canonical schema types: ${green}${report.pattern.canonicalSchemaTypes.join(', ') || 'none'}${reset}`);
  console.log(`  Expected blocks per page: ${bold}${report.pattern.expectedSchemaCount}${reset}`);
  console.log();

  console.log(`${bold}Page Audit:${reset}`);
  for (const page of pages) {
    const locData = locations.find(l => l.id === page.id);
    const name = locData ? locData.name : page.file.replace('.html', '');
    const status = page.schemaCount === 0
      ? `${red}✗ no schemas${reset}`
      : page.types.length < report.pattern.canonicalSchemaTypes.length
        ? `${yellow}⚠ ${page.types.length}/${report.pattern.canonicalSchemaTypes.length} types${reset}`
        : `${green}✓ complete${reset}`;
    const driftCount = page.drift.length;
    const driftLabel = driftCount > 0 ? ` ${yellow}(${driftCount} drift)${reset}` : '';
    console.log(`  ${status.padEnd(30)} ${page.file.padEnd(22)} ${name}${driftLabel}`);
  }
  console.log();

  console.log(`${bold}Gap Summary:${reset}`);
  console.log(`  Critical: ${report.summary.critical > 0 ? red : green}${report.summary.critical}${reset}`);
  console.log(`  High:     ${report.summary.high > 0 ? yellow : green}${report.summary.high}${reset}`);
  console.log(`  Medium:   ${report.summary.medium > 0 ? yellow : green}${report.summary.medium}${reset}`);
  console.log();

  if (gaps.length === 0) {
    console.log(`${green}${bold}✓ All pages conform to the canonical pattern. No remaining work.${reset}`);
  } else {
    console.log(`${bold}Top gaps:${reset}`);
    for (const g of gaps.slice(0, 10)) {
      const color = g.severity === 'critical' ? red : (g.severity === 'high' ? yellow : gray);
      console.log(`  ${color}[${g.severity.toUpperCase()}]${reset} ${g.file}: ${g.message}`);
      console.log(`    → ${cyan}${g.action}${reset}`);
    }
    if (gaps.length > 10) {
      console.log(`  ${gray}... and ${gaps.length - 10} more gaps${reset}`);
    }
    console.log();

    if (opts.part && opts.of) {
      console.log(`${bold}${blue}Scoped for Part ${opts.part}/${opts.of}:${reset}`);
      console.log(`  ${scope.note}`);
      console.log();
      for (const g of scope.scoped) {
        const color = g.severity === 'critical' ? red : (g.severity === 'high' ? yellow : gray);
        console.log(`  ${color}[${g.severity.toUpperCase()}]${reset} ${g.file}: ${g.message}`);
        console.log(`    → ${cyan}${g.action}${reset}`);
      }
    } else {
      console.log(`${gray}Tip: re-run with --part N --of M to scope work across a multi-part task.${reset}`);
    }
  }

  console.log();
  process.exit(report.summary.critical > 0 ? 1 : 0);
}

main();
