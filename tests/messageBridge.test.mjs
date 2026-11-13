import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../src/messageBridge.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText

function setup(embedded = true) {
    const sent = []
    const listeners = new Set()
    const parent = { postMessage: (data, origin) => sent.push({ data, origin }) }
    const window = {
        parent,
        addEventListener: (type, fn) => { assert.equal(type, 'message'); listeners.add(fn) },
        removeEventListener: (type, fn) => { assert.equal(type, 'message'); listeners.delete(fn) },
    }
    if (!embedded) window.parent = window
    const exports = {}
    runInNewContext(compiled, { exports, window, URL })
    return { ...exports, parent, sent, listeners }
}

const origin = 'https://customer.example.com'
const command = { channel: 'clonedspaces-example', version: 1, id: 'test-1', type: 'set-cube-visible', visible: false }

test('origin configuration rejects wildcards, opaque origins, paths and credentials', () => {
    const { readParentOrigin } = setup()
    assert.equal(readParentOrigin(undefined), undefined)
    assert.equal(readParentOrigin(origin), origin)
    for (const value of ['*', 'null', 'file:///tmp/a', origin + '/', origin + '/path', 'https://user:pass@customer.example.com', 42]) {
        assert.throws(() => readParentOrigin(value))
    }
})

test('only validated parent commands mutate state; outgoing payloads contain approved fields only', () => {
    const bridge = setup()
    let visible = true
    let calls = 0
    const handle = bridge.createMessageBridge(origin, {
        isCubeVisible: () => visible,
        setCubeVisible: value => { visible = value; calls++ },
    })
    const dispatch = (data, eventOrigin = origin, source = bridge.parent) => {
        for (const fn of bridge.listeners) fn({ data, origin: eventOrigin, source })
    }
    dispatch(command, 'https://attacker.example.com')
    dispatch(command, origin, {})
    for (const invalid of [null, [], {}, { ...command, version: 2 }, { ...command, visible: 'false' },
        { ...command, type: 'workspace' }, { ...command, id: '' }, { ...command, id: 'x'.repeat(65) },
        { ...command, workspace: {} }]) dispatch(invalid)
    assert.equal(calls, 0)
    assert.equal(bridge.sent.length, 1)
    dispatch(command)
    assert.equal(calls, 1)
    assert.equal(visible, false)
    const { visible: unused, ...getState } = command
    dispatch({ ...getState, type: 'get-state' })
    // JSON conversion removes VM realm prototypes for deep comparison.
    assert.deepEqual(JSON.parse(JSON.stringify(bridge.sent)), [
        { origin, data: { channel: command.channel, version: 1, type: 'ready' } },
        { origin, data: { channel: command.channel, version: 1, type: 'cube-visibility-changed', cubeVisible: false } },
        { origin, data: { channel: command.channel, version: 1, type: 'state', id: 'test-1', cubeVisible: false } },
        { origin, data: { channel: command.channel, version: 1, type: 'state', id: 'test-1', cubeVisible: false } },
    ])
    handle.destroy()
    assert.equal(bridge.listeners.size, 0)
    dispatch(command)
    assert.equal(calls, 1)
})

test('standalone viewer does not install a listener or send messages', () => {
    const bridge = setup(false)
    bridge.createMessageBridge(origin, { isCubeVisible: () => true, setCubeVisible: () => assert.fail() }).destroy()
    assert.equal(bridge.listeners.size, 0)
    assert.equal(bridge.sent.length, 0)
})
