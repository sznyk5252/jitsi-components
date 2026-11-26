import createCache, { EmotionCache } from '@emotion/cache';
import { throttle } from 'lodash-es';

import { IReduxState, IStore } from '../app/types';
import { getURLWithoutParams } from '../base/connection/utils';
import { clientResized } from '../base/responsive-ui/actions';
import { showToolbox } from '../toolbox/actions.web';

import { attachComponentSurfaceWindow, removeComponentSurface } from './actions';
import {
    COMPONENT_SURFACE_CACHE_KEY,
    COMPONENT_SURFACE_LOAD_POLL_INTERVAL,
    COMPONENT_SURFACE_LOAD_TIMEOUT,
    COMPONENT_SURFACE_MARKER,
    COMPONENT_SURFACE_WINDOW_PREFIX,
    DEFAULT_SURFACE_HEIGHT,
    DEFAULT_SURFACE_WIDTH
} from './constants';
import logger from './logger';
import { IComponentSurfaceHandle, IComponentSurfaceOptions } from './types';

/**
 * The base font stack of the app, mirroring the SCSS variable. The shell page
 * does not load the app's stylesheet by itself; the styles are mirrored before
 * the first component renders, but setting the base typography here keeps text
 * readable for the brief moment in between.
 */
const SURFACE_FONT_FAMILY
    = '-apple-system, BlinkMacSystemFont, open_sanslight, \'Helvetica Neue\', Helvetica, Arial, sans-serif';

/**
 * The ids whose windows are currently being opened, i.e. the calls that are
 * past the handle check but have not stored a handle yet. Prevents a second
 * request for the same id from re-navigating a window that is still loading.
 */
const opening = new Set<string>();

/**
 * Returns the live window handle of a surface, or {@code undefined} if it has
 * no window (not opened yet, a selector surface, or closed).
 *
 * @param {IReduxState} state - The redux state.
 * @param {string} id - The surface id.
 * @returns {IComponentSurfaceHandle | undefined}
 */
export function getSurfaceHandle(state: IReduxState, id: string): IComponentSurfaceHandle | undefined {
    return state['features/component-layout'].surfaces[id]?.handle as IComponentSurfaceHandle | undefined;
}

/**
 * Returns the live handles of all surfaces that currently have a window.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {Array<[string, IComponentSurfaceHandle]>}
 */
export function getAllSurfaceHandles(state: IReduxState): Array<[string, IComponentSurfaceHandle]> {
    const { surfaces } = state['features/component-layout'];

    return Object.keys(surfaces).reduce<Array<[string, IComponentSurfaceHandle]>>((acc, id) => {
        const handle = surfaces[id].handle as IComponentSurfaceHandle | undefined;

        if (handle) {
            acc.push([ id, handle ]);
        }

        return acc;
    }, []);
}

/**
 * Builds the URL of the static shell page a component surface window loads.
 * The shell is the same same-origin page the multi-screen feature uses, so it
 * carries a real referrer (which embeds rendered inside the window need) and
 * the marker that proves what was actually served.
 *
 * @param {IReduxState} state - The redux state.
 * @returns {string}
 */
function getSurfacePageUrl(state: IReduxState): string {
    const locationURL = state['features/base/connection'].locationURL;
    const href = locationURL
        ? getURLWithoutParams(locationURL).href
        : `${window.location.origin}${window.location.pathname}`;

    return `${href.substring(0, href.lastIndexOf('/'))}/static/secondScreen.html`;
}

/**
 * Copies the app's styles into a surface window and keeps them in sync.
 *
 * The popup loads a bare shell page, so without this the components portaled
 * into it would be unstyled: their global stylesheet, theme variables and the
 * classes the app puts on {@code <html>}/{@code <body>} (layout, mobile, dark
 * mode) all live in the meeting document. Emotion styles are not relied on
 * here; portaled components get their own Emotion cache (see
 * {@link buildSurfaceDocument}). Stylesheet links are re-created with absolute
 * URLs so relative {@code url()} references and fonts resolve as they do in the
 * meeting document.
 *
 * @param {Document} targetDoc - The surface document.
 * @returns {Function} Disconnects the observers.
 */
