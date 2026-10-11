# Deploying

Production is a **Cloudflare Worker with static assets**, on the Custom Domains
`shashankbansal.io` and `www.shashankbansal.io`.

- `wrangler.jsonc` — assets dir `./dist`, Custom Domain routes, `workers_dev` off.
- `worker/index.js` — 301s `www` → apex, otherwise serves the asset.
- `public/404.html` — served for unknown paths (`not_found_handling: "404-page"`).

Custom Domains make Cloudflare create the DNS records and TLS certificates on the
first deploy. Nothing needs to be added to DNS by hand, but there must be **no
existing CNAME** on those hostnames.

## First deploy

```bash
npx wrangler login     # once; authorizes this machine in the browser
npm run deploy:check   # build + dry run, uploads nothing
npm run deploy         # build + publish
```

## From GitHub

`.github/workflows/deploy.yml` deploys on manual trigger (Actions → Deploy to
Cloudflare → Run workflow). It needs repo secrets `CLOUDFLARE_API_TOKEN`
(template "Edit Cloudflare Workers") and `CLOUDFLARE_ACCOUNT_ID`. Add a `push`
trigger to deploy on every push to `master`.

## Rolling back

```bash
npx wrangler deployments list
npx wrangler rollback <deployment-id>
```

Or check out an older git tag and `npm run deploy` again.
