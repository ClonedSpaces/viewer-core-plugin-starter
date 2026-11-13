# Developer guide: iframe messaging bridge

This guide is for developers building a customer site's UI around an embedded Cloned Spaces viewer. The customer page sends commands to a plugin inside the viewer iframe. The plugin performs a specific action locally and replies with approved plain data. It can also publish events to update the customer UI.

Start with [iframe-parent.html](iframe-parent.html) for the customer page, [messageBridge.ts](../src/messageBridge.ts) for the wire protocol, and [ExamplePlugin.ts](../src/ExamplePlugin.ts) for viewer-side actions. This is an opt-in sample protocol, not a general viewer API.

## The boundary: viewer objects never leave the viewer

**The workspace and all viewer components must NEVER be exposed to the embedding site.** This includes the plugin instance, scenes, cameras, maps, layers, Three.js objects, DOM nodes, internal configuration, and credentials.

Keep viewer access inside the plugin. Never serialize or spread viewer objects into messages, attach them to global browser objects, or expose them through a proxy or generic remote method dispatcher. Do not forward raw API results, exceptions, or internal event objects. Being serializable does not make data suitable for disclosure.

Build every outgoing payload from explicitly approved fields. This sample exports only a boolean describing the example cube's visibility. The bridge receives two callbacks; it receives no workspace, mesh, scene, or other viewer component.

```text
Customer site                         Viewer iframe
UI button                             Message bridge → Plugin action → Private viewer objects
    └── validated command ──────────→       │
    ←── reply with matching ID ─────────────┤
    ←── event without request ID ───────────┘
```

For example, `set-cube-visible` means “ask the plugin to set its example cube's visibility.” It does not give the caller a cube reference or permission to access arbitrary objects.

## How command, reply, and event messages differ

A **command** asks the plugin to do one allowed operation. The parent assigns a unique `id` and stores it until a reply arrives or its timeout expires.

A **reply** reports the outcome for that command. In version 1, every successful command produces a `state` message with the same `id` and the current `cubeVisible` value. Match replies by ID, rather than assuming the next received message belongs to the last command sent.

An **event** is a notification, with no request ID. `ready` announces that the listener is installed. `cube-visibility-changed` is emitted after a visibility command, before its reply. Events must not resolve a pending command.

Version 1 has no `success`/`error` envelope. Invalid messages are ignored, and unexpected action failures have no protocol error reply. A timeout means “no matching reply was received”; it does not prove the action failed or was never executed.

## Configure and run the sample

