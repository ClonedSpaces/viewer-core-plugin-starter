# @clonedspaces/viewer-core-plugin-starter

A TypeScript starter for Cloned Spaces viewer extensions. One ExamplePlugin adds a configurable cube and contains five small examples: moving a camera, adding toolbar groups and buttons, adding GeoJSON, querying a GIS layer, and bridging an embedding site through postMessage. It uses the curated plugin API, with no dependency on viewer-core internals.

## Requirements

- Node.js 20.19+ on the 20.x line, or 22.12+ (the installed Vite 8 requirement).
- npm (included with Node.js), pnpm, or Yarn.
- The privately supplied `@clonedspaces/viewer-core-plugin` package archive.
- A viewer host with an initialized stage and a main scene.
- Three.js compatible with the host; this starter uses 0.185.0.

This is a plugin library, not a standalone viewer. It has no HTML application or bundled project data.

## Getting started

Clone or copy this starter into your own project directory. Before installing, place the privately supplied plugin API archive at:

```text
vendor/clonedspaces-viewer-core-plugin-1.0.0.tgz
```

The archive is intentionally absent from the public starter and is ignored by Git. You do not need access to the core repository or a public registry release of the plugin API. If your supplied archive has a different filename or version, update its file reference in package.json. Keep the peer dependency range compatible with the sandbox host.

From the starter directory:

```sh
npm install
npm run build
npm run serve
```

The ES module is served at http://127.0.0.1:4174/index.js. Add the configuration from [examples/plugin.config.json](examples/plugin.config.json) to a compatible viewer host's plugin configuration array before launch. The host registers and initializes the plugin after its views are ready.

For continuous JavaScript builds, run the following in one terminal, then npm run serve in another after the first build completes:

```sh
npm run dev
```

Reload the viewer after changes. This workflow does not hot-replace active plugin instances. The development command emits JavaScript and source maps; npm run build also checks types and emits declarations. You can check types separately with npm run typecheck.

### Choose your package manager

The scripts invoke TypeScript and Vite directly, so no package manager is required beyond your preferred choice:

| Task | npm | pnpm | Yarn |
| --- | --- | --- | --- |
| Install | npm install | pnpm install | yarn install |
| Check types | npm run typecheck | pnpm run typecheck | yarn run typecheck |
| Build | npm run build | pnpm run build | yarn run build |
| Watch builds | npm run dev | pnpm run dev | yarn run dev |
| Serve the plugin | npm run serve | pnpm run serve | yarn run serve |

Use one package manager consistently within your project and commit its lockfile. When working inside the Cloned Spaces monorepo, follow that repository's pnpm workflow instead.

### What Vite provides

Vite builds a browser ES module, watches source changes, and serves the built files locally. It is a development tool; it is not bundled into your plugin. The local URL loads your plugin into a viewer host. It does not launch a standalone viewer or provide the planned developer sandbox and sample datasets.

The preview server permits cross-origin module loading for local development and listens only on loopback. For an HTTPS viewer or a restrictive Content Security Policy, serve the module through the viewer's own origin or configure an approved HTTPS development origin.

## Shared runtime modules

Both `three` and `@clonedspaces/viewer-core-plugin` are peer dependencies: the host supplies compatible runtime modules. They are also dev dependencies so the starter can build and typecheck locally. The plugin API uses the local tarball for development and `^1.0.0` for host compatibility. The archive supplies build-time tooling access; the host still supplies the runtime module.

The build leaves three and @clonedspaces/viewer-core-plugin as external ES imports. The host must resolve both names to its shared browser module instances, usually through its import map or module loading setup. Do not bundle a second copy of Three.js into the plugin.

For example, a host that already publishes browser bundles at these URLs can configure this import map before loading modules:

```html
<script type="importmap">
{
  "imports": {
    "three": "/vendor/three.js",
    "@clonedspaces/viewer-core-plugin": "/vendor/viewer-core-plugin.js"
  }
}
</script>
```

These URLs are examples, not files supplied by this starter. Use your host's actual browser-ready bundles and ensure the host itself uses the same modules. The plugin API package's raw TypeScript build is not a self-contained browser bundle.

