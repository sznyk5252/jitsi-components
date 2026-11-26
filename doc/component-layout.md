# Component layout API (fork)

This fork adds the ability to split the meeting UI into independent
**components** and render each of them in a different place: a separate browser
window, or (when the meeting is not embedded) an element inside the meeting
document. It is aimed at wall-display / multi-monitor setups and at embedders
that want a custom chrome around the conference.

Out of the box the toolbar, the filmstrips, the chat, the participants pane, the
custom panel, the reactions and the callee info can be moved; every component,
including the large video, can be shown or hidden. The large video cannot leave
the meeting window, and the notifications are not part of the layout.

## Quick start

The embedder interface is the regular Jitsi iframe API:

```html
<script src="https://your-deployment/external_api.js"></script>

<div style="display: flex; gap: 8px">
    <div id="meeting" style="width: 900px; height: 600px"></div>
</div>

<script>
const api = new JitsiMeetExternalAPI('your-deployment', {
    parentNode: document.getElementById('meeting'),
    roomName: 'ComponentLayoutDemo'
});

api.addEventListener('componentSurfaceError', ({ id, error, component }) => {
    console.warn('surface error', id, error, component);
});

// Runs from a click handler: browsers only allow popups that come from a user
// gesture. The window is opened by the meeting page, so the click has to reach
// it through the API (see the "Popup blocking" section).
async function split() {
    api.executeCommand('openComponentSurface', {
        id: 'side',
        title: 'Toolbar and filmstrip',
        width: 520,
        height: 720
    });

    // Both components share one window. There is no need to wait for
    // `componentSurfaceOpened`: targets may be set first, they apply as soon as
    // the window's handle is attached.
    api.executeCommand('setComponentTargets', {
        toolbar: 'side',
        filmstrip: 'side'
    });
}
</script>
```

To render a component back in the meeting window, target it at `main`:

```js
api.executeCommand('setComponentTarget', { component: 'toolbar', target: 'main' });
```

## Commands

| Command | Arguments | Description |
| --- | --- | --- |
| `openComponentSurface` | `{ id, title?, width?, height?, left?, top?, viewport?, iframe? }` | Opens (or focuses) the window for a surface id, or binds the surface to an iframe when `iframe` is given. |
| `closeComponentSurface` | `id` | Closes the window. Components targeted at it move back to the meeting window. |
| `setComponentTarget` | `{ component, target }` | Moves one component. `target` is a surface id, `'main'`, or `{ selector }`. |
| `setComponentTargets` | `{ [component]: target }` | Moves several components at once. |
| `setComponentVisible` | `{ component, visible }` | Shows or hides a component without moving it. It stays mounted, so the large video keeps working. |
| `resetComponentLayout` | – | Shows everything, moves it back and closes every surface window. |

### Component ids

| Id | Component |
| --- | --- |
| `toolbox` | The bottom toolbar with all its buttons. |
| `filmstrip` | The main filmstrip (thumbnails of the participants). |
| `stageFilmstrip` | The stage-view filmstrip. |
| `screenshareFilmstrip` | The screenshare filmstrip. |
| `chat` | The chat panel. |
| `participantsPane` | The participants pane. |
| `customPanel` | The custom (embedded) panel. |
| `reactions` | The reaction animations. |
| `calleeInfo` | The "is calling" indicator. |
| `largeVideo` | The main video. Visibility only (see limitations). |

Unknown ids are rejected with a `componentSurfaceError` event whose
`error` is `unknown-component`.

### Surface options

* `id` – required, any string. The same id always maps to the same window, so
  opening an existing id focuses it instead of creating a second window.
