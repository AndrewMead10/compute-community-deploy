const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const si = require('systeminformation');
const db = require('./database');
const https = require('https');

// Model recommendations data  – last refreshed 20 Apr 2025
const MODEL_RECOMMENDATIONS = {
  tiny: {                 // <5 B params
    name: "<5 B parameters",
    min_ram: 8,           // GB
    models: [
      {
        name: "TinyLlama‑1.1B‑Chat",
        repo: "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
        file: "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf",
        params_b: 1.1,
        file_size_gb: 0.67,
        ram_required: 3.17,
        quant: "Q4_K_M",
        description: "Good baseline chat model that fits in ~3 GB of RAM – perfect for laptops."
      },
      {
        name: "Phi‑2 (2.7 B)",
        repo: "TheBloke/phi-2-GGUF",
        file: "phi-2.Q4_K_M.gguf",
        params_b: 2.7,
        file_size_gb: 1.79,
        ram_required: 4.29,
        quant: "Q4_K_M",
        description: "Small Microsoft research model with surprisingly strong reasoning."
      },
      {
        name: "Gemma‑2B‑It",
        repo: "MaziyarPanahi/gemma-2b-it-GGUF",
        file: "gemma-2b-it.Q4_K_M.gguf",
        params_b: 2.0,
        file_size_gb: 1.63,
        ram_required: 4.0,          // calculated ≈ 2.5× file size
        quant: "Q4_K_M",
        description: "Google’s compact instruction‑tuned Gemma, extended 32 k context."
      }
    ]
  },

  small: {                // 5‑10 B
    name: "5‑10 B parameters",
    min_ram: 16,
    models: [
      {
        name: "Mistral‑7B‑Instruct‑v0.2",
        repo: "TheBloke/Mistral-7B-Instruct-v0.2-GGUF",
        file: "mistral-7b-instruct-v0.2.Q4_K_M.gguf",
        params_b: 7,
        file_size_gb: 4.37,
        ram_required: 6.87,
        quant: "Q4_K_M",
        description: "Fast, high‑quality 7 B model – great all‑rounder on 16 GB RAM machines."
      },
      {
        name: "Stable‑Beluga‑7B",
        repo: "TheBloke/StableBeluga-7B-GGUF",
        file: "stablebeluga-7b.Q4_K_M.gguf",
        params_b: 7,
        file_size_gb: 4.40,
        ram_required: 7.0,
        quant: "Q4_K_M",
        description: "Stability AI fine‑tune focused on creative chat‑style responses."
      },
      {
        name: "Gemma‑7B‑It",
        repo: "google/gemma-7b-it-GGUF",
        file: "gemma-7b-it.Q4_K_M.gguf",
        params_b: 7,
        file_size_gb: 4.55,
        ram_required: 7.2,
        quant: "Q4_K_M",
        description: "Latest Google Gemma – strong instruction following, long context (32 k)."
      }
    ]
  },

  medium: {               // 10‑20 B
    name: "10‑20 B parameters",
    min_ram: 32,
    models: [
      {
        name: "CodeLlama‑13B‑Instruct",
        repo: "TheBloke/CodeLlama-13B-Instruct-GGUF",
        file: "codellama-13b-instruct.Q4_K_M.gguf",
        params_b: 13,
        file_size_gb: 7.87,
        ram_required: 10.37,
        quant: "Q4_K_M",
        description: "Meta’s coding specialist – needs ~10 GB system RAM or VRAM."
      },
      {
        name: "Llama‑2‑13B‑Chat",
        repo: "TheBloke/Llama-2-13B-chat-GGUF",
        file: "llama-2-13b-chat.Q4_K_M.gguf",
        params_b: 13,
        file_size_gb: 7.87,
        ram_required: 10.37,
        quant: "Q4_K_M",
        description: "Solid general‑purpose assistant, strong factual grounding."
      }
    ]
  },

  large: {                // 20‑35 B
    name: "20‑35 B parameters",
    min_ram: 48,
    models: [
      {
        name: "Llama‑2‑34B‑Chat (OpenBuddy)",
        repo: "TheBloke/openbuddy-llama2-34b-v11.1-bf16-GGUF",
        file: "openbuddy-llama2-34b-v11.1-bf16.Q4_K_M.gguf",
        params_b: 34,
        file_size_gb: 20.28,
        ram_required: 22.78,
        quant: "Q4_K_M",
        description: "Powerful 34 B model with rich knowledge and balanced personality."
      }
    ]
  },

  xlarge: {               // 35 B+
    name: "35 B+ parameters",
    min_ram: 64,
    models: [
      {
        name: "Llama‑2‑70B‑Chat",
        repo: "TheBloke/Llama-2-70B-Chat-GGUF",
        file: "llama-2-70b-chat.Q4_K_M.gguf",
        params_b: 70,
        file_size_gb: 41.42,
        ram_required: 43.92,
        quant: "Q4_K_M",
        description: "Flagship 70 B model – needs ~44 GB RAM or split across CPU+GPU."
      }
    ]
  }
};

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
      if (gpuController && gpuController.memoryTotal) {
        gpuMemoryGB = Math.round(gpuController.memoryTotal / 1024); // Convert MB to GB
      }
    }

    // Calculate available memory based on allocation settings
    const effectiveRamGB = memorySettings?.cpu ? Math.floor(totalRamGB * memorySettings.cpu) : totalRamGB;
    const effectiveGpuGB = memorySettings?.gpu ? Math.floor(gpuMemoryGB * memorySettings.gpu) : gpuMemoryGB;

    // Filter recommendations based on available memory and current backend
    const recommendations = {};
    for (const [size, data] of Object.entries(MODEL_RECOMMENDATIONS)) {
      const isGPUBackend = backend && ['CUDA', 'METAL'].includes(backend);
      const availableMemory = isGPUBackend ? effectiveGpuGB : effectiveRamGB;
      const memoryRequired = isGPUBackend ? Math.ceil(data.min_ram / 2) : data.min_ram; // GPU typically needs half the RAM

      if (availableMemory >= memoryRequired) {
        recommendations[size] = {
          ...data,
          suitable: true,
          reason: `Suitable for your hardware with current allocation (${availableMemory}GB ${isGPUBackend ? 'GPU' : 'RAM'} available, needs ${memoryRequired}GB)`
        };
      } else {
        recommendations[size] = {
          ...data,
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