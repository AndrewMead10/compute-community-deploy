// Tab switching functionality
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  console.log('Tab buttons found:', tabButtons.length);
  console.log('Tab panes found:', tabPanes.length);
  
  // Set initial tab state
  tabPanes.forEach(pane => {
    if (pane.classList.contains('active')) {
      pane.style.display = pane.id === 'setup' ? 'flex' : 'none';
    } else {
      pane.style.display = 'none';
    }
  });
  
  tabButtons.forEach(button => {
    console.log('Button data-tab:', button.getAttribute('data-tab'));
    
    button.addEventListener('click', () => {
      console.log('Tab button clicked:', button.getAttribute('data-tab'));
      
      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        pane.style.display = 'none';
      });
      
      // Add active class to clicked button and corresponding pane
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      console.log('Looking for element with ID:', tabId);
      
      const tabElement = document.getElementById(tabId);
      if (tabElement) {
        console.log('Tab element found, adding active class');
        tabElement.classList.add('active');
        
        // Explicitly set display style based on the tab
        if (tabId === 'setup') {
          tabElement.style.display = 'flex';
        } else if (tabId === 'users') {
          tabElement.style.display = 'flex';
          tabElement.style.flexDirection = 'column';
        }
        
        // Debug: Check if the tab is visible after adding the active class
        setTimeout(() => {
          const computedStyle = window.getComputedStyle(tabElement);
          console.log(`Tab ${tabId} display style:`, computedStyle.display);
          console.log(`Tab ${tabId} visibility:`, computedStyle.visibility);
          console.log(`Tab ${tabId} opacity:`, computedStyle.opacity);
          console.log(`Tab ${tabId} has active class:`, tabElement.classList.contains('active'));
        }, 100);
      } else {
        console.error('Tab element not found with ID:', tabId);
      }
      
      // Load data for the active tab
      if (tabId === 'users') {
        console.log('Loading users data and stats');
        loadUsersAndStats();
      }
    });
  });
  
  // Load system information
  loadSystemInfo();
  
  // Load users and stats
  loadUsersAndStats();
  
  // Setup run button
  const runButton = document.getElementById('run-button');
  runButton.addEventListener('click', runModel);
  
  // Setup fetch models button
  const fetchModelsButton = document.getElementById('fetch-models-button');
  fetchModelsButton.addEventListener('click', fetchModels);
  
  // Setup local model path input to disable model select when used
  const localModelPathInput = document.getElementById('local-model-path');
  localModelPathInput.addEventListener('input', () => {
    const modelSelect = document.getElementById('model-select');
    if (localModelPathInput.value.trim()) {
      modelSelect.disabled = true;
    } else {
      modelSelect.disabled = !document.getElementById('repo-id').value.trim();
    }
  });
  
  // Setup API key modal
  const addApiKeyButton = document.getElementById('add-api-key');
  const modal = document.getElementById('api-key-modal');
  const closeButton = document.querySelector('.close');
  const saveApiKeyButton = document.getElementById('save-api-key');
  const copyGeneratedKeyButton = document.getElementById('copy-generated-key');
  
  addApiKeyButton.addEventListener('click', () => {
    // Clear previous values
    document.getElementById('user-name').value = '';
    document.getElementById('api-key').value = '';
    
    // Generate a random API key
    const apiKey = generateApiKey();
    document.getElementById('api-key').value = apiKey;
    
    modal.style.display = 'block';
  });
  
  closeButton.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
  
  saveApiKeyButton.addEventListener('click', saveApiKey);
  
  // Add copy functionality for the generated API key
  copyGeneratedKeyButton.addEventListener('click', () => {
    const apiKeyInput = document.getElementById('api-key');
    apiKeyInput.select();
    document.execCommand('copy');
    
    // Show a temporary "Copied!" message
    const originalText = copyGeneratedKeyButton.textContent;
    copyGeneratedKeyButton.textContent = 'Copied!';
    setTimeout(() => {
      copyGeneratedKeyButton.textContent = originalText;
    }, 2000);
  });
  
  // Setup output listeners
  window.api.onSetupOutput((data) => {
    const outputText = document.getElementById('output-text');
    outputText.textContent += data;
    outputText.scrollTop = outputText.scrollHeight;
  });
  
  window.api.onSetupError((data) => {
    const outputText = document.getElementById('output-text');
    outputText.textContent += `${data}`;
    outputText.scrollTop = outputText.scrollHeight;
  });

  // Setup memory sliders
  const backendSelect = document.getElementById('backend');
  const ramMemoryContainer = document.getElementById('cpu-memory-container');
  const gpuMemoryContainer = document.getElementById('gpu-memory-container');
  const ramMemorySlider = document.getElementById('cpu-memory');
  const gpuMemorySlider = document.getElementById('gpu-memory');
  const ramMemoryValue = document.getElementById('cpu-memory-value');
  const gpuMemoryValue = document.getElementById('gpu-memory-value');

  // Function to format memory display
  const formatMemoryDisplay = (totalMemoryGB, percentage) => {
    const allocatedGB = (totalMemoryGB * (percentage / 100)).toFixed(1);
    return `${allocatedGB} GB (${percentage}%)`;
  };

  let systemMemoryInfo = {
    ram: 0,
    gpu: 0
  };

  // Update memory info
  const updateMemoryInfo = async () => {
    try {
      const info = await window.api.getSystemInfo();
      if (!info.error) {
        systemMemoryInfo.ram = info.memory.total;
        if (info.gpu && info.gpu[0] && info.gpu[0].vram) {
          systemMemoryInfo.gpu = Math.round(info.gpu[0].vram / 1024); // Convert MB to GB
        }
        // Set initial slider values only after we have the memory info
        ramMemoryValue.textContent = formatMemoryDisplay(systemMemoryInfo.ram, ramMemorySlider.value);
        gpuMemoryValue.textContent = formatMemoryDisplay(systemMemoryInfo.gpu, gpuMemorySlider.value);
        
        // Load initial recommendations only after we have memory info
        loadModelRecommendations();
      }
    } catch (error) {
      console.error('Error getting system memory info:', error);
    }
  };

  // Initial memory info load
  updateMemoryInfo();

  backendSelect.addEventListener('change', () => {
    const isGPUBackend = ['CUDA', 'METAL'].includes(backendSelect.value);
    gpuMemoryContainer.style.display = isGPUBackend ? 'block' : 'none';
    ramMemoryContainer.style.display = backendSelect.value === 'CPU' ? 'block' : 'none';
    // Reload recommendations when backend changes
    if (systemMemoryInfo.ram > 0) {  // Only load if we have memory info
      loadModelRecommendations();
    }
  });

  ramMemorySlider.addEventListener('input', () => {
    const percentage = ramMemorySlider.value;
    ramMemoryValue.textContent = formatMemoryDisplay(systemMemoryInfo.ram, percentage);
    // Debounce the recommendation update to avoid too frequent updates
    clearTimeout(ramMemorySlider.timeout);
    ramMemorySlider.timeout = setTimeout(() => {
      if (systemMemoryInfo.ram > 0) {  // Only load if we have memory info
        loadModelRecommendations();
      }
    }, 300);
  });

  gpuMemorySlider.addEventListener('input', () => {
    const percentage = gpuMemorySlider.value;
    gpuMemoryValue.textContent = formatMemoryDisplay(systemMemoryInfo.gpu, percentage);
    // Debounce the recommendation update to avoid too frequent updates
    clearTimeout(gpuMemorySlider.timeout);
    gpuMemorySlider.timeout = setTimeout(() => {
      if (systemMemoryInfo.ram > 0) {  // Only load if we have memory info
        loadModelRecommendations();
      }
    }, 300);
  });

  // Load and display model recommendations
  async function loadModelRecommendations() {
    const recommendationsContainer = document.getElementById('model-recommendations-container');
    
    // Don't proceed if we don't have memory info yet
    if (systemMemoryInfo.ram === 0) {
      recommendationsContainer.innerHTML = '<p>Loading system information...</p>';
      return;
    }

    const backend = backendSelect.value;
    const ramAllocation = ramMemorySlider.value / 100;
    const gpuAllocation = gpuMemorySlider.value / 100;
    
    // Calculate actual available memory in GB
    const availableRamGB = systemMemoryInfo.ram * ramAllocation;
    const availableGpuGB = systemMemoryInfo.gpu * gpuAllocation;
    
    try {
      const result = await window.api.getModelRecommendations({
        backend,
        memorySettings: {
          cpu: ramAllocation,
          gpu: ['CUDA', 'METAL'].includes(backend) ? gpuAllocation : null
        }
      });
      
      if (result.error) {
        recommendationsContainer.innerHTML = `<p class="error">Error: ${result.error}</p>`;
        return;
      }

      // Get suitable models across all categories
      const allSuitableModels = [];
      for (const [size, data] of Object.entries(result.recommendations)) {
        if (data.suitable) {
          data.models.forEach(model => {
            // Check if model fits within allocated memory
            const memoryRequired = model.ram_required;
            const isGPUBackend = ['CUDA', 'METAL'].includes(backend);
            const availableMemory = isGPUBackend ? availableGpuGB : availableRamGB;
            
            if (availableMemory >= memoryRequired) {
              allSuitableModels.push({
                ...model,
                category: data.name,
                reason: `Fits within allocated ${isGPUBackend ? 'GPU' : 'RAM'} memory (${availableMemory.toFixed(1)}GB available, needs ${memoryRequired}GB)`
              });
            }
          });
        }
      }

      // Sort by RAM required (ascending) and take top 3
      const topModels = allSuitableModels
        .sort((a, b) => a.ram_required - b.ram_required)
        .slice(0, 3);

      if (topModels.length === 0) {
        const memoryType = backend === 'CPU' ? 'RAM' : 'GPU memory';
        const availableMemory = backend === 'CPU' ? availableRamGB : availableGpuGB;
        recommendationsContainer.innerHTML = `<p>No suitable models found for your hardware with current ${memoryType} allocation (${availableMemory.toFixed(1)}GB). Try increasing the allocation or check HuggingFace for smaller models.</p>`;
        return;
      }

      const html = topModels.map(model => `
        <div class="recommended-model">
          <h4>${model.name}</h4>
          <div class="model-tooltip">
            <p>${model.description}</p>
            <p>Category: ${model.category}</p>
            <p>${model.reason}</p>
          </div>
          <button class="select-model-btn" data-repo="${model.repo}" data-file="${model.file}">
            Select Model
          </button>
        </div>
      `).join('');
      
      recommendationsContainer.innerHTML = html;

      // Add click handlers for select buttons
      const selectButtons = recommendationsContainer.querySelectorAll('.select-model-btn');
      selectButtons.forEach(button => {
        button.addEventListener('click', () => {
          const repo = button.dataset.repo;
          const file = button.dataset.file;
          
          // Fill in the repository ID
          document.getElementById('repo-id').value = repo;
          
          // Fetch models and select the recommended one
          fetchModels().then(() => {
            const modelSelect = document.getElementById('model-select');
            const options = Array.from(modelSelect.options);
            const targetOption = options.find(option => option.text.includes(file));
            if (targetOption) {
              targetOption.selected = true;
            }
          });
        });
      });
    } catch (error) {
      console.error('Error loading model recommendations:', error);
      recommendationsContainer.innerHTML = `<p class="error">Error loading recommendations: ${error.message}</p>`;
    }
  }
});

