#!/bin/bash

# Script to set up the environment for llama-cpp-python
# Arguments:
# $1 - Backend (CPU, CUDA, etc.)
# $2 - Model ID (path or HF model ID)

BACKEND=$1
MODEL_ID=$2

echo "Setting up environment for $BACKEND with model $MODEL_ID"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if a virtual environment already exists
if [ -d "venv" ]; then
    echo "Virtual environment already exists. Skipping setup."
else
    echo "Virtual environment not found. Proceeding with setup."

    # Check for Python installation
    if ! command_exists python; then
        #make check for just python and also python3
        echo "Python is not installed. Please install it and rerun the script."
        echo "Download it from this link: https://www.python.org/downloads/"
        exit 1
    fi

    echo "Python is installed. Version: $(python --version)"

    echo "Creating virtual environment..."
    python -m venv venv

    # Activate virtual environment (Git Bash / WSL)
    echo "Activating virtual environment..."
    source venv/Scripts/activate

    fi

    echo "Installing dependencies..."
    pip install --upgrade pip
    pip install -r ../deploy/requirements.txt

    echo "Setup complete! Virtual environment is ready."
fi

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