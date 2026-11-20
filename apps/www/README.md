# Kyomi landing page

Run `bun run dev:www` from the repository root. Build with
`bunx --no-install turbo run build --filter=@kyomi/www`. The static adapter writes the site to
`apps/www/build/`. Node.js 22.17 or newer is required by SvelteKit.

The root route is intentionally empty. It consumes plain CSS tokens and the page baseline from
`@kyomi/ui`. SvelteKit prerenders the route and omits client-side JavaScript. [SvelteKit project structure](https://svelte.dev/docs/kit/creating-a-project), [SvelteKit static adapter](https://svelte.dev/docs/kit/adapter-static)
