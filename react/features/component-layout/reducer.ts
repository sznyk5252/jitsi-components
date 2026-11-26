import ReducerRegistry from '../base/redux/ReducerRegistry';

import {
    ATTACH_COMPONENT_SURFACE_WINDOW,
    REMOVE_COMPONENT_SURFACE,
    RESET_COMPONENT_LAYOUT,
    SET_COMPONENT_SURFACE,
    SET_COMPONENT_TARGET,
    SET_COMPONENT_TARGETS,
    SET_COMPONENT_VISIBLE
} from './actionTypes';
import { MAIN_SURFACE_ID } from './constants';
import { IComponentSurface, IComponentTarget } from './types';

/**
 * The prefix of the ids of the surfaces that render into a selector in the
 * meeting document.
 */
const SELECTOR_SURFACE_PREFIX = 'selector:';

export interface IComponentLayoutState {

    /**
     * The components that are hidden. Only hidden components are listed; an
     * absent key means the component is visible.
     */
    hidden: { [component: string]: boolean; };

    /**
     * The open or configured surfaces, keyed by surface id. A surface with a
     * {@code selector} renders into the meeting document; the others are
     * windows, whose live handle is attached once they load.
     */
    surfaces: { [id: string]: IComponentSurface; };

    /**
     * The target surface id of every moved component. A component that is not
     * present here renders in place, in the meeting document.
     */
    targets: { [component: string]: string; };
}

const DEFAULT_STATE: IComponentLayoutState = {
    hidden: {},
    surfaces: {},
    targets: {}
};

/**
 * Returns the id of the synthetic surface used for a selector target.
 *
 * @param {string} selector - The CSS selector.
 * @returns {string}
 */
export function getSelectorSurfaceId(selector: string): string {
    return `${SELECTOR_SURFACE_PREFIX}${selector}`;
}

/**
 * Applies a single component target to a state draft.
 *
 * @param {IComponentLayoutState} state - The current state.
 * @param {string} component - The component id.
 * @param {IComponentTarget} target - Where to move it.
 * @returns {IComponentLayoutState}
 */
function applyTarget(
        state: IComponentLayoutState,
        component: string,
        target?: IComponentTarget | null): IComponentLayoutState {
    const targets = { ...state.targets };

    if (!target || target === MAIN_SURFACE_ID) {
        delete targets[component];

        return { ...state, targets };
    }

    if (typeof target === 'string') {
        targets[component] = target;

        return {
            ...state,
            surfaces: {
                ...state.surfaces,
                [target]: state.surfaces[target] ?? {}
            },
            targets
        };
    }

    const { selector } = target;

    if (!selector) {
        delete targets[component];

        return { ...state, targets };
    }

    const id = getSelectorSurfaceId(selector);

    targets[component] = id;

    return {
        ...state,
        surfaces: {
            ...state.surfaces,
            [id]: { ...state.surfaces[id], selector }
        },
        targets
    };
}

ReducerRegistry.register<IComponentLayoutState>('features/component-layout',
(state = DEFAULT_STATE, action): IComponentLayoutState => {
    switch (action.type) {
    case SET_COMPONENT_SURFACE: {
        const { id, options } = action;

        return {
            ...state,
            surfaces: {
                ...state.surfaces,
                [id]: {
                    ...state.surfaces[id],
                    title: options?.title ?? state.surfaces[id]?.title,
                    viewport: Boolean(options?.viewport)
                }
            }
        };
    }
    case ATTACH_COMPONENT_SURFACE_WINDOW:
        return {
            ...state,
            surfaces: {
                ...state.surfaces,
                [action.id]: { ...state.surfaces[action.id], handle: action.handle }
            }
        };
    case REMOVE_COMPONENT_SURFACE: {
        const surfaces = { ...state.surfaces };
        const targets = { ...state.targets };

        delete surfaces[action.id];
        Object.keys(targets).forEach(component => {
            if (targets[component] === action.id) {
                delete targets[component];
            }
        });

        return { ...state, surfaces, targets };
    }
    case SET_COMPONENT_TARGET:
        return applyTarget(state, action.component, action.target);
    case SET_COMPONENT_TARGETS:
        return Object.keys(action.targets ?? {}).reduce(
            (acc, component) => applyTarget(acc, component, action.targets[component]),
            state);
    case SET_COMPONENT_VISIBLE: {
        const hidden = { ...state.hidden };

        if (action.visible) {
            delete hidden[action.component];
        } else {
            hidden[action.component] = true;
        }

        return { ...state, hidden };
    }
    case RESET_COMPONENT_LAYOUT:
        return {
            hidden: {},
            surfaces: {},
            targets: {}
        };
    }

    return state;
});
