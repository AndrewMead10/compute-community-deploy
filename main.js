const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const si = require('systeminformation');

// Initialize store for saving settings
const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Uncomment for development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle hardware detection requests from renderer
ipcMain.handle('get-hardware-info', async () => {
  try {
    const [cpu, mem, graphics] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.graphics()
    ]);
    
    return {
      cpu,
      mem,
      graphics
    };
  } catch (error) {
    console.error('Error fetching hardware info:', error);
    return { error: error.message };
  }
});

// Handle GPU benchmark request
ipcMain.handle('benchmark-gpu', async () => {
  // This would be replaced with actual GPU benchmarking code
  // For now, we'll return mock data
  return {
    score: Math.floor(Math.random() * 10000) + 5000,
    capabilities: {
      cuda: true,
      tensorCores: Math.random() > 0.5,
      vram: Math.floor(Math.random() * 16) + 4,
      maxBatchSize: 32,
      inferenceSpeed: Math.floor(Math.random() * 100) + 20 + " tokens/sec"
    }
  };
});

// Save peer settings
ipcMain.on('save-peer-settings', (event, settings) => {
  store.set('peerSettings', settings);
});

// Get peer settings
ipcMain.handle('get-peer-settings', () => {
  return store.get('peerSettings', {
    username: '',
    shareGpu: false,
    maxGpuUsage: 80,
    allowedPeers: []
  });
}); 