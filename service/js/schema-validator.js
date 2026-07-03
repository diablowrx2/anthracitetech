/**
 * Anthracite Tech Schema Validator & Google Testing Integration
 * Validates JSON-LD structured data against Schema.org and Google Rich Results requirements.
 *
 * Usage:
 *   <script src="js/schema-validator.js"></script>
 *   <script>SchemaValidator.run({ overlay: true });</script>
 *
 * Or auto-run in dev mode by adding ?schema-test=1 to the URL.
 */
(function(global) {
  'use strict';

  var RULES = {
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
    }
  };

  function hasProp(obj, key) {
    return obj && typeof obj === 'object' && key in obj && obj[key] !== null && obj[key] !== undefined && obj[key] !== '';
  }

  function validateOne(schema) {
    var type = schema['@type'] || 'Unknown';
    var rule = RULES[type] || null;
    var results = {
      type: type,
      valid: true,
      errors: [],
      warnings: [],
      info: [],
      google: { pass: true, errors: [], warnings: [] }
    };

    if (!rule) {
      results.warnings.push('No validation rules for type: ' + type);
      results.google.warnings.push('No Google validation rules for type: ' + type);
      return results;
    }

    // Schema.org required
    rule.required.forEach(function(k) {
      if (!hasProp(schema, k)) {
        results.errors.push('Missing required property: ' + k);
        results.valid = false;
      }
    });

    // Schema.org recommended
    rule.recommended.forEach(function(k) {
      if (!hasProp(schema, k)) {
        results.warnings.push('Missing recommended property: ' + k);
      }
    });

    // Google required
    rule.googleRequired.forEach(function(k) {
      if (!hasProp(schema, k)) {
        results.google.errors.push('Missing Google-required property: ' + k);
        results.google.pass = false;
      }
    });

    // Google recommended
    rule.googleRecommended.forEach(function(k) {
      if (!hasProp(schema, k)) {
        results.google.warnings.push('Missing Google-recommended property: ' + k);
      }
    });

    // Context check
    if (hasProp(schema, '@context')) {
      var ctx = schema['@context'];
      if (typeof ctx === 'string' && ctx.indexOf('schema.org') === -1 && ctx !== 'https://schema.org') {
        results.errors.push('@context must reference schema.org');
        results.valid = false;
      }
    }

    // Type-specific deep checks
    if (type === 'LocalBusiness') {
      if (hasProp(schema, 'address')) {
        var addr = schema.address;
        if (!hasProp(addr, 'streetAddress')) results.google.warnings.push('address.streetAddress recommended for Google');
        if (!hasProp(addr, 'addressLocality')) results.google.warnings.push('address.addressLocality recommended for Google');
        if (!hasProp(addr, 'addressRegion')) results.google.warnings.push('address.addressRegion recommended for Google');
        if (!hasProp(addr, 'postalCode')) results.google.warnings.push('address.postalCode recommended for Google');
      }
      if (hasProp(schema, 'geo')) {
        var geo = schema.geo;
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
        var ents = Array.isArray(schema.mainEntity) ? schema.mainEntity : [schema.mainEntity];
        ents.forEach(function(ent, i) {
          if (!hasProp(ent, '@type') || ent['@type'] !== 'Question') {
            results.google.warnings.push('mainEntity[' + i + '] should be @type: Question');
          }
          if (hasProp(ent, 'acceptedAnswer')) {
            var ans = ent.acceptedAnswer;
            if (!hasProp(ans, '@type') || ans['@type'] !== 'Answer') {
              results.google.warnings.push('mainEntity[' + i + '].acceptedAnswer should be @type: Answer');
            }
          }
        });
      }
    }

    return results;
  }

  function extractSchemas() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var schemas = [];
    scripts.forEach(function(s, idx) {
      try {
        var data = JSON.parse(s.textContent.trim());
        var items = Array.isArray(data) ? data : [data];
        items.forEach(function(item) {
          schemas.push({ index: idx, data: item });
        });
      } catch (e) {
        schemas.push({ index: idx, parseError: e.message, raw: s.textContent.substring(0, 200) });
      }
    });
    return schemas;
  }

  function buildReport(schemas) {
    var report = {
      total: schemas.length,
      parsed: 0,
      failed: 0,
      results: [],
      summary: { pass: 0, fail: 0, googlePass: 0, googleFail: 0 }
    };

    schemas.forEach(function(s) {
      if (s.parseError) {
        report.failed++;
        report.results.push({ index: s.index, parseError: s.parseError, raw: s.raw });
        return;
      }
      report.parsed++;
      var res = validateOne(s.data);
      report.results.push({ index: s.index, type: res.type, result: res });
      if (res.valid) report.summary.pass++; else report.summary.fail++;
      if (res.google.pass) report.summary.googlePass++; else report.summary.googleFail++;
    });

    return report;
  }

  function renderOverlay(report) {
    var existing = document.getElementById('schema-test-overlay');
    if (existing) existing.remove();

    var panel = document.createElement('div');
    panel.id = 'schema-test-overlay';
    panel.style.cssText = 'position:fixed;bottom:1rem;right:1rem;z-index:9999;width:420px;max-height:80vh;overflow-y:auto;background:#0f172a;border:1px solid #334155;border-radius:1rem;padding:1rem;font-family:system-ui,sans-serif;font-size:13px;color:#e2e8f0;box-shadow:0 25px 50px rgba(0,0,0,.5);';

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">';
    html += '<strong style="font-size:14px;">Schema Validator</strong>';
    html += '<button id="schema-test-close" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem;">';
    html += '<div style="background:#1e293b;padding:.5rem;border-radius:.5rem;text-align:center;"><div style="font-size:18px;font-weight:700;color:#22c55e;">' + report.summary.pass + '</div><div style="font-size:11px;color:#94a3b8;">Schema.org Pass</div></div>';
    html += '<div style="background:#1e293b;padding:.5rem;border-radius:.5rem;text-align:center;"><div style="font-size:18px;font-weight:700;color:#f59e0b;">' + report.summary.googlePass + '</div><div style="font-size:11px;color:#94a3b8;">Google Pass</div></div>';
    html += '</div>';

    if (report.failed > 0) {
      html += '<div style="background:#7f1d1d;color:#fecaca;padding:.5rem;border-radius:.5rem;margin-bottom:.5rem;font-size:12px;">⚠️ ' + report.failed + ' JSON-LD block(s) failed to parse</div>';
    }

    report.results.forEach(function(r, i) {
      if (r.parseError) {
        html += '<div style="background:#1e293b;border-radius:.5rem;padding:.5rem;margin-bottom:.5rem;border-left:3px solid #ef4444;">';
        html += '<div style="font-weight:600;color:#ef4444;">Block #' + (r.index + 1) + ' — Parse Error</div>';
        html += '<div style="color:#94a3b8;font-size:11px;margin-top:.25rem;">' + r.parseError + '</div>';
        html += '</div>';
        return;
      }
      var res = r.result;
      var color = res.valid && res.google.pass ? '#22c55e' : (res.valid ? '#f59e0b' : '#ef4444');
      html += '<div style="background:#1e293b;border-radius:.5rem;padding:.5rem;margin-bottom:.5rem;border-left:3px solid ' + color + ';">';
      html += '<div style="font-weight:600;">Block #' + (r.index + 1) + ': ' + r.type + '</div>';

      if (res.errors.length) {
        html += '<div style="margin-top:.4rem;color:#fca5a5;font-size:11px;"><strong>Required Errors:</strong><ul style="margin:.25rem 0 0 1rem;padding:0;">';
        res.errors.forEach(function(e) { html += '<li>' + e + '</li>'; });
        html += '</ul></div>';
      }
      if (res.google.errors.length) {
        html += '<div style="margin-top:.4rem;color:#fca5a5;font-size:11px;"><strong>Google Errors:</strong><ul style="margin:.25rem 0 0 1rem;padding:0;">';
        res.google.errors.forEach(function(e) { html += '<li>' + e + '</li>'; });
        html += '</ul></div>';
      }
      if (res.warnings.length) {
        html += '<div style="margin-top:.4rem;color:#fde68a;font-size:11px;"><strong>Warnings:</strong><ul style="margin:.25rem 0 0 1rem;padding:0;">';
        res.warnings.forEach(function(e) { html += '<li>' + e + '</li>'; });
        html += '</ul></div>';
      }
      if (res.google.warnings.length) {
        html += '<div style="margin-top:.4rem;color:#fde68a;font-size:11px;"><strong>Google Warnings:</strong><ul style="margin:.25rem 0 0 1rem;padding:0;">';
        res.google.warnings.forEach(function(e) { html += '<li>' + e + '</li>'; });
        html += '</ul></div>';
      }
      if (res.info.length) {
        html += '<div style="margin-top:.4rem;color:#93c5fd;font-size:11px;"><strong>Info:</strong><ul style="margin:.25rem 0 0 1rem;padding:0;">';
        res.info.forEach(function(e) { html += '<li>' + e + '</li>'; });
        html += '</ul></div>';
      }
      html += '</div>';
    });

    // Google Rich Results Test link
    var pageUrl = encodeURIComponent(window.location.href);
    html += '<div style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid #334155;">';
    html += '<a href="https://search.google.com/test/rich-results?url=' + pageUrl + '" target="_blank" rel="noopener" style="display:block;background:#1e293b;color:#60a5fa;padding:.5rem;border-radius:.5rem;text-align:center;text-decoration:none;font-size:12px;font-weight:600;">Open Google Rich Results Test ↗</a>';
    html += '</div>';

    panel.innerHTML = html;
    document.body.appendChild(panel);

    document.getElementById('schema-test-close').addEventListener('click', function() {
      panel.remove();
    });
  }

  function consoleReport(report) {
    console.group('%c[SchemaValidator] Structured Data Report', 'font-weight:bold;font-size:14px;color:#3b82f6;');
    console.log('Total JSON-LD blocks:', report.total);
    console.log('Parsed:', report.parsed, '| Failed:', report.failed);
    console.log('Schema.org Pass:', report.summary.pass, '| Fail:', report.summary.fail);
    console.log('Google Pass:', report.summary.googlePass, '| Fail:', report.summary.googleFail);

    report.results.forEach(function(r, i) {
      if (r.parseError) {
        console.group('%cBlock #' + (r.index + 1) + ' — Parse Error', 'color:#ef4444;font-weight:bold;');
        console.error(r.parseError);
        console.log('Raw:', r.raw);
        console.groupEnd();
        return;
      }
      var res = r.result;
      var color = res.valid && res.google.pass ? '#22c55e' : (res.valid ? '#f59e0b' : '#ef4444');
      var label = res.valid && res.google.pass ? 'PASS' : (res.valid ? 'WARN' : 'FAIL');
      console.group('%cBlock #' + (r.index + 1) + ' — ' + r.type + ' [' + label + ']', 'color:' + color + ';font-weight:bold;');
      if (res.errors.length) console.error('Required Errors:', res.errors);
      if (res.google.errors.length) console.error('Google Errors:', res.google.errors);
      if (res.warnings.length) console.warn('Warnings:', res.warnings);
      if (res.google.warnings.length) console.warn('Google Warnings:', res.google.warnings);
      if (res.info.length) console.info('Info:', res.info);
      console.groupEnd();
    });

    console.log('%cTip: Add ?schema-test=1 to URL for overlay panel.', 'color:#94a3b8;font-style:italic;');
    console.groupEnd();
  }

  var SchemaValidator = {
    version: '1.0.0',
    rules: RULES,

    validate: function(schema) {
      return validateOne(schema);
    },

    extract: function() {
      return extractSchemas();
    },

    run: function(opts) {
      opts = opts || {};
      var schemas = extractSchemas();
      var report = buildReport(schemas);
      consoleReport(report);
      if (opts.overlay || /[?&]schema-test=1/.test(location.search)) {
        renderOverlay(report);
      }
      return report;
    },

    googleTestUrl: function(url) {
      return 'https://search.google.com/test/rich-results?url=' + encodeURIComponent(url || window.location.href);
    },

    schemaMarkupUrl: function(url) {
      return 'https://validator.schema.org/#/validate/codeUrl/' + encodeURIComponent(url || window.location.href);
    }
  };

  global.SchemaValidator = SchemaValidator;

  // Auto-run if schema-test=1 is in URL
  if (/[?&]schema-test=1/.test(location.search)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { SchemaValidator.run({ overlay: true }); });
    } else {
      SchemaValidator.run({ overlay: true });
    }
  }

})(window);
