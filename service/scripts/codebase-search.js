#!/usr/bin/env node
/**
 * Anthracite Tech Codebase Search Tool
 *
 * Quick feature-existence checker for the Anthracite Tech codebase.
 * Searches HTML, JS, CSS, and JSON files for patterns, localStorage keys,
 * function names, CSS classes/IDs, or predefined features.
 *
 * Usage:
 *   node scripts/codebase-search.js --localstorage anthracitetech_job_summary_date_filter
 *   node scripts/codebase-search.js --function applyDateFilter
 *   node scripts/codebase-search.js --class date-filter
 *   node scripts/codebase-search.js --id tech-filter-select
 *   node scripts/codebase-search.js --pattern "getItem\\s*\\("
 *   node scripts/codebase-search.js --feature localStorage-persistence
 *   node scripts/codebase-search.js --feature date-filter
 *   node scripts/codebase-search.js --feature tech-filter
 *   node scripts/codebase-search.js --feature booking-form
 *   node scripts/codebase-search.js --feature schema-org
 *   node scripts/codebase-search.js --feature api-endpoint
 *   node scripts/codebase-search.js --feature chart
 *   node scripts/codebase-search.js --json                    # machine-readable
 *
 * Designed for pre-task verification: before spawning a task to add a
 * feature, run this to confirm the feature (or a variant) does not
 * already exist.
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

/* ── Configuration ─────────────────────────────────────────────────────── */

const DEFAULT_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.md']);
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.herenow',
  'tests',
  '__pycache__',
  '.venv',
  'venv'
]);
const EXCLUDE_PATTERNS = [
  /\.bak(?:\d+|\.|$)/i,
  /\.bak\./i,
  /~$/,
  /\.tmp$/i,
  /\.swp$/i
];

