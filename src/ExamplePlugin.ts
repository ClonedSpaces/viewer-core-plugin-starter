import { BasePlugin, type BasePluginScene, type BasePluginMapManager } from '@clonedspaces/viewer-core-plugin'
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { readSettings } from './settings'
import { createMessageBridge } from './messageBridge'

/** One starter plugin, with five small API examples below. */
export class ExamplePlugin extends BasePlugin {
    private messageBridge?: { destroy: () => void }
    private scene?: BasePluginScene
    private mesh?: Mesh<BoxGeometry, MeshBasicMaterial>
    private toolbarGroupId?: string
    private mapManager?: BasePluginMapManager
    private sourceId?: string
    private layerId?: string

    override async init(): Promise<boolean> {
        if (this.mesh) return true
        const settings = readSettings(this.config.settings)
        const stage = this.workspace.stage
        if (!stage) throw new Error('ExamplePlugin requires a workspace with a stage')
        const scene = settings.sceneId ? stage.scenes.getById(settings.sceneId) : stage.scenes.getMain()
        if (!scene) throw new Error('ExamplePlugin could not find its target scene')

        const size = settings.size ?? 1
        const mesh = new Mesh(new BoxGeometry(size, size, size), new MeshBasicMaterial({ color: settings.color ?? '#00aaff' }))
        mesh.name = this.name + ':example-cube'
        if (settings.position) mesh.position.set(...settings.position)
        else mesh.position.copy(scene.centre)
        this.scene = scene
        this.mesh = mesh
        this.mapManager = this.workspace.map?.manager
        try {
            scene.addObject(mesh)
            this.addToolbar()
            // 5. Explicit commands and plain-data events only; viewer objects stay private.
            if (settings.parentOrigin) {
                this.messageBridge = createMessageBridge(settings.parentOrigin, {
                    isCubeVisible: () => mesh.visible,
                    setCubeVisible: visible => { mesh.visible = visible },
                })
            }
        } catch (error) {
            this.destroy()
            throw error
        }
        return true
    }

    // 1. Move an existing camera. Positions and distances use scene units.
    private async moveCamera(): Promise<void> {
        const stage = this.workspace.stage
        const viewport = stage?.viewports.getMain()
        const camera = viewport?.activeCameraId ? stage?.cameraControls.getById(viewport.activeCameraId) : undefined
        if (!camera || !this.scene) return
        const target = this.scene.centre
        const position = target.clone().add(new Vector3(10, 10, 10))
        await camera.setLookAt(position, target, true)
    }

    // 2. Add a toolbar group and buttons. Each button calls one of the examples.
    private addToolbar(): void {
        const ui = this.workspace.interface
        this.toolbarGroupId = ui.addToolbarGroup({ id: 'examples', label: 'Example plugin', mode: 'stage' })
        ui.addToolbarButton(this.toolbarGroupId, {
            id: 'move-camera', label: 'Move camera', icon: 'videocam', onClick: () => this.moveCamera(),
        })
        ui.addToolbarButton(this.toolbarGroupId, {
            id: 'add-geojson', label: 'Add GeoJSON', icon: 'add_location_alt',
            enabled: !!this.workspace.map, onClick: () => this.addGeoJson(),
        })
        ui.addToolbarButton(this.toolbarGroupId, {
            id: 'get-gis-layer', label: 'Get GIS layer', icon: 'layers',
            enabled: !!this.workspace.map, onClick: () => this.getGisLayer(),
        })
        // ui.setToolbarButtonState('move-camera', { enabled: false })
    }

    // 3. Add a GeoJSON source and a circle layer at the map's current centre.
    private addGeoJson(): void {
        const map = this.mapManager
        if (!map || this.sourceId) return
        const { lng, lat } = map.getCenter()
        const sourceId = this.name + ':points'
        const layerId = this.name + ':point-circles'
        map.addSource(sourceId, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [{
                type: 'Feature', properties: { label: 'Example point' },
                geometry: { type: 'Point', coordinates: [lng, lat] },
            }] },
        })
        try {
            map.addLayer({ id: layerId, type: 'circle', source: sourceId,
                paint: { 'circle-radius': 10, 'circle-color': '#00aaff' } })
        } catch (error) {
            map.removeSource(sourceId)
            throw error
        }
        this.sourceId = sourceId
        this.layerId = layerId
    }

    // 4. Get a registered GIS layer and query its records at the current workspace time.
    private async getGisLayer(): Promise<void> {
        const gis = this.workspace.map?.gis
        const layerId = gis?.listLayers()[0]?.id
        if (!gis || !layerId) {
            console.info('No registered GIS layers are available')
            return
        }
        const layer = gis.getLayer(layerId)
        const { data } = await gis.queryLayer(layerId)
        console.info('GIS layer:', layer, 'Records:', data)
        // To display it on the map: await gis.setVisible(layerId, true)
    }

    override update(): void {}

    override destroy(): void {
        this.messageBridge?.destroy()
        this.messageBridge = undefined
        if (this.toolbarGroupId) this.workspace.interface.removeToolbarGroup(this.toolbarGroupId)
        // Remove layers before their source, through the same manager that added them.
        if (this.layerId) this.mapManager?.removeLayer(this.layerId)
        if (this.sourceId) this.mapManager?.removeSource(this.sourceId)
        if (this.mesh) {
            this.scene?.removeObject(this.mesh)
            this.mesh.geometry.dispose()
            this.mesh.material.dispose()
        }
        this.toolbarGroupId = undefined
        this.layerId = undefined
        this.sourceId = undefined
        this.mapManager = undefined
        this.mesh = undefined
        this.scene = undefined
    }
}
