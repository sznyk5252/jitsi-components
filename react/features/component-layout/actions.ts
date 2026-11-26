import {
    ATTACH_COMPONENT_SURFACE_WINDOW,
    CLOSE_COMPONENT_SURFACE,
    OPEN_COMPONENT_SURFACE,
    REMOVE_COMPONENT_SURFACE,
    RESET_COMPONENT_LAYOUT,
    SET_COMPONENT_SURFACE,
    SET_COMPONENT_TARGET,
    SET_COMPONENT_TARGETS,
    SET_COMPONENT_VISIBLE
} from './actionTypes';
import { IComponentSurfaceOptions, IComponentTarget } from './types';

/**
 * Opens (or focuses) the component surface window identified by {@code id}.
 * Components are not moved into it until {@code setComponentTarget} points at
 * that id, so a surface can be opened ahead of time.
 *
 * Windows can only be opened from a user gesture; when the browser blocks the
 * popup the embedder receives a {@code componentSurfaceError} event.
 *
 * @param {string} id - The surface id.
 * @param {IComponentSurfaceOptions} options - The window options.
 * @returns {Object}
 */
export function openComponentSurface(id: string, options?: IComponentSurfaceOptions) {
    return {
        type: OPEN_COMPONENT_SURFACE,
        id,
        options
    };
}

/**
 * Closes the component surface window identified by {@code id}. Components
 * targeted at it move back to the meeting document.
 *
 * @param {string} id - The surface id.
 * @returns {Object}
 */
export function closeComponentSurface(id: string) {
    return {
        type: CLOSE_COMPONENT_SURFACE,
        id
    };
}

/**
 * Stores a surface's configuration. Dispatched by the middleware before the
 * window is opened, so the title and viewport settings are known even if the
 * open fails.
 *
 * @param {string} id - The surface id.
 * @param {IComponentSurfaceOptions} options - The surface options.
 * @returns {Object}
 */
export function setComponentSurface(id: string, options?: IComponentSurfaceOptions) {
    return {
        type: SET_COMPONENT_SURFACE,
        id,
        options
    };
}

/**
 * Attaches the live window handle to a surface once its window has loaded.
 *
 * @param {string} id - The surface id.
 * @param {unknown} handle - The live window handle.
 * @returns {Object}
 */
export function attachComponentSurfaceWindow(id: string, handle: unknown) {
    return {
        type: ATTACH_COMPONENT_SURFACE_WINDOW,
        id,
        handle
    };
}

/**
 * Removes a surface and every target pointing to it. Used when the user closes
 * the window directly; the middleware's close path removes it after closing.
 *
 * @param {string} id - The surface id.
 * @returns {Object}
 */
export function removeComponentSurface(id: string) {
    return {
        type: REMOVE_COMPONENT_SURFACE,
        id
    };
}

/**
 * Moves one component to a target. Pass {@code null} (or {@code 'main'}) to
 * render it in place in the meeting document again.
 *
 * @param {string} component - The component id, see {@code COMPONENT_IDS}.
 * @param {IComponentTarget | null} target - The target surface id, or a
 * {@code { selector }} object.
 * @returns {Object}
 */
export function setComponentTarget(component: string, target?: IComponentTarget | null) {
    return {
        type: SET_COMPONENT_TARGET,
        component,
        target
    };
}

/**
 * Shows or hides one component without moving it. The component stays mounted,
 * so hiding the large video does not break the legacy layout code and hiding
 * the filmstrip does not reset its scroll position.
 *
 * @param {string} component - The component id, see {@code COMPONENT_IDS}.
 * @param {boolean} visible - Whether the component should be displayed.
 * @returns {Object}
 */
export function setComponentVisible(component: string, visible: boolean) {
    return {
        type: SET_COMPONENT_VISIBLE,
        component,
        visible
    };
}

/**
 * Moves several components at once.
 *
 * @param {Object} targets - A map of component id to target.
 * @returns {Object}
 */
export function setComponentTargets(targets: { [component: string]: IComponentTarget | null; }) {
    return {
        type: SET_COMPONENT_TARGETS,
        targets
    };
}

/**
 * Moves every component back to the meeting document, shows everything and
 * closes every surface window.
 *
 * @returns {Object}
 */
export function resetComponentLayout() {
    return {
        type: RESET_COMPONENT_LAYOUT
    };
}
