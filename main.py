from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
import uvicorn
import secrets
import sqlite3
import subprocess
import os
import json
from typing import List, Optional
import uuid
import psutil
import requests
from pathlib import Path
from setup_tgi import setup_tgi

app = FastAPI(title="TGI Manager")

# Configuration
class Config:
    def __init__(self):
        self.workspace_dir = os.path.abspath(os.path.dirname(__file__))
        self.tgi_info = None

config = Config()

# Models for request/response
class ModelConfig(BaseModel):
    model_id: str
    backend: str  # "llama.cpp" or "tgi"
    hf_token: Optional[str] = None
    
class APIKey(BaseModel):
    key: str
    name: str
    enabled: bool = True

class APIKeyCreate(BaseModel):
    name: str

# Database setup
def init_db():
    conn = sqlite3.connect('tgi_manager.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS api_keys
                 (key TEXT PRIMARY KEY, name TEXT, enabled BOOLEAN)''')
    c.execute('''CREATE TABLE IF NOT EXISTS model_config
                 (id INTEGER PRIMARY KEY, model_id TEXT, backend TEXT, 
                  hf_token TEXT, active BOOLEAN)''')
    conn.commit()
    conn.close()

# Security
api_key_header = APIKeyHeader(name="X-API-Key")

def get_api_key(api_key: str = Security(api_key_header)) -> str:
    conn = sqlite3.connect('tgi_manager.db')
    c = conn.cursor()
    c.execute('SELECT enabled FROM api_keys WHERE key = ?', (api_key,))
    result = c.fetchone()
    conn.close()
    
    if not result or not result[0]:
        raise HTTPException(status_code=403, detail="Invalid or disabled API key")
    return api_key

# Model management endpoints
@app.post("/model/configure")
async def configure_model(config: ModelConfig):
    conn = sqlite3.connect('tgi_manager.db')
    c = conn.cursor()
    
    # Disable all existing configurations
    c.execute('UPDATE model_config SET active = 0')
    
    # Add new configuration
    c.execute('''INSERT INTO model_config (model_id, backend, hf_token, active)
                 VALUES (?, ?, ?, 1)''', 
              (config.model_id, config.backend, config.hf_token))
    
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/model/current")
async def get_current_model():
    conn = sqlite3.connect('tgi_manager.db')
    c = conn.cursor()
    c.execute('SELECT model_id, backend, hf_token FROM model_config WHERE active = 1')
    result = c.fetchone()
    conn.close()
    
    if not result:
        return None
    
    return {
        "model_id": result[0],
        "backend": result[1],
        "hf_token": result[2]
    }

# API key management
@app.post("/api-keys", response_model=APIKey)
async def create_api_key(key_create: APIKeyCreate):
    api_key = secrets.token_urlsafe(32)
    conn = sqlite3.connect('tgi_manager.db')
    c = conn.cursor()
    c.execute('INSERT INTO api_keys (key, name, enabled) VALUES (?, ?, 1)',
              (api_key, key_create.name))
    conn.commit()
    conn.close()
    
    return APIKey(key=api_key, name=key_create.name, enabled=True)

@app.get("/api-keys", response_model=List[APIKey])
async def list_api_keys():
    conn = sqlite3.connect('tgi_manager.db')
    c = conn.cursor()
    c.execute('SELECT key, name, enabled FROM api_keys')
    keys = [APIKey(key=k, name=n, enabled=e) for k, n, e in c.fetchall()]
    conn.close()
    return keys

@app.post("/api-keys/{key}/toggle")
async def toggle_api_key(key: str):
    conn = sqlite3.connect('tgi_manager.db')
    c = conn.cursor()
    c.execute('UPDATE api_keys SET enabled = NOT enabled WHERE key = ?', (key,))
    if c.rowcount == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    conn.commit()
    conn.close()
    return {"status": "success"}

# TGI server management
def start_tgi_server(model_config: ModelConfig):
    if not config.tgi_info:
        raise HTTPException(status_code=500, detail="TGI not properly initialized")

    venv_python = os.path.join(config.tgi_info["venv_path"], "bin", "python")
    
    if model_config.backend == "llama.cpp":
        cmd = [
            venv_python, "-m", "text_generation_launcher",
            "--model-id", model_config.model_id,
            "--backend", "llama.cpp"
        ]
    else:
        cmd = [
            venv_python, "-m", "text_generation_launcher",
            "--model-id", model_config.model_id
        ]
    
    if model_config.hf_token:
        os.environ["HUGGING_FACE_HUB_TOKEN"] = model_config.hf_token
    
    process = subprocess.Popen(cmd)
    return process.pid

@app.post("/server/start")
async def start_server():
    model_config = await get_current_model()
    if not model_config:
        raise HTTPException(status_code=400, detail="No model configured")
    
    pid = start_tgi_server(ModelConfig(**model_config))
    return {"status": "success", "pid": pid}

@app.post("/server/stop")
async def stop_server():
    # Find and kill TGI process
    for proc in psutil.process_iter(['pid', 'name']):
        if 'text-generation-launcher' in proc.info['name']:
            proc.kill()
    return {"status": "success"}

# Startup
@app.on_event("startup")
async def startup_event():
    init_db()
    try:
        print("Setting up TGI...")
        config.tgi_info = setup_tgi(config.workspace_dir)
        print("TGI setup completed successfully!")
    except Exception as e:
        print(f"Error setting up TGI: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize TGI: {str(e)}"
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
