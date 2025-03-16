const { ipcRenderer } = require('electron');
const Chart = require('chart.js/auto');

// Global variables
let hardwareInfo = {};
let peerSettings = {};
let connectedPeers = [];
let activeTasks = [];
let completedTasks = [];
let isConnected = false;
let networkChart;
let gpuUsageChart;

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const gpuInfoElement = document.getElementById('gpu-info');
const cpuInfoElement = document.getElementById('cpu-info');
const ramInfoElement = document.getElementById('ram-info');
const benchmarkButton = document.getElementById('benchmark-gpu');
const benchmarkResult = document.getElementById('benchmark-result');
const benchmarkScore = document.getElementById('benchmark-score');
const benchmarkDetails = document.getElementById('benchmark-details');
const connectButton = document.getElementById('connect-btn');
const networkStatusIndicator = document.getElementById('network-status-indicator');
const networkStatusText = document.getElementById('network-status-text');
const peersList = document.getElementById('peers-list');
const settingsForm = document.getElementById('settings-form');
const maxGpuUsageSlider = document.getElementById('max-gpu-usage');
const maxGpuValue = document.getElementById('max-gpu-value');
const shareGpuToggle = document.getElementById('share-gpu');
const gpuSettings = document.getElementById('gpu-settings');
const addPeerButton = document.getElementById('add-peer-btn');
const allowedPeersContainer = document.getElementById('allowed-peers');
const taskForm = document.getElementById('task-form');
const activeTasksContainer = document.getElementById('active-tasks');
const completedTasksContainer = document.getElementById('completed-tasks');
const inviteCodeElement = document.getElementById('invite-code');
const copyInviteCodeButton = document.getElementById('copy-invite-code');
const generateNewCodeButton = document.getElementById('generate-new-code');
const taskTypeSelect = document.getElementById('task-type');
const inferenceOptions = document.getElementById('inference-options');
const finetuneOptions = document.getElementById('finetune-options');

// DUMMY DATA SECTION
// ------------------

// Dummy hardware data
const dummyHardwareData = {
  cpu: {
    manufacturer: 'AMD',
    brand: 'Ryzen 9 5900X',
    speed: 3.7,
    cores: 12,
    physicalCores: 12,
    processors: 1
  },
  mem: {
    total: 34359738368, // 32GB
    free: 17179869184,  // 16GB
    used: 17179869184   // 16GB
  },
  graphics: {
    controllers: [
      {
        model: 'NVIDIA GeForce RTX 3080',
        vendor: 'NVIDIA',
        vram: 10240,
        driverVersion: '531.41',
        subDeviceId: '123456',
        temperature: 65
      }
    ],
    displays: [
      {
        connection: 'DisplayPort',
        main: true,
        resolutionX: 2560,
        resolutionY: 1440,
        currentRefreshRate: 144
      }
    ]
  }
};

// Dummy benchmark result
const dummyBenchmark = {
  score: 8750,
  capabilities: {
    cuda: true,
    tensorCores: true,
    vram: 10,
    maxBatchSize: 32,
    inferenceSpeed: "42 tokens/sec"
  }
};

// Dummy peer data
const dummyPeers = [
  {
    id: 'peer1',
    username: 'Alice',
    hardware: {
      gpu: 'NVIDIA RTX 4090',
      vram: 24,
      score: 12500
    },
    status: 'available',
    uptime: '3h 45m'
  },
  {
    id: 'peer2',
    username: 'Bob',
    hardware: {
      gpu: 'AMD Radeon RX 6900 XT',
      vram: 16,
      score: 9200
    },
    status: 'busy',
    uptime: '1h 20m'
  },
  {
    id: 'peer3',
    username: 'Charlie',
    hardware: {
      gpu: 'NVIDIA RTX 3070',
      vram: 8,
      score: 7800
    },
    status: 'available',
    uptime: '5h 10m'
  }
];

// Dummy tasks
const dummyActiveTasks = [
  {
    id: 'task1',
    model: 'llama2-13b',
    type: 'inference',
    status: 'running',
    progress: 45,
    gpu: 'local',
    startTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
    prompt: "Explain quantum computing in simple terms"
  },
  {
    id: 'task2',
    model: 'mistral-7b',
    type: 'finetune',
    status: 'queued',
    progress: 0,
    gpu: 'peer2 (Bob)',
    startTime: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 minutes ago
    dataset: "custom"
  }
];

