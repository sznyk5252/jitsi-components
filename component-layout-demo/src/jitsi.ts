export interface JitsiApi {
    addEventListener(event: string, handler: (data: Record<string, unknown>) => void): void;
    dispose(): void;
    executeCommand(command: string, ...args: unknown[]): void;
}

interface JitsiApiConstructor {
    new (domain: string, options: Record<string, unknown>): JitsiApi;
}

declare global {
    interface Window {
        JitsiMeetExternalAPI?: JitsiApiConstructor;
    }
}

/**
 * A domain as typed by the user, split into the base URL the API script is
 * loaded from and the bare domain the API constructor expects.
 */
export interface JitsiTarget {
    baseUrl: string;
    domain: string;
}

/**
 * Normalises a user-entered deployment address.
 *
 * @param {string} value - The address, with or without a protocol.
 * @returns {JitsiTarget}
 */
export function parseTarget(value: string): JitsiTarget {
    const trimmed = value.trim().replace(/\/+$/, '');

    // JitsiMeetExternalAPI always builds its iframe with https://, so a bare
    // host defaults to HTTPS. An explicit http:// is still honoured for the
    // API script, but such a deployment cannot host the meeting iframe.
    const baseUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    return {
        baseUrl,
        domain: baseUrl.replace(/^https?:\/\//i, '')
    };
}

/**
 * Checks whether a deployment serves this fork's external API. The check reads
 * the bundle itself, which works when the demo runs on the deployment's origin
 * (the recommended setup) and returns {@code null} when CORS hides it.
 *
 * @param {string} baseUrl - The deployment base URL.
 * @returns {Promise<boolean | null>}
 */
export async function supportsComponentLayout(baseUrl: string): Promise<boolean | null> {
    try {
        const response = await fetch(`${baseUrl}/libs/external_api.min.js`, { cache: 'no-store' });

        if (!response.ok) {
            return null;
        }

        const text = await response.text();

        return text.includes('component-surface-opened') && text.includes('set-component-visible');
    } catch {
        return null;
    }
}

const loadedScripts = new Map<string, Promise<void>>();

/**
 * Loads {@code external_api.js} from a deployment (once per URL).
 *
 * @param {string} baseUrl - The deployment base URL.
 * @returns {Promise<JitsiApiConstructor>}
 */
export async function loadJitsiApi(baseUrl: string): Promise<JitsiApiConstructor> {
    // Standard deployments serve the bundle under libs/ (and alias it at
    // /external_api.js). The libs path is also what the fork's dev server
    // serves, so one URL works for both.
    const src = `${baseUrl}/libs/external_api.min.js`;
    let pending = loadedScripts.get(src);

    if (!pending) {
        pending = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');

            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Nie udało się pobrać ${src}`));
            document.head.appendChild(script);
        });
        loadedScripts.set(src, pending);
    }

    await pending;

    if (!window.JitsiMeetExternalAPI) {
        throw new Error('external_api.js nie zdefiniowało JitsiMeetExternalAPI');
    }

    return window.JitsiMeetExternalAPI;
}
