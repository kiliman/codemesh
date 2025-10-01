# CodeMesh Landing Page

Beautiful, modern landing page for CodeMesh built with Astro + Tailwind CSS.

## Features

- 🎨 Modern gradient design with dark theme
- ⚡ Lightning-fast Astro static site generation
- 🎯 Fully responsive design
- 💅 Tailwind CSS v4 for styling
- 🖼️ Showcases the Sonnet 4.5 badge
- 📱 Mobile-first approach

## Development

```bash
# Start dev server from root
pnpm dev:landing

# Or from this directory
pnpm dev
```

Visit http://localhost:4321 to see the site.

## Building

```bash
# Build from root
pnpm build:landing

# Or from this directory
pnpm build
```

The built site will be in `dist/` and can be deployed to any static hosting provider.

## Deployment Options

- **Cloudflare Pages** - Recommended for CDN and edge performance
- **Netlify** - Easy deployment with continuous integration
- **Vercel** - Great for Next.js-like deployments
- **GitHub Pages** - Free static hosting
- **Any static host** - It's just HTML, CSS, and JS!

## Structure

- `src/pages/index.astro` - Main landing page
- `src/styles/global.css` - Global Tailwind styles
- `public/` - Static assets (images, favicon, etc.)

Built with ❤️ by Claudia