function mirrorDocumentStyles(targetDoc: Document): () => void {
    const sourceDoc = document;
    const mirrored = new Map<Element, Element>();

    const copyCustomProperties = () => {
        const computed = window.getComputedStyle(sourceDoc.documentElement);

        for (let i = 0; i < computed.length; i++) {
            const property = computed.item(i);

            if (property.startsWith('--')) {
                targetDoc.documentElement.style.setProperty(property, computed.getPropertyValue(property));
            }
        }
    };

    const syncRootClasses = () => {
        targetDoc.documentElement.className = sourceDoc.documentElement.className;
        targetDoc.body.className = sourceDoc.body.className;
        copyCustomProperties();
    };

    const isMirrored = (element: Element): boolean => {
        const tag = element.tagName;

        return tag === 'STYLE' || (tag === 'LINK' && (element as HTMLLinkElement).rel === 'stylesheet');
    };

    const createMirror = (source: Element): Element | undefined => {
        if (!isMirrored(source)) {
            return undefined;
        }

        let target: Element;

        if (source.tagName === 'STYLE') {
            const style = targetDoc.createElement('style');

            style.textContent = source.textContent ?? '';
            target = style;
        } else {
            const link = targetDoc.createElement('link');

            link.rel = 'stylesheet';

            // The live href is absolute, which is what makes the popup resolve
            // the stylesheet (and everything it references) against the app.
            link.href = (source as HTMLLinkElement).href;
            target = link;
        }

        target.setAttribute('data-mirrored-style', '1');
        targetDoc.head.appendChild(target);
        mirrored.set(source, target);

        return target;
    };

    const syncMirror = (source: Element) => {
        const target = mirrored.get(source);

        if (!target) {
            createMirror(source);

            return;
        }

        if (source.tagName === 'STYLE') {
            const text = source.textContent ?? '';

            if (target.textContent !== text) {
                target.textContent = text;
            }
        } else {
            const href = (source as HTMLLinkElement).href;

            if ((target as HTMLLinkElement).href !== href) {
                (target as HTMLLinkElement).href = href;
            }
        }
    };

    const removeMirror = (source: Element) => {
        mirrored.get(source)?.remove();
        mirrored.delete(source);
    };

    Array.from(sourceDoc.head.children).forEach(createMirror);
    syncRootClasses();

    const headObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node instanceof Element) {
                        createMirror(node);
                    }
                });
                mutation.removedNodes.forEach(node => {
                    if (node instanceof Element) {
                        removeMirror(node);
                    }
                });
            } else if (mutation.type === 'characterData') {
                const parent = mutation.target.parentElement;

                if (parent) {
                    syncMirror(parent);
                }
            } else if (mutation.type === 'attributes') {
                syncMirror(mutation.target as Element);
            }
        });
    });

    headObserver.observe(sourceDoc.head, {
        attributes: true,
        attributeFilter: [ 'href' ],
        characterData: true,
        childList: true,
        subtree: true
    });

    const rootObserver = new MutationObserver(syncRootClasses);

    rootObserver.observe(sourceDoc.documentElement, {
        attributes: true,
        attributeFilter: [ 'class' ]
    });
    rootObserver.observe(sourceDoc.body, {
        attributes: true,
        attributeFilter: [ 'class' ]
    });

    return () => {
        headObserver.disconnect();
        rootObserver.disconnect();
        mirrored.forEach(target => target.remove());
        mirrored.clear();
    };
}

/**
 * Builds the surface document: the root the components are portaled into, the
 * per-window Emotion cache, and the style mirroring.
 *
 * The root carries the {@code videoconference_page} id and the app's layout
 * class on purpose: the components' global CSS positions them against those
 * (the toolbar is absolute at the bottom of the page, the filmstrip is fixed
 * to the viewport), so a surface window lays them out exactly like a very
 * small meeting window.
 *
 * @param {Window} win - The surface window.
 * @param {string} title - The window title.
 * @returns {IComponentSurfaceHandle}
 */
function buildSurfaceDocument(win: Window, title = 'Jitsi Meet'): IComponentSurfaceHandle {
    const doc = win.document;

    // Re-attaching to a persistent iframe reuses its document; drop whatever a
    // previous attachment left behind so ids and styles are not duplicated.
    doc.querySelectorAll('[data-component-surface-root]').forEach(element => element.remove());
    doc.querySelectorAll('[data-mirrored-style]').forEach(element => element.remove());

    doc.title = title;
    doc.documentElement.lang = document.documentElement.lang;
    Object.assign(doc.documentElement.style, { height: '100%' });
    Object.assign(doc.body.style, {
        margin: '0',
        height: '100%',
        background: '#000',
        color: '#fff',
        fontFamily: SURFACE_FONT_FAMILY,
        overflow: 'hidden'
    });

    const root = doc.createElement('div');

    root.id = 'videoconference_page';
    root.setAttribute('data-component-surface-root', '1');
    root.classList.add('component-surface');
    Object.assign(root.style, {
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden'
    });
    doc.body.appendChild(root);

    const cache: EmotionCache = createCache({
        container: doc.head,
        key: COMPONENT_SURFACE_CACHE_KEY
    });

    return {
        cache,
        root,
        win,
        disconnect: mirrorDocumentStyles(doc)
    };
}

