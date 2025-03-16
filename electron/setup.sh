#!/bin/bash

# Script to set up the environment for llama-cpp-python
# Arguments:
# $1 - Backend (CPU, CUDA, etc.)
# $2 - Model ID (path or HF model ID)

BACKEND=$1
MODEL_ID=$2

echo "Setting up environment for $BACKEND with model $MODEL_ID"

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
  echo "Creating Python virtual environment..."
  python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Set environment variables based on backend for installation
if [ "$BACKEND" == "CUDA" ]; then
  echo "Installing llama-cpp-python with CUDA support..."
  CMAKE_ARGS="-DLLAMA_CUBLAS=on" pip install llama-cpp-python --force-reinstall --upgrade
elif [ "$BACKEND" == "METAL" ]; then
  echo "Installing llama-cpp-python with Metal support..."
  CMAKE_ARGS="-DLLAMA_METAL=on" pip install llama-cpp-python --force-reinstall --upgrade
elif [ "$BACKEND" == "OPENBLAS" ]; then
  echo "Installing llama-cpp-python with OpenBLAS support..."
  CMAKE_ARGS="-DLLAMA_OPENBLAS=on" pip install llama-cpp-python --force-reinstall --upgrade
else
  echo "Installing llama-cpp-python with CPU support..."
  pip install llama-cpp-python --force-reinstall --upgrade
fi

# Install FastAPI and other dependencies
echo "Installing FastAPI and other dependencies..."
pip install -r ../deploy/requirements.txt

# Check if MODEL_ID contains a specific model file (repo:model format)
if [[ $MODEL_ID == *":"* ]]; then
  echo "Detected specific model file in repository"
  REPO_ID=$(echo $MODEL_ID | cut -d':' -f1)
  MODEL_FILE=$(echo $MODEL_ID | cut -d':' -f2)
  
  echo "Repository ID: $REPO_ID"
  echo "Model file: $MODEL_FILE"
  
  # Create models directory if it doesn't exist
  mkdir -p models
  
  # Download the specific model file
  echo "Downloading model from Hugging Face..."
  python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='$REPO_ID', filename='$MODEL_FILE', local_dir='models')"
  
  # Set MODEL_ID to the local path
  MODEL_ID="models/$(basename $MODEL_FILE)"
  echo "Model downloaded to $MODEL_ID"
# Download the model if it's a Hugging Face model ID (old format)
elif [[ $MODEL_ID == *"/"* ]]; then
  echo "Downloading model from Hugging Face..."
  
  # Create models directory if it doesn't exist
  mkdir -p models
  
  # Try to find a GGUF file in the repository
  echo "Looking for GGUF files in the repository..."
  GGUF_FILES=$(python -c "from huggingface_hub import list_repo_files; files = list_repo_files('$MODEL_ID'); print('\n'.join([f for f in files if f.endswith('.gguf')]))")
  
  if [ -z "$GGUF_FILES" ]; then
    echo "No GGUF files found in the repository. Trying to download ggml-model-q4_0.bin..."
    python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='$MODEL_ID', filename='ggml-model-q4_0.bin', local_dir='models')"
    MODEL_ID="models/ggml-model-q4_0.bin"
  else
    # Use the first GGUF file found
    FIRST_GGUF=$(echo "$GGUF_FILES" | head -n 1)
    echo "Found GGUF file: $FIRST_GGUF"
    python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='$MODEL_ID', filename='$FIRST_GGUF', local_dir='models')"
    MODEL_ID="models/$(basename $FIRST_GGUF)"
  fi
  
  echo "Model downloaded to $MODEL_ID"
fi

echo "Setup complete!"
exit 0 