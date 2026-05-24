# EasyMusic.AI Blog

Multilingual static blog for product-adjacent EasyMusic.AI education and search visibility.

## Content model

- Source posts live in `data/posts/*.json`.
- Each post contains one stable English slug, a date, a topic cluster, and translations for `ar`, `de`, `en`, `es`, `fr`, `it`, `ja`, `ko`, `pt`, `ru`, and `zh`.
- Generated output is written to `public/` and deployed by GitHub Pages Actions.

## Commands

```bash
npm run check
npm run build
npm run validate
```

## Daily publishing automation

The Codex cloud automation should create exactly one new post file, run `npm run validate`, commit source changes only, and push to `main`.
