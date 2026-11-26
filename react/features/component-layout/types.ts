import { EmotionCache } from '@emotion/cache';

/**
 * Where a UI component should be rendered.
 *
 * - {@code 'main'} (or an absent target) renders it in place, in the meeting
 *   document.
 * - any other string is the id of a component surface, opened through the
 *   {@code openComponentSurface} API command.
 * - an object with a {@code selector} renders it into the first element
 *   matching that selector in the meeting document. This only works when the
 *   meeting is not embedded in a cross-origin iframe.
 */
export type IComponentTarget = string | { selector: string; };

/**
 * Options accepted by the {@code openComponentSurface} API command.
 */
export interface IComponentSurfaceOptions {

    /**
     * The height of the window, in CSS pixels.
     */
    height?: number;

    /**
     * A CSS selector of a same-origin {@code <iframe>} in the page that embeds
     * the meeting. When set, no window is opened: the components are portaled
     * into that iframe's document instead, so the embedder can place each
     * surface in its own layout, next to the meeting. Requires the embedding
     * page to share the meeting's origin.
     */
    iframe?: string;

    /**
     * The left position of the window, in CSS pixels.
     */
    left?: number;

    /**
     * The title of the window.
     */
    title?: string;

    /**
     * The top position of the window, in CSS pixels.
     */
    top?: number;

    /**
     * Whether the size of this window should drive the app's responsive layout
     * metrics while it is open. Use this when the surface hosts the filmstrip,
     * so the thumbnails are sized for that window rather than for the meeting
     * window. Only one surface should have it, and closing it restores the
     * metrics of the meeting window.
     */
    viewport?: boolean;

    /**
     * The width of the window, in CSS pixels.
     */
    width?: number;
}

/**
 * The live, non-serializable handle of a component surface window. As with the
 * multi-screen feature, state holds it opaquely ({@code unknown}) because the
 * shared/native build has no DOM lib; it is cast back to
 * {@link IComponentSurfaceHandle} where it is used.
 */
export interface IComponentSurfaceHandle {

    /**
     * The per-window Emotion cache, whose container is the window's head.
     */
    cache: EmotionCache;

    /**
     * Tears down the observers that mirror styles into the window and the
     * viewport listener, if any.
     */
    disconnect: () => void;

    /**
     * Whether the surface lives in an iframe of the embedder page instead of a
     * popup window. Such a surface must not be closed with {@code win.close()}.
     */
    embedded?: boolean;

    /**
     * The embedder iframe this surface renders into, when {@code embedded}.
     */
    iframe?: HTMLIFrameElement;

    /**
     * The element the window's components are portaled into.
     */
    root: HTMLElement;

    /**
     * Whether this window drives the responsive layout metrics while open.
     */
    viewport?: boolean;

    /**
     * The window itself.
     */
    win: Window;
}

/**
 * A component surface: a target an embedder can move components to.
 */
export interface IComponentSurface {

    /**
     * The live window handle. Absent while the window is being opened and for
     * selector targets, which live in the meeting document.
     */
    handle?: unknown;

    /**
     * A CSS selector in the meeting document. When set, this surface renders
     * into the matching element instead of into a window.
     */
    selector?: string;

    /**
     * The title to give the window.
     */
    title?: string;

    /**
     * Whether this surface drives the responsive layout metrics while open.
     */
    viewport?: boolean;
}
