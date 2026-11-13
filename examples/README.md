# Five examples in one plugin

Load ExamplePlugin using [plugin.config.json](plugin.config.json). The first four examples are small methods in [src/ExamplePlugin.ts](../src/ExamplePlugin.ts):

| Method | Shows how to |
| --- | --- |
| moveCamera() | Find the main viewport's active camera and animate its position and target. |
| addToolbar() | Create a stage toolbar group and add buttons with click handlers. |
| addGeoJson() | Add a GeoJSON point source and a circle layer at the map centre. |
| getGisLayer() | List registered GIS layers, get one layer's state, and query its records. |

The plugin creates the cube and toolbar on initialization. Use its Move camera, Add GeoJSON, and Get GIS layer buttons to run the other examples. Map buttons are disabled when the workspace has no map. GIS results appear in the browser console; if no GIS layers are registered, the example logs that instead.

The toolbar appears when the stage is the main view in normal stage mode. It follows the host's mode switching. Camera positions use scene units; edit the offset in moveCamera() for your project. GeoJSON coordinates use longitude/latitude.

GeoJSON is added once per plugin instance, to the current map style. GIS queries use the current workspace time and leave shared layer visibility unchanged. The comment in getGisLayer() shows how to request visibility if needed.

The host must call destroy() when unloading the plugin. It removes the toolbar group and all its buttons, removes the GeoJSON layer before its source, and disposes the cube's resources.

## Iframe messaging

The fifth example is an opt-in [postMessage bridge with a developer guide](postmessage.md), with a runnable [embedding page](iframe-parent.html). It accepts explicit commands and emits approved plain-data responses and events. **The workspace and any viewer components must never be exposed to the embedding site.** The bridge checks the exact origin, sender, and payload, and removes its listener during cleanup.


Read the guide for the command/reply and event model, complete protocol schemas, integration steps, timeouts, security boundary, extension workflow, and troubleshooting. Start with the parent HTML for customer-side code and messageBridge.ts for viewer-side validation.
