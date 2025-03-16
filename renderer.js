const { ipcRenderer } = require('electron');
const Chart = require('chart.js/auto');

// Global variables
let hardwareInfo = {};
let cpuUsageChart;
let ramUsageChart;
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
const modelForm = document.getElementById('model-form');
const modelTypeRadios = document.querySelectorAll('input[name="model-type"]');
const modelIdInput = document.getElementById('model-id');
const runButton = document.getElementById('run-btn');

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
    processors: 1,
    usage: 25
  },
  mem: {
    total: 34359738368, // 32GB
    free: 17179869184,  // 16GB
    used: 17179869184,  // 16GB
    usage: 50
  },
  graphics: {
    controllers: [
      {
        model: 'NVIDIA GeForce RTX 3080',
        vendor: 'NVIDIA',
        vram: 10240,
        driverVersion: '531.41',
        subDeviceId: '123456',
        temperature: 65,
        usage: 35
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

// Helper Functions
// ---------------

// Format memory size in GB
function formatMemorySize(bytes) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
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
  
  // Set up resource usage charts
  setupResourceCharts();
  
  // Set up event listeners
  setupEventListeners();
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
      <p><strong>Usage:</strong> ${gpu.usage || 0}%</p>
      ${gpu.temperature ? `<p><strong>Temperature:</strong> ${gpu.temperature}°C</p>` : ''}
      <p><strong>Driver:</strong> ${gpu.driverVersion || 'Unknown'}</p>
    `;
  } else {
    gpuInfoElement.innerHTML = '<p>No GPU detected</p>';
  }
  
  // Display CPU info
  if (data.cpu) {
    cpuInfoElement.innerHTML = `
      <p><strong>Model:</strong> ${data.cpu.brand || 'Unknown'}</p>
      <p><strong>Manufacturer:</strong> ${data.cpu.manufacturer || 'Unknown'}</p>
      <p><strong>Speed:</strong> ${data.cpu.speed ? data.cpu.speed + ' GHz' : 'Unknown'}</p>
      <p><strong>Cores:</strong> ${data.cpu.cores || 'Unknown'}</p>
      <p><strong>Physical Cores:</strong> ${data.cpu.physicalCores || 'Unknown'}</p>
      <p><strong>Usage:</strong> ${data.cpu.usage || 0}%</p>
    `;
  } else {
    cpuInfoElement.innerHTML = '<p>No CPU information available</p>';
  }
  
  // Display RAM info
  if (data.mem) {
    ramInfoElement.innerHTML = `
      <p><strong>Total Memory:</strong> ${formatMemorySize(data.mem.total)}</p>
      <p><strong>Used Memory:</strong> ${formatMemorySize(data.mem.used)}</p>
      <p><strong>Free Memory:</strong> ${formatMemorySize(data.mem.free)}</p>
      <p><strong>Usage:</strong> ${Math.round(data.mem.used / data.mem.total * 100)}%</p>
    `;
  } else {
    ramInfoElement.innerHTML = '<p>No memory information available</p>';
  }
}

// Set up resource usage charts
function setupResourceCharts() {
  // CPU usage chart
  const cpuCtx = document.getElementById('cpu-usage-chart').getContext('2d');
  cpuUsageChart = new Chart(cpuCtx, {
    type: 'bar',
    data: {
      labels: ['CPU Usage'],
      datasets: [{
        label: 'Usage %',
        data: [dummyHardwareData.cpu.usage],
        backgroundColor: 'rgba(74, 108, 247, 0.7)',
        borderWidth: 1
      }]
    },
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
        }
      }
    }
  });
  
  // RAM usage chart
  const ramCtx = document.getElementById('ram-usage-chart').getContext('2d');
  ramUsageChart = new Chart(ramCtx, {
    type: 'bar',
    data: {
      labels: ['RAM Usage'],
      datasets: [{
        label: 'Usage %',
        data: [Math.round(dummyHardwareData.mem.used / dummyHardwareData.mem.total * 100)],
        backgroundColor: 'rgba(40, 167, 69, 0.7)',
        borderWidth: 1
      }]
    },
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
        }
      }
    }
  });
  
  // GPU usage chart
  const gpuCtx = document.getElementById('gpu-usage-chart').getContext('2d');
  gpuUsageChart = new Chart(gpuCtx, {
    type: 'bar',
    data: {
      labels: ['GPU Usage'],
      datasets: [{
        label: 'Usage %',
        data: [dummyHardwareData.graphics.controllers[0].usage],
        backgroundColor: 'rgba(220, 53, 69, 0.7)',
        borderWidth: 1
      }]
    },
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
        }
      }
    }
  });
  
  // Simulate real-time updates
  setInterval(() => {
    // Update CPU usage
    const cpuUsage = Math.floor(Math.random() * 40) + 20;
    cpuUsageChart.data.datasets[0].data = [cpuUsage];
    cpuUsageChart.update();
    
    // Update RAM usage
    const ramUsage = Math.floor(Math.random() * 30) + 40;
    ramUsageChart.data.datasets[0].data = [ramUsage];
    ramUsageChart.update();
    
    // Update GPU usage
    const gpuUsage = Math.floor(Math.random() * 50) + 20;
    gpuUsageChart.data.datasets[0].data = [gpuUsage];
    gpuUsageChart.update();
    
    // Update info containers
    const cpuInfo = document.querySelector('#cpu-info p:last-child');
    if (cpuInfo) cpuInfo.innerHTML = `<strong>Usage:</strong> ${cpuUsage}%`;
    
    const ramInfo = document.querySelector('#ram-info p:last-child');
    if (ramInfo) ramInfo.innerHTML = `<strong>Usage:</strong> ${ramUsage}%`;
    
    const gpuInfo = document.querySelector('#gpu-info p:nth-child(4)');
    if (gpuInfo) gpuInfo.innerHTML = `<strong>Usage:</strong> ${gpuUsage}%`;
  }, 2000);
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
  
  // Model form
  modelForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Get selected model type
    let modelType;
    modelTypeRadios.forEach(radio => {
      if (radio.checked) {
        modelType = radio.value;
      }
    });
    
    const modelId = modelIdInput.value;
    
    if (!modelId) {
      alert('Please enter a Model ID');
      return;
    }
    
    // In a real app, we would send this to the backend
    console.log('Running model:', {
      type: modelType,
      id: modelId
    });
    
    runButton.disabled = true;
    runButton.textContent = 'Running...';
    
    // Simulate running the model
    setTimeout(() => {
      alert(`Started ${modelType} model with ID: ${modelId}`);
      runButton.disabled = false;
      runButton.textContent = 'Run';
    }, 2000);
  });
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', initApp); 