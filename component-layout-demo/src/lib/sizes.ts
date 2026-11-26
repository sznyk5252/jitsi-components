/**
 * Natural sizes of the Jitsi modules, used to size the inline panels.
 *
 * The vertical filmstrip is fixed-width in Jitsi: {@code DEFAULT_FILMSTRIP_WIDTH}
 * is 120 px, plus borders and scrollbar space. The toolbar is a single row of
 * buttons whose content is about 80 px tall, plus its margin.
 *
 * These are starting points, not contracts: override them if your deployment
 * changes {@code interfaceConfig.FILM_STRIP_MAX_HEIGHT}, enables a resizable
 * filmstrip, or uses a custom toolbar. They are exported so the demo and your
 * other projects can agree on one source of truth.
 */
export const SURFACE_SIZES = {
    // 140 px is the filmstrip's computed max-width in a default deployment
    // (120 px + borders/scrollbar); 2 px are the panel borders.
    filmstripWidth: 144,
    toolbarHeight: 92
} as const;
