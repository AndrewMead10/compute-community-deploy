// Tab switching functionality
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // Get DOM elements for later use
    const backendSelect = document.getElementById('backend');
    const ramMemoryContainer = document.getElementById('cpu-memory-container');
    const gpuMemoryContainer = document.getElementById('gpu-memory-container');
    const ramMemorySlider = document.getElementById('cpu-memory');
    const gpuMemorySlider = document.getElementById('gpu-memory');
    const ramMemoryValue = document.getElementById('cpu-memory-value');
    const gpuMemoryValue = document.getElementById('gpu-memory-value');
    const cpuModelInputs = document.getElementById('cpu-model-inputs');
    const gpuModelInputs = document.getElementById('gpu-model-inputs');

    // Set initial tab state
    tabPanes.forEach(pane => {
        if (pane.classList.contains('active')) {
            pane.style.display = pane.id === 'setup' ? 'flex' : 'none';
        } else {
            pane.style.display = 'none';
        }
    });

    // Set initial model input containers visibility based on default backend
    const initialBackend = backendSelect.value;

    // Show/hide model inputs based on initial backend value
    cpuModelInputs.style.display = initialBackend === 'CPU' ? 'block' : 'none';
    gpuModelInputs.style.display = ['CUDA', 'METAL'].includes(initialBackend) ? 'block' : 'none';

    // Show/hide memory containers based on initial backend value
    ramMemoryContainer.style.display = initialBackend === 'CPU' ? 'block' : 'none';
    gpuMemoryContainer.style.display = ['CUDA', 'METAL'].includes(initialBackend) ? 'block' : 'none';

    tabButtons.forEach(button => {

        button.addEventListener('click', () => {

            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                pane.style.display = 'none';
            });

            // Add active class to clicked button and corresponding pane
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');

            const tabElement = document.getElementById(tabId);
            if (tabElement) {
                tabElement.classList.add('active');

                // Explicitly set display style based on the tab
                if (tabId === 'setup') {
                    tabElement.style.display = 'flex';
                } else if (tabId === 'users') {
                    tabElement.style.display = 'flex';
                    tabElement.style.flexDirection = 'column';
                }
            } else {
                console.error('Tab element not found with ID:', tabId);
            }

            // Load data for the active tab
            if (tabId === 'users') {
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
        const cpuModelSelect = document.getElementById('cpu-model-select');
        if (localModelPathInput.value.trim()) {
            cpuModelSelect.disabled = true;
        } else {
            cpuModelSelect.disabled = !document.getElementById('cpu-repo-id').value.trim();
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

    // Setup P2P event listeners
    window.api.onP2PPeerConnected((peerId) => {
        const outputText = document.getElementById('output-text');
        outputText.textContent += `Peer connected: ${peerId}\n`;
        updateConnectionCount();
    });

    window.api.onP2PPeerDisconnected((peerId) => {
        const outputText = document.getElementById('output-text');
        outputText.textContent += `Peer disconnected: ${peerId}\n`;
        updateConnectionCount();
    });

    window.api.onP2PError((error) => {
        const outputText = document.getElementById('output-text');
        outputText.textContent += `P2P Error: ${error}\n`;
    });

    window.api.onP2PStatusUpdate((status) => {
        updateP2PStatus(status);
    });

    // Setup copy URL button
    const copyUrlButton = document.getElementById('copy-url');
    if (copyUrlButton) {
        copyUrlButton.addEventListener('click', copyShareableUrl);
    }

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
                // first device is the integrated GPU, second is the discrete GPU
                if (info.gpu && info.gpu[1] && info.gpu[1].vram) {
                    systemMemoryInfo.gpu = Math.round(info.gpu[1].vram / 1024); // Convert MB to GB
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

    // Set up backend select change handler
    backendSelect.addEventListener('change', () => {
        const isGPUBackend = ['CUDA', 'METAL'].includes(backendSelect.value);
        gpuMemoryContainer.style.display = isGPUBackend ? 'block' : 'none';
        ramMemoryContainer.style.display = backendSelect.value === 'CPU' ? 'block' : 'none';

        // Show/hide appropriate model input fields based on backend
        cpuModelInputs.style.display = backendSelect.value === 'CPU' ? 'block' : 'none';
        gpuModelInputs.style.display = isGPUBackend ? 'block' : 'none';

        // Clear any previously selected models when switching backends
        if (isGPUBackend) {
            document.getElementById('gpu-repo-id').value = '';
        } else {
            document.getElementById('cpu-repo-id').value = '';
            document.getElementById('cpu-model-select').innerHTML = '<option value="">Select a repository first</option>';
            document.getElementById('cpu-model-select').disabled = true;
        }

        // Reload recommendations when backend changes
        if (isGPUBackend && systemMemoryInfo.gpu > 0) {
            loadModelRecommendations();
        } else if (!isGPUBackend && systemMemoryInfo.ram > 0) {
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
            if (systemMemoryInfo.gpu > 0) {  // Only load if we have memory info
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

        const backend = document.getElementById('backend').value;
        const isGpuBackend = ['CUDA', 'METAL'].includes(backend);
        const ramAllocation = document.getElementById('cpu-memory').value;
        const gpuAllocation = document.getElementById('gpu-memory').value;

        // Calculate actual available memory in GB
        const availableRamGB = systemMemoryInfo.ram * (ramAllocation / 100);
        const availableGpuGB = systemMemoryInfo.gpu * (gpuAllocation / 100);

        try {
            const params = {
                backend: backend,
                memorySettings: {
                    cpu: ramAllocation,
                    gpu: isGpuBackend ? gpuAllocation : null
                }
            };

            const result = await window.api.getModelRecommendations(params);

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
                        const availableMemory = isGpuBackend ? availableGpuGB : availableRamGB;

                        if (availableMemory >= memoryRequired) {
                            allSuitableModels.push({
                                ...model,
                                category: data.name,
                                reason: `Fits within allocated ${isGpuBackend ? 'GPU' : 'RAM'} memory (${availableMemory.toFixed(1)}GB available, needs ${memoryRequired}GB)`
                            });
                        }
                    });
                }
            }

            // Sort by RAM required (descending) and take top 3
            const topModels = allSuitableModels
                .sort((a, b) => b.ram_required - a.ram_required)
                .slice(0, 3);

            if (topModels.length === 0) {
                const memoryType = backend === 'CPU' ? 'RAM' : 'GPU memory';
                const availableMemory = backend === 'CPU' ? availableRamGB : availableGpuGB;
                recommendationsContainer.innerHTML = `<p>No suitable models found for your hardware with current ${memoryType} allocation (${availableMemory.toFixed(1)}GB). Try increasing the allocation or check HuggingFace for smaller models.</p>`;
                return;
            }

            const html = topModels.map(model => {
                // Create data attributes based on backend
                let buttonData = `data-repo="${model.repo}"`;
                if (!isGpuBackend && model.file) {
                    buttonData += ` data-file="${model.file}"`;
                }

                return `
            <div class="recommended-model">
              <h4>${model.name}</h4>
              <div class="model-tooltip">
                <p>${model.description}</p>
                <p>Category: ${model.category}</p>
                <p>${model.reason}</p>
              </div>
              <button class="select-model-btn" ${buttonData}>
                Select Model
              </button>
            </div>
          `;
            }).join('');

            recommendationsContainer.innerHTML = html;

            // Add click handlers for select buttons
            const selectButtons = recommendationsContainer.querySelectorAll('.select-model-btn');
            selectButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const repo = button.dataset.repo;
                    const currentBackend = document.getElementById('backend').value;
                    const isCurrentGpuBackend = ['CUDA', 'METAL'].includes(currentBackend);

                    if (isCurrentGpuBackend) {
                        // For GPU, just set the repo ID
                        document.getElementById('gpu-repo-id').value = repo;
                    } else {
                        // For CPU, fetch models and select the recommended one
                        const file = button.dataset.file;
                        document.getElementById('cpu-repo-id').value = repo;

                        // Fetch models and select the recommended one
                        fetchModels().then(() => {
                            const modelSelect = document.getElementById('cpu-model-select');
                            const options = Array.from(modelSelect.options);
                            const targetOption = options.find(option => option.text.includes(file));
                            if (targetOption) {
                                targetOption.selected = true;
                            }
                        });
                    }
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
    const cpuRepoId = document.getElementById('cpu-repo-id').value.trim();
    const outputText = document.getElementById('output-text');
    const cpuModelSelect = document.getElementById('cpu-model-select');

    if (!cpuRepoId) {
        alert('Please enter a repository ID');
        return;
    }

    // Clear previous models
    while (cpuModelSelect.options.length > 0) {
        cpuModelSelect.remove(0);
    }

    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Loading models...';
    cpuModelSelect.appendChild(placeholderOption);

    outputText.textContent = `Fetching models from ${cpuRepoId}...\n`;

    try {
        const result = await window.api.fetchHfModels(cpuRepoId);

        // Clear the select
        while (cpuModelSelect.options.length > 0) {
            cpuModelSelect.remove(0);
        }

        if (result.success && result.models && result.models.length > 0) {
            // Add placeholder option
            const selectOption = document.createElement('option');
            selectOption.value = '';
            selectOption.textContent = 'Select a model';
            cpuModelSelect.appendChild(selectOption);

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
                cpuModelSelect.appendChild(option);
            });

            // Enable the select
            cpuModelSelect.disabled = false;

            outputText.textContent += `Found ${result.models.length} models in the repository.\n`;
        } else {
            // Add placeholder option
            const noModelsOption = document.createElement('option');
            noModelsOption.value = '';
            noModelsOption.textContent = 'No GGUF models found';
            cpuModelSelect.appendChild(noModelsOption);

            outputText.textContent += `Error: ${result.error || 'No GGUF models found in the repository'}\n`;
        }
    } catch (error) {
        console.error('Error fetching models:', error);

        // Add placeholder option
        const errorOption = document.createElement('option');
        errorOption.value = '';
        errorOption.textContent = 'Error fetching models';
        cpuModelSelect.appendChild(errorOption);

        outputText.textContent += `Error fetching models: ${error.message}\n`;
    }
}

// Run the model
async function runModel() {
    const backend = document.getElementById('backend').value;
    const isGpuBackend = ['CUDA', 'METAL'].includes(backend);
    const cpuMemoryValue = document.getElementById('cpu-memory').value;
    const gpuMemoryValue = document.getElementById('gpu-memory').value;

    let modelId;

    // Get model ID based on backend
    if (isGpuBackend) {
        // For GPU, we only need the repo ID
        const gpuRepoId = document.getElementById('gpu-repo-id').value.trim();

        if (!gpuRepoId) {
            alert('Please enter an AWQ repository ID for GPU inference');
            return;
        }

        modelId = gpuRepoId;
    } else {
        // For CPU, we need the repo ID and model file or a local path
        const cpuRepoId = document.getElementById('cpu-repo-id').value.trim();
        const cpuModelSelect = document.getElementById('cpu-model-select');
        const selectedModel = cpuModelSelect.value;
        const localModelPath = document.getElementById('local-model-path').value.trim();

        if (localModelPath) {
            modelId = localModelPath;
        } else if (cpuRepoId && selectedModel) {
            modelId = `${cpuRepoId}:${selectedModel}`;
        } else {
            alert('Please either select a GGUF model from a repository or enter a local model path');
            return;
        }
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
                gpu: isGpuBackend ? gpuMemoryValue : null
            }
        });

        if (result.success) {
            outputText.textContent += '\nSetup completed successfully!\n';
            
            // Automatically start P2P sharing
            outputText.textContent += '\nStarting P2P sharing...\n';
            await startP2PAutomatically();
            
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

// Automatically start P2P sharing
async function startP2PAutomatically() {
    try {
        const outputText = document.getElementById('output-text');
        const p2pStatusPanel = document.getElementById('p2p-status-panel');
        
        // First check if P2P is already running
        const currentStatus = await window.api.getP2PStatus();
        
        if (currentStatus.isRunning) {
            outputText.textContent += `P2P sharing is already running!\n`;
            outputText.textContent += `Active connections: ${currentStatus.connections}\n`;
            
            // Show P2P status panel
            p2pStatusPanel.style.display = 'block';
            updateP2PStatus(currentStatus);
            return;
        }
        
        const result = await window.api.startP2PBackend();

        if (result.success) {
            if (result.alreadyRunning) {
                outputText.textContent += `P2P sharing was already running!\n`;
                outputText.textContent += `Shareable URL: ${result.shareableUrl}\n`;
                outputText.textContent += `Active connections: ${result.connections}\n`;
            } else {
                outputText.textContent += `P2P sharing started successfully!\n`;
                outputText.textContent += `Shareable URL: ${result.shareableUrl}\n`;
                outputText.textContent += `Shareable URL copied to clipboard!\n`;
            }
            
            // Show P2P status panel
            p2pStatusPanel.style.display = 'block';
            updateP2PInfo(result);
            
        } else {
            outputText.textContent += `Failed to start P2P sharing: ${result.error}\n`;
        }
    } catch (error) {
        console.error('Error starting P2P automatically:', error);
        const outputText = document.getElementById('output-text');
        outputText.textContent += `Error starting P2P sharing: ${error.message}\n`;
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

// P2P Status Management Functions
function updateP2PInfo(info) {
    const p2pInfoDiv = document.getElementById('p2p-info');
    const shareableUrlInput = document.getElementById('shareable-url');
    
    if (info) {
        p2pInfoDiv.style.display = 'block';
        
        if (info.shareableUrl) {
            shareableUrlInput.value = info.shareableUrl;
        } else {
            // Generate a simple shareable URL
            shareableUrlInput.value = `p2p://${info.peerId}`;
        }
    } else {
        p2pInfoDiv.style.display = 'none';
    }
}

function updateP2PStatus(status) {
    const statusText = document.getElementById('p2p-status-text');
    const connectionCount = document.getElementById('connection-count');
    
    statusText.textContent = status.isRunning ? 'Running' : 'Stopped';
    statusText.style.color = status.isRunning ? '#28a745' : '#6c757d';
    
    if (connectionCount) {
        connectionCount.textContent = status.connections || 0;
    }
}

function updateConnectionCount() {
    // Get current status and update connection count
    window.api.getP2PStatus().then(status => {
        const connectionCount = document.getElementById('connection-count');
        if (connectionCount) {
            connectionCount.textContent = status.connections || 0;
        }
    });
}

function copyShareableUrl() {
    const shareableUrlInput = document.getElementById('shareable-url');
    const copyButton = document.getElementById('copy-url');
    
    shareableUrlInput.select();
    document.execCommand('copy');
    
    const originalText = copyButton.textContent;
    copyButton.textContent = 'Copied!';
    setTimeout(() => {
        copyButton.textContent = originalText;
    }, 2000);
} 