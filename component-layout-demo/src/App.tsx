import { CSSProperties, ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { JitsiApi, loadJitsiApi, parseTarget, supportsComponentLayout } from './jitsi';
import {
    createComponentLayout,
    COMPONENT_IDS as JITSI_COMPONENTS,
    InlineSurface,
    SURFACE_SIZES,
    type IComponentLayoutController,
    type JitsiComponentId
} from './lib';

type AreaKey = 'filmstrip' | 'main' | 'toolbar';
type Mode = 'demo' | 'live';
type PanelKey = 'filmstrip' | 'toolbar';
type Status = 'connected' | 'connecting' | 'disconnected';

interface LogEntry {
    at: string;
    id: number;
    kind: 'error' | 'info' | 'ok';
    text: string;
}

const AREA_TITLES: Record<AreaKey, string> = {
    filmstrip: 'Filmstrip',
    main: 'Główny obraz',
    toolbar: 'Opcje'
};

const COMPONENT_IDS: Record<AreaKey, JitsiComponentId> = {
    filmstrip: JITSI_COMPONENTS.FILMSTRIP,
    main: JITSI_COMPONENTS.LARGE_VIDEO,
    toolbar: JITSI_COMPONENTS.TOOLBOX
};

const APP_STYLE = {
    '--filmstrip-width': `${SURFACE_SIZES.filmstripWidth}px`,
    '--toolbar-height': `${SURFACE_SIZES.toolbarHeight}px`
} as CSSProperties;

const SURFACE_IDS: Record<PanelKey, string> = {
    filmstrip: 'filmstrip-panel',
    toolbar: 'toolbar-panel'
};

const MOCK_PARTICIPANTS = [
    { color: '#5b8def', initials: 'AK', name: 'Anna K.', speaking: true },
    { color: '#e07a5f', initials: 'MW', name: 'Marek W.', speaking: false },
    { color: '#3d9970', initials: 'JS', name: 'Julia S.', speaking: false },
    { color: '#9b5de5', initials: 'PT', name: 'Piotr T.', speaking: false },
    { color: '#f2a65a', initials: 'KN', name: 'Kasia N.', speaking: false }
];

/**
 * Renders a labelled area with its show/hide control.
 *
 * @param {Object} props - The props.
 * @returns {ReactNode}
 */
function Area({
    children,
    className = '',
    footer,
    persistent = false,
    subtitle,
    title,
    visible,
    onToggle
}: {
    children: ReactNode;
    className?: string;
    footer?: ReactNode;
    persistent?: boolean;
    subtitle: string;
    title: string;
    visible: boolean;
    onToggle: () => void;
}) {
    return (
        <section className = { `area ${className} ${visible ? '' : 'area--collapsed'}` }>
            <header className = 'area__head'>
                <div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
                <button
                    aria-pressed = { !visible }
                    className = { `toggle ${visible ? 'toggle--on' : ''}` }
                    onClick = { onToggle }
                    type = 'button'>
                    {visible ? 'Ukryj' : 'Pokaż'}
                </button>
            </header>
            { (visible || persistent) && <div className = 'area__body'>{children}</div> }
            { visible && footer && <footer className = 'area__foot'>{footer}</footer> }
        </section>
    );
}

/**
 * The mock stage used in demo mode.
 *
 * @returns {ReactNode}
 */
function MockMain() {
    return (
        <div className = 'mock-main'>
            <div className = 'mock-main__avatar'>AK</div>
            <div className = 'mock-main__name'>Anna Kowalska</div>
            <div className = 'mock-main__hint'>Główny obraz (mock)</div>
            <div className = 'mock-main__self'>Ty</div>
        </div>
    );
}

/**
 * The mock filmstrip used in demo mode.
 *
 * @returns {ReactNode}
 */
function MockFilmstrip() {
    return (
        <div className = 'mock-filmstrip'>
            { MOCK_PARTICIPANTS.map(participant => (
                <div
                    className = { `thumb ${participant.speaking ? 'thumb--speaking' : ''}` }
                    key = { participant.name }>
                    <span style = { { background: participant.color } }>
                        { participant.initials }
                    </span>
                    <small>{ participant.name }</small>
                </div>
            )) }
        </div>
    );
}

/**
 * The mock toolbar used in demo mode.
 *
 * @returns {ReactNode}
 */
function MockToolbar() {
    const [ mic, setMic ] = useState(true);
    const [ camera, setCamera ] = useState(true);

    return (
        <div className = 'mock-toolbar'>
            <button
                className = { mic ? 'is-on' : 'is-off' }
                onClick = { () => setMic(value => !value) }
                type = 'button'>
                <span className = 'dot' />
                Mikrofon
            </button>
            <button
                className = { camera ? 'is-on' : 'is-off' }
                onClick = { () => setCamera(value => !value) }
                type = 'button'>
                <span className = 'dot' />
                Kamera
            </button>
            <button type = 'button'>
                <span className = 'dot' />
                Ekran
            </button>
            <button type = 'button'>
                <span className = 'dot' />
                Czat
            </button>
            <button className = 'is-off' type = 'button'>
                <span className = 'dot' />
                Rozłącz
            </button>
        </div>
    );
}

const DEFAULT_DEPLOYMENT = [ '5173', '5174' ].includes(window.location.port)
    ? 'localhost:8090'
    : window.location.host;

/**
 * The demo application.
 *
 * @returns {ReactNode}
 */
export default function App() {
    const [ mode, setMode ] = useState<Mode>(() =>
        new URLSearchParams(window.location.search).get('mode') === 'live' ? 'live' : 'demo');
    const [ visible, setVisible ] = useState<Record<AreaKey, boolean>>({
        filmstrip: true,
        main: true,
        toolbar: true
    });
    const [ inPanel, setInPanel ] = useState<Record<PanelKey, boolean>>({
        filmstrip: false,
        toolbar: false
    });
    const [ status, setStatus ] = useState<Status>('disconnected');
    const [ connectedBase, setConnectedBase ] = useState<string | null>(null);
    const [ domain, setDomain ] = useState(DEFAULT_DEPLOYMENT);
    const [ room, setRoom ] = useState('ComponentLayoutDemo');
    const [ connectError, setConnectError ] = useState<string | null>(null);
    const [ logOpen, setLogOpen ] = useState(false);
    const [ log, setLog ] = useState<LogEntry[]>([]);

    const apiRef = useRef<JitsiApi | null>(null);
    const layoutRef = useRef<IComponentLayoutController | null>(null);
    const mountRef = useRef<HTMLDivElement | null>(null);
    const logId = useRef(0);
    const connectingRef = useRef(false);

    const addLog = useCallback((kind: LogEntry['kind'], text: string) => {
        logId.current += 1;

        // Build the entry outside the updater: StrictMode may invoke the
        // updater more than once, and it must stay pure.
        const entry: LogEntry = {
            at: new Date().toLocaleTimeString('pl-PL'),
            id: logId.current,
            kind,
            text
        };

        setLog(entries => [ entry, ...entries ].slice(0, 40));
    }, []);

    const resetPanelFrames = useCallback(() => {
        document.querySelectorAll<HTMLIFrameElement>('.panel__frame').forEach(frame => {
            try {
                frame.contentWindow?.location.reload();
            } catch {
                // The frame may not be same-origin (a misconfigured deployment).
            }
        });
    }, []);

    const disconnect = useCallback(() => {
        apiRef.current?.dispose();
        apiRef.current = null;
        layoutRef.current = null;
        if (mountRef.current) {
            mountRef.current.replaceChildren();
        }
        setInPanel({ filmstrip: false,
            toolbar: false });
        setConnectedBase(null);
        setStatus('disconnected');
        resetPanelFrames();
    }, [ resetPanelFrames ]);

    useEffect(() => () => apiRef.current?.dispose(), []);

    const connect = async () => {
        const container = mountRef.current;

        if (!container || connectingRef.current) {
            return;
        }

        connectingRef.current = true;
        setStatus('connecting');
        setConnectError(null);
        addLog('info', `Łączenie z ${domain}…`);

        const { baseUrl, domain: apiDomain } = parseTarget(domain);

        try {
            const forked = await supportsComponentLayout(baseUrl);

            if (forked === false) {
                const message = 'Ten serwer nie ma komend component layout — to nie build z forkiem. '
                    + 'Użyj dev-servera forka, np. https://localhost:8090.';

                setStatus('disconnected');
                setConnectError(message);
                addLog('error', message);

                return;
            }

            const JitsiMeetExternalAPI = await loadJitsiApi(baseUrl);

            if (forked) {
                addLog('ok', 'Serwer obsługuje component layout.');
            }

            apiRef.current?.dispose();
            container.replaceChildren();
            setInPanel({ filmstrip: false,
                toolbar: false });

            const api = new JitsiMeetExternalAPI(apiDomain, {
                configOverwrite: {
                    prejoinConfig: { enabled: false },
                    startWithAudioMuted: true
                },
                parentNode: container,
                roomName: room.trim() || 'ComponentLayoutDemo'
            });

            api.addEventListener('componentSurfaceOpened', data => {
                addLog('ok', `Otwarto panel: ${String(data.id)}`);
            });

            api.addEventListener('componentSurfaceClosed', data => {
                addLog('info', `Zamknięto panel: ${String(data.id)}`);
                setInPanel(current => {
                    const next = { ...current };

                    if (data.id === SURFACE_IDS.filmstrip) {
                        next.filmstrip = false;
                    } else if (data.id === SURFACE_IDS.toolbar) {
                        next.toolbar = false;
                    }

                    return next;
                });
            });

            api.addEventListener('componentSurfaceError', data => {
                addLog('error', `Błąd ${String(data.id)}: ${String(data.error)}`);

                if (data.error === 'embedder-cross-origin') {
                    addLog('info', 'Otwórz to demo z tego samego adresu co spotkanie, aby osadzić panele obok.');
                } else if (data.error === 'surface-not-found') {
                    addLog('info', 'Nie znaleziono iframe panelu w tej stronie.');
                } else if (data.error === 'unknown-component') {
                    addLog('info', 'Serwer nie zna tego komponentu — sprawdź, czy to build z forkiem.');
                }

                setInPanel({ filmstrip: false,
                    toolbar: false });
            });

            apiRef.current = api;
            layoutRef.current = createComponentLayout(api);
            setConnectedBase(baseUrl);
            setStatus('connected');
            addLog('ok', `Połączono z pokojem ${room}`);
        } catch (error) {
            const message = `${error instanceof Error ? error.message : 'Nie udało się połączyć'}. `
                + `Otwórz ${baseUrl} w nowej karcie i zaakceptuj certyfikat, jeśli to dev-server.`;

            setStatus('disconnected');
            setConnectError(message);
            addLog('error', message);
        } finally {
            connectingRef.current = false;
        }
    };

    const changeMode = (next: Mode) => {
        if (next === mode) {
            return;
        }
        if (mode === 'live') {
            disconnect();
        }
        setMode(next);
    };

    const toggleVisible = (area: AreaKey) => {
        const next = !visible[area];

        setVisible(current => ({ ...current,
            [area]: next }));

        if (status === 'connected') {
            layoutRef.current?.setVisible(COMPONENT_IDS[area], next);
        }
    };

    const moveToPanel = (key: PanelKey) => {
        const api = apiRef.current;

        if (!api || status !== 'connected') {
            return;
        }

        if (!document.getElementById(SURFACE_IDS[key])) {
            addLog('error', `Brak panelu ${SURFACE_IDS[key]} w tej stronie`);

            return;
        }

        // Do not use viewport: true here: it rewrites the meeting's global
        // responsive metrics with the panel size, which can flip Jitsi into its
        // reduced UI and make the filmstrip disappear entirely. The panel is
        // sized to the filmstrip's natural width instead (SURFACE_SIZES).
        layoutRef.current?.place(COMPONENT_IDS[key], SURFACE_IDS[key], `#${SURFACE_IDS[key]}`, {
            title: `Jitsi – ${AREA_TITLES[key]}`
        });
        setInPanel(current => ({ ...current,
            [key]: true }));
    };

    const restoreToMeeting = (key: PanelKey) => {
        const api = apiRef.current;

        if (!api || status !== 'connected') {
            return;
        }

        layoutRef.current?.restore(COMPONENT_IDS[key], SURFACE_IDS[key]);
        setInPanel(current => ({ ...current,
            [key]: false }));
    };

    const sameOrigin = connectedBase ? connectedBase === window.location.origin : false;
    const notConnected = status !== 'connected';

    const renderPanel = (key: PanelKey) => {
        if (notConnected || !connectedBase) {
            return <div className = 'panel__empty'>Połącz ze spotkaniem, aby użyć panelu.</div>;
        }

        return (
            <InlineSurface
                className = 'panel'
                id = { SURFACE_IDS[key] }
                overlay = { !inPanel[key] ? (
                    <div className = 'panel__empty'>
                        <strong>Panel pusty</strong>
                        <small>{ AREA_TITLES[key] } jest w oknie spotkania</small>
                    </div>
                ) : undefined }
                src = { `${connectedBase}/static/secondScreen.html` }
                title = { `Jitsi – ${AREA_TITLES[key]}` } />
        );
    };

    const renderPanelFooter = (key: PanelKey) => (
        <button
            className = 'ghost'
            disabled = { notConnected }
            onClick = { () => (inPanel[key] ? restoreToMeeting(key) : moveToPanel(key)) }
            title = { inPanel[key] ? 'Przywróć do spotkania' : 'Przenieś do panelu obok' }
            type = 'button'>
            { inPanel[key] ? 'Do spotkania' : 'Do panelu' }
        </button>
    );

    return (
        <div className = 'app' style = { APP_STYLE }>
            <header className = 'topbar'>
                <div>
                    <h1>Jitsi – podział widoku</h1>
                    <p>Trzy niezależne obszary: główny obraz, opcje i filmstrip.</p>
                </div>
                <div className = 'topbar__actions'>
                    { mode === 'demo' && (
                        <button
                            className = 'topbar__cta'
                            onClick = { () => changeMode('live') }
                            type = 'button'>
                            Połącz z Jitsi
                        </button>
                    ) }
                    <div className = 'mode-switch'>
                        <button
                            className = { mode === 'demo' ? 'active' : '' }
                            onClick = { () => changeMode('demo') }
                            type = 'button'>
                            Demo
                        </button>
                        <button
                            className = { mode === 'live' ? 'active' : '' }
                            onClick = { () => changeMode('live') }
                            type = 'button'>
                            Jitsi na żywo
                        </button>
                    </div>
                </div>
            </header>

            { mode === 'live' && status === 'connected' && (
                <section className = 'connect-bar connect-bar--connected'>
                    <span className = 'connect-bar__meeting'>
                        Połączono: <strong>{ room.trim() || 'ComponentLayoutDemo' }</strong>
                        {' '}na <strong>{ connectedBase?.replace(/^https?:\/\//, '') }</strong>
                    </span>
                    <button onClick = { disconnect } type = 'button'>Rozłącz</button>
                    <span className = 'status status--connected'>Połączono</span>
                </section>
            ) }

            { mode === 'live' && status !== 'connected' && (
                <div className = 'connect-modal'>
                    <form
                        className = 'connect-modal__card'
                        onSubmit = { event => {
                            event.preventDefault();
                            connect();
                        } }>
                        <h2>Połącz ze spotkaniem</h2>
                        <p>
                            Wpisz adres builda z forkiem i nazwę pokoju. Spotkanie otworzy się
                            w obszarze „Główny obraz”.
                        </p>
                        <label>
                            Serwer
                            <input
                                onChange = { event => setDomain(event.target.value) }
                                placeholder = 'localhost:8090'
                                spellCheck = { false }
                                value = { domain } />
                        </label>
                        <label>
                            Pokój
                            <input
                                autoFocus = { true }
                                onChange = { event => setRoom(event.target.value) }
                                placeholder = 'ComponentLayoutDemo'
                                value = { room } />
                        </label>
                        { connectError && <div className = 'connect-modal__error'>{ connectError }</div> }
                        <button
                            className = 'primary'
                            disabled = { status === 'connecting' }
                            type = 'submit'>
                            { status === 'connecting' ? 'Łączenie…' : 'Połącz' }
                        </button>
                        <button
                            className = 'ghost'
                            disabled = { status === 'connecting' }
                            onClick = { () => changeMode('demo') }
                            type = 'button'>
                            Zobacz demo bez łączenia
                        </button>
                        <p className = 'connect-modal__hint'>
                            Dev-server forka: <code>localhost:8090</code> (HTTPS — zaakceptuj certyfikat).
                        </p>
                    </form>
                </div>
            ) }

            { mode === 'live' && status === 'connected' && !sameOrigin && (
                <div className = 'notice'>
                    <strong>Panele obok wymagają tego samego origin.</strong>
                    {' '}To demo jest otwarte z { window.location.origin }, a spotkanie z { connectedBase }.
                    {' '}
                    <a href = { `${connectedBase}/static/component-layout-app/` }>
                        Otwórz demo z serwera spotkania
                    </a>
                    .
                </div>
            ) }

            <main className = 'workspace'>
                <Area
                    className = { `area--main ${mode === 'live' ? 'area--live' : ''}` }
                    persistent = { mode === 'live' }
                    subtitle = { mode === 'live'
                        ? 'largeVideo w oknie spotkania – sterowany przez setComponentVisible'
                        : 'Podglądowa scena z głównym mówcą' }
                    title = { AREA_TITLES.main }
                    visible = { visible.main }
                    onToggle = { () => toggleVisible('main') }>
                    { mode === 'live'
                        ? <div className = 'jitsi-mount' ref = { mountRef } />
                        : <MockMain /> }
                </Area>

                <Area
                    className = { `area--filmstrip ${mode === 'live' ? 'area--live' : ''}` }
                    footer = { mode === 'live' ? renderPanelFooter('filmstrip') : undefined }
                    subtitle = { mode === 'live'
                        ? (inPanel.filmstrip ? 'W panelu obok' : 'W oknie spotkania')
                        : 'Miniatury uczestników' }
                    title = { AREA_TITLES.filmstrip }
                    visible = { visible.filmstrip }
                    onToggle = { () => toggleVisible('filmstrip') }>
                    { mode === 'live' ? renderPanel('filmstrip') : <MockFilmstrip /> }
                </Area>

                <Area
                    className = { `area--toolbar ${mode === 'live' ? 'area--live' : ''}` }
                    footer = { mode === 'live' ? renderPanelFooter('toolbar') : undefined }
                    subtitle = { mode === 'live'
                        ? (inPanel.toolbar ? 'W panelu obok' : 'W oknie spotkania')
                        : 'Mikrofon, kamera, udostępnianie…' }
                    title = { AREA_TITLES.toolbar }
                    visible = { visible.toolbar }
                    onToggle = { () => toggleVisible('toolbar') }>
                    { mode === 'live' ? renderPanel('toolbar') : <MockToolbar /> }
                </Area>
            </main>

            <footer className = { `console ${logOpen ? 'console--open' : 'console--collapsed'}` }>
                <div className = 'console__head'>
                    <span>Dziennik</span>
                    { !logOpen && (
                        <span className = 'console__latest'>
                            { log[0] ? log[0].text : 'Brak zdarzeń.' }
                        </span>
                    ) }
                    <div className = 'console__actions'>
                        { logOpen && log.length > 0 && (
                            <button className = 'ghost ghost--small' onClick = { () => setLog([]) } type = 'button'>
                                Wyczyść
                            </button>
                        ) }
                        <button
                            className = 'ghost ghost--small'
                            onClick = { () => setLogOpen(open => !open) }
                            type = 'button'>
                            { logOpen ? 'Zwiń' : 'Rozwiń' }
                        </button>
                    </div>
                </div>
                { logOpen && (
                    <div className = 'console__body'>
                        { log.length === 0 && <p className = 'muted'>Brak zdarzeń.</p> }
                        { log.map(entry => (
                            <p className = { `log-line log-line--${entry.kind}` } key = { entry.id }>
                                <span>{ entry.at }</span>
                                { entry.text }
                            </p>
                        )) }
                    </div>
                ) }
            </footer>
        </div>
    );
}