/**
 * Computes the {@code window.open} features string for a surface.
 *
 * @param {IComponentSurfaceOptions} options - The window options.
 * @returns {string}
 */
function computeFeatures(options: IComponentSurfaceOptions = {}): string {
    const width = Math.max(160, Math.round(options.width ?? DEFAULT_SURFACE_WIDTH));
    const height = Math.max(120, Math.round(options.height ?? DEFAULT_SURFACE_HEIGHT));
    const left = Math.round(options.left ?? Math.max(0, (window.screen.availWidth - width) / 2));
    const top = Math.round(options.top ?? Math.max(0, (window.screen.availHeight - height) / 2));

    return `popup,width=${width},height=${height},left=${left},top=${top}`;
}

/**
 * Waits for a freshly opened surface window to load its shell page, so the
 * handle is built on the real document and not wiped by the navigation.
 *
 * Resolves with how the wait ended. A window closed mid-load, or a navigation
 * that stalls, fires no {@code load} at all, so the wait is bounded by a poll
 * for {@code win.closed} and a timeout.
 *
 * @param {Window} win - The opened window.
 * @returns {Promise<'loaded' | 'closed' | 'timeout' | 'wrong-page'>}
 */
function awaitSurfaceLoad(win: Window): Promise<'loaded' | 'closed' | 'timeout' | 'wrong-page'> {
    return new Promise(resolve => {
        let poll = 0;
        let timeout = 0;
        let settled = false;

        const finish = (result: 'loaded' | 'closed' | 'timeout' | 'wrong-page') => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearInterval(poll);
            window.clearTimeout(timeout);
            resolve(result);
        };

        win.addEventListener('load', () => {
            let hasMarker = false;

            try {
                hasMarker = Boolean(win.document.querySelector(`meta[name="${COMPONENT_SURFACE_MARKER}"]`));
            } catch (_e) {
                hasMarker = false;
            }

            finish(hasMarker ? 'loaded' : 'wrong-page');
        }, { once: true });

        poll = window.setInterval(() => {
            if (win.closed) {
                finish('closed');
            }
        }, COMPONENT_SURFACE_LOAD_POLL_INTERVAL);
        timeout = window.setTimeout(() => finish('timeout'), COMPONENT_SURFACE_LOAD_TIMEOUT);
    });
}

/**
 * Notifies the embedder that a surface window could not be opened.
 *
 * @param {IStore} store - The redux store.
 * @param {string} id - The surface id.
 * @param {string} error - A machine-readable error code.
 * @param {Window} win - The window to close, if one was opened.
 * @returns {void}
 */
function failSurfaceOpen(store: IStore, id: string, error: string, win?: Window | null) {
    if (win && !win.closed) {
        win.close();
    }

    APP.API?.notifyComponentSurfaceError?.({ id, error });
    store.dispatch(removeComponentSurface(id));
}

/**
 * Returns the document of the page that embeds the meeting. When the meeting is
 * not embedded this is the meeting document itself. Accessing a cross-origin
 * parent throws, which is reported as such.
 *
 * @returns {Document | undefined}
 */
function getEmbedderDocument(): Document | undefined {
    try {
        return window.parent && window.parent !== window ? window.parent.document : document;
    } catch (_e) {
        return undefined;
    }
}

/**
 * Resolves an embedder-provided iframe surface.
 *
 * @param {string} selector - The CSS selector of the iframe in the embedder page.
 * @returns {{ iframe: HTMLIFrameElement } | { error: string }}
 */
function resolveEmbeddedSurface(selector: string): { iframe: HTMLIFrameElement; } | { error: string; } {
    const doc = getEmbedderDocument();

    if (!doc) {
        return { error: 'embedder-cross-origin' };
    }

    let element: Element | null = null;

    try {
        element = doc.querySelector(selector);
    } catch (_e) {
        return { error: 'surface-not-found' };
    }

    if (!element) {
        return { error: 'surface-not-found' };
    }

    if (element.tagName !== 'IFRAME') {
        return { error: 'surface-not-an-iframe' };
    }

    return { iframe: element as HTMLIFrameElement };
}