1. Supply the private API archive and install/build the starter using the [repository setup](../README.md#getting-started).
2. Make the built plugin available to a compatible viewer host. Use the host's shared runtime modules as described in the main README.
3. Add the configuration below to the viewer host's trusted plugin configuration array. Replace the plugin module URL and customer origin.
4. Edit `viewerUrl` in [iframe-parent.html](iframe-parent.html) to point to your actual viewer page, including its project route if required.
5. Serve that HTML page from the configured customer origin and open it in a browser. Show cube and Hide cube become enabled after a valid state response or visibility event.

```json
{
  "name": "ExamplePlugin",
  "author": "Your organisation",
  "version": "0.1.0",
  "type": "stage-example",
  "source": "https://plugins.example.com/index.js",
  "settings": {
    "parentOrigin": "https://customer.example.com"
  }
}
```

The three URLs have different roles:

| Value | Example | Used for |
| --- | --- | --- |
| Customer origin | `https://customer.example.com` | The plugin's trusted `settings.parentOrigin`; outgoing reply/event target. |
| Viewer URL | `https://viewer.example.com/project` | The parent page's iframe `src`. Its origin is the parent's command target and incoming sender check. |
| Plugin module URL | `https://plugins.example.com/index.js` | The viewer host's plugin `source`. This is not the iframe URL or the command target. |

`parentOrigin` must equal a canonical HTTP(S) origin: scheme, hostname, and optional port, with no path, credentials, query, fragment, or trailing slash. For example, `http://localhost:3000` is valid; `https://customer.example.com/` is rejected. Origins include the port; `localhost` and `127.0.0.1` are different hosts. Omit the setting to disable messaging. An invalid configured origin causes settings validation to fail.

Configure the trusted origin on the viewer side. Never derive permission from incoming messages, a parent-supplied URL parameter, or an unvalidated referrer. This sample permits one exact origin and the immediate parent window only. It installs no listener when the viewer is opened outside an iframe.

Serve both pages over HTTP(S); use HTTPS or localhost for the parent sample's [`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) support. Do not open the HTML through `file://`. The sample HTML is a separate customer-site artifact: the library build does not serve it or bundle a viewer application.

The viewer deployment must permit the customer page to frame it. Check its [`Content-Security-Policy: frame-ancestors`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors) and any [`X-Frame-Options`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options) restrictions, as well as the parent site's frame policy. If [iframe sandboxing](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox) is used, it must preserve the viewer's actual origin and permit its scripts; opaque `null` origins are not supported. Plugin module CORS/import-map requirements remain separate from postMessage.

## Protocol reference: version 1

Messages are structured-cloneable JavaScript objects, not JSON strings. Do not call `JSON.stringify()` before sending them. The receiver validates their runtime shape; TypeScript types alone do not validate messages from another window.

Every message includes these exact values:

| Field | Value |
| --- | --- |
| `channel` | `"clonedspaces-example"` |
| `version` | Numeric `1` |

Commands also include an `id` consisting of 1–64 ASCII letters, digits, underscores, or hyphens. Use a fresh ID for every request. Extra fields are rejected, including extra metadata fields. The channel routes messages; it is not a secret or an authentication credential.

### Commands: parent → plugin

| Type | Exact fields, including the common fields | Action |
| --- | --- | --- |
| `get-state` | `channel`, `version`, `id`, `type` | Read the example cube's visibility. |
| `set-cube-visible` | `channel`, `version`, `id`, `type`, `visible` | Set the example cube's visibility to a boolean. |

```js
iframe.contentWindow.postMessage({
    channel: 'clonedspaces-example',
    version: 1,
    id: 'request-1',
    type: 'set-cube-visible',
    visible: false,
}, 'https://viewer.example.com')
```

There is no arbitrary scene ID, object path, method name, or workspace query parameter. A `visible` string such as `"false"` is invalid.

### Replies and events: plugin → parent

| Type | Kind | Exact fields, including the common fields |
| --- | --- | --- |
| `state` | Reply | `channel`, `version`, `type`, `id`, `cubeVisible` |
| `ready` | Event | `channel`, `version`, `type` |
| `cube-visibility-changed` | Event | `channel`, `version`, `type`, `cubeVisible` |

The successful reply to the command above is:

```json
{
  "channel": "clonedspaces-example",
  "version": 1,
  "type": "state",
  "id": "request-1",
  "cubeVisible": false
}
```

The notification sent immediately before that reply is:

```json
{
  "channel": "clonedspaces-example",
  "version": 1,
  "type": "cube-visibility-changed",
  "cubeVisible": false
}
```

Currently, that notification is emitted for every valid visibility command, even when the requested value equals the existing value. It does not observe visibility changes caused elsewhere in the viewer. Add a deliberate, cleaned-up internal subscription if your application needs those changes published too.

## Startup, correlation, and cleanup

The parent installs its message and iframe-load listeners before setting the iframe URL. The plugin installs its listener during `init()`, then emits `ready`. When the parent receives `ready`, it requests state. After iframe load it also requests state if it has not already received a state update. This handles the usual ordering differences between load and plugin initialization; it is not a durable delivery guarantee.

For a visibility operation, the flow is:

```text
Parent UI                           Plugin
store request-1 and start timeout
set-cube-visible(request-1, false) → validate origin, sender, schema
                                    set the private cube's visibility
                                  ← cube-visibility-changed(false)
update UI; keep request pending
                                  ← state(request-1, false)
clear request-1 timeout; update UI
```

The parent sample keeps outstanding IDs and timers in a `Map`, uses a five-second timeout, and ignores replies whose IDs are no longer pending. Multiple requests can be outstanding. It updates the status text through `textContent`.

The sample does not implement replay protection, deduplication, durable delivery, cancellation, reconnection, or automatic retries. Reusing an ID does not stop a command executing twice. A repeated visibility assignment is safe for this example, but future non-idempotent commands need their own retry/deduplication policy. Do not blindly retry an operation after a timeout.

`destroy()` removes the plugin's message listener before the plugin disposes its resources. In a framework parent application, also remove the parent listener, clear pending timers, and reject/cancel pending application requests when the UI unmounts. On iframe navigation or reload, reset readiness, disable controls, clear old pending requests, and repeat initialization. The standalone HTML demonstrates initial startup and is not a complete navigation/session manager. Late replies from an old instance require session handling if the integration is extended to support reconnection.

## Security checks on both sides

The plugin accepts a message only when `event.origin` exactly matches the configured customer origin and `event.source` is its immediate parent. The parent accepts a message only when the origin matches the viewer origin and the source is that specific iframe's `contentWindow`. Both send to exact target origins, never `"*"`. See the [MDN postMessage security guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns).

Wrong origins, wrong windows, unsupported versions/types, malformed values, and extra fields are ignored without a response. This avoids replying to untrusted traffic. It also means the customer UI sees a timeout rather than a validation error.

An allowed origin identifies a website, not a signed-in user or their project permissions. Authorize sensitive operations inside the viewer/plugin using the host's trusted identity and permissions. Origin checks do not make arbitrary viewer data safe to disclose. Keep the customer site and viewer on separate origins to retain browser isolation; this bridge cannot isolate the viewer from other code running on the viewer's own origin.

## Add a new operation

1. Define a task-specific command and a small approved result, such as selecting a public application item by a validated external ID. Decide whether the embedding site is permitted to perform that action and see that result.
2. Add the command to `BridgeCommand` and implement runtime validation in `readCommand()`. Reject unknown and extra fields. Bound strings, arrays, query ranges, and other inputs before calling viewer APIs.
3. Add a narrow callback to `createMessageBridge()` and implement it inside `ExamplePlugin`. Keep every workspace/component reference inside the plugin. Do not pass the workspace to the bridge.
4. Construct the reply explicitly from approved values. Introduce a documented result type if `state` is no longer suitable. Never spread a viewer result or forward a raw error.
5. Extend the parent receiver, pending-request handling, protocol reference, and tests together. Add bounded concurrency and rate limits before exposing costly actions.
6. Subscribe to internal events only when needed; map them to approved event fields and unsubscribe during cleanup.

For asynchronous operations, define when a reply is sent: after acceptance or after completion. Catch failures and return documented, sanitized error codes only to validated callers. Do not mistake a command being received for its work having completed.

If you introduce explicit success/error replies, document the new envelope and update both sides together. They are not part of version 1 today. Use a new protocol version for incompatible schema changes; the strict field checks mean even adding an extra field can break an existing receiver. Use a distinct channel or deliberate routing design before enabling multiple bridge instances in the same viewer.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Buttons stay disabled | Plugin initialized successfully; `parentOrigin` is present; viewer is embedded; `viewerUrl` points to the viewer rather than the plugin JS. |
| Settings validation fails | Exact origin without a trailing slash/path; correct scheme, hostname, and port; no wildcard or credentials. |
| Request times out | Both origin checks and source checks; channel/version; exact fields; plugin lifecycle; browser console for action failures. Timeout is not a failure acknowledgement. |
| Viewer refuses to load in iframe | Deployment framing headers, parent frame policy, viewer authentication, and sandbox configuration. |
| Plugin fails before `ready` | Stage and scene availability, private API/runtime compatibility, import maps, plugin module URL, CORS, and CSP. |
| Response is ignored | Match its ID to a still-pending request; check the exact reply field set and boolean `cubeVisible`. |
| Cube is reported visible but cannot be seen | Visibility means the mesh's `visible` flag. It may be outside the camera view or hidden behind geometry. |
| No event after another viewer operation | The sample emits visibility events only for its own visibility command. |

Use the browser's parent and iframe console contexts to inspect the respective listeners. Log only protocol metadata needed for diagnosis; do not dump the workspace or private viewer state.

## Verify changes

From the repository root:

```sh
npm run build
node --test tests/messageBridge.test.mjs
```

The focused tests cover origin configuration, rejected origins/windows/payloads, approved response fields, command/reply correlation, standalone behavior, and listener cleanup. They execute the bridge with a simulated window; they do not replace a browser integration check.

For a live check, load the customer page and confirm initialization, Show/Hide state replies, and visibility events. Send an extra field or unsupported command and confirm that no action or reply occurs. Try a different origin or iframe sender and confirm rejection. Finally unload the plugin and verify it no longer responds. Exercise iframe reload and UI teardown when you add session management to your own application.