const FEATURE_DEFINITIONS = {
  'localStorage-persistence': {
    description: 'localStorage getItem/setItem usage',
    patterns: [/localStorage\.(getItem|setItem|removeItem)/i]
  },
  'date-filter': {
    description: 'Date-range filtering UI or logic',
    patterns: [/date.?filter|getDateFilter|applyDateFilter|onPresetChange|onCustomDateChange/i]
  },
  'tech-filter': {
    description: 'Technician filtering UI or logic',
    patterns: [/tech.?filter|TECH_FILTER|technicianFilter|applyTechFilter/i]
  },
  'booking-form': {
    description: 'Booking or appointment form',
    patterns: [/booking|schedule.*appointment|book.*now|inline-booking/i]
  },
  'schema-org': {
    description: 'Schema.org / JSON-LD structured data',
    patterns: [/schema\.org|application\/ld\+json/i]
  },
  'api-endpoint': {
    description: 'API fetch / XMLHttpRequest calls',
    patterns: [/fetch\s*\(|XMLHttpRequest|axios|api\//i]
  },
  'chart': {
    description: 'Charts or canvas visualisations',
    patterns: [/\bchart\b|\.bar-chart|\bcanvas\b|svg.*sparkline|area chart/i]
  },
  'email-template': {
    description: 'Email template markup',
    patterns: [/<table[\s\S]*?\{\{[a-z_]+\}\}/i, /template|email template/i]
  },
  'service-worker': {
    description: 'Service worker registration',
    patterns: [/navigator\.serviceWorker/i]
  },
  'analytics': {
    description: 'Analytics or dashboard features',
    patterns: [/dashboard|analytics|management reporting|performance data|aggregate.*data/i]
  }
};

/* ── File scanning ─────────────────────────────────────────────────────── */

function shouldExcludeFile(filePath) {
  const basename = path.basename(filePath);
  return EXCLUDE_PATTERNS.some(p => p.test(basename));
}

function shouldExcludeDir(dirName) {
  return EXCLUDE_DIRS.has(dirName);
}

function findFiles(rootDir, extensions = DEFAULT_EXTENSIONS) {
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

      if (entry.isDirectory()) {
        if (!shouldExcludeDir(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.has(ext) && !shouldExcludeFile(fullPath)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

/* ── Search engines ────────────────────────────────────────────────────── */

function searchByPattern(files, regex, rootDir) {
  const results = [];
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const relative = path.relative(rootDir, filePath);
    const fileMatches = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        fileMatches.push({
          line: i + 1,
          text: line.trim()
        });
      }
    }

    if (fileMatches.length > 0) {
      results.push({
        file: relative,
        matches: fileMatches
      });
    }
  }
  return results;
}

function searchLocalStorageKey(files, key, rootDir) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexDirect = new RegExp(`localStorage\\.(?:getItem|setItem|removeItem)\\s*\\(\\s*["']${escaped}["']`, 'i');
  const regexConst = new RegExp(`["']${escaped}["']`, 'i');

  const direct = searchByPattern(files, regexDirect, rootDir);
  const constDecl = searchByPattern(files, regexConst, rootDir);

  // Merge results, preferring direct matches grouped by file
  const byFile = new Map();
  for (const r of direct) {
    byFile.set(r.file, { file: r.file, matches: [...r.matches] });
  }
  for (const r of constDecl) {
    if (byFile.has(r.file)) {
      const existing = byFile.get(r.file);
      for (const m of r.matches) {
        if (!existing.matches.some(em => em.line === m.line)) {
          existing.matches.push(m);
        }
      }
    } else {
      byFile.set(r.file, { file: r.file, matches: [...r.matches] });
    }
  }

  return Array.from(byFile.values()).map(r => ({
    file: r.file,
    matches: r.matches.sort((a, b) => a.line - b.line)
  }));
}

function searchFunctionName(files, name, rootDir) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b(function\\s+${escaped}|const\\s+${escaped}\\s*=|let\\s+${escaped}\\s*=|var\\s+${escaped}\\s*=|${escaped}\\s*\\(|${escaped}\\s*:)\\b`, 'i');
  return searchByPattern(files, regex, rootDir);
}

function searchCssClass(files, name, rootDir) {
  const regex = new RegExp(`class=["'][^"']*\\b${name}\\b[^"']*["']|\\.${name}\\b`, 'i');
  return searchByPattern(files, regex, rootDir);
}

function searchId(files, name, rootDir) {
  const regex = new RegExp(`\\bid=["']${name}["']|#${name}\\b`, 'i');
  return searchByPattern(files, regex, rootDir);
}

function searchFeature(files, featureName, rootDir) {
  const def = FEATURE_DEFINITIONS[featureName];
  if (!def) {
    return { error: `Unknown feature "${featureName}". Known: ${Object.keys(FEATURE_DEFINITIONS).join(', ')}` };
  }

  const allResults = [];
  for (const pattern of def.patterns) {
    const matches = searchByPattern(files, pattern, rootDir);
    allResults.push(...matches);
  }

  // Deduplicate by file+line
  const seen = new Set();
  const deduped = [];
  for (const r of allResults) {
    for (const m of r.matches) {
      const key = `${r.file}:${m.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push({ file: r.file, match: m });
      }
    }
  }

  // Group back by file
  const byFile = {};
  for (const d of deduped) {
    byFile[d.file] = byFile[d.file] || [];
    byFile[d.file].push(d.match);
  }

  return Object.keys(byFile).map(file => ({
    file,
    matches: byFile[file]
  }));
}

/* ── Reporting ─────────────────────────────────────────────────────────── */

function printResults(results, queryLabel, jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify({ query: queryLabel, results }, null, 2));
    return;
  }

  console.log();
  console.log(`${ANSI.bold}${ANSI.blue}╔══════════════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}║  Anthracite Tech Codebase Search                                              ║${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}║  ${ANSI.gray}${queryLabel}${ANSI.blue} ${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}╚══════════════════════════════════════════════════════════════════════╝${ANSI.reset}`);
  console.log();

  if (results.error) {
    console.log(`${ANSI.red}Error: ${results.error}${ANSI.reset}`);
    return;
  }

  if (!Array.isArray(results) || results.length === 0) {
    console.log(`${ANSI.yellow}No matches found.${ANSI.reset}`);
    console.log(`${ANSI.gray}Tip: Try a broader pattern or check a different directory.${ANSI.reset}`);
    return;
  }

  let totalMatches = 0;
  for (const fileResult of results) {
    console.log(`${ANSI.bold}${ANSI.cyan}▸ ${fileResult.file}${ANSI.reset}`);
    for (const m of fileResult.matches) {
      const snippet = m.text.length > 120 ? m.text.substring(0, 120) + '…' : m.text;
      console.log(`  ${ANSI.gray}${String(m.line).padStart(4)}:${ANSI.reset} ${snippet}`);
      totalMatches++;
    }
    console.log();
  }

  console.log(`${ANSI.bold}${ANSI.green}Found ${results.length} file(s) with ${totalMatches} match(es).${ANSI.reset}`);
}

function printFeatureList(jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify({ features: FEATURE_DEFINITIONS }, null, 2));
    return;
  }
  console.log();
  console.log(`${ANSI.bold}Available predefined features:${ANSI.reset}`);
  for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
    console.log(`  ${ANSI.cyan}${key.padEnd(24)}${ANSI.reset} ${ANSI.gray}${def.description}${ANSI.reset}`);
  }
  console.log();
}

/* ── CLI parsing ───────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    localstorage: null,
    function: null,
    class: null,
    id: null,
    pattern: null,
    feature: null,
    listFeatures: false,
    json: false,
    dir: process.cwd()
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--localstorage':
      case '--ls':
        opts.localstorage = args[++i];
        break;
      case '--function':
      case '--fn':
        opts.function = args[++i];
        break;
      case '--class':
      case '--cls':
        opts.class = args[++i];
        break;
      case '--id':
        opts.id = args[++i];
        break;
      case '--pattern':
      case '--re':
        opts.pattern = args[++i];
        break;
      case '--feature':
      case '--feat':
        opts.feature = args[++i];
        break;
      case '--list-features':
      case '--list':
        opts.listFeatures = true;
        break;
      case '--json':
        opts.json = true;
        break;
      default:
        if (!arg.startsWith('--') && fs.existsSync(path.resolve(arg))) {
          opts.dir = path.resolve(arg);
        } else if (!arg.startsWith('--')) {
          // Treat bare word as a pattern if nothing else set
          if (!opts.pattern && !opts.localstorage && !opts.function && !opts.class && !opts.id && !opts.feature) {
            opts.pattern = arg;
          }
        }
        break;
    }
  }

  return opts;
}

function printUsage(jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify({ error: 'No search query provided. Use --list-features to see available features.' }));
    return;
  }
  console.log(`
${ANSI.bold}Usage:${ANSI.reset} node scripts/codebase-search.js [options] [directory]

${ANSI.bold}Search options:${ANSI.reset}
  --localstorage <key>     Search for a localStorage key usage
  --function <name>        Search for function declarations/definitions
  --class <name>           Search for CSS class usage
  --id <name>              Search for element ID usage
  --pattern <regex>        Generic regex search across files
  --feature <name>         Search for a predefined feature
  --list-features          List all predefined feature names

${ANSI.bold}Output options:${ANSI.reset}
  --json                   Output results as JSON

${ANSI.bold}Examples:${ANSI.reset}
  node scripts/codebase-search.js --localstorage anthracitetech_job_summary_date_filter
  node scripts/codebase-search.js --function applyDateFilter
  node scripts/codebase-search.js --class date-filter
  node scripts/codebase-search.js --feature localStorage-persistence
  node scripts/codebase-search.js --pattern "getItem\\s*\\(" ../..
`);
}

/* ── Main ──────────────────────────────────────────────────────────────── */

function main() {
  const opts = parseArgs(process.argv);

  if (opts.listFeatures) {
    printFeatureList(opts.json);
    process.exit(0);
  }

  const hasQuery = opts.localstorage || opts.function || opts.class || opts.id || opts.pattern || opts.feature;
  if (!hasQuery) {
    printUsage(opts.json);
    process.exit(1);
  }

  if (!fs.existsSync(opts.dir)) {
    console.error(`${ANSI.red}Error: Directory not found: ${opts.dir}${ANSI.reset}`);
    process.exit(1);
  }

  const files = findFiles(opts.dir);
  let results;
  let queryLabel;

  if (opts.localstorage) {
    queryLabel = `localStorage key: "${opts.localstorage}"`;
    results = searchLocalStorageKey(files, opts.localstorage, opts.dir);
  } else if (opts.function) {
    queryLabel = `function: "${opts.function}"`;
    results = searchFunctionName(files, opts.function, opts.dir);
  } else if (opts.class) {
    queryLabel = `CSS class: "${opts.class}"`;
    results = searchCssClass(files, opts.class, opts.dir);
  } else if (opts.id) {
    queryLabel = `element ID: "${opts.id}"`;
    results = searchId(files, opts.id, opts.dir);
  } else if (opts.feature) {
    queryLabel = `feature: "${opts.feature}"`;
    results = searchFeature(files, opts.feature, opts.dir);
  } else if (opts.pattern) {
    queryLabel = `pattern: "${opts.pattern}"`;
    let regex;
    try {
      regex = new RegExp(opts.pattern, 'i');
    } catch (e) {
      console.error(`${ANSI.red}Invalid regex: ${e.message}${ANSI.reset}`);
      process.exit(1);
    }
    results = searchByPattern(files, regex, opts.dir);
  }

  printResults(results, queryLabel, opts.json);

  // Exit code: 0 if matches found, 1 if not (useful for scripts)
  if (Array.isArray(results) && results.length === 0) {
    process.exit(1);
  }
}

main();
