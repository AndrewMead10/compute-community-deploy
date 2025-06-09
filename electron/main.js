const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const si = require('systeminformation');
const db = require('./database');
const https = require('https');
const { MODEL_RECOMMENDATIONS } = require('./models');
const { P2PBackend } = require('./p2p-backend');

let mainWindow;
let p2pBackend = null;

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

ipcMain.handle('run-model', async (event, { backend, modelId, memorySettings }) => {
  return new Promise((resolve) => {
    let serverProcess;

    // Step 1: Set up Python environment
    mainWindow.webContents.send('setup-output', "Setting up Python environment...\n");
    
    const pythonSetupProcess = exec(
      `bash "${path.join(__dirname, '..', 'scripts', 'setup_python.sh')}"`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error setting up Python environment: ${error}`);
          mainWindow.webContents.send('setup-error', `Error setting up Python: ${error.message}\n`);
          resolve({ success: false, error: error.message });
          return;
        }

        console.log(`Python setup output: ${stdout}`);
        if (stderr) console.error(`Python setup stderr: ${stderr}`);

        // Step 2: Download llamafile and model
        mainWindow.webContents.send('setup-output', "Downloading llamafile server and model...\n");
        
        const downloadProcess = exec(
          `bash "${path.join(__dirname, '..', 'scripts', 'download.sh')}" "${modelId}"`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error downloading files: ${error}`);
              mainWindow.webContents.send('setup-error', `Error downloading: ${error.message}\n`);
              resolve({ success: false, error: error.message });
              return;
            }

            console.log(`Download output: ${stdout}`);
            if (stderr) console.error(`Download stderr: ${stderr}`);

            // Step 3: Start the servers
            mainWindow.webContents.send('setup-output', "Starting llamafile server and middleware...\n");

            serverProcess = exec(
              `bash "${path.join(__dirname, '..', 'scripts', 'run.sh')}" "${backend}" "${modelId}" "${memorySettings.cpu || 0}" "${memorySettings.gpu || 0}"`,
              (error, stdout, stderr) => {
                if (error) {
                  console.error(`Error executing run script: ${error}`);
                  mainWindow.webContents.send('setup-error', `Error starting servers: ${error.message}\n`);
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

            // Resolve after starting the servers
            resolve({ success: true, message: "Servers started successfully" });
          }
        );

        // Stream download output to the renderer process
        downloadProcess.stdout.on('data', (data) => {
          mainWindow.webContents.send('setup-output', data.toString());
        });

        downloadProcess.stderr.on('data', (data) => {
          mainWindow.webContents.send('setup-error', data.toString());
        });
      }
    );

    // Stream Python setup output to the renderer process
    pythonSetupProcess.stdout.on('data', (data) => {
      mainWindow.webContents.send('setup-output', data.toString());
    });

    pythonSetupProcess.stderr.on('data', (data) => {
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

ipcMain.handle('fetch-hf-models', async (event, repoId) => {
  return new Promise((resolve, reject) => {
    if (!repoId || !repoId.includes('/')) {
      resolve({ success: false, error: 'Invalid repository ID' });
      return;
    }

    const options = {
      hostname: 'huggingface.co',
      path: `/api/models/${repoId}/tree/main`,
      method: 'GET',
      headers: {
        'User-Agent': 'Electron LLM Runner'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({
            success: false,
            error: `Failed to fetch models: HTTP ${res.statusCode}`
          });
          return;
        }

        try {
          const files = JSON.parse(data);
          // Filter for GGUF files only
          const ggufModels = files.filter(file =>
            file.type === 'file' &&
            file.path.toLowerCase().endsWith('.gguf')
          ).map(file => ({
            name: file.path,
            size: file.size,
            lastModified: file.lastCommit
          }));

          resolve({
            success: true,
            models: ggufModels
          });
        } catch (error) {
          console.error('Error parsing HF API response:', error);
          resolve({
            success: false,
            error: `Failed to parse response: ${error.message}`
          });
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error fetching HF models:', error);
      resolve({
        success: false,
        error: `Network error: ${error.message}`
      });
    });

    req.end();
  });
});

// Add new IPC handler for model recommendations
ipcMain.handle('get-model-recommendations', async (event, { backend, memorySettings } = {}) => {
  try {
    // Ensure backend has a default value
    backend = backend || 'CPU';

    const [cpu, mem, gpu] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.graphics()
    ]);

    const totalRamGB = Math.round(mem.total / (1024 * 1024 * 1024));
    const hasGPU = gpu.controllers.some(controller =>
      controller.model && (
        controller.model.toLowerCase().includes('nvidia') ||
        controller.model.toLowerCase().includes('amd') ||
        controller.model.toLowerCase().includes('apple')
      )
    );

    // Get available GPU memory (if any)
    let gpuMemoryGB = 0;
    if (hasGPU) {
      const gpuController = gpu.controllers.find(controller =>
        controller.model && (
          controller.model.toLowerCase().includes('nvidia') ||
          controller.model.toLowerCase().includes('amd') ||
          controller.model.toLowerCase().includes('apple')
        )
      );
      if (gpuController && gpuController.vram) {
        gpuMemoryGB = Math.round(gpuController.vram / 1024); // Convert MB to GB
      }
    }

    // Calculate available memory based on allocation settings
    const effectiveRamGB = memorySettings?.cpu ? Math.floor(totalRamGB * memorySettings.cpu / 100) : totalRamGB;
    const effectiveGpuGB = memorySettings?.gpu ? Math.floor(gpuMemoryGB * memorySettings.gpu / 100) : gpuMemoryGB;

    // Filter recommendations based on available memory and current backend
    const isGPUBackend = backend && ['CUDA', 'METAL'].includes(backend);
    const recommendations = {};

    for (const [size, data] of Object.entries(MODEL_RECOMMENDATIONS)) {
      const availableMemory = isGPUBackend ? effectiveGpuGB : effectiveRamGB;
      const memoryRequired = isGPUBackend ? Math.ceil(data.min_ram / 2) : data.min_ram; // GPU typically needs half the RAM

      if (availableMemory >= memoryRequired) {
        // Create a copy of the data with processed models for the current backend
        const processedData = { ...data, models: [] };

        // Process each model to include only data relevant to the current backend
        for (const model of data.models) {
          const backendType = isGPUBackend ? 'gpu' : 'cpu';
          const backendData = model[backendType];

          if (backendData) {
            // Create a processed model with only the backend-specific data
            const processedModel = {
              name: model.name,
              params_b: model.params_b,
              description: model.description,
              ram_required: backendData.ram_required,
              repo: backendData.repo
            };

            // For CPU backend, also include file information
            if (backendType === 'cpu') {
              processedModel.file = backendData.file;
              processedModel.file_size_gb = backendData.file_size_gb;
              processedModel.quant = backendData.quant;
            }

            processedData.models.push(processedModel);
          }
        }

        recommendations[size] = {
          ...processedData,
          suitable: true,
          reason: `Suitable for your hardware with current allocation (${availableMemory}GB ${isGPUBackend ? 'GPU' : 'RAM'} available, needs ${memoryRequired}GB)`
        };
      } else {
        // Deep clone the data to prevent modification of unsuitable models
        const clonedData = JSON.parse(JSON.stringify(data));

        // Only include GPU or CPU models based on the backend
        if (clonedData.models) {
          clonedData.models = clonedData.models.map(model => {
            const backendType = isGPUBackend ? 'gpu' : 'cpu';
            const backendData = model[backendType];

            if (!backendData) return null;

            const processedModel = {
              name: model.name,
              params_b: model.params_b,
              description: model.description,
              ram_required: backendData.ram_required,
              repo: backendData.repo
            };

            if (backendType === 'cpu') {
              processedModel.file = backendData.file;
              processedModel.file_size_gb = backendData.file_size_gb;
              processedModel.quant = backendData.quant;
            }

            return processedModel;
          }).filter(model => model !== null);
        }

        recommendations[size] = {
          ...clonedData,
          suitable: false,
          reason: `Requires ${memoryRequired}GB ${isGPUBackend ? 'GPU memory' : 'RAM'} (you have ${availableMemory}GB allocated)`
        };
      }
    }

    return {
      recommendations,
      system: {
        ram: effectiveRamGB,
        hasGPU,
        gpuMemory: effectiveGpuGB
      }
    };
  } catch (error) {
    console.error('Error getting model recommendations:', error);
    return { error: 'Failed to get model recommendations' };
  }
});

// P2P Backend IPC handlers
ipcMain.handle('start-p2p-backend', async (event, options = {}) => {
  try {
    if (p2pBackend && p2pBackend.isRunning) {
      // Return current status instead of throwing error
      const status = p2pBackend.getStatus();
      return {
        success: true,
        alreadyRunning: true,
        peerId: status.peerId,
        multiaddrs: status.multiaddrs,
        shareableUrl: p2pBackend.generateShareableUrl(status.peerId),
        connections: status.connections
      };
    }

    // Create new P2P backend instance with default settings
    p2pBackend = new P2PBackend({
      onPeerConnect: (peerId) => {
        mainWindow.webContents.send('p2p-peer-connected', peerId);
      },
      onPeerDisconnect: (peerId) => {
        mainWindow.webContents.send('p2p-peer-disconnected', peerId);
      },
      onError: (error) => {
        console.error('P2P Backend error:', error);
        mainWindow.webContents.send('p2p-error', error.toString());
      },
      onStatusUpdate: (status) => {
        mainWindow.webContents.send('p2p-status-update', status);
      }
    });

    const result = await p2pBackend.start();
    
    // Copy shareable URL to clipboard
    if (result.shareableUrl) {
      clipboard.writeText(result.shareableUrl);
    }

    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('Error starting P2P backend:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('stop-p2p-backend', async () => {
  try {
    if (p2pBackend) {
      await p2pBackend.stop();
      p2pBackend = null;
    }
    return { success: true };
  } catch (error) {
    console.error('Error stopping P2P backend:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('get-p2p-status', async () => {
  try {
    if (!p2pBackend) {
      return {
        isRunning: false,
        connections: 0
      };
    }
    return p2pBackend.getStatus();
  } catch (error) {
    console.error('Error getting P2P status:', error);
    return {
      isRunning: false,
      connections: 0,
      error: error.message
    };
  }
});

// Handle app quit to stop P2P backend
app.on('before-quit', async () => {
  if (p2pBackend) {
    try {
      await p2pBackend.stop();
    } catch (error) {
      console.error('Error stopping P2P backend on quit:', error);
    }
  }
}); 