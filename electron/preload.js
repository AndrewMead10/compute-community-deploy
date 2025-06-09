const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  runModel: (options) => ipcRenderer.invoke('run-model', options),
  getUsers: () => ipcRenderer.invoke('get-users'),
  getUsageStats: () => ipcRenderer.invoke('get-usage-stats'),
  addApiKey: (userData) => ipcRenderer.invoke('add-api-key', userData),
  deleteUser: (userId) => ipcRenderer.invoke('delete-user', userId),
  fetchHfModels: (repoId) => ipcRenderer.invoke('fetch-hf-models', repoId),
  getModelRecommendations: (options) => ipcRenderer.invoke('get-model-recommendations', options),
  
  // P2P Backend APIs
  startP2PBackend: () => ipcRenderer.invoke('start-p2p-backend'),
  stopP2PBackend: () => ipcRenderer.invoke('stop-p2p-backend'),
  getP2PStatus: () => ipcRenderer.invoke('get-p2p-status'),
  
  // Event listeners
  onSetupOutput: (callback) => {
    ipcRenderer.on('setup-output', (_, data) => callback(data));
  },
  onSetupError: (callback) => {
    ipcRenderer.on('setup-error', (_, data) => callback(data));
  },
  onP2PPeerConnected: (callback) => {
    ipcRenderer.on('p2p-peer-connected', (_, peerId) => callback(peerId));
  },
  onP2PPeerDisconnected: (callback) => {
    ipcRenderer.on('p2p-peer-disconnected', (_, peerId) => callback(peerId));
  },
  onP2PError: (callback) => {
    ipcRenderer.on('p2p-error', (_, error) => callback(error));
  },
  onP2PStatusUpdate: (callback) => {
    ipcRenderer.on('p2p-status-update', (_, status) => callback(status));
  }
}
); 