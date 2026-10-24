import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('appInfo', {
  name: 'Electron React Vite'
})
