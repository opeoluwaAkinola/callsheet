# web

The CallSheet coordinator UI: Vue 3, TypeScript, Pinia and Vue Router, built with Vite.

```bash
npm install
npm run dev      # http://localhost:5173, proxies /graphql to the gateway on :4000
npm test         # Vitest + Vue Test Utils + axe-core accessibility checks
npm run build    # type-check and production build
```

In Docker, nginx serves the built app and proxies `/graphql` to `GATEWAY_URL`.
