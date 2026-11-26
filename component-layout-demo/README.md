# Jitsi component layout demo

A small React app that shows the meeting UI split into three independent areas:

1. **Główny obraz** (main video)
2. **Filmstrip** (participant thumbnails)
3. **Opcje** (toolbar: microphone, camera, ...)

Every area has a **Ukryj / Pokaż** button. In `Demo` mode the areas are mocked so
the app runs with no backend. In `Jitsi na żywo` mode the same buttons drive the
component layout API added in the fork:

| Area | Component id | Visibility | Inline panel |
| --- | --- | --- | --- |
| Główny obraz | `largeVideo` | `setComponentVisible` | not movable (by design) |
| Filmstrip | `filmstrip` | `setComponentVisible` | `openComponentSurface({ iframe })` + `setComponentTarget` |
| Opcje | `toolbox` | `setComponentVisible` | `openComponentSurface({ iframe })` + `setComponentTarget` |

The filmstrip and options panels are iframes placed by this app next to the
meeting. Jitsi portals the real components into them, so all three areas live on
the same page — no popups involved.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173.

## Live mode

Build the fork and serve it, then in the app switch to `Jitsi na żywo`, enter the
deployment address and a room name, and press `Połącz`.

For the development server:

```sh
cd ..   # repository root, this demo lives in component-layout-demo/
make dev WEBPACK_DEV_SERVER="./node_modules/.bin/webpack serve --mode development --port 8090"
```

The default `make dev` listens on 8080. If another Jitsi (for example a Docker
stack) already owns 8080, use 8090 as above — that is what the demo's default
assumes. (`./node_modules/.bin/webpack serve --mode development --port 8090`
also works once the assets have been deployed once.)

**Inline panels require the demo page and the meeting to share an origin.** Open
the app from the fork's dev server, not from Vite:

```
https://localhost:8090/static/component-layout-app/
```

with server `localhost:8090`. Accept the self-signed certificate first. Use
**https://**, not http:// — the server speaks HTTPS only, and
`JitsiMeetExternalAPI` always builds its iframe with `https://` anyway.

Clicking **Jitsi na żywo** (or the **Połącz z Jitsi** button in demo mode)
opens a mandatory **Połącz ze spotkaniem** dialog with the server and room
fields, prefilled with `localhost:8090`. Press **Połącz**; the dialog closes
and the meeting appears in the main area.

When the app runs from Vite (`http://localhost:5173`), it is cross-origin to the
meeting: the show/hide buttons work, but moving a component into a panel fails
with `embedder-cross-origin`. The app shows a link to the same-origin copy in
that case.

On connect the app fetches `libs/external_api.min.js` and refuses to connect if
the bundle has no component-layout commands (a stock Jitsi), logging a hint
instead of failing silently.

The app loads the API from `libs/external_api.min.js`, which is the path both a
deployed Jitsi and the fork's dev server serve (and which nginx aliases at
`/external_api.js`). Pointing the app at a stock Jitsi works for joining a room
but not for the component layout commands — they only exist in this fork.

Notes:

* The demo page and the Jitsi deployment must both be reachable from the browser.
  A self-signed development certificate has to be accepted for the deployment.
* The inline panel iframes load `static/secondScreen.html` from the deployment
  and are never closed by Jitsi: removing them from the page moves the component
  back to the meeting.
* The filmstrip panel is sized to the filmstrip's natural width
  (`SURFACE_SIZES.filmstripWidth`). Do not use `viewport: true` for an inline
  filmstrip: it rewrites the meeting's global responsive metrics and can flip it
  into reduced UI, where no filmstrip exists. A surface hosting the toolbar
  keeps it visible (it does not auto-hide like the meeting toolbar).
* The fork mounts the filmstrip slots even in the reduced UI (`onlyWhenMoved`),
  so a targeted filmstrip still reaches its panel in small meeting windows.
* A component moved to a panel loses local UI state (an open menu, scroll
  position); its redux state is shared.

## Sizes

The panels mirror the natural size of the Jitsi modules:

* **filmstrip** – `SURFACE_SIZES.filmstripWidth` = 144 px panel / 140 px module
  (Jitsi's `DEFAULT_FILMSTRIP_WIDTH` is 120 px plus borders and scrollbar). Jitsi's
  filmstrip has a fixed width, so a wider panel would leave black space.
* **toolbar** – `SURFACE_SIZES.toolbarHeight` = 92 px (the toolbar content is
  76 px plus its margin).

Both are exported from the library, and the demo applies them as CSS variables.
Override them if your deployment changes `interfaceConfig.FILM_STRIP_MAX_HEIGHT`,
enables a resizable filmstrip, or uses a custom toolbar. Do **not** use
`viewport: true` for an inline filmstrip: it changes the meeting's global
responsive metrics and can flip it into reduced UI, where no filmstrip exists.
The fork mounts the filmstrip slots in reduced UI as well, so a targeted
filmstrip still reaches its panel.

## Using it from another project

The reusable part is `src/lib` (framework-specific only in the small
`InlineSurface` component). It is built into `dist-lib` as an ES module with
type declarations and React externalized:

```sh
npm run build:lib     # dist-lib/jitsi-component-layout.js + .d.ts
npm pack              # jitsi-component-layout-0.1.0.tgz
```

Then in another project:

```sh
npm install /path/to/jitsi-component-layout-0.1.0.tgz
# or, without packing:
npm install /path/to/component-layout-demo
```

```tsx
import {
    COMPONENT_IDS,
    createComponentLayout,
    InlineSurface,
    SURFACE_SIZES
} from 'jitsi-component-layout';

function SplitView({ api }) {
    const layout = createComponentLayout(api);

    return (
        <div style = {{ display: 'grid', gridTemplateColumns: `1fr ${SURFACE_SIZES.filmstripWidth}px` }}>
            <div id = 'meeting' />
            <InlineSurface
                id = 'filmstrip-panel'
                src = 'https://meet.example.com/static/secondScreen.html'
                title = 'Filmstrip' />
            <button
                onClick = { () => layout.place(
                    COMPONENT_IDS.FILMSTRIP,
                    'filmstrip-panel',
                    '#filmstrip-panel'
                ) }>
                Move filmstrip
            </button>
        </div>
    );
}
```

Requirements: the deployment must be the fork, the demo/embedder page must be
same-origin with the meeting, and the iframe shell must be served from
`/static/secondScreen.html`. `createComponentLayout` is also usable without
React (it just calls `executeCommand` on the external API instance).

## Build

```sh
npm run build
rm -rf ../static/component-layout-app
cp -r dist ../static/component-layout-app
```

`../static/component-layout-app/` is what the fork serves at
`/static/component-layout-app/` (the build uses a relative base, so it works
from a subdirectory). The committed copy in the repository is built this way.