// Generate a random API key
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  
  // Generate a key in format: xxxx-xxxx-xxxx-xxxx
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 3) key += '-';
  }
  
  return key;
}

// Fetch models from a Hugging Face repository
async function fetchModels() {
  const repoId = document.getElementById('repo-id').value.trim();
  const outputText = document.getElementById('output-text');
  const modelSelect = document.getElementById('model-select');
  
  if (!repoId) {
    alert('Please enter a repository ID');
    return;
  }
  
  // Clear previous models
  while (modelSelect.options.length > 0) {
    modelSelect.remove(0);
  }
  
  // Add placeholder option
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Loading models...';
  modelSelect.appendChild(placeholderOption);
  
  outputText.textContent = `Fetching models from ${repoId}...\n`;
  
  try {
    const result = await window.api.fetchHfModels(repoId);
    
    // Clear the select
    while (modelSelect.options.length > 0) {
      modelSelect.remove(0);
    }
    
    if (result.success && result.models && result.models.length > 0) {
      // Add placeholder option
      const selectOption = document.createElement('option');
      selectOption.value = '';
      selectOption.textContent = 'Select a model';
      modelSelect.appendChild(selectOption);
      
      // Format file size
      const formatFileSize = (bytes) => {
        if (bytes < 1024 * 1024) {
          return `${(bytes / 1024).toFixed(2)} KB`;
        } else if (bytes < 1024 * 1024 * 1024) {
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        } else {
          return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        }
      };
      
      // Add models to select
      result.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        
        const fileName = model.name.split('/').pop();
        const fileSize = formatFileSize(model.size);
        
        option.textContent = `${fileName} (${fileSize})`;
        modelSelect.appendChild(option);
      });
      
      // Enable the select
      modelSelect.disabled = false;
      
      outputText.textContent += `Found ${result.models.length} models in the repository.\n`;
    } else {
      // Add placeholder option
      const noModelsOption = document.createElement('option');
      noModelsOption.value = '';
      noModelsOption.textContent = 'No GGUF models found';
      modelSelect.appendChild(noModelsOption);
      
      outputText.textContent += `Error: ${result.error || 'No GGUF models found in the repository'}\n`;
    }
  } catch (error) {
    console.error('Error fetching models:', error);
    
    // Add placeholder option
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = 'Error fetching models';
    modelSelect.appendChild(errorOption);
    
    outputText.textContent += `Error fetching models: ${error.message}\n`;
  }
}

