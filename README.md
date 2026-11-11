# Tristan's personal website

A fresh Astro + Tailwind CSS project. Run commands from the repository root.

## Development

```sh
npm ci
npm run dev
```

Open the local URL printed by Astro.

The navbar Contact form includes temporary drafts, attachments, and an animated
success screen. Its separate Cloudflare Worker sends through Resend and must be configured before
live sending works. See [contact form setup](docs/contact-form.md).

## Production build

```sh
npm run build
npm run preview
```

Astro generates the static site in `dist/`. The root `wrangler.jsonc` deploys
those static assets to the `tristanv0-github-io` Cloudflare Worker. Its empty
`previews` block enables pull-request builds using `npx wrangler preview`.

In that Worker's Cloudflare build settings, use the repository root, build
command `npm run build`, production deploy command `npx wrangler deploy`, and
preview deploy command `npx wrangler preview`. Set `STREVY_API_ORIGIN` and
`PUBLIC_CONTACT_ENDPOINT` in the build environment before rebuilding.

The contact Worker has a separate configuration. Deploy it explicitly with
`npx wrangler@4 deploy --config workers/contact/wrangler.jsonc`; the root
configuration is only for the portfolio website.

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

## Experience and education

Edit `src/data/experience.ts` to update timeline entries, dates, logos and modal
bullet points. `**Emphasis**` in a bullet renders as bold text. Work entries use
peach pills; student clubs and education use blue. TMU Blueprint and TMU CSA
sit above the full-width degree entry. Desktop positions share date boundaries
from each role’s `startMonth` and inclusive `endMonth`, so consecutive roles
meet at the same horizontal position. Inactive gaps are compressed and short
roles get enough space to keep all labels inside their bubbles. Each group
steps across the page,
while smaller screens use full-width entries along a vertical rail. Entries roll
in once per visit and open accessible detail dialogs on click or keyboard
activation. Reduced motion skips the entrance and dialog animations.

The desktop background uses separate, faint code-window and notebook sketches,
small drafting marks, and a “learning by doing” note. These are static decorative
elements with no connections between entries. Edit `ExperienceBackdrop.astro`
for their placement and styling. Smaller screens keep the vertical timeline rail.

## Strevy integration

Start the Strevy API in its own repository with `npm run dev`. The portfolio defaults to `http://localhost:3001` and fetches `GET /api/runs` from Astro frontmatter. The Running tab displays the five most recent runs with real dates, distances, moving times, paces and route PNGs. Scroll down to travel through the pinned carousel, or swipe/scroll horizontally. Clicking a run opens its details dialog.

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

Running, Gym and Badminton tabs sit above the cards and stay available during pinned
scrolling. Switching hobbies slides the old row left and the new row in from
the right, preserving horizontal progress. The inactive panel is inert and
hidden from assistive technology. Tabs support arrow keys, Home and End;
rapid changes queue the latest choice. Reduced motion switches immediately.
Inactive tabs have a rotating gradient border with a soft halo: darker orange
for Running, darker blue for Gym and darker green for Badminton. `src/components/HobbyTab.astro` keeps
the glow around the edge, behind the label. Active tabs remain solid; orbit
animations pause offscreen or in a hidden tab, and reduced motion keeps them still.
The Gym tab fetches `GET /api/workouts` from the same `STREVY_API_ORIGIN` at
build time. `src/data/workouts.ts` selects the latest five full workouts for
`src/components/WorkoutCard.astro`; summaries only populate calendar attendance.
Cards show the first valid `photos[].url`, or the dumbbell placeholder when
there is no photo or it fails to load. Below the image are the date, title,
duration, volume in the scraped unit, and set count. Runs and workouts load independently, with an unavailable message
for a failed source. Tab transitions live in `src/scripts/hobby-tabs.ts`.

The Badminton tab fetches `GET /api/badminton` from `STREVY_API_ORIGIN` at build
time and displays the latest five daily summaries. Its theme is `#05A74F`.
Cards show duration, active energy in kcal and rallies with odometer animations;
clicking a card opens the shared zoom dialog with average heart rate and distance
covered as well. Date-only API values retain their original calendar day, missing
metrics show dashes, and a failed badminton request does not affect the other tabs.
`src/components/BadmintonBackground.astro` draws a doubles court with service
lines, singles sidelines and a mesh net in the middle. The court reveals when
entering the tab and stays still throughout pinned horizontal scrolling.
Each horizontal and vertical court line has a tapered dark green highlight (`#037535`, matching
the inactive tab border) that glides back and forth with a randomized phase and
moderate speed. Highlights pause offscreen, in inactive hobbies and hidden browser
tabs, and are omitted for reduced motion.
When leaving Badminton, each trail accelerates offscreen in its current travel
direction while the court outline and net fade away. The temporary clipping
removal lets highlights continue past the court boundary; resting geometry is
restored before the next entry. The shared activity calendar stays visible.
Shared tab labels and colors live in `src/data/hobbies.ts`.