const dummyCompletedTasks = [
  {
    id: 'task3',
    model: 'llama2-7b',
    type: 'inference',
    status: 'completed',
    gpu: 'peer3 (Charlie)',
    startTime: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    endTime: new Date(Date.now() - 1000 * 60 * 119).toISOString(), // 1 minute after start
    prompt: "Write a short poem about AI",
    result: "In silicon dreams, intelligence grows,\nLearning patterns humans may never know.\nWith every token, with every byte,\nAI expands into the night.\n\nPartner to mankind, not foe nor friend,\nA tool whose purpose we must tend.\nIn this dance of minds both made and born,\nA new kind of wisdom is slowly formed."
  },
  {
    id: 'task4',
    model: 'mixtral-8x7b',
    type: 'finetune',
    status: 'completed',
    gpu: 'local',
    startTime: new Date(Date.now() - 1000 * 60 * 240).toISOString(), // 4 hours ago
    endTime: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 1 hour after start
    dataset: "alpaca",
    result: "Model fine-tuned successfully. Loss: 0.0342, Accuracy: 94.7%"
  }
];

// Dummy GPU usage data for chart
const dummyGpuUsageData = {
  labels: Array.from({length: 20}, (_, i) => i),
  datasets: [{
    label: 'GPU Usage (%)',
    data: Array.from({length: 20}, () => Math.floor(Math.random() * 40) + 30),
    borderColor: 'rgb(74, 108, 247)',
    backgroundColor: 'rgba(74, 108, 247, 0.2)',
    fill: true,
    tension: 0.4
  }]
};

// Dummy network data for chart
const dummyNetworkData = {
  labels: ['You', 'Alice', 'Bob', 'Charlie'],
  datasets: [{
    label: 'GPU Score',
    data: [8750, 12500, 9200, 7800],
    backgroundColor: [
      'rgba(74, 108, 247, 0.7)',
      'rgba(40, 167, 69, 0.7)',
      'rgba(255, 193, 7, 0.7)',
      'rgba(23, 162, 184, 0.7)'
    ],
    borderWidth: 1
  }]
};

// Helper Functions
// ---------------

// Format memory size in GB
function formatMemorySize(bytes) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// Generate random invite code
function generateRandomInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

// Initialize the app
function initApp() {
  // Set up tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(button.dataset.tab).classList.add('active');
    });
  });
  
  // Load hardware info
  loadHardwareInfo();
  
  // Set up GPU usage chart
  setupGpuUsageChart();
  
  // Set up network chart
  setupNetworkChart();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load settings
  loadSettings();
  
  // Load tasks
  loadTasks();
  
  // Generate invite code
  inviteCodeElement.textContent = generateRandomInviteCode();
}

// Load hardware info (using dummy data for now)
function loadHardwareInfo() {
  // In a real app, we would use ipcRenderer.invoke('get-hardware-info')
  // For now, use dummy data
  displayHardwareInfo(dummyHardwareData);
}

// Display hardware info
function displayHardwareInfo(data) {
  hardwareInfo = data;
  
  // Display GPU info
  if (data.graphics && data.graphics.controllers && data.graphics.controllers.length > 0) {
    const gpu = data.graphics.controllers[0];
    gpuInfoElement.innerHTML = `
      <p><strong>Model:</strong> ${gpu.model || 'Unknown'}</p>
      <p><strong>Vendor:</strong> ${gpu.vendor || 'Unknown'}</p>
      <p><strong>VRAM:</strong> ${gpu.vram ? (gpu.vram / 1024).toFixed(2) + ' GB' : 'Unknown'}</p>
      <p><strong>Driver Version:</strong> ${gpu.driverVersion || 'Unknown'}</p>
      ${gpu.temperature ? `<p><strong>Temperature:</strong> ${gpu.temperature}°C</p>` : ''}
    `;
  } else {
    gpuInfoElement.innerHTML = '<p>No GPU detected</p>';
  }
  
  // Display CPU info
  if (data.cpu) {
    cpuInfoElement.innerHTML = `
      <p><strong>Manufacturer:</strong> ${data.cpu.manufacturer || 'Unknown'}</p>
      <p><strong>Model:</strong> ${data.cpu.brand || 'Unknown'}</p>
      <p><strong>Speed:</strong> ${data.cpu.speed ? data.cpu.speed + ' GHz' : 'Unknown'}</p>
      <p><strong>Cores:</strong> ${data.cpu.cores || 'Unknown'} (Physical: ${data.cpu.physicalCores || 'Unknown'})</p>
    `;
  } else {
    cpuInfoElement.innerHTML = '<p>No CPU information available</p>';
  }
  
  // Display RAM info
  if (data.mem) {
    ramInfoElement.innerHTML = `
      <p><strong>Total Memory:</strong> ${formatMemorySize(data.mem.total)}</p>
      <p><strong>Used Memory:</strong> ${formatMemorySize(data.mem.used)} (${Math.round(data.mem.used / data.mem.total * 100)}%)</p>
      <p><strong>Free Memory:</strong> ${formatMemorySize(data.mem.free)}</p>
    `;
  } else {
    ramInfoElement.innerHTML = '<p>No memory information available</p>';
  }
}

