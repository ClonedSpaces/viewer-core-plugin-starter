/** Only these plain-data commands cross the iframe boundary. Never expose viewer objects. */
export type BridgeCommand =
    | { channel: 'clonedspaces-example'; version: 1; id: string; type: 'get-state' }
    | { channel: 'clonedspaces-example'; version: 1; id: string; type: 'set-cube-visible'; visible: boolean }

const channel = 'clonedspaces-example'

export function readParentOrigin(value: unknown): string | undefined {
    if (value === undefined) return undefined
    if (typeof value !== 'string') throw new Error('settings.parentOrigin must be an exact HTTP(S) origin')
    let url: URL
    try { url = new URL(value) } catch { throw new Error('settings.parentOrigin must be an exact HTTP(S) origin') }
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== value) {
        throw new Error('settings.parentOrigin must be an exact HTTP(S) origin without a path or trailing slash')
    }
    return value
}

function readCommand(value: unknown): BridgeCommand | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
    const data = value as Record<string, unknown>
    if (data.channel !== channel || data.version !== 1 || typeof data.id !== 'string'
        || !/^[a-zA-Z0-9_-]{1,64}$/.test(data.id)) return undefined
    if (data.type === 'get-state' && Object.keys(data).length === 4) {
        return { channel, version: 1, id: data.id, type: 'get-state' }
    }
    if (data.type === 'set-cube-visible' && typeof data.visible === 'boolean' && Object.keys(data).length === 5) {
        return { channel, version: 1, id: data.id, type: 'set-cube-visible', visible: data.visible }
    }
    return undefined
}

/** A narrow bridge, deliberately given no workspace, scene, camera, mesh, or plugin reference. */
export function createMessageBridge(parentOrigin: string, actions: {
    isCubeVisible: () => boolean
    setCubeVisible: (visible: boolean) => void
}): { destroy: () => void } {
    // Validate even when called independently of settings validation.
    readParentOrigin(parentOrigin)
    if (window.parent === window) return { destroy: () => {} }
    const parent = window.parent
    const sendState = (type: 'state' | 'cube-visibility-changed', id?: string): void => {
        // Construct every outgoing payload explicitly. Never spread or serialize viewer state.
        parent.postMessage({ channel, version: 1, type, ...(id ? { id } : {}),
            cubeVisible: actions.isCubeVisible() }, parentOrigin)
    }
    const onMessage = (event: MessageEvent<unknown>): void => {
        if (event.origin !== parentOrigin || event.source !== parent) return
        const command = readCommand(event.data)
        if (!command) return
        if (command.type === 'set-cube-visible') {
            actions.setCubeVisible(command.visible)
            sendState('cube-visibility-changed')
        }
        sendState('state', command.id)
    }
    window.addEventListener('message', onMessage)
    // The parent also requests state after iframe load, so it cannot miss initialization.
    parent.postMessage({ channel, version: 1, type: 'ready' }, parentOrigin)
    return { destroy: () => window.removeEventListener('message', onMessage) }
}
