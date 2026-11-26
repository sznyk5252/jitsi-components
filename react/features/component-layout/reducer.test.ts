import { Reducer } from 'redux';
import { describe, expect, it } from 'vitest';

import ReducerRegistry from '../base/redux/ReducerRegistry';

import {
    REMOVE_COMPONENT_SURFACE,
    RESET_COMPONENT_LAYOUT,
    SET_COMPONENT_SURFACE,
    SET_COMPONENT_TARGET,
    SET_COMPONENT_TARGETS,
    SET_COMPONENT_VISIBLE
} from './actionTypes';
import { IComponentLayoutState, getSelectorSurfaceId } from './reducer';

describe('Component layout reducer', () => {
    const reducer: Reducer<IComponentLayoutState>
        = ReducerRegistry._elements['features/component-layout'];

    it('is registered in ReducerRegistry', () => {
        expect(reducer).toBeDefined();
    });

    it('returns the default state for an unknown action', () => {
        const state = reducer(undefined, { type: 'UNKNOWN_ACTION' });

        expect(state).toEqual({
            hidden: {},
            surfaces: {},
            targets: {}
        });
    });

    it('creates a placeholder surface for a target set before the window opens', () => {
        const state = reducer(undefined, {
            type: SET_COMPONENT_TARGET,
            component: 'toolbar',
            target: 'side'
        });

        expect(state.targets).toEqual({ toolbar: 'side' });
        expect(state.surfaces.side).toBeDefined();
    });

    it('removes the target when a component is moved back to main', () => {
        const state = reducer({
            hidden: {},
            surfaces: { side: {} },
            targets: { toolbar: 'side' }
        }, {
            type: SET_COMPONENT_TARGET,
            component: 'toolbar',
            target: 'main'
        });

        expect(state.targets).toEqual({});
    });

    it('creates a selector surface and stores the selector', () => {
        const selector = '#my-toolbar';
        const state = reducer(undefined, {
            type: SET_COMPONENT_TARGET,
            component: 'toolbar',
            target: { selector }
        });

        expect(state.targets.toolbar).toBe(getSelectorSurfaceId(selector));
        expect(state.surfaces[getSelectorSurfaceId(selector)]).toEqual({ selector });
    });

    it('moves several components at once', () => {
        const state = reducer(undefined, {
            type: SET_COMPONENT_TARGETS,
            targets: {
                filmstrip: 'side',
                toolbar: 'side'
            }
        });

        expect(state.targets).toEqual({
            filmstrip: 'side',
            toolbar: 'side'
        });
    });

    it('drops the targets of a removed surface', () => {
        const state = reducer({
            hidden: {},
            surfaces: { side: {} },
            targets: {
                filmstrip: 'side',
                toolbar: 'side'
            }
        }, {
            type: REMOVE_COMPONENT_SURFACE,
            id: 'side'
        });

        expect(state.targets).toEqual({});
        expect(state.surfaces).toEqual({});
    });

    it('keeps the configuration of a surface when it is re-opened', () => {
        const state = reducer({
            hidden: {},
            surfaces: { side: { title: 'Side' } },
            targets: {}
        }, {
            type: SET_COMPONENT_SURFACE,
            id: 'side',
            options: { title: 'Side', viewport: true }
        });

        expect(state.surfaces.side).toEqual({
            title: 'Side',
            viewport: true
        });
    });

    it('hides and shows a component without touching its target', () => {
        const hiddenState = reducer({
            hidden: {},
            surfaces: { side: {} },
            targets: { toolbar: 'side' }
        }, {
            type: SET_COMPONENT_VISIBLE,
            component: 'toolbar',
            visible: false
        });

        expect(hiddenState.hidden).toEqual({ toolbar: true });
        expect(hiddenState.targets).toEqual({ toolbar: 'side' });

        const shownState = reducer(hiddenState, {
            type: SET_COMPONENT_VISIBLE,
            component: 'toolbar',
            visible: true
        });

        expect(shownState.hidden).toEqual({});
    });

    it('resets every surface and target', () => {
        const state = reducer({
            hidden: { largeVideo: true },
            surfaces: {
                side: {},
                [getSelectorSurfaceId('#x')]: { selector: '#x' }
            },
            targets: {
                filmstrip: 'side',
                toolbar: getSelectorSurfaceId('#x')
            }
        }, { type: RESET_COMPONENT_LAYOUT });

        expect(state).toEqual({
            hidden: {},
            surfaces: {},
            targets: {}
        });
    });
});
