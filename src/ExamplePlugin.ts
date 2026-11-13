import { BasePlugin, type BasePluginScene } from '@clonedspaces/viewer-core-plugin'
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three'
import { readSettings } from './settings'

/** A small stage extension using only the curated plugin workspace. */
export class ExamplePlugin extends BasePlugin {
    private scene?: BasePluginScene
    private mesh?: Mesh<BoxGeometry, MeshBasicMaterial>

    override async init(): Promise<boolean> {
        if (this.mesh) return true

        const settings = readSettings(this.config.settings)
        const stage = this.workspace.stage
        if (!stage) throw new Error('ExamplePlugin requires a workspace with a stage')

        const scene = settings.sceneId
            ? stage.scenes.getById(settings.sceneId)
            : stage.scenes.getMain()
        if (!scene) throw new Error('ExamplePlugin could not find its target scene')

        const size = settings.size ?? 1
        const mesh = new Mesh(
            new BoxGeometry(size, size, size),
            new MeshBasicMaterial({ color: settings.color ?? '#00aaff' }),
        )
        mesh.name = this.name + ':example-cube'
        if (settings.position) mesh.position.set(...settings.position)
        else mesh.position.copy(scene.centre)

        this.scene = scene
        this.mesh = mesh
        try {
            scene.addObject(mesh, {
                onDoubleClick: () => {
                    const content = document.createElement('p')
                    content.textContent = 'This cube belongs to ' + this.name + '.'
                    void this.workspace.interface.showDialog('Example plugin', content)
                        .catch(error => console.error('Example plugin dialog failed', error))
                },
            })
        } catch (error) {
            this.destroy()
            throw error
        }
        return true
    }

    /** Required lifecycle hook; the host does not automatically call it each frame. */
    override update(): void {}

    /** The host must call this before discarding or replacing the plugin instance. */
    override destroy(): void {
        const mesh = this.mesh
        if (!mesh) return

        // Removing the object also unregisters its picking callbacks.
        this.scene?.removeObject(mesh)
        mesh.geometry.dispose()
        mesh.material.dispose()
        this.mesh = undefined
        this.scene = undefined
    }
}
