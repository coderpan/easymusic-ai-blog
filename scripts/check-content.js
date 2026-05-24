const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const site = readJson("data/site.json");
const postFiles = fs
  .readdirSync(path.join(root, "data/posts"))
  .filter((file) => file.endsWith(".json"))
  .sort();

const errors = [];
const slugs = new Set();

if (!postFiles.length) {
  errors.push("Expected at least one post in data/posts.");
}

for (const file of postFiles) {
  const post = readJson(path.join("data/posts", file));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date || "")) {
    errors.push(`${file}: date must be YYYY-MM-DD.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug || "")) {
    errors.push(`${file}: slug must be lowercase kebab-case.`);
  }
  if (slugs.has(post.slug)) {
    errors.push(`${file}: duplicate slug ${post.slug}.`);
  }
  slugs.add(post.slug);
  for (const locale of site.locales) {
    const entry = post.translations && post.translations[locale];
    if (!entry) {
      errors.push(`${file}: missing ${locale} translation.`);
      continue;
    }
    const body = Array.isArray(entry.body) ? entry.body.join("\n\n") : entry.body;
    for (const key of ["title", "description"]) {
      if (!entry[key] || entry[key].trim().length < 20) {
        errors.push(`${file}: ${locale}.${key} is missing or too thin.`);
      }
    }
    if (!body || body.trim().length < 700) {
      errors.push(`${file}: ${locale}.body is missing or too thin.`);
    }
    const productLinks = [...body.matchAll(/https:\/\/easymusic\.ai[^\s)]+/g)].map((match) => match[0]);
    if (!productLinks.length || productLinks.length > 3) {
      errors.push(`${file}: ${locale} should contain 1-3 EasyMusic product links.`);
    }
    for (const link of productLinks) {
      if (!isAllowedProductLink(link, locale)) {
        errors.push(`${file}: ${locale} uses an unlisted product link: ${link}`);
      }
    }
    if (/copyright-free|royalty-free|plagiarism-free/i.test(body)) {
      errors.push(`${file}: ${locale} contains unsafe rights phrasing.`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Checked ${postFiles.length} post(s) across ${site.locales.length} locales.`);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function isAllowedProductLink(link, locale) {
  const allowed = Object.values(site.defaultProductLinks)
    .map((linksByLocale) => linksByLocale[locale] || linksByLocale[site.defaultLocale])
    .filter(Boolean);
  return allowed.includes(link.replace(/[.,;:!?]+$/, ""));
}
