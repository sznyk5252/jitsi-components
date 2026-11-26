/**
 * The id of the main meeting surface: components targeted at it render in the
 * meeting document.
 */
export const MAIN_SURFACE_ID = 'main';

/**
 * The ids of the UI components that can be moved to another surface. They are
 * the contract of the component layout API: an embedder targets a component by
 * one of these ids. Only components that render correctly outside of the
 * conference page belong here: the large video is intentionally absent because
 * the legacy video layout code looks its DOM node up in the main document.
 */
export const COMPONENT_IDS = {
    CALLEE_INFO: 'calleeInfo',
    CHAT: 'chat',
    CUSTOM_PANEL: 'customPanel',
    FILMSTRIP: 'filmstrip',
    LARGE_VIDEO: 'largeVideo',
    PARTICIPANTS_PANE: 'participantsPane',
    REACTIONS: 'reactions',
    SCREENSHARE_FILMSTRIP: 'screenshareFilmstrip',
    STAGE_FILMSTRIP: 'stageFilmstrip',
    TOOLBOX: 'toolbox'
};

/**
 * The component ids that can be moved to another surface. The large video is
 * visibility-only: the legacy video layout code looks its DOM node up in the
 * meeting document by id, so it cannot leave it.
 */
export const MOVABLE_COMPONENT_IDS = [
    COMPONENT_IDS.CALLEE_INFO,
    COMPONENT_IDS.CHAT,
    COMPONENT_IDS.CUSTOM_PANEL,
    COMPONENT_IDS.FILMSTRIP,
    COMPONENT_IDS.PARTICIPANTS_PANE,
    COMPONENT_IDS.REACTIONS,
    COMPONENT_IDS.SCREENSHARE_FILMSTRIP,
    COMPONENT_IDS.STAGE_FILMSTRIP,
    COMPONENT_IDS.TOOLBOX
];

/**
 * All the component ids accepted by the visibility API, as an array.
 */
export const VISIBLE_COMPONENT_IDS = Object.values(COMPONENT_IDS);

/**
 * The component ids accepted by the targeting API, as an array.
 */
export const SUPPORTED_COMPONENT_IDS = MOVABLE_COMPONENT_IDS;

/**
 * The prefix of the browser window names used for component surfaces. The same
 * id maps to the same window, so re-opening an id focuses the existing window
 * instead of creating a duplicate.
 */
export const COMPONENT_SURFACE_WINDOW_PREFIX = 'jitsiComponentSurface_';

/**
 * The meta marker of the shell page component surfaces load. Keep in sync with
 * {@code static/secondScreen.html}, which is reused as the shell.
 */
export const COMPONENT_SURFACE_MARKER = 'jitsi-second-screen';

/**
 * How long to wait for a component surface window to load its shell page before
 * giving up on it and closing it.
 */
export const COMPONENT_SURFACE_LOAD_TIMEOUT = 10000;

/**
 * How often the load wait re-checks whether the window was closed. A window
 * closed mid-load fires no {@code load} event, so without polling the wait
 * would only end on the timeout above.
 */
export const COMPONENT_SURFACE_LOAD_POLL_INTERVAL = 250;

/**
 * The default size of a component surface window, in CSS pixels.
 */
export const DEFAULT_SURFACE_WIDTH = 480;
export const DEFAULT_SURFACE_HEIGHT = 360;

/**
 * The Emotion cache key used for the styles injected into a component surface
 * window. Each surface gets its own cache whose container is that window's
 * {@code head}.
 */
export const COMPONENT_SURFACE_CACHE_KEY = 'componentsurface';
