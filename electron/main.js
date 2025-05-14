const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const si = require('systeminformation');
const db = require('./database');
const https = require('https');
const { MODEL_RECOMMENDATIONS } = require('./models');

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

ipcMain.handle('run-model', async (event, { backend, modelId, memorySettings }) => {
  return new Promise((resolve) => {
    let serverProcess;

    // Execute the setup.sh script with the backend, model ID, and memory settings as arguments
    const setupProcess = exec(
      `bash "${path.join(__dirname, 'setup.sh')}" "${backend}" "${modelId}" "${memorySettings.cpu || 0}" "${memorySettings.gpu || 0}"`,
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

        // Start the run.sh script to run the server with memory settings
        serverProcess = exec(
          `bash "${path.join(__dirname, 'run.sh')}" "${backend}" "${modelId}" "${memorySettings.cpu || 0}" "${memorySettings.gpu || 0}"`,
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