## Sample code

The API examples are methods in the single [ExamplePlugin](src/ExamplePlugin.ts). Its toolbar buttons let you try them without moving the camera or querying GIS on startup. See the [sample guide](examples/README.md).

### Iframe messaging bridge

The opt-in [postMessage developer guide](examples/postmessage.md) connects an embedding site's UI to two validated cube commands and plain-data responses/events. A [parent-page example](examples/iframe-parent.html) shows both directions. Configure an exact trusted `settings.parentOrigin` to enable it.

**The workspace and any viewer components must never be exposed to the embedding site.** Keep all viewer access inside the plugin and send only explicitly approved data. Never expose a generic object/method proxy or serialize viewer objects. The developer guide explains command/reply IDs, events, protocol payloads, setup, origin checks, timeouts, extension rules, and troubleshooting.

## Customise the example

- Rename the package in package.json and ExamplePlugin in [src/ExamplePlugin.ts](src/ExamplePlugin.ts) and [src/index.ts](src/index.ts).
- Update name, author, version, type, and source in the example configuration. The host resolves the export matching name, falling back to the default export. Names must be unique in its registry.
- Define your options in [src/settings.ts](src/settings.ts). Configuration arrives as config.settings; validate it at this boundary.
- Replace the cube with your plugin's behaviour. Stage and map are optional workspace capabilities; check availability before use. This example deliberately requires the stage.

Example settings:

```json
{
  "sceneId": "main",
  "size": 2,
  "color": "#00aaff",
  "position": [0, 0, 0]
}
```

All options are optional. The default is a unit cube at the main scene's current centre. Positions and sizes use scene units; choose a suitable position and size for your project. The starter preserves the user's camera position, so navigate to the cube if it is outside the view or hidden by existing geometry.

## Lifecycle and cleanup

init() runs after the host creates the plugin with its curated workspace and configuration. This starter throws a descriptive error if the required stage or scene is absent; it does not rely on the host checking a false return value. Calling init() again on an initialized instance is harmless.

update() satisfies the base contract and is intentionally empty. It is not automatically called on every animation frame. If needed, register a callback with workspace.stage.registerUpdate() and unregister it during cleanup. Use a plugin-specific callback ID; callback timing follows the stage scheduler.

destroy() removes the iframe message listener, removes the toolbar group and buttons, removes any example GeoJSON layer and source, and disposes the cube geometry and material. The host must invoke it before discarding or replacing the instance. When extending the example, also unsubscribe event callbacks using the same callback reference, remove popups and map layers/sources you created, and dispose plugin-owned resources. Remove map layers before their sources.

The private plugin API package supplies documented TypeScript declarations for the workspace, interface, time, events, stage, map, and GIS contracts. Use editor hover and navigation to inspect them; a guide is included in the package README.

## Files

| File | Purpose |
| --- | --- |
| src/ExamplePlugin.ts | Plugin lifecycle and stage object example. |
| src/messageBridge.ts | Validated iframe commands and plain-data replies/events. |
| src/settings.ts | Typed settings and input validation. |
| src/index.ts | Named and default exports consumed by the host. |
| examples/postmessage.md | Iframe bridge developer guide and protocol reference. |
| examples/iframe-parent.html | Customer-site UI using the command/reply protocol. |
| tests/messageBridge.test.mjs | Bridge validation and lifecycle checks. |
| examples/plugin.config.json | Configuration to add to a viewer host. |
| vite.config.ts | Browser ES module build and local preview server. |
| tsconfig.json | Strict type checking and declaration output. |
| vendor/README.md | Where to place the private plugin API archive. |

## Delivering a plugin

Run npm run build and deploy the entire dist directory to a static host. Set source to the deployed index.js URL. The URL must be reachable by the browser, permitted by the host's Content Security Policy, and support CORS when served from another origin. The shared runtime module mappings are still required.

The starter source can be shared publicly. The package.json setting private: true prevents accidental npm publication; it does not prevent a public source repository. Keep the private plugin API archive out of public repositories and distributions.
