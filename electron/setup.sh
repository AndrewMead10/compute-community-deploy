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

# Download the model if it's a Hugging Face model ID
if [[ $MODEL_ID == *"/"* ]]; then
  echo "Downloading model from Hugging Face..."
  pip install huggingface_hub
  python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='$MODEL_ID', filename='ggml-model-q4_0.bin', local_dir='models')"
  MODEL_ID="models/ggml-model-q4_0.bin"
  echo "Model downloaded to $MODEL_ID"
fi

echo "Setup complete!"
exit 0 