/**
 * Waits for an embedder iframe to have a usable, same-origin document.
 *
 * @param {HTMLIFrameElement} iframe - The surface iframe.
 * @returns {Promise<boolean>}
 */
function waitForIframeDocument(iframe: HTMLIFrameElement): Promise<boolean> {
    return new Promise(resolve => {
        let poll = 0;
        let timeout = 0;
        let settled = false;

        const isReady = () => {
            try {
                return Boolean(iframe.contentDocument?.body) && iframe.contentDocument?.readyState === 'complete';
            } catch (_e) {
                return false;
            }
        };

        const finish = (ready: boolean) => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearInterval(poll);
            window.clearTimeout(timeout);
            iframe.removeEventListener('load', handleLoad);
            resolve(ready);
        };

        function handleLoad() {
            if (isReady()) {
                finish(true);
            }
        }

        if (isReady()) {
            finish(true);

            return;
        }

        iframe.addEventListener('load', handleLoad);
        poll = window.setInterval(() => {
            if (isReady()) {
                finish(true);
            }
        }, COMPONENT_SURFACE_LOAD_POLL_INTERVAL);
        timeout = window.setTimeout(() => finish(false), COMPONENT_SURFACE_LOAD_TIMEOUT);
    });
}

/**
 * Attaches a surface to an iframe of the embedding page, so its components are
 * rendered inline, in the embedder's own layout, instead of in a popup. This
 * only works when the embedding page shares the meeting's origin.
 *
 * @param {IStore} store - The redux store.
 * @param {string} id - The surface id.
 * @param {string} selector - The CSS selector of the iframe in the embedder page.
 * @param {IComponentSurfaceOptions} options - The surface options.
 * @returns {Promise<void>}
 */
export async function attachComponentSurfaceIframe(
        store: IStore,
        id: string,
        selector: string,
        options: IComponentSurfaceOptions = {}): Promise<void> {
    if (opening.has(id)) {
        return;
    }

    opening.add(id);

    try {
        const resolved = resolveEmbeddedSurface(selector);

        if ('error' in resolved) {
            logger.warn(`Could not resolve component surface "${id}": ${resolved.error}`);
            failSurfaceOpen(store, id, resolved.error);

            return;
        }

        const { iframe } = resolved;

        if (!await waitForIframeDocument(iframe)) {
            logger.warn(`Component surface iframe "${id}" never became available`);
            failSurfaceOpen(store, id, 'surface-not-ready');

            return;
        }

        if (!store.getState()['features/component-layout'].surfaces[id]) {
            return;
        }

        const win = iframe.contentWindow;

        if (!win?.document?.body) {
            failSurfaceOpen(store, id, 'surface-not-ready');

            return;
        }

        let handle: IComponentSurfaceHandle;

        try {
            handle = buildSurfaceDocument(win, options.title);
        } catch (e) {
            logger.warn(`Could not build the component surface document for "${id}"`, e);
            failSurfaceOpen(store, id, 'window-setup-failed');

            return;
        }

        handle.embedded = true;
        handle.iframe = iframe;

        const onMouseMove = throttle(() => store.dispatch(showToolbox()), 100, {
            leading: true,
            trailing: false
        });

        win.document.addEventListener('mousemove', onMouseMove);

        let resizeObserver: ResizeObserver | undefined;

        if (options.viewport) {
            handle.viewport = true;

            const onResize = () => store.dispatch(clientResized(iframe.clientWidth, iframe.clientHeight));

            resizeObserver = new window.ResizeObserver(onResize);
            resizeObserver.observe(iframe);
            onResize();
        }

        // The embedder owns the iframe: when it removes it (route change, panel
        // unmount) the surface is gone too, and the components go back home.
        const removalObserver = new window.MutationObserver(() => {
            if (!iframe.isConnected) {
                store.dispatch(removeComponentSurface(id));
            }
        });

        removalObserver.observe(iframe.ownerDocument.documentElement, { childList: true, subtree: true });

        const disconnectHandle = handle.disconnect;

        handle.disconnect = () => {
            win.document.removeEventListener('mousemove', onMouseMove);
            resizeObserver?.disconnect();
            removalObserver.disconnect();
            disconnectHandle();
            handle.root.remove();
        };

        store.dispatch(attachComponentSurfaceWindow(id, handle));
        APP.API?.notifyComponentSurfaceOpened?.({ id });
    } finally {
        opening.delete(id);
    }
}

