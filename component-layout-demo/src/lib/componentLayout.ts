/**
 * The ids the component layout fork accepts. Keep in sync with
 * react/features/component-layout/constants.ts in the jitsi-meet fork.
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
} as const;

export type JitsiComponentId = typeof COMPONENT_IDS[keyof typeof COMPONENT_IDS];

/**
 * The minimal external API surface the controller needs. A
 * {@code JitsiMeetExternalAPI} instance satisfies it.
 */
export interface IJitsiCommandApi {
    executeCommand(command: string, ...args: unknown[]): void;
}

export interface ISurfaceOptions {
    height?: number;
    left?: number;
    title?: string;
    top?: number;

    /**
     * Makes the surface size drive the meeting's global responsive metrics.
     * Avoid it for inline filmstrip panels: a small panel flips Jitsi into
     * reduced UI, which has no filmstrip. Size the panel to
     * {@code SURFACE_SIZES.filmstripWidth} instead.
     */
    viewport?: boolean;
    width?: number;
}

/**
 * A thin, framework-agnostic wrapper around the component layout commands of
 * the fork. It owns no state: every call sends one or two commands to the
 * meeting, and the meeting's redux state is the source of truth.
 */
export interface IComponentLayoutController {

    /**
     * Binds a surface id to a same-origin iframe of the embedding page. The
     * iframe must already exist (pass its CSS selector).
     */
    attachSurface(surfaceId: string, iframeSelector: string, options?: ISurfaceOptions): void;

    /**
     * Closes/detaches a surface. Components targeted at it go back to the
     * meeting.
     */
    detachSurface(surfaceId: string): void;

    /**
     * Moves a component to a surface id, or to {@code 'main'}.
     */
    move(component: JitsiComponentId, target: string): void;

    /**
     * Binds an iframe surface and moves a component into it in one call.
     */
    place(
        component: JitsiComponentId,
        surfaceId: string,
        iframeSelector: string,
        options?: ISurfaceOptions
    ): void;

    /**
     * Moves everything back to the meeting, shows everything and closes every
     * surface.
     */
    reset(): void;

    /**
     * Moves a component back to the meeting and detaches its surface.
     */
    restore(component: JitsiComponentId, surfaceId: string): void;

    /**
     * Shows or hides a component without moving it.
     */
    setVisible(component: JitsiComponentId, visible: boolean): void;
}

/**
 * Creates a controller for one meeting.
 *
 * @param {IJitsiCommandApi} api - The external API instance of the meeting.
 * @returns {IComponentLayoutController}
 */
export function createComponentLayout(api: IJitsiCommandApi): IComponentLayoutController {
    const attachSurface = (surfaceId: string, iframeSelector: string, options: ISurfaceOptions = {}) => {
        api.executeCommand('openComponentSurface', {
            id: surfaceId,
            iframe: iframeSelector,
            ...options
        });
    };

    const detachSurface = (surfaceId: string) => {
        api.executeCommand('closeComponentSurface', surfaceId);
    };

    const move = (component: JitsiComponentId, target: string) => {
        api.executeCommand('setComponentTarget', { component, target });
    };

    return {
        attachSurface,
        detachSurface,
        move,
        place(component, surfaceId, iframeSelector, options) {
            attachSurface(surfaceId, iframeSelector, options);
            move(component, surfaceId);
        },
        reset() {
            api.executeCommand('resetComponentLayout');
        },
        restore(component, surfaceId) {
            move(component, 'main');
            detachSurface(surfaceId);
        },
        setVisible(component, visible) {
            api.executeCommand('setComponentVisible', { component, visible });
        }
    };
}