// Run the model
async function runModel() {
  const backend = document.getElementById('backend').value;
  const repoId = document.getElementById('repo-id').value.trim();
  const modelSelect = document.getElementById('model-select');
  const selectedModel = modelSelect.value;
  const localModelPath = document.getElementById('local-model-path').value.trim();
  const cpuMemoryValue = document.getElementById('cpu-memory').value;
  const gpuMemoryValue = document.getElementById('gpu-memory').value;
  
  let modelId;
  
  // Determine which model ID to use
  if (localModelPath) {
    modelId = localModelPath;
  } else if (repoId && selectedModel) {
    modelId = `${repoId}:${selectedModel}`;
  } else {
    alert('Please either select a model from a repository or enter a local model path');
    return;
  }
  
  const outputText = document.getElementById('output-text');
  outputText.textContent = `Starting setup with backend: ${backend}, model: ${modelId}...\n`;
  
  const runButton = document.getElementById('run-button');
  runButton.disabled = true;
  runButton.textContent = 'Running...';
  
  try {
    const result = await window.api.runModel({ 
      backend, 
      modelId,
      memorySettings: {
        cpu: backend === 'CPU' ? cpuMemoryValue : null,
        gpu: ['CUDA', 'METAL'].includes(backend) ? gpuMemoryValue : null
      }
    });
    
    if (result.success) {
      outputText.textContent += '\nSetup completed successfully!\n';
    } else {
      outputText.textContent += `\nSetup failed: ${result.error}\n`;
    }
  } catch (error) {
    console.error('Error running model:', error);
    outputText.textContent += `\nError: ${error.message}\n`;
  } finally {
    runButton.disabled = false;
    runButton.textContent = 'Run Model';
  }
}

