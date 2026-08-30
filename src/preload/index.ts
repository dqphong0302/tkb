import { contextBridge, ipcRenderer } from 'electron'

const EVENT_CHANNELS = ['solver:event']

const api = {
  invoke: (channel: string, payload?: unknown): Promise<unknown> =>
    ipcRenderer.invoke(channel, payload),
  on: (channel: string, cb: (data: unknown) => void): (() => void) => {
    if (!EVENT_CHANNELS.includes(channel)) return () => {}
    const listener = (_event: unknown, data: unknown): void => cb(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type PreloadApi = typeof api