/**
 * Opens a surface window (or focuses it, if it is already open) and attaches
 * its live handle to the surface once it has loaded.
 *
 * @param {IStore} store - The redux store.
 * @param {string} id - The surface id.
 * @param {IComponentSurfaceOptions} options - The window options.
 * @returns {Promise<void>}
 */
export async function openComponentSurfaceWindow(
        store: IStore,
        id: string,
        options: IComponentSurfaceOptions = {}): Promise<void> {
    const existing = getSurfaceHandle(store.getState(), id);

    if (existing && !existing.win.closed) {
        existing.win.focus();

        return;
    }

    if (opening.has(id)) {
        return;
    }

    opening.add(id);

    try {
        const url = getSurfacePageUrl(store.getState());
        const win = window.open(url, `${COMPONENT_SURFACE_WINDOW_PREFIX}${id}`, computeFeatures(options));

        if (!win) {
            logger.warn(`Failed to open component surface "${id}" (popup blocked?)`);
            failSurfaceOpen(store, id, 'popup-blocked');

            return;
        }

        const result = win.closed ? 'closed' : await awaitSurfaceLoad(win);

        if (result === 'closed' || win.closed) {
            logger.debug(`Component surface "${id}" was closed while loading`);
            store.dispatch(removeComponentSurface(id));
            APP.API?.notifyComponentSurfaceClosed?.({ id });

            return;
        }

        if (result !== 'loaded') {
            logger.warn(`Component surface "${id}" did not load the shell page (${result})`);
            failSurfaceOpen(store, id, result === 'timeout' ? 'window-load-timeout' : 'window-load-failed', win);

            return;
        }

        if (!store.getState()['features/component-layout'].surfaces[id]) {
            win.close();

            return;
        }

        let handle: IComponentSurfaceHandle;

        try {
            handle = buildSurfaceDocument(win, options.title);
        } catch (e) {
            logger.warn(`Could not build the component surface document for "${id}"`, e);
            failSurfaceOpen(store, id, 'window-setup-failed', win);

            return;
        }

        if (options.viewport) {
            handle.viewport = true;

            const onResize = () => store.dispatch(clientResized(win.innerWidth, win.innerHeight));
            const disconnectStyles = handle.disconnect;

            win.addEventListener('resize', onResize);
            handle.disconnect = () => {
                win.removeEventListener('resize', onResize);
                disconnectStyles();
            };
            onResize();
        }

        // The toolbox hides itself when the pointer stops moving in the meeting
        // window. A pointer moving in the toolbar's own window has to count as
        // activity too, otherwise a detached toolbar fades away as soon as the
        // user reaches for it.
        const onMouseMove = throttle(() => store.dispatch(showToolbox()), 100, {
            leading: true,
            trailing: false
        });

        win.addEventListener('mousemove', onMouseMove);
        const disconnectHandle = handle.disconnect;

        handle.disconnect = () => {
            win.removeEventListener('mousemove', onMouseMove);
            disconnectHandle();
        };

        store.dispatch(attachComponentSurfaceWindow(id, handle));
        win.addEventListener('pagehide', () => store.dispatch(removeComponentSurface(id)), { once: true });
        APP.API?.notifyComponentSurfaceOpened?.({ id });
    } finally {
        opening.delete(id);
    }
}

/**
 * Closes a surface window from an already-captured handle. The caller removes
 * the redux entry first, so the portal unmounts while the window is still open.
 *
 * @param {IStore} store - The redux store.
 * @param {IComponentSurfaceHandle | undefined} handle - The captured handle.
 * @param {string} id - The surface id.
 * @returns {void}
 */
export function closeComponentSurfaceHandle(
        store: IStore,
        handle: IComponentSurfaceHandle | undefined,
        id: string) {
    if (!handle) {
        return;
    }

    handle.disconnect();

    if (!handle.embedded && !handle.win.closed) {
        handle.win.close();
    }

    if (handle.viewport) {
        store.dispatch(clientResized(window.innerWidth, window.innerHeight));
    }

    APP.API?.notifyComponentSurfaceClosed?.({ id });
}

/**
 * Closes every surface window.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
export function closeAllComponentSurfaces(store: IStore) {
    getAllSurfaceHandles(store.getState()).forEach(([ id, handle ]) => {
        closeComponentSurfaceHandle(store, handle, id);
    });
}
