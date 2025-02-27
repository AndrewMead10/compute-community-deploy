import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Switch,
  Alert,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import axios from 'axios';

const { ipcRenderer } = window.require('electron');

interface APIKey {
  key: string;
  name: string;
  enabled: boolean;
}

interface ModelConfig {
  model_id: string;
  backend: string;
  hf_token?: string;
}

function App() {
  const [tab, setTab] = useState(0);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    model_id: '',
    backend: 'tgi',
  });
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [serverStatus, setServerStatus] = useState('stopped');
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'http://localhost:8000';

  useEffect(() => {
    // Load settings
    ipcRenderer.invoke('get-settings').then((settings: any) => {
      if (settings.hfToken) {
        setModelConfig(prev => ({ ...prev, hf_token: settings.hfToken }));
      }
    });

    // Load API keys
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api-keys`);
      setApiKeys(response.data);
    } catch (err) {
      setError('Failed to load API keys');
    }
  };

  const handleModelConfigSave = async () => {
    try {
      await axios.post(`${API_BASE}/model/configure`, modelConfig);
      if (modelConfig.hf_token) {
        await ipcRenderer.invoke('save-settings', { hfToken: modelConfig.hf_token });
      }
      setError(null);
    } catch (err) {
      setError('Failed to save model configuration');
    }
  };

  const handleCreateApiKey = async () => {
    try {
      await axios.post(`${API_BASE}/api-keys`, { name: newKeyName });
      setNewKeyName('');
      fetchApiKeys();
      setError(null);
    } catch (err) {
      setError('Failed to create API key');
    }
  };

  const handleToggleApiKey = async (key: string) => {
    try {
      await axios.post(`${API_BASE}/api-keys/${key}/toggle`);
      fetchApiKeys();
      setError(null);
    } catch (err) {
      setError('Failed to toggle API key');
    }
  };

  const handleServerControl = async () => {
    try {
      if (serverStatus === 'stopped') {
        await axios.post(`${API_BASE}/server/start`);
        setServerStatus('running');
      } else {
        await axios.post(`${API_BASE}/server/stop`);
        setServerStatus('stopped');
      }
      setError(null);
    } catch (err) {
      setError('Failed to control server');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)}>
          <Tab label="Model Configuration" />
          <Tab label="API Keys" />
          <Tab label="Server Control" />
        </Tabs>
      </Paper>

      {tab === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Model Configuration
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <TextField
              label="Model ID"
              value={modelConfig.model_id}
              onChange={(e) => setModelConfig(prev => ({ ...prev, model_id: e.target.value }))}
            />
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Backend</InputLabel>
            <Select
              value={modelConfig.backend}
              onChange={(e) => setModelConfig(prev => ({ ...prev, backend: e.target.value }))}
            >
              <MenuItem value="tgi">TGI CUDA</MenuItem>
              <MenuItem value="llama.cpp">Llama.cpp</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <TextField
              label="Hugging Face Token"
              value={modelConfig.hf_token || ''}
              onChange={(e) => setModelConfig(prev => ({ ...prev, hf_token: e.target.value }))}
            />
          </FormControl>
          <Button variant="contained" onClick={handleModelConfigSave}>
            Save Configuration
          </Button>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            API Keys
          </Typography>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <TextField
              label="New Key Name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateApiKey}
            >
              Create Key
            </Button>
          </Box>
          <List>
            {apiKeys.map((key) => (
              <ListItem key={key.key}>
                <ListItemText
                  primary={key.name}
                  secondary={key.key}
                />
                <ListItemSecondaryAction>
                  <Switch
                    edge="end"
                    checked={key.enabled}
                    onChange={() => handleToggleApiKey(key.key)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Server Control
          </Typography>
          <Button
            variant="contained"
            color={serverStatus === 'stopped' ? 'primary' : 'error'}
            onClick={handleServerControl}
          >
            {serverStatus === 'stopped' ? 'Start Server' : 'Stop Server'}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default App; 