const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const Store = require('electron-store');
const fs = require('fs');
const store = new Store();

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function setupVirtualEnv() {
  const venvPath = path.join(__dirname, '../venv');
  const requirementsPath = path.join(__dirname, '../requirements.txt');

  // Check if venv already exists
  if (!fs.existsSync(venvPath)) {
    console.log('Creating virtual environment...');
    try {
      execSync('python -m venv venv', { cwd: path.join(__dirname, '..') });
    } catch (error) {
      console.error('Failed to create virtual environment:', error);
      throw error;
    }
  }

  // Install requirements
  console.log('Installing requirements...');
  const pipPath = process.platform === 'win32' ? 
    path.join(venvPath, 'Scripts', 'pip') :
    path.join(venvPath, 'bin', 'pip');

  try {
    execSync(`"${pipPath}" install -r "${requirementsPath}"`, { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Failed to install requirements:', error);
    throw error;
  }
}

function startBackend() {
  const pythonPath = process.platform === 'win32' ? 
    path.join(__dirname, '../venv/Scripts/python') :
    path.join(__dirname, '../venv/bin/python');

  backendProcess = spawn(pythonPath, [path.join(__dirname, '../main.py')]);

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend stdout: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend stderr: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  try {
    setupVirtualEnv();
    createWindow();
    startBackend();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// IPC handlers for settings
ipcMain.handle('get-settings', () => {
  return {
    pythonPath: store.get('pythonPath'),
    hfToken: store.get('hfToken')
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set(settings);
  return true;
}); 