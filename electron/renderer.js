// Tab switching functionality
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // Add active class to clicked button and corresponding pane
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // Load data for the active tab
      if (tabId === 'users-tab') {
        loadUsers();
      } else if (tabId === 'stats-tab') {
        loadUsageStats();
      }
    });
  });
  
  // Load system information
  loadSystemInfo();
  
  // Load users
  loadUsers();
  
  // Setup run button
  const runButton = document.getElementById('run-button');
  runButton.addEventListener('click', runModel);
  
  // Setup API key modal
  const addApiKeyButton = document.getElementById('add-api-key');
  const modal = document.getElementById('api-key-modal');
  const closeButton = document.querySelector('.close');
  const saveApiKeyButton = document.getElementById('save-api-key');
  
  addApiKeyButton.addEventListener('click', () => {
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
  
  // Setup output listeners
  window.api.onSetupOutput((data) => {
    const outputText = document.getElementById('output-text');
    outputText.textContent += data;
    outputText.scrollTop = outputText.scrollHeight;
  });
  
  window.api.onSetupError((data) => {
    const outputText = document.getElementById('output-text');
    outputText.textContent += `ERROR: ${data}`;
    outputText.scrollTop = outputText.scrollHeight;
  });
});

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

// Run the model
async function runModel() {
  const backend = document.getElementById('backend').value;
  const modelId = document.getElementById('model-id').value;
  
  if (!modelId) {
    alert('Please enter a model ID');
    return;
  }
  
  const outputText = document.getElementById('output-text');
  outputText.textContent = `Starting setup with backend: ${backend}, model: ${modelId}...\n`;
  
  const runButton = document.getElementById('run-button');
  runButton.disabled = true;
  runButton.textContent = 'Running...';
  
  try {
    const result = await window.api.runModel({ backend, modelId });
    
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

// Load users
async function loadUsers() {
  try {
    const users = await window.api.getUsers();
    const usersListElement = document.getElementById('users-list');
    
    if (users.length === 0) {
      usersListElement.innerHTML = '<p>No users found.</p>';
      return;
    }
    
    let html = '';
    users.forEach((user) => {
      const createdAt = new Date(user.created_at).toLocaleString();
      html += `
        <div class="user-card">
          <div class="user-info">
            <h3>${user.name}</h3>
            <p><strong>API Key:</strong> ${user.api_key}</p>
            <p><strong>Created:</strong> ${createdAt}</p>
            <p><strong>Admin:</strong> ${user.is_admin ? 'Yes' : 'No'}</p>
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
  } catch (error) {
    console.error('Error loading users:', error);
    const usersListElement = document.getElementById('users-list');
    usersListElement.innerHTML = `<p class="error">Error loading users: ${error.message}</p>`;
  }
}

// Load usage statistics
async function loadUsageStats() {
  try {
    const stats = await window.api.getUsageStats();
    const statsElement = document.getElementById('stats-container');
    
    if (Object.keys(stats).length === 0) {
      statsElement.innerHTML = '<p>No usage statistics available.</p>';
      return;
    }
    
    let html = '<div class="stats-grid">';
    
    // Create a card for each user
    for (const [userName, userStats] of Object.entries(stats)) {
      const lastRequest = userStats.last_request ? new Date(userStats.last_request).toLocaleString() : 'Never';
      
      html += `
        <div class="stats-card">
          <h3>${userName}</h3>
          <div class="stats-info">
            <p><strong>Total Requests:</strong> ${userStats.total_requests}</p>
            <p><strong>Total Tokens:</strong> ${userStats.total_tokens}</p>
            <p><strong>Last Request:</strong> ${lastRequest}</p>
          </div>
          <div class="stats-endpoints">
            <h4>Endpoints</h4>
            <ul>
      `;
      
      // Add endpoint usage
      for (const [endpoint, count] of Object.entries(userStats.endpoints)) {
        html += `<li><strong>${endpoint}:</strong> ${count} requests</li>`;
      }
      
      html += `
            </ul>
          </div>
        </div>
      `;
    }
    
    html += '</div>';
    statsElement.innerHTML = html;
  } catch (error) {
    console.error('Error loading usage statistics:', error);
    const statsElement = document.getElementById('stats-container');
    statsElement.innerHTML = `<p class="error">Error loading usage statistics: ${error.message}</p>`;
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
    loadUsers();
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
    loadUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    alert(`Error deleting user: ${error.message}`);
  }
} 