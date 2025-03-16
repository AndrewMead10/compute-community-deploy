const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const si = require('systeminformation');
const db = require('./database');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
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
    const [cpu, cpuLoad, gpu, mem, os] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.graphics(),
      si.mem(),
      si.osInfo()
    ]);
    
    return {
      cpu: {
        model: cpu.manufacturer + ' ' + cpu.brand,
        cores: cpu.cores,
        speed: cpu.speed,
        usage: Math.round(cpuLoad.currentLoad)
      },
      gpu: gpu.controllers.map(controller => ({
        model: controller.model,
        vram: controller.vram,
        memoryUsage: controller.memoryUsed ? Math.round((controller.memoryUsed / controller.vram) * 100) : null
      })),
      memory: {
        total: Math.round(mem.total / (1024 * 1024 * 1024)), // Convert to GB
        free: Math.round(mem.free / (1024 * 1024 * 1024)),
        used: Math.round((mem.total - mem.free) / (1024 * 1024 * 1024))
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
    let serverProcess;
    
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
        
        // After setup is complete, start the server
        mainWindow.webContents.send('setup-output', "Setup complete. Starting server...\n");
        
        // Start the run.sh script to run the server
        serverProcess = exec(`bash ${path.join(__dirname, 'run.sh')} ${backend} ${modelId}`, 
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error executing run script: ${error}`);
              mainWindow.webContents.send('setup-error', `Error starting server: ${error.message}\n`);
              resolve({ success: false, error: error.message });
              return;
            }
          }
        );
        
        // Stream server output to the renderer process
        serverProcess.stdout.on('data', (data) => {
          mainWindow.webContents.send('setup-output', data.toString());
        });
        
        serverProcess.stderr.on('data', (data) => {
          mainWindow.webContents.send('setup-error', data.toString());
        });
        
        // Resolve after starting the server
        resolve({ success: true, message: "Server started successfully" });
      }
    );
    
    // Stream setup output to the renderer process
    setupProcess.stdout.on('data', (data) => {
      mainWindow.webContents.send('setup-output', data.toString());
    });
    
    setupProcess.stderr.on('data', (data) => {
      mainWindow.webContents.send('setup-error', data.toString());
    });
    
    // Handle app quit to kill the server process
    app.on('before-quit', () => {
      if (serverProcess) {
        serverProcess.kill();
      }
    });
  });
});

// User management functions
ipcMain.handle('get-users', async () => {
  try {
    return await db.getUsers();
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
});

ipcMain.handle('add-api-key', async (event, { name, key }) => {
  try {
    await db.addUser(name, key);
    return await db.getUsers();
  } catch (error) {
    console.error('Error adding API key:', error);
    throw error;
  }
});

ipcMain.handle('delete-user', async (event, userId) => {
  try {
    await db.deleteUser(userId);
    return await db.getUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
});

// Usage statistics functions
ipcMain.handle('get-usage-stats', async () => {
  try {
    return await db.getUsageStats();
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return {};
  }
}); 