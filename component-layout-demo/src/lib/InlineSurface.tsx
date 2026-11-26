import { CSSProperties, ReactNode } from 'react';

export interface IInlineSurfaceProps {

    /**
     * Optional class added to the wrapper.
     */
    className?: string;

    /**
     * The id of the iframe. Pass it as the {@code iframe} selector (e.g.
     * {@code "#filmstrip-panel"}) to the component layout controller.
     */
    id: string;

    /**
     * Rendered on top of the iframe while it is empty, so the area keeps a
     * visible placeholder before a component is moved into it.
     */
    overlay?: ReactNode;

    /**
     * The shell page. Point it at
     * {@code <deployment>/static/secondScreen.html}; it must be same-origin
     * with the meeting.
     */
    src: string;

    /**
     * The accessible title of the iframe.
     */
    title: string;
}

const rootStyle: CSSProperties = {
    height: '100%',
    position: 'relative',
    width: '100%'
};

const frameStyle: CSSProperties = {
    border: 0,
    display: 'block',
    height: '100%',
    width: '100%'
};

const overlayStyle: CSSProperties = {
    inset: 0,
    position: 'absolute'
};

/**
 * An iframe the meeting can render a component into, with an optional
 * placeholder overlay. It is the only React component needed to move a
 * component next to the meeting: give it a stable id and pass
 * {@code #id} to {@code createComponentLayout(...).place()}.
 *
 * @param {IInlineSurfaceProps} props - The props.
 * @returns {ReactNode}
 */
export function InlineSurface({ className, id, overlay, src, title }: IInlineSurfaceProps) {
    return (
        <div
            className = { className ? `jitsi-inline-surface ${className}` : 'jitsi-inline-surface' }
            style = { rootStyle }>
            <iframe
                id = { id }
                src = { src }
                style = { frameStyle }
                title = { title } />
            { overlay && (
                <div className = 'jitsi-inline-surface__overlay' style = { overlayStyle }>
                    { overlay }
                </div>
            ) }
        </div>
    );
}