Clicking a Gym card uses the same center-and-zoom animation as a run card.
`src/components/WorkoutModal.astro` puts a small photo gallery and compact
workout stats in the left column, with a separately scrolling exercise list on
the right. Additional photos can be scrolled horizontally. Start/end times use
Toronto time without a city label. The warmup-volume note and Hevy link are omitted.
Hovering briefly previews an exercise's sets; leaving closes that preview.
Click toggles the current expanded state, including hover-open items, and
keeps a clicked-open item open. A click-closed item stays closed until the
pointer leaves and re-enters. Exercise headings omit index/muscle/equipment
labels and show metadata such as `3 sets · 3m rest`. The right column is narrower.
Native disclosure controls also support clicking,
Enter/Space and touch. Dropdown height and opacity animate on opening/closing;
rapid changes reverse from the current frame. Reduced motion switches instantly.
All disclosures, animations and scroll positions reset on reopening.
Sets use compact alternating rows with a gold `W` for warmups, working-set
numbers starting at one, and values such as `185 lb × 10 reps`. Notes, rest
intervals, time, distance, RPE and record badges are retained.
On phones the overview stacks above the
scrolling exercise list, and the overall dialog can scroll on short screens.
Both hobbies share `src/scripts/run-modal.ts`, including Escape,
backdrop/close buttons, focus restoration, scroll locking and reduced motion.

Strevy reads `strava/latest-runs.json`, `strava/media/...` and
`hevy/latest-workouts.json` from R2. The public endpoints remain `/api/runs`,
`/api/runs/media/...` and `/api/workouts`. Deploy the updated Strevy Worker
before rebuilding the portfolio with the hosted API origin. Updating R2 alone
does not refresh this static website; rebuild it after each scrape/upload.

The transparent activity calendar is shared across Running, Gym and Badminton.
It sits at the upper right with its bottom aligned to the hobby buttons on
tablet/desktop; on phones it stacks above the buttons. It stays visible when
switching hobbies and shares the pinned frame with the cards. On short screens
the calendar scrolls above the viewport before the buttons/cards pin, allowing
horizontal travel to remain usable. The running note sits beside the intro
copy, clear of the calendar. A soft fade conceals artwork behind the dates.

Each activity gets its own colored circle: orange for runs, blue for gym and
green for badminton. Multiple activities stack, including multiple workouts
of the same hobby. Switching tabs rotates the first matching activity to the
front, leaving days without that hobby alone. Hovering or keyboard-focusing a
day scrolls long titles and cycles through every activity with an animated
circle swap. Leaving restores the selected hobby's front circle. Reduced
motion shows all titles without scrolling or rotating them. Full activity
names remain available in the accessible date label.

The calendar uses all dates supplied by each API before limiting the card rows
to five entries. The run endpoint currently supplies five runs; Hevy summaries
and the full badminton history also contribute dates. It shows the current
Toronto month and refreshes today/month on load, focus and once per minute.
Today's filled marker pulses unless reduced motion is enabled or the calendar
is hidden/offscreen. The calendar is independent of Gym's particle transitions.
Updating the activity history still requires rebuilding the static site.
Layout is in `src/components/ActivityCalendar.astro`, the combined model in
`src/data/activity-calendar.ts`, and interactions in `src/scripts/activity-calendar.ts`,
`calendar-stack.ts` and `activity-calendar-hover.ts`.

The runs carousel spans the viewport. Leading and trailing spacers align the
first and last cards with the section margins at either end; those spacers move
with the content so cards flow to both screen edges while scrolling. Clicking
a card opens its details dialog without a selected-card state or a separate
summary below the carousel. Both hobbies end after the cards, with no divider,
project blurb or update footer. The running curves fit the shorter section.
Near the end of the page, the carousel reserves enough scroll distance to
reach its final card; that extra distance does not stretch the background.
When the cards fit below the sticky header,
scrolling down pins the carousel and moves
the cards left until the last run is visible, then the page continues downward.
Both hobbies use 1.8 pixels of vertical travel per horizontal pixel for a slower,
gentler pace. Adjust `VERTICAL_SCROLL_PER_PIXEL` in `src/scripts/run-carousel.ts`
to tune this independently of the page-wide wheel sensitivity.
Scrolling up reverses that progression. Horizontal swiping and
keyboard navigation stay synchronized with the page's scroll position. Reduced
motion and viewports too short for the buttons/cards retain the native
horizontal carousel without pinning. This behavior is in `src/scripts/run-carousel.ts`.
The scrollbar is hidden; swiping and keyboard navigation remain available.

