#!/usr/bin/env node
/**
 * Anthracite Tech Schema Validator — Build Pipeline
 * Validates JSON-LD structured data in index.html against Schema.org
 * and Google Rich Results requirements at build time.
 *
 * Usage:
 *   node scripts/validate-schemas.js [path/to/index.html]
 *
 * Exit codes:
 *   0 = all schemas pass
 *   1 = schema errors or parse failures
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RULES = {
  LocalBusiness: {
    required: ['@context', '@type', 'name', 'address'],
    recommended: ['image', 'url', 'telephone', 'geo', 'openingHoursSpecification', 'priceRange', 'areaServed'],
    googleRequired: ['@context', '@type', 'name', 'address'],
    googleRecommended: ['image', 'url', 'telephone', 'geo', 'openingHoursSpecification', 'priceRange', 'aggregateRating', 'review']
  },
  WebSite: {
    required: ['@context', '@type', 'name', 'url'],
    recommended: ['potentialAction'],
    googleRequired: ['@context', '@type', 'name', 'url'],
    googleRecommended: ['potentialAction']
  },
  BreadcrumbList: {
    required: ['@context', '@type', 'itemListElement'],
    recommended: [],
    googleRequired: ['@context', '@type', 'itemListElement'],
    googleRecommended: []
  },
  FAQPage: {
    required: ['@context', '@type', 'mainEntity'],
    recommended: [],
    googleRequired: ['@context', '@type', 'mainEntity'],
    googleRecommended: []
  },
  Service: {
    required: ['@context', '@type', 'name'],
    recommended: ['description', 'provider', 'areaServed', 'offers'],
    googleRequired: ['@context', '@type', 'name'],
    googleRecommended: ['description', 'provider', 'areaServed']
  },
  OfferCatalog: {
    required: ['@context', '@type', 'name'],
    recommended: ['itemListElement'],
    googleRequired: ['@context', '@type', 'name'],
    googleRecommended: []
  },
  Offer: {
    required: ['@context', '@type'],
    recommended: ['name', 'description', 'url', 'price', 'priceCurrency', 'availability'],
    googleRequired: ['@context', '@type'],
    googleRecommended: ['name', 'price', 'priceCurrency', 'availability']
  },
  HowTo: {
    required: ['@context', '@type', 'name'],
    recommended: ['step', 'totalTime', 'estimatedCost', 'supply', 'tool'],
    googleRequired: ['@context', '@type', 'name'],
    googleRecommended: ['step', 'totalTime']
  }
};

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

function hasProp(obj, key) {
  return obj && typeof obj === 'object' && key in obj && obj[key] !== null && obj[key] !== undefined && obj[key] !== '';
}

function validateOne(schema) {
  const type = schema['@type'] || 'Unknown';
  const rule = RULES[type] || null;
  const results = {
    type,
    valid: true,
    errors: [],
    warnings: [],
    info: [],
    google: { pass: true, errors: [], warnings: [] }
  };

  if (!rule) {
    results.warnings.push(`No validation rules for type: ${type}`);
    results.google.warnings.push(`No Google validation rules for type: ${type}`);
    return results;
  }

  rule.required.forEach(k => {
    if (!hasProp(schema, k)) {
      results.errors.push(`Missing required property: ${k}`);
      results.valid = false;
    }
  });

  rule.recommended.forEach(k => {
    if (!hasProp(schema, k)) {
      results.warnings.push(`Missing recommended property: ${k}`);
    }
  });

  rule.googleRequired.forEach(k => {
    if (!hasProp(schema, k)) {
      results.google.errors.push(`Missing Google-required property: ${k}`);
      results.google.pass = false;
    }
  });

  rule.googleRecommended.forEach(k => {
    if (!hasProp(schema, k)) {
      results.google.warnings.push(`Missing Google-recommended property: ${k}`);
    }
  });

  if (hasProp(schema, '@context')) {
    const ctx = schema['@context'];
    if (typeof ctx === 'string' && !ctx.includes('schema.org') && ctx !== 'https://schema.org') {
      results.errors.push('@context must reference schema.org');
      results.valid = false;
    }
  }

  if (type === 'LocalBusiness') {
    if (hasProp(schema, 'address')) {
      const addr = schema.address;
      if (!hasProp(addr, 'streetAddress')) results.google.warnings.push('address.streetAddress recommended for Google');
      if (!hasProp(addr, 'addressLocality')) results.google.warnings.push('address.addressLocality recommended for Google');
      if (!hasProp(addr, 'addressRegion')) results.google.warnings.push('address.addressRegion recommended for Google');
      if (!hasProp(addr, 'postalCode')) results.google.warnings.push('address.postalCode recommended for Google');
    }
    if (hasProp(schema, 'geo')) {
      const geo = schema.geo;
      if (!hasProp(geo, 'latitude') || !hasProp(geo, 'longitude')) {
        results.google.warnings.push('geo should include latitude and longitude');
      }
    }
    if (!hasProp(schema, 'aggregateRating') && !hasProp(schema, 'review')) {
      results.info.push('Consider adding aggregateRating or review for Rich Results eligibility');
    }
  }

  if (type === 'FAQPage') {
    if (hasProp(schema, 'mainEntity')) {
      const ents = Array.isArray(schema.mainEntity) ? schema.mainEntity : [schema.mainEntity];
      ents.forEach((ent, i) => {
        if (!hasProp(ent, '@type') || ent['@type'] !== 'Question') {
          results.google.warnings.push(`mainEntity[${i}] should be @type: Question`);
        }
        if (hasProp(ent, 'acceptedAnswer')) {
          const ans = ent.acceptedAnswer;
          if (!hasProp(ans, '@type') || ans['@type'] !== 'Answer') {
            results.google.warnings.push(`mainEntity[${i}].acceptedAnswer should be @type: Answer`);
          }
        }
      });
    }
  }

  if (type === 'BreadcrumbList') {
    if (hasProp(schema, 'itemListElement')) {
      const items = Array.isArray(schema.itemListElement) ? schema.itemListElement : [schema.itemListElement];
      items.forEach((item, i) => {
        if (!hasProp(item, '@type') || item['@type'] !== 'ListItem') {
          results.google.warnings.push(`itemListElement[${i}] should be @type: ListItem`);
        }
        if (!hasProp(item, 'position')) {
          results.google.warnings.push(`itemListElement[${i}] missing position`);
        }
      });
    }
  }

  return results;
}

function extractSchemas(html) {
  const schemas = [];
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let idx = 0;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim();
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      items.forEach(item => {
        schemas.push({ index: idx, data: item, rawLength: raw.length });
      });
    } catch (e) {
      schemas.push({ index: idx, parseError: e.message, raw: raw.substring(0, 200) });
    }
    idx++;
  }
  return schemas;
}

function buildReport(schemas) {
  const report = {
    total: schemas.length,
    parsed: 0,
    failed: 0,
    results: [],
    summary: { pass: 0, fail: 0, googlePass: 0, googleFail: 0 }
  };

  schemas.forEach(s => {
    if (s.parseError) {
      report.failed++;
      report.results.push({ index: s.index, parseError: s.parseError, raw: s.raw });
      return;
    }
    report.parsed++;
    const res = validateOne(s.data);
    report.results.push({ index: s.index, type: res.type, result: res });
    if (res.valid) report.summary.pass++; else report.summary.fail++;
    if (res.google.pass) report.summary.googlePass++; else report.summary.googleFail++;
  });

  return report;
}

function printReport(report) {
  const { bold, red, green, yellow, blue, cyan, gray, reset } = ANSI;

  console.log(`${bold}${blue}╔══════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${bold}${blue}║       Anthracite Tech Schema Validator — Build Pipeline               ║${reset}`);
  console.log(`${bold}${blue}╚══════════════════════════════════════════════════════════════╝${reset}`);
  console.log();
  console.log(`  Total JSON-LD blocks: ${bold}${report.total}${reset}`);
  console.log(`  Parsed: ${green}${report.parsed}${reset}  |  Failed: ${report.failed > 0 ? red : green}${report.failed}${reset}`);
  console.log(`  Schema.org Pass: ${green}${report.summary.pass}${reset}  |  Fail: ${report.summary.fail > 0 ? red : green}${report.summary.fail}${reset}`);
  console.log(`  Google Pass: ${green}${report.summary.googlePass}${reset}  |  Fail: ${report.summary.googleFail > 0 ? yellow : green}${report.summary.googleFail}${reset}`);
  console.log();

  report.results.forEach(r => {
    if (r.parseError) {
      console.log(`${red}${bold}✗ Block #${r.index + 1} — Parse Error${reset}`);
      console.log(`  ${gray}Error:${reset} ${r.parseError}`);
      console.log(`  ${gray}Raw:${reset} ${r.raw}...`);
      console.log();
      return;
    }

    const res = r.result;
    const color = res.valid && res.google.pass ? green : (res.valid ? yellow : red);
    const icon = res.valid && res.google.pass ? '✓' : (res.valid ? '⚠' : '✗');
    const label = res.valid && res.google.pass ? 'PASS' : (res.valid ? 'WARN' : 'FAIL');

    console.log(`${color}${bold}${icon} Block #${r.index + 1}: ${r.type} [${label}]${reset}`);

    if (res.errors.length) {
      console.log(`  ${red}Required Errors:${reset}`);
      res.errors.forEach(e => console.log(`    • ${e}`));
    }
    if (res.google.errors.length) {
      console.log(`  ${red}Google Errors:${reset}`);
      res.google.errors.forEach(e => console.log(`    • ${e}`));
    }
    if (res.warnings.length) {
      console.log(`  ${yellow}Warnings:${reset}`);
      res.warnings.forEach(e => console.log(`    • ${e}`));
    }
    if (res.google.warnings.length) {
      console.log(`  ${yellow}Google Warnings:${reset}`);
      res.google.warnings.forEach(e => console.log(`    • ${e}`));
    }
    if (res.info.length) {
      console.log(`  ${blue}Info:${reset}`);
      res.info.forEach(e => console.log(`    • ${e}`));
    }
    console.log();
  });

  if (report.summary.fail === 0 && report.failed === 0) {
    console.log(`${green}${bold}✓ All schemas passed validation.${reset}`);
  } else {
    console.log(`${red}${bold}✗ Schema validation failed. Fix errors above before deploying.${reset}`);
  }
  console.log();
}

function main() {
  const htmlPath = process.argv[2] || path.join(__dirname, '..', 'index.html');

  if (!fs.existsSync(htmlPath)) {
    console.error(`${ANSI.red}Error: File not found: ${htmlPath}${ANSI.reset}`);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const schemas = extractSchemas(html);

  if (schemas.length === 0) {
    console.error(`${ANSI.yellow}Warning: No JSON-LD schemas found in ${htmlPath}${ANSI.reset}`);
    process.exit(1);
  }

  const report = buildReport(schemas);
  printReport(report);

  const hasCriticalErrors = report.failed > 0 || report.summary.fail > 0;
  process.exit(hasCriticalErrors ? 1 : 0);
}

main();