// Load system information
async function loadSystemInfo() {
  try {
    const systemInfo = await window.api.getSystemInfo();
    const systemInfoElement = document.getElementById('system-info');
    
    if (systemInfo.error) {
      systemInfoElement.innerHTML = `<p class="error">Error: ${systemInfo.error}</p>`;
      return;
    }
    
    // Get CPU usage
    const cpuUsage = systemInfo.cpu.usage || 0;
    
    // Calculate memory usage percentage
    const memoryTotal = systemInfo.memory.total;
    const memoryUsed = systemInfo.memory.used;
    const memoryUsagePercent = Math.round((memoryUsed / memoryTotal) * 100);
    
    // Start building HTML
    let html = `
      <div class="info-section">
        <h3>CPU</h3>
        <p><strong>Model:</strong> ${systemInfo.cpu.model}</p>
        <p><strong>Cores:</strong> ${systemInfo.cpu.cores}</p>
        <p><strong>Speed:</strong> ${systemInfo.cpu.speed} GHz</p>
        <div class="usage-bar-container">
          <div class="usage-bar" style="width: ${cpuUsage}%"></div>
          <span class="usage-text">${cpuUsage}% Usage</span>
        </div>
      </div>
      
      <div class="info-section">
        <h3>Memory</h3>
        <p><strong>Total:</strong> ${memoryTotal} GB</p>
        <p><strong>Used:</strong> ${memoryUsed} GB</p>
        <div class="usage-bar-container">
          <div class="usage-bar" style="width: ${memoryUsagePercent}%"></div>
          <span class="usage-text">${memoryUsagePercent}% Usage</span>
        </div>
      </div>
    `;
    
    // Only show GPU section if NVIDIA GPU is detected
    const hasNvidiaGpu = systemInfo.gpu.some(gpu => 
      gpu.model && gpu.model.toLowerCase().includes('nvidia')
    );
    
    if (hasNvidiaGpu) {
      html += `<div class="info-section"><h3>GPU</h3>`;
      
      systemInfo.gpu.forEach(gpu => {
        if (gpu.model && gpu.model.toLowerCase().includes('nvidia')) {
          const vramText = gpu.vram ? `${gpu.vram} MB` : 'Unknown';
          // Use real GPU memory usage if available, otherwise use 0
          const gpuMemUsagePercent = gpu.memoryUsage !== null ? gpu.memoryUsage : 0;
          
          html += `
            <p><strong>Model:</strong> ${gpu.model || 'Unknown'}</p>
            <p><strong>VRAM:</strong> ${vramText}</p>
            <div class="usage-bar-container">
              <div class="usage-bar" style="width: ${gpuMemUsagePercent}%"></div>
              <span class="usage-text">${gpuMemUsagePercent}% Memory Usage</span>
            </div>
          `;
        }
      });
      
      html += `</div>`;
    }
    
    systemInfoElement.innerHTML = html;
    
    // Update system info every 2 seconds
    setTimeout(loadSystemInfo, 2000);
  } catch (error) {
    console.error('Error loading system info:', error);
    const systemInfoElement = document.getElementById('system-info');
    systemInfoElement.innerHTML = `<p class="error">Error loading system information: ${error.message}</p>`;
    
    // Try again after 5 seconds if there was an error
    setTimeout(loadSystemInfo, 5000);
  }
}

