#!/bin/bash

# Script to download llamafile server and GGUF model weights
# Arguments:
# $1 - Model ID (path or HF model ID with optional file specification)

MODEL_ID=$1

if [ -z "$MODEL_ID" ]; then
    echo "Usage: $0 <MODEL_ID>"
    echo "MODEL_ID can be:"
    echo "  - Local path to GGUF file"  
    echo "  - HuggingFace repo ID (e.g., microsoft/DialoGPT-medium)"
    echo "  - HuggingFace repo:file format (e.g., microsoft/DialoGPT-medium:model.gguf)"
    exit 1
fi

echo "Starting download process for model: $MODEL_ID"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Create necessary directories
mkdir -p ../bin
mkdir -p ../models

# Determine the server filename based on platform
SERVER_FILENAME="llamafile-server"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    SERVER_FILENAME="llamafile-server.exe"
fi

# Check if llamafile server already exists
if [ -f "../bin/$SERVER_FILENAME" ]; then
    echo "llamafile server already exists at ../bin/$SERVER_FILENAME"
else
    echo "Downloading llamafile server..."
    
    # Detect architecture and OS
    ARCH=$(uname -m)
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    
    # Map architecture names
    case $ARCH in
        x86_64)
            ARCH="amd64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            echo "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
    
    # For simplicity, we'll download the universal llamafile that works on all platforms
    # According to llamafile docs, the main executable works on Windows, Linux, macOS, etc.
    LLAMAFILE_URL="https://github.com/Mozilla-Ocho/llamafile/releases/latest/download/llamafile-0.9.3"
    
    if command_exists wget; then
        wget -q -O "../bin/$SERVER_FILENAME" "$LLAMAFILE_URL"
    elif command_exists curl; then
        curl -s -L -o "../bin/$SERVER_FILENAME" "$LLAMAFILE_URL"
    else
        echo "Error: Neither wget nor curl is available. Please install one of them."
        exit 1
    fi
    
    # Make executable
    chmod +x "../bin/$SERVER_FILENAME"
    
    echo "llamafile server download completed!"
fi

# Function to download GGUF model
download_gguf_model() {
    # Check if it's a local file path
    if [[ -f "$MODEL_ID" ]]; then
        echo "Model is a local file: $MODEL_ID"
        echo "No download needed."
        return 0
    fi
    
    # Activate Python virtual environment for downloading
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        source "../python/venv/bin/activate"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        source "../python/venv/Scripts/activate"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        source "../python/venv/bin/activate"
    else
        echo "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Check if MODEL_ID contains a specific model file (repo:model format)
    if [[ $MODEL_ID == *":"* ]]; then
        REPO_ID=$(echo $MODEL_ID | cut -d':' -f1)
        MODEL_FILE=$(echo $MODEL_ID | cut -d':' -f2)
        
        # Check if model already exists
        if [[ -f "../models/$(basename $MODEL_FILE)" ]]; then
            echo "Model file already exists: ../models/$(basename $MODEL_FILE)"
            return 0
        fi
        
        # Download the specific model file
        echo "Downloading model..."
        if ! python -c "
from huggingface_hub import hf_hub_download
import os
import sys
try:
    # Suppress progress bar by redirecting stdout during download
    import contextlib
    with open(os.devnull, 'w') as devnull:
        with contextlib.redirect_stdout(devnull):
            hf_hub_download(repo_id='$REPO_ID', filename='$MODEL_FILE', local_dir='../models', local_dir_use_symlinks=False)
except Exception as e:
    print(f'Download failed: {e}', file=sys.stderr)
    exit(1)
" 2>/dev/null; then
            echo "Failed to download model from Hugging Face"
            exit 1
        fi
        
        echo "Download completed!"
    else
        echo "Error: Repository ID provided without specific file."
        echo "Please specify the exact GGUF file you want to download."
        echo "Format: repository_id:filename.gguf"
        echo "Example: $MODEL_ID:model.gguf"
        exit 1
    fi
}

# Main execution
download_gguf_model

echo ""
echo "Download process complete!"
echo "llamafile server: ../bin/$SERVER_FILENAME"
echo "Model files are in: ../models/"

exit 0 