Card stats use `Odometer.astro` and `src/scripts/card-odometers.ts` to roll digits
into place as they enter view, replaying when returning to a hobby. Separators
and units remain still. The effect only animates transforms; reduced motion
and JavaScript-free views show the final values immediately.

Run cards use a consistent scattered arrangement with five smaller widths,
uneven gaps and varied vertical offsets. Edit `runLayouts` in `Hobbies.astro`
to change the composition. `RunCard.astro` varies the photo proportions, paper
colours and rotations. Spacing is tighter on phones; `--run-stagger-max` controls
the vertical range, which is reduced to fit shorter viewports when possible.
Slot padding reserves room below the lower cards, while hover effects remain
independent. The arrangement stays stable across reloads.

Running keeps the orange `#FC4C02` arrows tracing along their curves with scroll.
Switching to Gym sends those arrows offscreen, then falling particles assemble
the Gym artwork from the bottom up. Leaving Gym dissolves the artwork from the
top down, with dust drifting upward before the orange arrows return. The
"keyboard" accent changes to blue `#1E6FFF` for Gym and orange for Running.
"Taking the scenic route" returns when the orange color transition begins.

Gym also has two oversized blue weight-plate outlines and a handwritten
"one more rep." note above the cards. These details
fade with the hobby theme and stay fixed during horizontal travel. The note
accounts for the stacked calendar on phones; all decorations ignore pointer
events. Edit them in `GymBackground.astro` and `Hobbies.astro`.

Gym has a longer blue line graph lower on the left and a gold wireframe medal
lower on the right. The graph starts with five points and adds one about every
2.6 seconds: 60% of steps rise, 20% hold steady and 20% dip. The lower baseline
and taller drawing area leave room for higher peaks, with occasional larger
upward jumps. It keeps a rolling
window of thirteen points, with a gentle 0.7-second pulse on the newest dot. This
is decorative progress, not measured workout history. The medal has two faces
and connecting edges, projected in perspective, and turns once every 22 seconds.
Its darker gold outline stays readable against the light background.

`src/components/GymBackground.astro` controls placement and outline styling;
`src/scripts/gym-background.ts` controls growth, rotation and particle effects.
Particles use the same points as the vector outlines. Each transition caches
the artwork and particle sprites once, then draws the reveal and dust in canvas
on the display's animation frames, avoiding repeated SVG clipping and geometry
queries. Both artworks stay anchored during pinned carousel travel. Gym pauses
offscreen or in a hidden tab. Reduced motion skips particles, rotation, graph
growth and blinking, and switches hobbies immediately. Without JavaScript, the
complete orange lines remain visible and the Running tab is shown.

The SVG keeps its aspect ratio. Its background layer excludes the carousel's
extra scroll height and uses native sticky positioning to stay fixed behind the
pinned cards. Arrowheads keep tracing their paths with page-scroll progress,
including throughout horizontal scrolling. Decorative drift follows the sticky
layer's position, keeping the backdrop steady during the pinned portion.

`src/components/RunningScenery.astro` adds overhead trees and faceted rocks in
the same SVG coordinate space. Rocks leave clearance for the arrows' full
vertical drift; the larger rock inside the middle loop follows that arrow's
drift to remain within the loop. Paper-colored radial halos let the lines fade beneath tree
canopy edges. The scenery stays fixed with the arrows during horizontal card
travel and fades out/in with Running's hobby transition.

Edit arrow shapes, colour and thickness in `src/components/ScrollArrows.astro`, and motion in `src/scripts/hobbies-motion.ts`.

## Styling

`src/scripts/page-scroll.ts` scales vertical mouse-wheel and trackpad input to
65% of its original distance and adds a short easing effect. Tune
`WHEEL_SENSITIVITY` and `SMOOTHING_MS` there. Touch, keyboard, anchor links,
horizontal gestures, zoom and nested scroll regions retain native behavior.
Reduced motion keeps the lower wheel sensitivity but skips easing. The script
uses the real document scroll position so sticky scenes and the carousel stay
synchronized.

Layout, typography, colours, responsive behaviour and interaction states use Tailwind classes directly on the relevant Astro tags. `RunCard.astro` and `ProjectCard.astro` keep repeated card markup in one place. Tailwind variants use complete, static class names so the compiler can discover them.

`src/styles/global.css` contains only the Tailwind import, shared theme tokens/breakpoints and site-wide browser defaults. Edit shared palette values in its `@theme` block; edit individual sections in their `.astro` files. SVG stroke geometry uses native SVG attributes on the relevant paths.
