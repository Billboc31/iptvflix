import { EventEmitter } from 'node:events'

const emitter = new EventEmitter()
emitter.setMaxListeners(0)

export function emitCommandForDevice(deviceId: string, commandId: string): void {
  emitter.emit(`command:${deviceId}`, commandId)
}

export function onCommandForDevice(
  deviceId: string,
  listener: (commandId: string) => void,
): () => void {
  emitter.on(`command:${deviceId}`, listener)
  return () => emitter.off(`command:${deviceId}`, listener)
}