* `iframe` – a CSS selector of an `<iframe>` in the page that embeds the
  meeting. When set, no window is opened: the components are portaled into that
  iframe's document, so each area can sit in the embedder's own layout, next to
  the meeting. The iframe must be same-origin with the meeting (for example the
  app served from the meeting deployment itself). See
  [Inline surfaces](#inline-surfaces-iframes).
* `title` – the window title.
* `width`, `height`, `left`, `top` – initial geometry in CSS pixels.
* `viewport` – when `true`, the size of this window drives the app's **global**
  responsive layout metrics while it is open. This affects the whole meeting,
  and a small surface can flip the app into its reduced UI (which has no
  filmstrip). It is not recommended for inline iframe surfaces: size the panel
  to the filmstrip's natural width (about 132 px) instead, and leave this off.
  Closing the surface restores the meeting window's metrics.

### Inline surfaces (iframes)

Instead of a popup window, a surface can live in an iframe that the embedder
places wherever it wants:

```html
<iframe id="filmstrip-panel" src="https://meet.example.com/static/secondScreen.html"></iframe>

<script>
api.executeCommand('openComponentSurface', {
    id: 'filmstrip-panel',
    iframe: '#filmstrip-panel',
    viewport: true
});
api.executeCommand('setComponentTarget', {
    component: 'filmstrip',
    target: 'filmstrip-panel'
});
</script>
```

The meeting portals the React subtree into the iframe document, gives it its own
Emotion cache and mirrors the meeting's styles into it, so the component looks
and lays out exactly as it does in the meeting. The iframe is never closed by
Jitsi; removing it from the page removes the surface and moves the component
back.

This requires the embedding page to share the meeting's origin. A cross-origin
embedder cannot hand a DOM subtree to the meeting, and gets an
`embedder-cross-origin` error instead — use popup windows there.

### Selector targets

`target: { selector: '#my-toolbar' }` portals the component into the first
element matching the selector **in the meeting document**. This is usable when
the meeting is served directly (or embedded same-origin), not when it runs in a
cross-origin iframe: the meeting document cannot see the embedder's DOM. The
container becomes the positioning context for the component.

## Events

| Event | Payload | Description |
| --- | --- | --- |
| `componentSurfaceOpened` | `{ id }` | The window loaded and its components are being rendered. |
| `componentSurfaceClosed` | `{ id }` | The window was closed, by the API or by the user. |
| `componentSurfaceError` | `{ id, error, component? }` | The window could not be opened, or a target was rejected. |

Error codes: `popup-blocked`, `window-load-timeout`, `window-load-failed`,
`window-setup-failed`, `unknown-component`, `component-not-movable` (the large
video was targeted at a surface), `surface-not-found`, `surface-not-an-iframe`,
`surface-not-ready`, `embedder-cross-origin`.

## Console API

When the meeting is served directly (not through an iframe) the same operations
are available on the page:

```js
APP.componentLayout.openSurface('side', { width: 520, height: 720 });
APP.componentLayout.setTargets({ toolbar: 'side', filmstrip: 'side' });
APP.componentLayout.setTarget('toolbar', 'main');
APP.componentLayout.setVisible('largeVideo', false);
APP.componentLayout.closeSurface('side');
APP.componentLayout.reset();
```

This is handy for trying the feature from the browser console and for wrapper
pages that inject a script into the meeting document.

## How it works

* `react/features/component-layout` holds the redux slice, the middleware and
  the `ComponentSlot` wrapper.
* Every movable component in `Conference.tsx` is wrapped in a
  `<ComponentSlot component=...>`. Without a target the slot renders the
  component in place, so the default UI is unchanged.
* Surfaces are same-origin popups loading `static/secondScreen.html` (the shell
  the multi-screen feature already uses). `ComponentSlot` portals the React
  subtree into the window with `ReactDOM.createPortal`, so redux state, context
  and media tracks stay shared with the meeting.
* The popup gets a per-window Emotion cache and a mirrored copy of the meeting
  document's stylesheets, theme variables and `<html>`/`<body>` classes, so the
  components look and lay out exactly as they do in the meeting.
* The surface root carries `id="videoconference_page"` and the app's current
  layout class (`vertical-filmstrip`, `tile-view`, ...), which is what the
  components' global CSS keys off.
* Pointer movement inside a surface counts as activity, otherwise a detached
  toolbar would auto-hide.

## Limitations

* **Popup blocking.** Windows are opened by the meeting page, which requires a
  user gesture. A browser will block `window.open` if the command arrives from
  an embedder click through an asynchronous `postMessage`. In practice this
  works when the iframe is allowed to be activated (for example the button lives
  inside the meeting UI). Otherwise the embedder gets a `popup-blocked` error.
  Allowing popups for the deployment is recommended.
* **Dialogs and menus stay in the meeting window.** Buttons in a detached
  toolbar still open their dialogs in the main window, and MUI popovers/menus
  are portaled to the meeting document's body, so on a multi-monitor setup they
  can appear on the other display. This is the main rough edge of the current
  implementation.
* **Moving a component remounts it.** A moved component keeps its redux state
  but loses local component state (scroll position, an open menu).
* **One responsive viewport.** Components use the meeting window's size unless
  the surface has `viewport: true`. Only one surface can own the metrics.
* **Inline panels need a same-origin page.** An iframe surface is only reachable
  when the embedder page and the meeting share an origin (for example the React
  demo served from `static/component-layout-app/`). Cross-origin embedders must
  use popup windows.
* **Large video is not movable.** The legacy video layout code looks the
  `<video>` element up in the meeting document by id. It can be hidden and shown
  (the component stays mounted), but not sent to a surface.

## Building

```sh
npm ci
make dev        # dev server
make compile    # production bundles
npm run lint    # eslint + tsc
```

## Demos

* `static/component-layout-demo.html` – a plain embedder example using the iframe
  API.
* `static/component-layout-app/` – the built React mini app with three areas
  (main video, options, filmstrip), a show/hide button for each, and buttons
  that move the filmstrip and toolbar into **inline panels next to the meeting**
  (iframe surfaces). Its source lives in the `component-layout-demo` folder at
  the repository root; run it with `npm install && npm run dev`, or open
  `https://your-deployment/static/component-layout-app/` after deploying.

  The reusable part lives in `component-layout-demo/src/lib` and is built to
  `dist-lib` as an ES module with type declarations (`createComponentLayout`,
  `InlineSurface`, `COMPONENT_IDS`, `SURFACE_SIZES`); the demo README shows how
  to pack it and install it in another project. The panel sizes mirror the Jitsi
  modules: ~144 px for the filmstrip (its computed width is 140 px) and ~92 px
  for the toolbar.

  Inline panels need the demo page and the meeting on the same origin, so open
  the copy served by the deployment (`/static/component-layout-app/`), not the
  Vite dev server, unless you accept the cross-origin limitation (only visibility
  toggles work there). For a dev server, if 8080 is free:

  ```sh
  make dev
  # https://localhost:8080/static/component-layout-app/, server localhost:8080
  ```

  If another deployment already owns 8080, serve the fork on 8090:

  ```sh
  make dev WEBPACK_DEV_SERVER="./node_modules/.bin/webpack serve --mode development --port 8090"
  # https://localhost:8090/static/component-layout-app/, server localhost:8090
  ```

  Use `https://` (accept the self-signed certificate); the dev server speaks
  HTTPS and the external API always builds its iframe with `https://`.

See the mini app's README for details.
