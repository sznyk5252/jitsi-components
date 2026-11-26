import { IStore } from '../app/types';
import { APP_WILL_MOUNT } from '../base/app/actionTypes';
import { CONFERENCE_FAILED, CONFERENCE_LEFT } from '../base/conference/actionTypes';
import MiddlewareRegistry from '../base/redux/MiddlewareRegistry';

import {
    CLOSE_COMPONENT_SURFACE,
    OPEN_COMPONENT_SURFACE,
    REMOVE_COMPONENT_SURFACE,
    RESET_COMPONENT_LAYOUT,
    SET_COMPONENT_TARGET,
    SET_COMPONENT_TARGETS,
    SET_COMPONENT_VISIBLE
} from './actionTypes';
import {
    closeComponentSurface,
    openComponentSurface,
    removeComponentSurface,
    resetComponentLayout,
    setComponentSurface,
    setComponentTarget,
    setComponentTargets,
    setComponentVisible
} from './actions';
import { MOVABLE_COMPONENT_IDS, VISIBLE_COMPONENT_IDS } from './constants';
import {
    attachComponentSurfaceIframe,
    closeComponentSurfaceHandle,
    getAllSurfaceHandles,
    getSurfaceHandle,
    openComponentSurfaceWindow
} from './functions.web';
import logger from './logger';
import { IComponentSurfaceOptions, IComponentTarget } from './types';

/**
 * Rejects an unknown component id and tells the embedder. A typo would
 * otherwise be a silent no-op, with the component staying where it was.
 *
 * @param {IStore} store - The redux store.
 * @param {string} component - The component id.
 * @returns {boolean} Whether the id is supported.
 */
function validateComponent(store: IStore, component: string): boolean {
    if (MOVABLE_COMPONENT_IDS.includes(component)) {
        return true;
    }

    const error = VISIBLE_COMPONENT_IDS.includes(component) ? 'component-not-movable' : 'unknown-component';

    logger.warn(`Rejected component id "${component}" (${error})`);
    APP.API?.notifyComponentSurfaceError?.({
        component,
        error,
        id: component
    });

    return false;
}

/**
 * Rejects an unknown component id in a visibility request.
 *
 * @param {IStore} store - The redux store.
 * @param {string} component - The component id.
 * @returns {boolean} Whether the id is supported.
 */
function validateVisibleComponent(store: IStore, component: string): boolean {
    if (VISIBLE_COMPONENT_IDS.includes(component)) {
        return true;
    }

    logger.warn(`Unknown component id "${component}"`);
    APP.API?.notifyComponentSurfaceError?.({
        component,
        error: 'unknown-component',
        id: component
    });

    return false;
}

/**
 * Validates every component id in a target map.
 *
 * @param {IStore} store - The redux store.
 * @param {Object} targets - The map of component id to target.
 * @returns {Object} The map with the unknown component ids removed.
 */
function validateTargets(
        store: IStore,
        targets: { [component: string]: IComponentTarget | null; } = {}) {
    return Object.keys(targets).reduce<{ [component: string]: IComponentTarget | null; }>((acc, component) => {
        if (validateComponent(store, component)) {
            acc[component] = targets[component];
        }

        return acc;
    }, {});
}

/**
 * Exposes the feature to the page the meeting is served from, for deployments
 * that are not embedded and therefore have no iframe API to talk to. The
 * external API commands remain the supported embedder interface; this is the
 * same set of operations for the browser console and for wrapper pages that
 * inject their own script into the meeting document.
 *
 * @param {IStore} store - The redux store.
 * @returns {void}
 */
function installConsoleApi(store: IStore) {
    Object.assign(APP, {
        componentLayout: {
            closeSurface: (id: string) => store.dispatch(closeComponentSurface(id)),
            openSurface: (id: string, options?: IComponentSurfaceOptions) =>
                store.dispatch(openComponentSurface(id, options)),
            reset: () => store.dispatch(resetComponentLayout()),
            setTarget: (component: string, target?: IComponentTarget | null) =>
                store.dispatch(setComponentTarget(component, target)),
            setTargets: (targets: { [component: string]: IComponentTarget | null; }) =>
                store.dispatch(setComponentTargets(targets)),
            setVisible: (component: string, visible: boolean) =>
                store.dispatch(setComponentVisible(component, visible))
        }
    });
}

/**
 * Middleware that reconciles the live component surface windows with the
 * requested layout and tears them down when the meeting ends.
 *
 * @param {IStore} store - The redux store.
 * @returns {Function}
 */
MiddlewareRegistry.register((store: IStore) => {

    // Close every surface when the meeting window itself goes away. The
    // conference lifecycle below only covers leaving from within the app;
    // closing the tab directly dispatches neither event.
    window.addEventListener('pagehide', (event: PageTransitionEvent) => {
        if (!event.persisted) {
            getAllSurfaceHandles(store.getState())
                .forEach(([ id, handle ]) => closeComponentSurfaceHandle(store, handle, id));
        }
    });

    return next => action => {
        switch (action.type) {
        case OPEN_COMPONENT_SURFACE: {
            const result = next(action);

            store.dispatch(setComponentSurface(action.id, action.options));

            const open = action.options?.iframe
                ? attachComponentSurfaceIframe(store, action.id, action.options.iframe, action.options)
                : openComponentSurfaceWindow(store, action.id, action.options);

            open.catch(e => logger.error(`Could not open component surface "${action.id}"`, e));

            return result;
        }
        case CLOSE_COMPONENT_SURFACE: {
            const result = next(action);

            // The REMOVE handler below captures the handle, unmounts the portal
            // and closes the window, so closing here too would report it twice.
            store.dispatch(removeComponentSurface(action.id));

            return result;
        }
        case REMOVE_COMPONENT_SURFACE: {

            // The window may have been closed by the user already, in which case
            // the handle is spent; closing is idempotent.
            const handle = getSurfaceHandle(store.getState(), action.id);
            const result = next(action);

            closeComponentSurfaceHandle(store, handle, action.id);

            return result;
        }
        case RESET_COMPONENT_LAYOUT: {
            const handles = getAllSurfaceHandles(store.getState());
            const result = next(action);

            handles.forEach(([ id, handle ]) => closeComponentSurfaceHandle(store, handle, id));

            return result;
        }
        case SET_COMPONENT_TARGET:
            validateComponent(store, action.component);

            return next(action);
        case SET_COMPONENT_TARGETS:
            return next({ ...action, targets: validateTargets(store, action.targets) });
        case SET_COMPONENT_VISIBLE:
            validateVisibleComponent(store, action.component);

            return next(action);
        case APP_WILL_MOUNT:
            installConsoleApi(store);
            break;
        case CONFERENCE_FAILED:
        case CONFERENCE_LEFT:
            store.dispatch(resetComponentLayout());
            break;
        }

        return next(action);
    };
});