// Load users and stats combined
async function loadUsersAndStats() {
  try {
    // Get both users and usage stats
    const [users, stats] = await Promise.all([
      window.api.getUsers(),
      window.api.getUsageStats()
    ]);
    
    const usersListElement = document.getElementById('users-list');
    
    if (users.length === 0) {
      usersListElement.innerHTML = '<p>No users found.</p>';
      return;
    }
    
    let html = '';
    users.forEach((user) => {
      const createdAt = new Date(user.created_at).toLocaleString();
      const userName = user.name;
      
      // Get stats for this user if available
      const userStats = stats[userName] || {
        total_requests: 0,
        total_tokens: 0,
        last_request: null,
        endpoints: {}
      };
      
      const lastRequest = userStats.last_request ? new Date(userStats.last_request).toLocaleString() : 'Never';
      
      // Build endpoints HTML
      let endpointsHtml = '';
      if (Object.keys(userStats.endpoints).length > 0) {
        endpointsHtml = '<h4>Endpoints</h4><ul>';
        for (const [endpoint, count] of Object.entries(userStats.endpoints)) {
          endpointsHtml += `<li><strong>${endpoint}:</strong> ${count} requests</li>`;
        }
        endpointsHtml += '</ul>';
      } else {
        endpointsHtml = '<p>No endpoint usage data available.</p>';
      }
      
      html += `
        <div class="user-card">
          <div class="user-info">
            <h3>${userName}</h3>
            <p><strong>API Key:</strong> <span class="api-key-value">${user.api_key}</span> 
              <button class="copy-api-key" data-key="${user.api_key}">Copy</button>
            </p>
            <p><strong>Created:</strong> ${createdAt}</p>
            <p><strong>Admin:</strong> ${user.is_admin ? 'Yes' : 'No'}</p>
          </div>
          <div class="user-stats">
            <h4>Usage Statistics</h4>
            <p><strong>Total Requests:</strong> ${userStats.total_requests}</p>
            <p><strong>Total Tokens:</strong> ${userStats.total_tokens}</p>
            <p><strong>Last Request:</strong> ${lastRequest}</p>
            <div class="endpoints-section">
              ${endpointsHtml}
            </div>
          </div>
          <div class="user-actions">
            <button class="delete-user" data-id="${user.id}">Delete</button>
          </div>
        </div>
      `;
    });
    
    usersListElement.innerHTML = html;
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-user').forEach(button => {
      button.addEventListener('click', async () => {
        const userId = parseInt(button.getAttribute('data-id'));
        await deleteUser(userId);
      });
    });
    
    // Add event listeners to copy buttons
    document.querySelectorAll('.copy-api-key').forEach(button => {
      button.addEventListener('click', () => {
        const apiKey = button.getAttribute('data-key');
        navigator.clipboard.writeText(apiKey).then(() => {
          // Show a temporary "Copied!" message
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          setTimeout(() => {
            button.textContent = originalText;
          }, 2000);
        });
      });
    });
  } catch (error) {
    console.error('Error loading users and stats:', error);
    const usersListElement = document.getElementById('users-list');
    usersListElement.innerHTML = `<p class="error">Error loading users and stats: ${error.message}</p>`;
  }
}

// Save API key
async function saveApiKey() {
  const userName = document.getElementById('user-name').value;
  const apiKey = document.getElementById('api-key').value;
  
  if (!userName || !apiKey) {
    alert('Please enter both user name and API key');
    return;
  }
  
  try {
    await window.api.addApiKey({ name: userName, key: apiKey });
    
    // Clear form and close modal
    document.getElementById('user-name').value = '';
    document.getElementById('api-key').value = '';
    document.getElementById('api-key-modal').style.display = 'none';
    
    // Reload users list
    loadUsersAndStats();
  } catch (error) {
    console.error('Error saving API key:', error);
    alert(`Error saving API key: ${error.message}`);
  }
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user?')) {
    return;
  }
  
  try {
    await window.api.deleteUser(userId);
    
    // Reload users list
    loadUsersAndStats();
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(`Error deleting user: ${error.message}`);
  }
} 