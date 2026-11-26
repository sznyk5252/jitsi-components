/**
 * The type of the (redux) action which asks for a component surface window to
 * be opened. The middleware performs the actual open, because it needs the
 * {@code Window} object, which must not live in an action.
 */
export const OPEN_COMPONENT_SURFACE = 'OPEN_COMPONENT_SURFACE';

/**
 * The type of the (redux) action which asks for a component surface window to
 * be closed.
 */
export const CLOSE_COMPONENT_SURFACE = 'CLOSE_COMPONENT_SURFACE';

/**
 * The type of the (redux) action which stores a surface's configuration before
 * its window is opened.
 */
export const SET_COMPONENT_SURFACE = 'SET_COMPONENT_SURFACE';

/**
 * The type of the (redux) action which attaches the live window handle to a
 * surface once the window has loaded.
 */
export const ATTACH_COMPONENT_SURFACE_WINDOW = 'ATTACH_COMPONENT_SURFACE_WINDOW';

/**
 * The type of the (redux) action which removes a surface and every target that
 * points to it.
 */
export const REMOVE_COMPONENT_SURFACE = 'REMOVE_COMPONENT_SURFACE';

/**
 * The type of the (redux) action which moves one component to a target.
 */
export const SET_COMPONENT_TARGET = 'SET_COMPONENT_TARGET';

/**
 * The type of the (redux) action which moves several components to targets.
 */
export const SET_COMPONENT_TARGETS = 'SET_COMPONENT_TARGETS';

/**
 * The type of the (redux) action which shows or hides one component without
 * moving it. Hidden components stay mounted, so their state and legacy DOM
 * lookups keep working.
 */
export const SET_COMPONENT_VISIBLE = 'SET_COMPONENT_VISIBLE';

/**
 * The type of the (redux) action which moves every component back to the
 * meeting window, shows everything and closes every surface.
 */
export const RESET_COMPONENT_LAYOUT = 'RESET_COMPONENT_LAYOUT';
