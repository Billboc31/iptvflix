import { EventEmitter } from 'node:events';
const emitter = new EventEmitter();
emitter.setMaxListeners(0);
export function emitCommandForDevice(deviceId, commandId) {
    emitter.emit(`command:${deviceId}`, commandId);
}
export function onCommandForDevice(deviceId, listener) {
    emitter.on(`command:${deviceId}`, listener);
    return () => emitter.off(`command:${deviceId}`, listener);
}
//# sourceMappingURL=device-events.js.map