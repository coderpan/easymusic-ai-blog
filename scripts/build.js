const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const outDir = path.join(root, "public");
const site = readJson("data/site.json");
const posts = fs
  .readdirSync(path.join(root, "data/posts"))
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => readJson(path.join("data/posts", file)))
  .sort((a, b) => b.date.localeCompare(a.date));

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
writeFile("assets/site.css", css());

for (const locale of site.locales) {
  writeFile(`${locale}/index.html`, renderIndex(locale));
  writeFile(`${locale}/feed.xml`, renderFeed(locale));
  for (const post of posts) {
    writeFile(`${locale}/posts/${post.slug}/index.html`, renderPost(locale, post));
  }
}

writeFile("index.html", renderRedirect(`/${site.defaultLocale}/`));
writeFile("sitemap.xml", renderSitemap());
writeFile("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
writeFile("llms.txt", renderLlms());
writeFile("ai.txt", renderAiTxt());

console.log(`Built ${posts.length} post(s) into ${path.relative(root, outDir)}.`);

function renderIndex(locale) {
  const title = `${site.siteName} - ${site.localeNames[locale]}`;
  const description = "Practical multilingual guides for AI music creation workflows, prompts, planning, and responsible production.";
  const items = posts
    .map((post) => {
      const entry = post.translations[locale];
      return `<article class="post-card">
        <time datetime="${post.date}">${post.date}</time>
        <h2><a href="/${locale}/posts/${post.slug}/">${escapeHtml(entry.title)}</a></h2>
        <p>${escapeHtml(entry.description)}</p>
      </article>`;
    })
    .join("\n");
  return layout(locale, title, description, `/${locale}/`, `
    <section class="hero">
      <p class="eyebrow">${escapeHtml(site.productName)} knowledge base</p>
      <h1>${escapeHtml(site.siteName)}</h1>
      <p>Useful, product-adjacent articles for creators, marketers, educators, and teams planning music with AI.</p>
    </section>
    <section class="post-list">${items}</section>
  `);
}

function renderPost(locale, post) {
  const entry = post.translations[locale];
  const canonicalPath = `/${locale}/posts/${post.slug}/`;
  const alternates = Object.fromEntries(site.locales.map((code) => [code, `${site.baseUrl}/${code}/posts/${post.slug}/`]));
  return layout(locale, entry.title, entry.description, canonicalPath, `
    <article class="article">
      <p class="eyebrow">${escapeHtml(post.cluster)} / ${post.date}</p>
      <h1>${escapeHtml(entry.title)}</h1>
      <p class="dek">${escapeHtml(entry.description)}</p>
      ${markdownToHtml(Array.isArray(entry.body) ? entry.body.join("\n\n") : entry.body)}
    </article>
  `, alternates);
}

function layout(locale, title, description, canonicalPath, content, alternates = null) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const canonical = `${site.baseUrl}${canonicalPath}`;
  const alternateLinks = alternates || Object.fromEntries(site.locales.map((code) => [code, `${site.baseUrl}/${code}/`]));
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  ${Object.entries(alternateLinks).map(([code, href]) => `<link rel="alternate" hreflang="${code}" href="${href}">`).join("\n  ")}
  <link rel="alternate" hreflang="x-default" href="${alternateLinks[site.defaultLocale]}">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/${locale}/">${escapeHtml(site.siteName)}</a>
    <nav aria-label="Languages">
      ${site.locales.map((code) => `<a href="/${code}/"${code === locale ? ' aria-current="page"' : ""}>${code.toUpperCase()}</a>`).join("")}
    </nav>
  </header>
  <main>${content}</main>
  <footer>
    <p>${escapeHtml(site.siteName)} publishes practical AI music workflow guides. Product references point to verified ${escapeHtml(site.productName)} pages.</p>
    <p><a href="${site.productUrl}">${escapeHtml(site.productName)}</a> · <a href="/${locale}/feed.xml">RSS</a> · <a href="/llms.txt">llms.txt</a></p>
  </footer>
</body>
</html>`;
}

function renderSitemap() {
  const urls = [];
  for (const locale of site.locales) {
    urls.push({ loc: `${site.baseUrl}/${locale}/`, lastmod: today() });
    for (const post of posts) {
      urls.push({ loc: `${site.baseUrl}/${locale}/posts/${post.slug}/`, lastmod: post.date });
    }
  }
  urls.push({ loc: `${site.baseUrl}/llms.txt`, lastmod: today() });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url><loc>${url.loc}</loc><lastmod>${url.lastmod}</lastmod><changefreq>weekly</changefreq></url>`)
    .join("\n")}\n</urlset>\n`;
}

function renderFeed(locale) {
  const items = posts
    .slice(0, 20)
    .map((post) => {
      const entry = post.translations[locale];
      const url = `${site.baseUrl}/${locale}/posts/${post.slug}/`;
      return `<item><title>${escapeHtml(entry.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${new Date(post.date).toUTCString()}</pubDate><description>${escapeHtml(entry.description)}</description></item>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeHtml(site.siteName)} (${locale})</title><link>${site.baseUrl}/${locale}/</link><description>Multilingual AI music creation guides.</description>${items}</channel></rss>`;
}

function renderLlms() {
  const postLines = posts
    .map((post) => `- ${post.date}: ${post.translations.en.title} (${site.baseUrl}/en/posts/${post.slug}/)`)
    .join("\n");
  return `# ${site.siteName}\n\nA multilingual static blog for practical, human-readable AI music creation workflows related to ${site.productName}.\n\nProduct homepage: ${site.productUrl}\nProduct sitemap: ${site.productSitemapUrl}\nLocales: ${site.locales.join(", ")}\n\n## Content\n\n${postLines}\n\n## Claim boundaries\n\nArticles should not invent customers, rankings, pricing, integrations, legal guarantees, or rights claims. Product links should come from the current product sitemap when possible.\n`;
}

