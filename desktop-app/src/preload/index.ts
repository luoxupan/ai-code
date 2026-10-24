import { contextBridge, ipcRenderer } from 'electron'
import type { ChatSocketSession, ChatSocketStatus } from '../main/chatSocket'

type ChatSocketMessage = unknown

const subscribe = (channel: string, callback: (payload: any) => void) => {
  const listener = (_event: Electron.IpcRendererEvent, payload: any) => {
    callback(payload);
  };

  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('appInfo', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
})

contextBridge.exposeInMainWorld('chatSocket', {
  setSessionInfo: (session: ChatSocketSession) => ipcRenderer.invoke('chat-socket:set-session-info', session),
  getStatus: () => ipcRenderer.invoke('chat-socket:get-status'),
  connect: () => ipcRenderer.invoke('chat-socket:connect'),
  sendMessage: (message: ChatSocketMessage) => ipcRenderer.invoke('chat-socket:send-message', message),
  onMessage: (callback: (message: ChatSocketMessage) => void) => subscribe('chat-socket:message', callback),
  onStatusChange: (callback: (status: ChatSocketStatus) => void) => subscribe('chat-socket:status', callback)
})
