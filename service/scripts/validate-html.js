#!/usr/bin/env node
/**
 * Anthracite Tech HTML Validator — Build Pipeline
 * Checks for critical HTML issues: missing tags, accessibility problems,
 * broken asset references, and SEO essentials.
 *
 * Usage:
 *   node scripts/validate-html.js [path/to/index.html]
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
  gray: '\x1b[90m'
};

function checkTag(html, tag, required = true) {
  const openRegex = new RegExp(`<${tag}[^>]*>`, 'i');
  const closeRegex = new RegExp(`</${tag}>`, 'i');
  const hasOpen = openRegex.test(html);
  const hasClose = closeRegex.test(html);
  // Self-closing or void tags don't need closing
  const voidTags = ['!DOCTYPE', 'meta', 'link', 'img', 'br', 'hr', 'input', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
  const needsClose = required && !voidTags.some(vt => vt.toLowerCase() === tag.toLowerCase());
  return { tag, hasOpen, hasClose, pass: hasOpen && (!needsClose || hasClose) };
}

function checkMeta(html, name) {
  const regex = new RegExp(`<meta\\s+name=["']${name}["']`, 'i');
  return regex.test(html);
}

function checkOgTag(html, property) {
  const regex = new RegExp(`<meta\\s+property=["']${property}["']`, 'i');
  return regex.test(html);
}

function checkCanonical(html) {
  return /<link\s+rel=["']canonical["']/i.test(html);
}

function checkFavicon(html) {
  return /<link\s+rel=["']icon["']/i.test(html) || /<link\s+rel=["']shortcut icon["']/i.test(html);
}

function checkLangAttr(html) {
  const match = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function checkViewport(html) {
  return /<meta\s+name=["']viewport["']/i.test(html);
}

function checkCharset(html) {
  return /<meta\s+charset=["'][^"']+["']/i.test(html);
}

function checkImagesWithoutAlt(html) {
  const imgRegex = /<img[^>]*>/gi;
  const altRegex = /alt=["'][^"]*["']/i;
  const images = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    if (!altRegex.test(match[0])) {
      const srcMatch = match[0].match(/src=["']([^"']+)["']/i);
      images.push(srcMatch ? srcMatch[1] : 'unknown');
    }
  }
  return images;
}

function checkLinksWithoutHref(html) {
  const aRegex = /<a\s+[^>]*>/gi;
  const hrefRegex = /href=["'][^"']*["']/i;
  const links = [];
  let match;
  while ((match = aRegex.exec(html)) !== null) {
    if (!hrefRegex.test(match[0])) {
      links.push(match[0]);
    }
  }
  return links;
}

function checkExternalLinks(html) {
  const aRegex = /<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  const links = [];
  let match;
  while ((match = aRegex.exec(html)) !== null) {
    const hasRel = /rel=["'][^"']*noopener[^"']*["']/i.test(match[0]) &&
                   /rel=["'][^"']*noreferrer[^"']*["']/i.test(match[0]);
    if (!hasRel) {
      links.push(match[1]);
    }
  }
  return links;
}

function checkInlineStylesSize(html) {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let totalSize = 0;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    totalSize += match[1].length;
  }
  return totalSize;
}

function checkInlineScriptsSize(html) {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let totalSize = 0;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    if (!match[0].includes('src=')) {
      totalSize += match[1].length;
    }
  }
  return totalSize;
}

function checkHeadingHierarchy(html) {
  const hRegex = /<h([1-6])[^>]*>/gi;
  const headings = [];
  let match;
  while ((match = hRegex.exec(html)) !== null) {
    headings.push(parseInt(match[1], 10));
  }

  const issues = [];
  if (headings.length > 0 && headings[0] !== 1) {
    issues.push(`First heading is h${headings[0]}, should be h1`);
  }
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      issues.push(`Heading jump: h${headings[i - 1]} → h${headings[i]} at position ${i}`);
    }
  }
  return issues;
}

function main() {
  const htmlPath = process.argv[2] || path.join(__dirname, '..', 'index.html');

  if (!fs.existsSync(htmlPath)) {
    console.error(`${ANSI.red}Error: File not found: ${htmlPath}${ANSI.reset}`);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const baseDir = path.dirname(htmlPath);

  console.log(`${ANSI.bold}${ANSI.blue}╔══════════════════════════════════════════════════════════════╗${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}║       Anthracite Tech HTML Validator — Build Pipeline                 ║${ANSI.reset}`);
  console.log(`${ANSI.bold}${ANSI.blue}╚══════════════════════════════════════════════════════════════╝${ANSI.reset}`);
  console.log();

  let errors = 0;
  let warnings = 0;

  // Essential structure
  const essentialTags = ['!DOCTYPE', 'html', 'head', 'body', 'title', 'main'];
  console.log(`${ANSI.bold}Structure Checks:${ANSI.reset}`);
  essentialTags.forEach(tag => {
    const check = checkTag(html, tag);
    const status = check.pass ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.red}✗${ANSI.reset}`;
    if (!check.pass) errors++;
    console.log(`  ${status} <${tag}> ${check.pass ? 'OK' : 'MISSING'}`);
  });
  console.log();

  // Meta tags
  console.log(`${ANSI.bold}Meta / SEO Checks:${ANSI.reset}`);
  const metaChecks = [
    { name: 'charset', check: checkCharset(html) },
    { name: 'viewport', check: checkViewport(html) },
    { name: 'description', check: checkMeta(html, 'description') },
    { name: 'canonical', check: checkCanonical(html) },
    { name: 'favicon', check: checkFavicon(html) },
    { name: 'og:title', check: checkOgTag(html, 'og:title') },
    { name: 'og:description', check: checkOgTag(html, 'og:description') },
    { name: 'og:image', check: checkOgTag(html, 'og:image') },
    { name: 'og:url', check: checkOgTag(html, 'og:url') },
    { name: 'twitter:card', check: checkMeta(html, 'twitter:card') }
  ];
  metaChecks.forEach(m => {
    const status = m.check ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.yellow}⚠${ANSI.reset}`;
    if (!m.check) warnings++;
    console.log(`  ${status} ${m.name} ${m.check ? 'OK' : 'MISSING'}`);
  });

  const lang = checkLangAttr(html);
  if (lang) {
    console.log(`  ${ANSI.green}✓${ANSI.reset} lang="${lang}"`);
  } else {
    console.log(`  ${ANSI.yellow}⚠${ANSI.reset} lang attribute MISSING`);
    warnings++;
  }
  console.log();

  // Accessibility
  console.log(`${ANSI.bold}Accessibility Checks:${ANSI.reset}`);
  const noAltImages = checkImagesWithoutAlt(html);
  if (noAltImages.length === 0) {
    console.log(`  ${ANSI.green}✓${ANSI.reset} All images have alt text`);
  } else {
    console.log(`  ${ANSI.yellow}⚠${ANSI.reset} ${noAltImages.length} image(s) missing alt text`);
    noAltImages.slice(0, 5).forEach(src => console.log(`      - ${src}`));
    if (noAltImages.length > 5) console.log(`      ... and ${noAltImages.length - 5} more`);
    warnings += noAltImages.length;
  }

  const noHrefLinks = checkLinksWithoutHref(html);
  if (noHrefLinks.length === 0) {
    console.log(`  ${ANSI.green}✓${ANSI.reset} All links have href`);
  } else {
    console.log(`  ${ANSI.yellow}⚠${ANSI.reset} ${noHrefLinks.length} link(s) missing href`);
    warnings += noHrefLinks.length;
  }

  const unsafeExternal = checkExternalLinks(html);
  if (unsafeExternal.length === 0) {
    console.log(`  ${ANSI.green}✓${ANSI.reset} All external links have rel="noopener noreferrer"`);
  } else {
    console.log(`  ${ANSI.yellow}⚠${ANSI.reset} ${unsafeExternal.length} external link(s) missing security rel`);
    unsafeExternal.slice(0, 5).forEach(url => console.log(`      - ${url}`));
    warnings += unsafeExternal.length;
  }
  console.log();

  // Performance
  console.log(`${ANSI.bold}Performance Checks:${ANSI.reset}`);
  const styleSize = checkInlineStylesSize(html);
  const scriptSize = checkInlineScriptsSize(html);
  const totalKb = ((styleSize + scriptSize) / 1024).toFixed(1);
  const perfOk = totalKb < 100;
  console.log(`  ${perfOk ? ANSI.green + '✓' : ANSI.yellow + '⚠'}${ANSI.reset} Inline CSS+JS: ${totalKb} KB ${perfOk ? '(OK)' : '(consider splitting)'}`);
  if (!perfOk) warnings++;
  console.log();

  // Headings
  console.log(`${ANSI.bold}Heading Hierarchy:${ANSI.reset}`);
  const headingIssues = checkHeadingHierarchy(html);
  if (headingIssues.length === 0) {
    console.log(`  ${ANSI.green}✓${ANSI.reset} Heading hierarchy OK`);
  } else {
    headingIssues.forEach(issue => {
      console.log(`  ${ANSI.yellow}⚠${ANSI.reset} ${issue}`);
      warnings++;
    });
  }
  console.log();

  // Asset existence
  console.log(`${ANSI.bold}Local Asset Checks:${ANSI.reset}`);
  const assetRegex = /(?:src|href)=["']((?!https?:\/\/|data:|mailto:|#|tel:)[^"']+)["']/gi;
  const assets = new Set();
  let amatch;
  while ((amatch = assetRegex.exec(html)) !== null) {
    assets.add(amatch[1]);
  }

  let missingAssets = 0;
  assets.forEach(asset => {
    const assetPath = path.join(baseDir, asset.split('#')[0].split('?')[0]);
    const exists = fs.existsSync(assetPath);
    const status = exists ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.red}✗${ANSI.reset}`;
    if (!exists) {
      missingAssets++;
      errors++;
    }
    console.log(`  ${status} ${asset} ${exists ? 'EXISTS' : 'MISSING'}`);
  });
  console.log();

  // Summary
  console.log(`${ANSI.bold}Summary:${ANSI.reset} ${errors === 0 ? ANSI.green : ANSI.red}${errors} errors${ANSI.reset}, ${ANSI.yellow}${warnings} warnings${ANSI.reset}`);
  console.log();

  // Heading jumps are warnings, not build-breaking errors
  const criticalErrors = errors;

  if (criticalErrors > 0) {
    console.log(`${ANSI.red}${ANSI.bold}✗ HTML validation failed. Fix errors before deploying.${ANSI.reset}`);
    process.exit(1);
  } else {
    console.log(`${ANSI.green}${ANSI.bold}✓ HTML validation passed.${ANSI.reset}`);
    process.exit(0);
  }
}

main();
