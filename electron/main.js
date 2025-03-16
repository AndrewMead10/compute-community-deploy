const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const si = require('systeminformation');
const Store = require('electron-store');

// Initialize the store for saving user data
const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // Open DevTools in development
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

// IPC handlers for communication with renderer process
ipcMain.handle('get-system-info', async () => {
  try {
    const [cpu, gpu, mem, os] = await Promise.all([
      si.cpu(),
      si.graphics(),
      si.mem(),
      si.osInfo()
    ]);
    
    return {
      cpu: {
        model: cpu.manufacturer + ' ' + cpu.brand,
        cores: cpu.cores,
        speed: cpu.speed
      },
      gpu: gpu.controllers.map(controller => ({
        model: controller.model,
        vram: controller.vram
      })),
      memory: {
        total: Math.round(mem.total / (1024 * 1024 * 1024)), // Convert to GB
        free: Math.round(mem.free / (1024 * 1024 * 1024))
      },
      os: {
        platform: os.platform,
        distro: os.distro,
        release: os.release,
        arch: os.arch
      }
    };
  } catch (error) {
    console.error('Error getting system info:', error);
    return { error: 'Failed to get system information' };
  }
});

ipcMain.handle('run-model', async (event, { backend, modelId }) => {
  return new Promise((resolve) => {
    // Execute the setup.sh script with the backend and model ID as arguments
    const setupProcess = exec(`bash ${path.join(__dirname, 'setup.sh')} ${backend} ${modelId}`, 
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing setup script: ${error}`);
          resolve({ success: false, error: error.message });
          return;
        }
        
        console.log(`Setup script output: ${stdout}`);
        if (stderr) console.error(`Setup script stderr: ${stderr}`);
        
        resolve({ success: true, output: stdout });
      }
    );
    
    // Stream output to the renderer process
    setupProcess.stdout.on('data', (data) => {
      mainWindow.webContents.send('setup-output', data.toString());
    });
    
    setupProcess.stderr.on('data', (data) => {
      mainWindow.webContents.send('setup-error', data.toString());
    });
  });
});

// User management functions
ipcMain.handle('get-users', async () => {
  // Placeholder for getting users from the store
  return store.get('users', []);
});

ipcMain.handle('add-api-key', async (event, { name, key }) => {
  const users = store.get('users', []);
  users.push({ name, key, createdAt: new Date().toISOString() });
  store.set('users', users);
  return users;
});

ipcMain.handle('delete-user', async (event, userId) => {
  const users = store.get('users', []);
  const updatedUsers = users.filter((user, index) => index !== userId);
  store.set('users', updatedUsers);
  return updatedUsers;
}); 