// Set up GPU usage chart
function setupGpuUsageChart() {
  const ctx = document.getElementById('gpu-usage-chart').getContext('2d');
  gpuUsageChart = new Chart(ctx, {
    type: 'line',
    data: dummyGpuUsageData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Usage %'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time (s)'
          }
        }
      }
    }
  });
  
  // Simulate real-time updates
  setInterval(() => {
    const data = gpuUsageChart.data.datasets[0].data;
    data.shift();
    data.push(Math.floor(Math.random() * 40) + 30);
    gpuUsageChart.update();
  }, 2000);
}

// Set up network chart
function setupNetworkChart() {
  const ctx = document.getElementById('network-chart').getContext('2d');
  networkChart = new Chart(ctx, {
    type: 'bar',
    data: dummyNetworkData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'GPU Score'
          }
        }
      }
    }
  });
}

// Set up event listeners
function setupEventListeners() {
  // Benchmark GPU button
  benchmarkButton.addEventListener('click', async () => {
    benchmarkButton.disabled = true;
    benchmarkButton.textContent = 'Benchmarking...';
    
    try {
      // In a real app, we would use ipcRenderer.invoke('benchmark-gpu')
      // For now, use dummy data with a delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      const result = dummyBenchmark;
      
      benchmarkScore.textContent = result.score;
      
      let detailsHtml = '';
      for (const [key, value] of Object.entries(result.capabilities)) {
        detailsHtml += `<p class="benchmark-detail"><strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value}</p>`;
      }
      
      benchmarkDetails.innerHTML = detailsHtml;
      benchmarkResult.classList.remove('hidden');
    } catch (error) {
      console.error('Benchmark error:', error);
      alert('Error during benchmark: ' + error.message);
    } finally {
      benchmarkButton.disabled = false;
      benchmarkButton.textContent = 'Benchmark GPU';
    }
  });
  
  // Connect button
  connectButton.addEventListener('click', () => {
    if (isConnected) {
      // Disconnect logic
      isConnected = false;
      networkStatusIndicator.classList.remove('connected');
      networkStatusText.textContent = 'Disconnected';
      connectButton.textContent = 'Connect';
      peersList.innerHTML = '<p class="empty-message">No peers connected. Invite friends to join!</p>';
    } else {
      // Connect logic (using dummy data)
      isConnected = true;
      networkStatusIndicator.classList.add('connected');
      networkStatusText.textContent = 'Connected';
      connectButton.textContent = 'Disconnect';
      
      // Display dummy peers
      displayPeers(dummyPeers);
    }
  });
  
  // Settings form
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(settingsForm);
    const settings = {
      username: formData.get('username'),
      shareGpu: formData.get('shareGpu') === 'on',
      maxGpuUsage: parseInt(formData.get('maxGpuUsage')),
      apiEndpoint: formData.get('apiEndpoint'),
      allowedPeers: peerSettings.allowedPeers || []
    };
    
    // Save settings
    peerSettings = settings;
    // In a real app, we would use ipcRenderer.send('save-peer-settings', settings)
    
    alert('Settings saved successfully!');
  });
  
  // Max GPU usage slider
  maxGpuUsageSlider.addEventListener('input', () => {
    maxGpuValue.textContent = maxGpuUsageSlider.value + '%';
  });
  
  // Share GPU toggle
  shareGpuToggle.addEventListener('change', () => {
    gpuSettings.style.display = shareGpuToggle.checked ? 'block' : 'none';
  });
  
  // Add peer button
  addPeerButton.addEventListener('click', () => {
    const peerId = prompt('Enter peer ID or username:');
    if (peerId && peerId.trim()) {
      if (!peerSettings.allowedPeers) {
        peerSettings.allowedPeers = [];
      }
      
      peerSettings.allowedPeers.push(peerId.trim());
      displayAllowedPeers();
    }
  });
  
  // Task type select
  taskTypeSelect.addEventListener('change', () => {
    if (taskTypeSelect.value === 'inference') {
      inferenceOptions.classList.remove('hidden');
      finetuneOptions.classList.add('hidden');
    } else {
      inferenceOptions.classList.add('hidden');
      finetuneOptions.classList.remove('hidden');
    }
  });
  
  // Task form
  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = new FormData(taskForm);
    const task = {
      id: 'task' + (activeTasks.length + completedTasks.length + 1),
      model: formData.get('model'),
      type: formData.get('taskType'),
      status: 'queued',
      progress: 0,
      gpu: formData.get('gpuPreference'),
      startTime: new Date().toISOString()
    };
    
    if (task.type === 'inference') {
      task.prompt = formData.get('prompt');
    } else {
      task.dataset = formData.get('dataset');
    }
    
    // Add task to active tasks
    activeTasks.push(task);
    displayActiveTasks();
    
    // Reset form
    taskForm.reset();
    inferenceOptions.classList.remove('hidden');
    finetuneOptions.classList.add('hidden');
    
    // Simulate task progress
    simulateTaskProgress(task.id);
    
    alert('Task created successfully!');
  });
  
  // Copy invite code button
  copyInviteCodeButton.addEventListener('click', () => {
    navigator.clipboard.writeText(inviteCodeElement.textContent)
      .then(() => {
        copyInviteCodeButton.textContent = 'Copied!';
        setTimeout(() => {
          copyInviteCodeButton.textContent = 'Copy';
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy invite code');
      });
  });
  
  // Generate new invite code button
  generateNewCodeButton.addEventListener('click', () => {
    inviteCodeElement.textContent = generateRandomInviteCode();
  });
}

// Display peers
function displayPeers(peers) {
  connectedPeers = peers;
  
  if (peers.length === 0) {
    peersList.innerHTML = '<p class="empty-message">No peers connected. Invite friends to join!</p>';
    return;
  }
  
  let peersHtml = '';
  
  peers.forEach(peer => {
    peersHtml += `
      <div class="peer-card">
        <div class="peer-info">
          <p><strong>${peer.username}</strong> (${peer.hardware.gpu})</p>
          <p>VRAM: ${peer.hardware.vram} GB | Score: ${peer.hardware.score} | Uptime: ${peer.uptime}</p>
        </div>
        <div class="peer-status">
          <div class="peer-status-indicator ${peer.status}"></div>
          <span>${peer.status.charAt(0).toUpperCase() + peer.status.slice(1)}</span>
        </div>
        <div class="peer-actions">
          <button class="request-gpu-btn" data-peer-id="${peer.id}">Request GPU</button>
        </div>
      </div>
    `;
  });
  
  peersList.innerHTML = peersHtml;
  
  // Add event listeners to request GPU buttons
  document.querySelectorAll('.request-gpu-btn').forEach(button => {
    button.addEventListener('click', () => {
      const peerId = button.dataset.peerId;
      const peer = connectedPeers.find(p => p.id === peerId);
      
      if (peer && peer.status === 'available') {
        alert(`Request sent to ${peer.username}`);
        button.disabled = true;
        button.textContent = 'Requested';
      } else {
        alert(`${peer.username} is currently busy`);
      }
    });
  });
}

// Display allowed peers
function displayAllowedPeers() {
  if (!peerSettings.allowedPeers || peerSettings.allowedPeers.length === 0) {
    allowedPeersContainer.innerHTML = '<p class="empty-message">No peers added yet.</p>';
    return;
  }
  
  let peersHtml = '';
  
  peerSettings.allowedPeers.forEach((peer, index) => {
    peersHtml += `
      <div class="allowed-peer">
        <span>${peer}</span>
        <button class="remove-peer" data-index="${index}">Remove</button>
      </div>
    `;
  });
  
  allowedPeersContainer.innerHTML = peersHtml;
  
  // Add event listeners to remove buttons
  document.querySelectorAll('.remove-peer').forEach(button => {
    button.addEventListener('click', () => {
      const index = parseInt(button.dataset.index);
      peerSettings.allowedPeers.splice(index, 1);
      displayAllowedPeers();
    });
  });
}

// Load settings
function loadSettings() {
  // In a real app, we would use ipcRenderer.invoke('get-peer-settings')
  // For now, use default settings
  peerSettings = {
    username: '',
    shareGpu: false,
    maxGpuUsage: 80,
    allowedPeers: []
  };
  
  // Update form
  document.getElementById('username').value = peerSettings.username;
  document.getElementById('share-gpu').checked = peerSettings.shareGpu;
  document.getElementById('max-gpu-usage').value = peerSettings.maxGpuUsage;
  maxGpuValue.textContent = peerSettings.maxGpuUsage + '%';
  
  // Show/hide GPU settings
  gpuSettings.style.display = peerSettings.shareGpu ? 'block' : 'none';
  
  // Display allowed peers
  displayAllowedPeers();
}

// Load tasks
function loadTasks() {
  // Use dummy data
  activeTasks = [...dummyActiveTasks];
  completedTasks = [...dummyCompletedTasks];
  
  displayActiveTasks();
  displayCompletedTasks();
}

// Display active tasks
function displayActiveTasks() {
  if (activeTasks.length === 0) {
    activeTasksContainer.innerHTML = '<p class="empty-message">No active tasks.</p>';
    return;
  }
  
  let tasksHtml = '';
  
  activeTasks.forEach(task => {
    tasksHtml += `
      <div class="task-card">
        <div class="task-header">
          <div>
            <strong>${task.model}</strong> (${task.type})
          </div>
          <div>
            <span class="task-status">${task.status.charAt(0).toUpperCase() + task.status.slice(1)}</span>
          </div>
        </div>
        <p><strong>GPU:</strong> ${task.gpu}</p>
        <p><strong>Started:</strong> ${new Date(task.startTime).toLocaleString()}</p>
        ${task.type === 'inference' ? `<p><strong>Prompt:</strong> ${task.prompt}</p>` : 
          `<p><strong>Dataset:</strong> ${task.dataset}</p>`}
        <div class="task-progress">
          <div class="task-progress-bar" style="width: ${task.progress}%"></div>
        </div>
      </div>
    `;
  });
  
  activeTasksContainer.innerHTML = tasksHtml;
}

// Display completed tasks
function displayCompletedTasks() {
  if (completedTasks.length === 0) {
    completedTasksContainer.innerHTML = '<p class="empty-message">No completed tasks.</p>';
    return;
  }
  
  let tasksHtml = '';
  
  completedTasks.forEach(task => {
    tasksHtml += `
      <div class="task-card">
        <div class="task-header">
          <div>
            <strong>${task.model}</strong> (${task.type})
          </div>
          <div>
            <span class="task-status">${task.status.charAt(0).toUpperCase() + task.status.slice(1)}</span>
          </div>
        </div>
        <p><strong>GPU:</strong> ${task.gpu}</p>
        <p><strong>Started:</strong> ${new Date(task.startTime).toLocaleString()}</p>
        <p><strong>Completed:</strong> ${new Date(task.endTime).toLocaleString()}</p>
        ${task.type === 'inference' ? 
          `<p><strong>Prompt:</strong> ${task.prompt}</p>
           <p><strong>Result:</strong> ${task.result}</p>` : 
          `<p><strong>Dataset:</strong> ${task.dataset}</p>
           <p><strong>Result:</strong> ${task.result}</p>`}
      </div>
    `;
  });
  
  completedTasksContainer.innerHTML = tasksHtml;
}

// Simulate task progress
function simulateTaskProgress(taskId) {
  const task = activeTasks.find(t => t.id === taskId);
  if (!task) return;
  
  task.status = 'running';
  
  const interval = setInterval(() => {
    task.progress += Math.floor(Math.random() * 10) + 1;
    
    if (task.progress >= 100) {
      task.progress = 100;
      task.status = 'completed';
      task.endTime = new Date().toISOString();
      
      // Generate a result based on task type
      if (task.type === 'inference') {
        task.result = "This is a simulated result for the inference task. In a real application, this would be the output from the LLM.";
      } else {
        task.result = `Model fine-tuned successfully. Loss: ${(Math.random() * 0.1).toFixed(4)}, Accuracy: ${(90 + Math.random() * 9).toFixed(1)}%`;
      }
      
      // Move from active to completed
      activeTasks = activeTasks.filter(t => t.id !== taskId);
      completedTasks.push(task);
      
      displayActiveTasks();
      displayCompletedTasks();
      
      clearInterval(interval);
    } else {
      displayActiveTasks();
    }
  }, 1000);
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp); 