/** Options supplied through PluginConfig.settings. Distances use scene units. */
export interface ExamplePluginSettings {
    sceneId?: string
    size?: number
    /** Six hexadecimal digits, for example '#00aaff'. */
    color?: string
    /** Scene coordinates. Omit to use the scene's current centre. */
    position?: [number, number, number]
}

/** Validate configuration at the plugin boundary rather than trusting external JSON. */
export function readSettings(settings: Record<string, unknown>): ExamplePluginSettings {
    const { sceneId, size, color, position } = settings
    if (sceneId !== undefined && (typeof sceneId !== 'string' || !sceneId.trim())) {
        throw new Error('settings.sceneId must be a non-empty string')
    }
    if (size !== undefined && (typeof size !== 'number' || !Number.isFinite(size) || size <= 0)) {
        throw new Error('settings.size must be a positive finite number')
    }
    if (color !== undefined && (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) {
        throw new Error('settings.color must be a six-digit hexadecimal colour')
    }
    if (position !== undefined && (!Array.isArray(position) || position.length !== 3
        || !position.every(value => typeof value === 'number' && Number.isFinite(value)))) {
        throw new Error('settings.position must contain three finite numbers')
    }
    return { sceneId, size, color, position: position as ExamplePluginSettings['position'] }
}
