const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const outDir = path.join(root, "public");
const site = readJson("data/site.json");
const basePath = new URL(site.baseUrl).pathname.replace(/\/$/, "");
const posts = fs
  .readdirSync(path.join(root, "data/posts"))
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => readJson(path.join("data/posts", file)))
  .sort((a, b) => b.date.localeCompare(a.date));

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
writeFile("assets/site.css", css());
writeFile("index.html", renderIndex(site.defaultLocale));

for (const locale of site.locales) {
  writeFile(`${locale}/index.html`, renderIndex(locale));
  writeFile(`${locale}/feed.xml`, renderFeed(locale));
  for (const post of posts) {
    writeFile(`${locale}/posts/${post.slug}/index.html`, renderPost(locale, post));
  }
}

writeFile("sitemap.xml", renderSitemap());
writeFile("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`);
writeFile("llms.txt", renderLlms());
writeFile("ai.txt", renderAiTxt());

console.log(`Built ${posts.length} post(s) into ${path.relative(root, outDir)}.`);

function renderIndex(locale) {
  const title = `${site.siteName} - ${site.localeNames[locale]}`;
  const description = "Practical notes on briefs, prompts, revisions, and publishing decisions for people making music with AI tools.";
  const items = posts
    .map((post) => {
      const entry = post.translations[locale];
      return `<article class="post-card">
        <time datetime="${post.date}">${post.date}</time>
        <h2><a href="${localUrl(`/${locale}/posts/${post.slug}/`)}">${escapeHtml(entry.title)}</a></h2>
        <p>${escapeHtml(entry.description)}</p>
      </article>`;
    })
    .join("\n");
  return layout(locale, title, description, localeHomePath(locale), `
    <section class="hero">
      <p class="eyebrow">Prompts, edits, and publishing decisions</p>
      <h1>Make the music brief do real work</h1>
      <p>Field-tested notes for creators, marketers, educators, and small teams turning rough audio ideas into usable tracks.</p>
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
  const alternateLinks = alternates || Object.fromEntries(site.locales.map((code) => [code, `${site.baseUrl}${localeHomePath(code)}`]));
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
  <link rel="stylesheet" href="${localUrl("/assets/site.css")}">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${localUrl(localeHomePath(locale))}">${escapeHtml(site.siteName)}</a>
    <nav aria-label="Languages">
      ${site.locales.map((code) => `<a href="${localUrl(localeHomePath(code))}"${code === locale ? ' aria-current="page"' : ""}>${code.toUpperCase()}</a>`).join("")}
    </nav>
  </header>
  <main>${content}</main>
  <footer>
    <p>${escapeHtml(site.siteName)} publishes practical AI music workflow guides. Product references point to verified ${escapeHtml(site.productName)} pages.</p>
    <p><a href="${site.productUrl}">${escapeHtml(site.productName)}</a> · <a href="${localUrl(`/${locale}/feed.xml`)}">RSS</a> · <a href="${localUrl("/llms.txt")}">llms.txt</a></p>
  </footer>
</body>
</html>`;
}

function renderSitemap() {
  const urls = [{ loc: `${site.baseUrl}/`, lastmod: today() }];
  for (const locale of site.locales) {
    if (locale !== site.defaultLocale) {
      urls.push({ loc: `${site.baseUrl}/${locale}/`, lastmod: today() });
    }
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
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeHtml(site.siteName)} (${locale})</title><link>${site.baseUrl}${localeHomePath(locale)}</link><description>Multilingual AI music creation guides.</description>${items}</channel></rss>`;
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

function css() {
  return `:root{color-scheme:light;--ink:#17211f;--muted:#5d6b66;--paper:#fbfaf6;--line:#d9ded7;--accent:#0f766e;--warm:#b45309;--panel:#ffffff;--soft:#eef3ee;--gold:#d6a03d}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#fbfaf6 0%,#f2f6f0 46%,#fbfaf6 100%);color:var(--ink);font-family:ui-serif,Georgia,Cambria,"Times New Roman",serif;line-height:1.7}a{color:var(--accent);text-decoration-thickness:.08em;text-underline-offset:.2em}.site-header{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:18px clamp(18px,4vw,56px);border-bottom:1px solid color-mix(in srgb,var(--line),transparent 12%);background:rgba(251,250,246,.9);position:sticky;top:0;z-index:5;backdrop-filter:blur(14px)}.brand{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:850;color:var(--ink);text-decoration:none;letter-spacing:.01em}nav{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end}nav a{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;font-weight:700;text-decoration:none;color:var(--muted);padding:5px 7px;border-radius:4px}nav a:hover,nav a[aria-current=page]{color:var(--ink);background:var(--soft)}main{width:min(100%,1080px);margin:0 auto;padding:46px clamp(18px,4vw,34px) 72px}.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,280px);gap:clamp(22px,5vw,64px);align-items:end;padding:50px 0 38px;border-bottom:1px solid var(--line)}.hero:after{content:"";height:220px;border:1px solid var(--line);border-radius:8px;background:linear-gradient(135deg,#12312d 0%,#0f766e 45%,#d6a03d 100%);box-shadow:inset 0 0 0 12px rgba(251,250,246,.16)}.eyebrow{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--warm);font-weight:800}.hero h1,.article h1{font-size:clamp(38px,6vw,76px);line-height:.98;margin:10px 0 20px;letter-spacing:0;max-width:900px}.hero p,.dek{max-width:760px;color:var(--muted);font-size:19px}.post-list{display:grid;gap:18px;margin-top:30px}.post-card{background:rgba(255,255,255,.82);border:1px solid var(--line);border-radius:8px;padding:24px 26px;box-shadow:0 18px 50px rgba(23,33,31,.06)}.post-card h2{font-size:26px;line-height:1.14;margin:8px 0 10px}.post-card time{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--warm);font-size:12px;font-weight:800;letter-spacing:.05em}.article{background:rgba(255,255,255,.9);border:1px solid var(--line);border-radius:8px;padding:clamp(24px,5vw,60px);box-shadow:0 18px 60px rgba(23,33,31,.07)}.article h2{margin-top:42px;font-size:30px;line-height:1.16}.article h3{margin-top:30px;font-size:21px}.article p,.article li{font-size:18px}.article p{max-width:760px}.article ul{padding-inline-start:1.35rem;max-width:760px}.article li+li{margin-top:8px}footer{border-top:1px solid var(--line);padding:30px clamp(18px,4vw,56px);color:var(--muted);font-size:14px;background:#f7f7f1}footer p{max-width:900px}@media(max-width:760px){.site-header{position:static;align-items:flex-start;flex-direction:column}.hero{grid-template-columns:1fr;padding-top:24px}.hero:after{height:120px;order:-1}.article{border-left:0;border-right:0;border-radius:0;margin-left:-18px;margin-right:-18px}.hero h1,.article h1{font-size:38px}.article p,.article li{font-size:17px}}`;
}

function localUrl(pathname) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${basePath}${normalized}`;
}

function localeHomePath(locale) {
  return locale === site.defaultLocale ? "/" : `/${locale}/`;
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
