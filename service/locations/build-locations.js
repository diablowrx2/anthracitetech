const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'locations-data.json'), 'utf8'));
const template = fs.readFileSync(path.join(__dirname, 'harrisburg.html'), 'utf8');

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAll(str, search, replacement) {
  return str.split(search).join(replacement);
}

function buildPage(loc, site) {
  let html = template;

  // Helper to build areaServed JSON
  const areaServedJson = loc.areaServed.map(a =>
    `      { "@type": "City", "name": "${a}" }`
  ).join(',\n');

  // Helper to build breadcrumb JSON
  const breadcrumbJson = `    {
      "@type": "ListItem",
      "position": 2,
      "name": "${loc.name}",
      "item": "${site.baseUrl}/locations/${loc.id}.html"
    }`;

  // Build review JSON (same for all, generic but location-relevant)
  const reviewJson = `    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Mike T." },
      "reviewRating": { "@type": "Rating", "ratingValue": "5" },
      "reviewBody": "Fast and professional computer repair service in ${loc.name}. Highly recommend!",
      "datePublished": "2026-03-10"
    },
    {
      "@type": "Review",
      "author": { "@type": "Person", "name": "Lisa R." },
      "reviewRating": { "@type": "Rating", "ratingValue": "5" },
      "reviewBody": "They fixed my iPhone screen while I waited. Great prices and friendly staff in ${loc.name}.",
      "datePublished": "2026-02-20"
    }`;

  // Build local areas HTML
  const localAreasHtml = loc.localAreas.map(a => `        <span>${a}</span>`).join('\n');

  // Build search keywords HTML
  const keywordsHtml = loc.searchKeywords.map(k =>
    `          <li><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>"${k}"</li>`
  ).join('\n');

  // Define all replacements
  const replacements = [
    // Title & meta
    [`Computer Repair Harrisburg PA | Anthracite Tech Solutions — Phone Repair &amp; IT Support`, `Computer Repair ${loc.headlineSuffix} | Anthracite Tech Solutions — Phone Repair &amp; IT Support`],
    [`Anthracite Tech Solutions offers same-day computer repair, phone repair, and IT support in Harrisburg, PA. Free diagnostics for laptops, iPhone, Android &amp; business networks. Serving Camp Hill, Mechanicsburg &amp; Midtown.`, `Anthracite Tech Solutions offers same-day computer repair, phone repair, and IT support in ${loc.headlineSuffix}. Free diagnostics for laptops, iPhone, Android &amp; business networks. Serving ${loc.areaServed.slice(1, 4).join(', ')}.`],

    // LocalBusiness schema
    [`"@id": "https://anthracitetechsolutions.com/locations/harrisburg.html#localbusiness"`, `"@id": "${site.baseUrl}/locations/${loc.id}.html#localbusiness"`],
    [`"description": "Computer repair, phone repair, and IT support in Harrisburg, PA."`, `"description": "Computer repair, phone repair, and IT support in ${loc.headlineSuffix}."`],
    [`"url": "https://anthracitetechsolutions.com/locations/harrisburg.html"`, `"url": "${site.baseUrl}/locations/${loc.id}.html"`],
    [`"telephone": "+1-717-555-0100"`, `"telephone": "${site.phone}"`],
    [`"email": "harrisburg@anthracitetechsolutions.com"`, `"email": "${loc.email}"`],
    [`"priceRange": "$$"`, `"priceRange": "${site.priceRange}"`],
    [`"streetAddress": "321 Market St"`, `"streetAddress": "${site.streetAddress}"`],
    [`"addressLocality": "Harrisburg"`, `"addressLocality": "${loc.name}"`],
    [`"addressRegion": "PA"`, `"addressRegion": "${site.addressRegion}"`],
    [`"postalCode": "17101"`, `"postalCode": "${loc.postalCode}"`],
    [`"addressCountry": "US"`, `"addressCountry": "${site.addressCountry}"`],
    [`"latitude": 40.2732, "longitude": -76.8867`, `"latitude": ${loc.lat}, "longitude": ${loc.lon}`],

    // Opening hours (keep same, just ensure phone matches)
    [`"opens": "09:00", "closes": "19:00"`, `"opens": "09:00", "closes": "19:00"`],
    [`"opens": "10:00", "closes": "17:00"`, `"opens": "10:00", "closes": "17:00"`],

    // areaServed
    [`"areaServed": [
      { "@type": "City", "name": "Harrisburg, PA" },
      { "@type": "City", "name": "Camp Hill, PA" },
      { "@type": "City", "name": "Mechanicsburg, PA" },
      { "@type": "City", "name": "Midtown Harrisburg, PA" },
      { "@type": "City", "name": "Uptown Harrisburg, PA" }
    ]`, `"areaServed": [
${areaServedJson}
    ]`],

    // Payment & rating
    [`"paymentAccepted": "Cash, Credit Card, Debit Card, Apple Pay, Google Pay"`, `"paymentAccepted": "${site.paymentAccepted}"`],
    [`"currenciesAccepted": "USD"`, `"currenciesAccepted": "${site.currenciesAccepted}"`],
    [`"ratingValue": "4.7"`, `"ratingValue": "${site.aggregateRating.ratingValue}"`],
    [`"reviewCount": "89"`, `"reviewCount": "${site.aggregateRating.reviewCount}"`],

    // Reviews
    [`"author": { "@type": "Person", "name": "Mike T." },
        "reviewRating": { "@type": "Rating", "ratingValue": "5" },
        "reviewBody": "Fast and professional computer repair service in Harrisburg. Highly recommend!",
        "datePublished": "2026-03-10"
      },
      {
        "@type": "Review",
        "author": { "@type": "Person", "name": "Lisa R." },
        "reviewRating": { "@type": "Rating", "ratingValue": "5" },
        "reviewBody": "They fixed my iPhone screen while I waited. Great prices and friendly staff.",
        "datePublished": "2026-02-20"`, `"author": { "@type": "Person", "name": "Mike T." },
        "reviewRating": { "@type": "Rating", "ratingValue": "5" },
        "reviewBody": "Fast and professional computer repair service in ${loc.name}. Highly recommend!",
        "datePublished": "2026-03-10"
      },
      {
        "@type": "Review",
        "author": { "@type": "Person", "name": "Lisa R." },
        "reviewRating": { "@type": "Rating", "ratingValue": "5" },
        "reviewBody": "They fixed my iPhone screen while I waited. Great prices and friendly staff in ${loc.name}.",
        "datePublished": "2026-02-20"`],

    // Organization schema
    [`"telephone": "+1-717-555-0100"`, `"telephone": "${site.phone}"`, 1], // only first occurrence after LocalBusiness

    // BreadcrumbList
    [`"name": "Harrisburg",
        "item": "https://anthracitetechsolutions.com/locations/harrisburg.html"`, `"name": "${loc.name}",
        "item": "${site.baseUrl}/locations/${loc.id}.html"`],

    // Body content
    [`Same-day repairs in Harrisburg, PA`, loc.heroTagline],
    [`Computer Repair &amp; Phone Repair<br>in <span class="gradient-text">Harrisburg, PA</span>`, `Computer Repair &amp; Phone Repair<br>in <span class="gradient-text">${loc.headlineSuffix}</span>`],
    [`Your trusted local tech team for computer repair, phone repair, and IT support in Harrisburg and the Susquehanna Valley. Free diagnostics, transparent pricing, and fast turnaround from Midtown to Camp Hill.`, loc.heroSubtitle],
    [`<a href="tel:+17175550100"`, `<a href="tel:${site.phone.replace(/\D/g, '')}"`],
    [`Call (717) 555-0100`, `Call ${site.phoneDisplay}`],
    [`href="mailto:harrisburg@anthracitetechsolutions.com"`, `href="mailto:${loc.email}"`],
    [`Email Harrisburg@anthracitetechsolutions.com`, `Email ${loc.email.charAt(0).toUpperCase() + loc.email.slice(1)}`],

    // Pricing section (keep same content, just localize references)
    [`Speed up your computer with SSDs, more RAM, or other component upgrades.`, `Speed up your computer with SSDs, more RAM, or other component upgrades.`],
    [`On-site and remote tech support for homes and small businesses across Harrisburg.`, `On-site and remote tech support for homes and small businesses across ${loc.name}.`],

    // Services section
    [`Tech Services in Harrisburg`, `Tech Services in ${loc.name}`],
    [`Expert laptop and desktop repair for HP, Dell, Lenovo, Apple, and custom builds. We serve Harrisburg homes and offices with fast, reliable fixes.`, `Expert laptop and desktop repair for HP, Dell, Lenovo, Apple, and custom builds. We serve ${loc.name} homes and offices with fast, reliable fixes.`],
    [`Professional iPhone and Android repair in Harrisburg. Most screen and battery replacements are completed within an hour while you wait.`, `Professional iPhone and Android repair in ${loc.name}. Most screen and battery replacements are completed within an hour while you wait.`],
    [`Reliable IT support for Harrisburg small businesses and home offices. From network setup to cloud migration, we keep your systems running smoothly.`, `Reliable IT support for ${loc.name} small businesses and home offices. From network setup to cloud migration, we keep your systems running smoothly.`],

    // Local section
    [`Serving Greater Harrisburg`, `Serving Greater ${loc.name}`],
    [`We are proud to be Harrisburg's local tech repair shop. Whether you're working near the Capitol Complex, living in Midtown, or running a business along the Carlisle Pike, our technicians come to you or welcome you at our downtown location.`, loc.localContext],
    [`Our Harrisburg team understands the needs of state workers, small business owners, and families across the Susquehanna Valley. We offer house calls throughout the region and emergency IT support for downtown offices.`, loc.localContext2],

    // Offer descriptions in schema
    [`in Harrisburg, PA.`, `in ${loc.name}, ${site.addressRegion}.`],

    // Local areas tags
    [`        <span>Harrisburg</span>
        <span>Camp Hill</span>
        <span>Mechanicsburg</span>
        <span>Midtown</span>
        <span>Uptown</span>
        <span>Steelton</span>`, localAreasHtml],

    // Why choose heading
    [`Why Harrisburg Chooses Anthracite Tech`, `Why ${loc.name} Chooses Anthracite Tech`],

    // Search keywords
    [`          <li><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>"Computer repair Harrisburg PA"</li>
          <li><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>"Phone repair near Capitol Complex"</li>
          <li><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>"IT support for small business Harrisburg"</li>
          <li><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>"Laptop repair Camp Hill"</li>
          <li><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>"iPhone screen repair Mechanicsburg"</li>
          <li><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>"Same-day tech support near me"</li>`, keywordsHtml],

    // Footer
    [`📞 <a href="tel:+17175550100"`, `📞 <a href="tel:${site.phone.replace(/\D/g, '')}"`],
    [`(717) 555-0100`, site.phoneDisplay],
    [`✉️ <a href="mailto:harrisburg@anthracitetechsolutions.com"`, `✉️ <a href="mailto:${loc.email}"`],
    [`harrisburg@anthracitetechsolutions.com`, loc.email],
    [`📍 321 Market St, Harrisburg, PA 17101`, `📍 ${site.streetAddress}, ${loc.name}, ${site.addressRegion} ${loc.postalCode}`],
    [`Professional computer repair, phone repair, and IT support serving Harrisburg, Camp Hill, Mechanicsburg, and the Susquehanna Valley.`, `Professional computer repair, phone repair, and IT support serving ${loc.areaServed.slice(0, 3).join(', ')}, and the surrounding areas.`],
  ];

  // Apply replacements
  for (const r of replacements) {
    const [oldStr, newStr] = r;
    if (html.includes(oldStr)) {
      html = replaceAll(html, oldStr, newStr);
    }
  }

  // Inject canonical tag if missing
  const canonicalUrl = `${site.baseUrl}/locations/${loc.id}.html`;
  if (!html.includes('rel="canonical"')) {
    html = html.replace(
      '<meta name="description" content="',
      `<link rel="canonical" href="${canonicalUrl}">\n  <meta name="description" content="`
    );
  }

  // Inject FAQPage schema before </head>
  if (loc.faq && loc.faq.length > 0) {
    const faqSchemaJson = loc.faq.map((item, i) =>
      `      {
        "@type": "Question",
        "name": "${item.question.replace(/"/g, '\\"')}",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "${item.answer.replace(/"/g, '\\"')}"
        }
      }`
    ).join(',\n');

    const faqSchema = `\n  <!-- ═══ FAQPAGE SCHEMA ═══ -->\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "FAQPage",\n    "mainEntity": [\n${faqSchemaJson}\n    ]\n  }\n  <\/script>`;

    html = html.replace('</head>', `${faqSchema}\n</head>`);
  }

  // Inject FAQ nav link
  html = html.replace(
    '<li><a href="#contact" class="cta-btn">Free Diagnostic</a></li>',
    '<li><a href="#faq">FAQ</a></li>\n        <li><a href="#contact" class="cta-btn">Free Diagnostic</a></li>'
  );

  // Inject FAQ CSS before </style>
  const faqCss = `\n    /* ── FAQ ────────────────────────────────────── */\n    .faq-section { padding: 4rem 1.5rem; border-top: 1px solid var(--border); }\n    .faq-inner { max-width: 800px; margin: 0 auto; }\n    .faq-section h2 { font-size: 2rem; font-weight: 700; margin-bottom: .5rem; text-align: center; }\n    .faq-section .subtitle { text-align: center; color: var(--muted-foreground); margin-bottom: 2rem; }\n    .faq-list { display: flex; flex-direction: column; gap: .75rem; }\n    .faq-item { background: var(--card); border: 1px solid rgba(255,255,255,.05); border-radius: .75rem; overflow: hidden; }\n    .faq-question { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: transparent; border: none; color: var(--foreground); font-size: 1rem; font-weight: 600; cursor: pointer; text-align: left; }\n    .faq-question:hover { color: var(--primary); }\n    .faq-icon { transition: transform .3s; flex-shrink: 0; margin-left: 1rem; }\n    .faq-icon svg { width: 20px; height: 20px; }\n    .faq-item.open .faq-icon { transform: rotate(180deg); }\n    .faq-answer { max-height: 0; overflow: hidden; transition: max-height .3s ease; }\n    .faq-answer-inner { padding: 0 1.25rem 1.25rem; color: var(--muted-foreground); font-size: .95rem; line-height: 1.7; }\n    .faq-item.open .faq-answer { max-height: 300px; }`;
  html = html.replace('</style>', `${faqCss}\n  </style>`);

  // Inject FAQ HTML section before CTA
  if (loc.faq && loc.faq.length > 0) {
    const faqItemsHtml = loc.faq.map(item =>
      `      <div class="faq-item">\n        <button class="faq-question" onclick="toggleFaq(this)">\n          ${item.question.replace(/"/g, '&quot;')}\n          <span class="faq-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></span>\n        </button>\n        <div class="faq-answer">\n          <div class="faq-answer-inner">${item.answer.replace(/"/g, '&quot;')}</div>\n        </div>\n      </div>`
    ).join('\n');

    const faqSection = `\n<!-- ═══ FAQ ═══ -->\n<section class="faq-section" id="faq">\n  <div class="faq-inner">\n    <h2>Frequently Asked Questions</h2>\n    <p class="subtitle">Common questions about our ${loc.name} tech repair services.</p>\n    <div class="faq-list">\n${faqItemsHtml}\n    </div>\n  </div>\n</section>\n`;

    html = html.replace('<section class="cta-section" id="contact">', `${faqSection}<section class="cta-section" id="contact">`);
  }

  // Inject toggleFaq function before closing </script> at bottom
  const faqJs = `\n    // FAQ toggle\n    function toggleFaq(btn) {\n      const item = btn.parentElement;\n      const wasOpen = item.classList.contains('open');\n      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));\n      if (!wasOpen) item.classList.add('open');\n    }\n`;
  html = html.replace(
    /\(function\(\) \{\n    var header = document\.getElementById\('header'\);/,
    `${faqJs}  (function() {\n    var header = document.getElementById('header');`
  );

  // Ensure any remaining harrisburg-specific URLs in schema are fixed
  html = html.replace(/https:\/\/anthracitetechsolutions\.com\/locations\/harrisburg\.html/g, canonicalUrl);
  html = html.replace(/https:\/\/anthracitetechrepairs\.com\/locations\/harrisburg\.html/g, canonicalUrl);
  html = html.replace(/https:\/\/anthracitetechsolutions\.com/g, site.baseUrl);
  html = html.replace(/https:\/\/anthracitetechrepairs\.com/g, site.baseUrl);

  return html;
}

for (const loc of data.locations) {
  const html = buildPage(loc, data.site);
  const outPath = path.join(__dirname, `${loc.id}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`Generated: ${outPath}`);
}

console.log('Done.');