function renderAiTxt() {
  return `# AI usage guidance\n\nThis site welcomes crawling and summarization by search engines and AI assistants when attribution to ${site.siteName} is preserved and source URLs are retained. Do not use article text to imply legal, licensing, or copyright guarantees that the article does not state.\n`;
}

function markdownToHtml(markdown) {
  const lines = markdown.trim().split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let inList = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const listItem = trimmed.match(/^-\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(listItem[1])}</li>`);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  closeList();
  return html.join("\n");
}

function inline(text) {
  const parts = [];
  let lastIndex = 0;
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  for (const match of text.matchAll(linkPattern)) {
    parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    parts.push(`<a href="${escapeHtml(match[2])}" rel="nofollow">${escapeHtml(match[1])}</a>`);
    lastIndex = match.index + match[0].length;
  }
  parts.push(escapeHtml(text.slice(lastIndex)));
  return parts.join("").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderRedirect(target) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${target}"><link rel="canonical" href="${site.baseUrl}${target}"></head><body><a href="${target}">Continue</a></body></html>`;
}

function css() {
  return `:root{color-scheme:light;--ink:#17211f;--muted:#5d6b66;--paper:#fbfaf6;--line:#d9ded7;--accent:#0f766e;--warm:#b45309;--panel:#ffffff}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.65}a{color:var(--accent);text-decoration-thickness:.08em;text-underline-offset:.18em}.site-header{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:18px clamp(18px,4vw,56px);border-bottom:1px solid var(--line);background:rgba(251,250,246,.92);position:sticky;top:0;backdrop-filter:blur(14px)}.brand{font-weight:800;color:var(--ink);text-decoration:none}nav{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}nav a{font-size:12px;text-decoration:none;color:var(--muted);padding:4px 6px;border-radius:4px}nav a[aria-current=page]{color:var(--ink);background:#e8eee9}main{width:min(100%,980px);margin:0 auto;padding:42px clamp(18px,4vw,28px) 64px}.hero{padding:42px 0 34px;border-bottom:1px solid var(--line)}.eyebrow{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:var(--warm);font-weight:700}.hero h1,.article h1{font-size:clamp(34px,6vw,62px);line-height:1.02;margin:10px 0 18px;letter-spacing:0}.hero p,.dek{max-width:760px;color:var(--muted);font-size:18px}.post-list{display:grid;gap:16px;margin-top:28px}.post-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:22px}.post-card h2{font-size:24px;line-height:1.18;margin:8px 0}.post-card time{color:var(--warm);font-size:13px;font-weight:700}.article{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:clamp(22px,5vw,52px)}.article h2{margin-top:38px;font-size:28px;line-height:1.2}.article h3{margin-top:28px;font-size:20px}.article p,.article li{font-size:17px}.article ul{padding-inline-start:1.4rem}.article li+li{margin-top:8px}footer{border-top:1px solid var(--line);padding:28px clamp(18px,4vw,56px);color:var(--muted);font-size:14px}@media(max-width:720px){.site-header{position:static;align-items:flex-start;flex-direction:column}.article{border-left:0;border-right:0;border-radius:0;margin-left:-18px;margin-right:-18px}.hero h1,.article h1{font-size:36px}}`;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeFile(relativePath, contents) {
  const filePath = path.join(outDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
