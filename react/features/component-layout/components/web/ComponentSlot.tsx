import { CacheProvider } from '@emotion/react';
import React, { ReactNode, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { LAYOUT_CLASSNAMES } from '../../../video-layout/constants';
import { getCurrentLayout } from '../../../video-layout/functions.any';
import { COMPONENT_IDS } from '../../constants';
import { IComponentSurfaceHandle } from '../../types';

/**
 * The type of the React props of {@link ComponentSlot}.
 */
interface IProps {

    /**
     * The component to render in place when no surface targets it.
     */
    children: ReactNode;

    /**
     * The id of the component, see {@code COMPONENT_IDS}. It is the key the
     * embedder uses to target it.
     */
    component: string;

    /**
     * Whether the component can leave the meeting document. The large video
     * cannot: the legacy layout code looks its video element up by id. A
     * non-movable component still honours the visibility state.
     */
    movable?: boolean;

    /**
     * Render nothing while the component is not targeted at a surface. Used to
     * keep a slot mounted in UI variants that otherwise do not render the
     * component (the reduced UI has no filmstrip), so an external surface can
     * still receive it.
     */
    onlyWhenMoved?: boolean;
}

/**
 * Renders its children in place, or portals them into the component surface
 * the embedder targeted, and hides them when the embedder asked for it.
 * Mounted around every layoutable component in the conference; without a target
 * or a hidden flag it is a no-op wrapper.
 *
 * @param {IProps} props - The props.
 * @returns {ReactElement}
 */
const ComponentSlot = ({ children, component, movable = true, onlyWhenMoved = false }: IProps) => {
    const target = useSelector((state: IReduxState) =>
        state['features/component-layout'].targets[component]);
    const hidden = useSelector((state: IReduxState) =>
        Boolean(state['features/component-layout'].hidden[component]));
    const surface = useSelector((state: IReduxState) =>
        (target ? state['features/component-layout'].surfaces[target] : undefined));
    const layoutClassName = useSelector((state: IReduxState) =>
        LAYOUT_CLASSNAMES[getCurrentLayout(state) ?? '']);

    const handle = surface?.handle as IComponentSurfaceHandle | undefined;
    const isWindowSurface = Boolean(movable
        && handle
        && !handle.win.closed
        && !(handle.iframe && !handle.iframe.isConnected));
    const hiddenClassName = hidden ? ' component-surface__slot--hidden' : '';

    useEffect(() => {
        if (!isWindowSurface || !handle) {
            return;
        }

        const root = handle.root;

        // The layout class is what the components' global CSS keys off (the
        // filmstrip's orientation, the toolbar's position), so the surface
        // root has to carry the layout the meeting is currently in. assign
        // instead of clobbering so several components can share a surface.
        root.classList.add('component-surface');
        Object.values(LAYOUT_CLASSNAMES).forEach(name => {
            if (name) {
                root.classList.toggle(name, name === layoutClassName);
            }
        });

        if (component === COMPONENT_IDS.TOOLBOX) {
            root.classList.add('component-surface--toolbox');
        }

        return () => {
            if (component === COMPONENT_IDS.TOOLBOX) {
                root.classList.remove('component-surface--toolbox');
            }
        };
    }, [ component, handle, isWindowSurface, layoutClassName ]);

    const selector = movable ? surface?.selector : undefined;
    const selectorElement = useMemo(() => {
        if (isWindowSurface || !selector || typeof document === 'undefined') {
            return undefined;
        }

        return document.querySelector<HTMLElement>(selector) ?? undefined;
    }, [ isWindowSurface, selector ]);

    const isMoved = Boolean(isWindowSurface || (movable && selectorElement));

    if (onlyWhenMoved && !isMoved) {
        return null;
    }

    if (isWindowSurface && handle) {
        return ReactDOM.createPortal(
            <CacheProvider value = { handle.cache }>
                <div
                    className = { `component-surface__slot${hiddenClassName}` }
                    data-component = { component }>
                    {children}
                </div>
            </CacheProvider>,
            handle.root,
            `${target}:${component}`
        );
    }

    if (selectorElement) {
        return ReactDOM.createPortal(
            <div
                className = { `component-surface__slot component-surface__slot--selector${hiddenClassName}` }
                data-component = { component }>
                {children}
            </div>,
            selectorElement,
            `${target}:${component}`
        );
    }

    if (hidden) {
        return (
            <div
                className = 'component-surface__slot component-surface__slot--hidden'
                data-component = { component }>
                {children}
            </div>
        );
    }

    return <>{children}</>;
};

export default ComponentSlot;
