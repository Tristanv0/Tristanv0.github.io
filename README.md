# Tristan's personal website

A fresh Astro + Tailwind CSS project. Run commands from the repository root.

## Development

```sh
npm ci
npm run dev
```

Open the local URL printed by Astro.

## Production build

```sh
npm run build
npm run preview
```

Astro generates the static site in `dist/`. Deployment has not been configured for this rebuild yet.

## Project structure

```text
src/pages/          Page routes; index.astro is the homepage
src/components/     Section headings, project/run cards, Hobbies and scroll arrows
src/data/runs.ts    Strevy API fetching, types and run-card data formatting
src/scripts/        Scroll-driven arrow animation
src/styles/         Global CSS and the Tailwind import
public/             Static assets copied into the build
astro.config.mjs    Astro and Tailwind Vite configuration
```

The original React site is preserved on the local `archive/original-portfolio` branch. Work on the replacement happens on `rebuild`.

## Strevy integration

Start the Strevy API in its own repository with `npm run dev`. The portfolio defaults to `http://localhost:3001` and fetches `GET /api/runs` from Astro frontmatter. The Hobbies section displays the five most recent runs with real dates, distances, moving times, paces and route PNGs. Three cards fit across on desktop; on mobile, one card and a hint of the next are visible. Swipe, scroll horizontally or use the previous/next buttons to browse the row. Selecting a card updates its description and opens its details dialog.

If a run has attached photos, its first valid photo fills the card's image area and the transparent route PNG sits above it. A subtle shade and route glow keep the path visible. Runs without photos retain the route-only design. Photo and route failures are handled independently, so a failed photo falls back to the plain route and a failed route still leaves the photo visible. Photo URLs are used directly from Strevy rather than downloaded into this repository.

To use another API origin, copy `.env.example` to `.env` and set:

```dotenv
STREVY_API_ORIGIN=http://localhost:3001
```

Restart Astro after changing environment settings. Fetching happens on development page requests and during `npm run build`. The deployed static page contains a snapshot, so rebuild to publish new runs. It does not poll the API in the browser. Route PNGs load separately from Strevy using absolute image URLs resolved against this origin.

Before deployment, set `STREVY_API_ORIGIN` to a public HTTPS API origin so visitors can load the route images. A deployed site cannot load images from the localhost server on your computer. The build environment must also be able to reach that API. This server/build-time JSON fetch does not require browser CORS changes.

If the API is offline, returns an error, or has no runs, the rest of the portfolio still renders with an unavailable or empty message. Missing metrics appear as dashes and missing route images show a fallback.

## Run details dialog

Clicking a run lifts the card into the center of the screen, then reveals a modal with its first photo above the `mapImage` (the route with its map background). The map uses the absolute `mapImage.url` from Strava's CDN directly and displays at full column width with its natural proportions, including wide feed maps. Older API-relative map URLs and `mapImage.path` values remain supported; paths are resolved relative to `/api/runs/`. The cards continue using the transparent `routeImage` overlay. Missing photos or maps are omitted, and failed images show an unavailable message. The right column shows the date and sport type, title, distance, moving time, pace, average heart rate, elevation gain and relative effort, in that order. Missing values appear as dashes. The layout stacks on mobile and scrolls inside the dialog when needed.

The native dialog keeps keyboard focus inside it. Close with Escape, the close button or a backdrop click; focus returns to the card. The page stays in place while the dialog is open. Reduced-motion settings skip the zoom animation. Edit the layout in `src/components/RunModal.astro` and animation in `src/scripts/run-modal.ts`.

## Hobbies motion

Orange arrows trace forward and drift as Hobbies moves through the viewport. The animation uses passive scroll events and one animation frame per update, with work limited to the visible section. With the browser's reduced-motion preference enabled, the arrows remain static. Without JavaScript, the complete decorative lines remain visible.

Edit arrow shapes, colour and thickness in `src/components/ScrollArrows.astro`, and motion in `src/scripts/hobbies-motion.ts`.

## Styling

Layout, typography, colours, responsive behaviour and interaction states use Tailwind classes directly on the relevant Astro tags. `RunCard.astro` and `ProjectCard.astro` keep repeated card markup in one place. Tailwind variants use complete, static class names so the compiler can discover them.

`src/styles/global.css` contains only the Tailwind import, shared theme tokens/breakpoints and site-wide browser defaults. Edit shared palette values in its `@theme` block; edit individual sections in their `.astro` files. SVG stroke geometry uses native SVG attributes on the relevant paths.
