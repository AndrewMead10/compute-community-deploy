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
  getRecentModels: (limit) => ipcRenderer.invoke('get-recent-models', limit),
  deleteRecentModel: (modelId) => ipcRenderer.invoke('delete-recent-model', modelId),
  onSetupOutput: (callback) => {
    ipcRenderer.on('setup-output', (_, data) => callback(data));
  },
  onSetupError: (callback) => {
    ipcRenderer.on('setup-error', (_, data) => callback(data));
  }
}
); 