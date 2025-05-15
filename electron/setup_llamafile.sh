#!/bin/bash

# Script to set up the environment for llamafile
# Arguments:
# $1 - Backend (CPU, CUDA, METAL)
# $2 - Model ID (path, HF model ID, or llamafile URL)
# $3 - RAM Memory Allocation (percentage)
# $4 - GPU Memory Allocation (percentage)

BACKEND=$1
MODEL_ID=$2
RAM_MEMORY=$3
GPU_MEMORY=$4

echo "Setting up environment for $BACKEND with model $MODEL_ID"
echo "Memory settings: RAM ${RAM_MEMORY}%, GPU ${GPU_MEMORY}%"

# Create models directory if it doesn't exist
mkdir -p models

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to download a file with progress
download_file() {
    local url=$1
    local output=$2
    
    if command_exists wget; then
        wget -O "$output" "$url" --show-progress
    elif command_exists curl; then
        curl -L "$url" -o "$output" --progress-bar
    else
        echo "Error: Neither wget nor curl is installed. Please install one of them."
        exit 1
    fi
}

# Set environment variables for memory allocation
if [ "$BACKEND" = "CPU" ]; then
    GPU_ENABLED=0
    MEM_PARAMS="--nobrowser --parallel 1"
elif [ "$BACKEND" = "CUDA" ]; then
    GPU_ENABLED=1
    MEM_PARAMS="--nobrowser -ngl 999"
elif [ "$BACKEND" = "METAL" ]; then
    GPU_ENABLED=1
    MEM_PARAMS="--nobrowser -ngl 999"
fi

# Check if MODEL_ID contains a URL (likely a direct download link to a llamafile)
if [[ $MODEL_ID == http* && $MODEL_ID == *.llamafile ]]; then
    echo "Downloading llamafile from URL: $MODEL_ID"
    MODEL_FILENAME=$(basename "$MODEL_ID")
    MODEL_PATH="models/$MODEL_FILENAME"
    
    if [ ! -f "$MODEL_PATH" ]; then
        download_file "$MODEL_ID" "$MODEL_PATH"
        chmod +x "$MODEL_PATH"
    else
        echo "Model file already exists: $MODEL_PATH"
    fi
    
    MODEL_ID="$MODEL_PATH"

# Check if MODEL_ID contains a specific model from Hugging Face (repo:model format)
elif [[ $MODEL_ID == *":"* ]]; then
    echo "Detected specific model file in repository"
    REPO_ID=$(echo $MODEL_ID | cut -d':' -f1)
    MODEL_FILE=$(echo $MODEL_ID | cut -d':' -f2)
    MODEL_PATH="models/$(basename $MODEL_FILE)"
    
    # Check if it's from Mozilla/llamafile repo or Mozilla's llamafile models
    if [[ $REPO_ID == "Mozilla/"* && ($MODEL_FILE == *.llamafile || $REPO_ID == *"llamafile") ]]; then
        # Download from HF using direct URL approach
        HF_URL="https://huggingface.co/$REPO_ID/resolve/main/$MODEL_FILE"
        
        if [ ! -f "$MODEL_PATH" ]; then
            echo "Downloading llamafile: $HF_URL"
            download_file "$HF_URL" "$MODEL_PATH"
            chmod +x "$MODEL_PATH"
        else
            echo "Model file already exists: $MODEL_PATH"
        fi
    else
        echo "Downloading model from Hugging Face..."
        if ! python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='$REPO_ID', filename='$MODEL_FILE', local_dir='models')"; then
            echo "Failed to download model from Hugging Face"
            exit 1
        fi
    fi
    
    MODEL_ID="$MODEL_PATH"

# Check if MODEL_ID is a repo ID containing llamafile (like Mozilla/Meta-Llama-3-8B-Instruct-llamafile)
elif [[ $MODEL_ID == *"llamafile"* && $MODEL_ID == *"/"* ]]; then
    echo "Looking for llamafile in the repository..."
    
    # List files in the repository
    if command_exists python; then
        FILES=$(python -c "from huggingface_hub import list_repo_files; print('\n'.join(list_repo_files('$MODEL_ID')))")
        
        # Find the first llamafile
        LLAMAFILE=$(echo "$FILES" | grep "\.llamafile$" | head -n 1)
        
        if [ -z "$LLAMAFILE" ]; then
            echo "No llamafile found in the repository $MODEL_ID"
            exit 1
        fi
        
        echo "Found llamafile: $LLAMAFILE"
        MODEL_PATH="models/$(basename $LLAMAFILE)"
        
        # Download the llamafile
        if [ ! -f "$MODEL_PATH" ]; then
            HF_URL="https://huggingface.co/$MODEL_ID/resolve/main/$LLAMAFILE"
            echo "Downloading llamafile: $HF_URL"
            download_file "$HF_URL" "$MODEL_PATH"
            chmod +x "$MODEL_PATH"
        else
            echo "Model file already exists: $MODEL_PATH"
        fi
        
        MODEL_ID="$MODEL_PATH"
    else
        echo "Python is not installed. Cannot list files in the repository."
        exit 1
    fi

# If MODEL_ID is an existing local file
elif [ -f "$MODEL_ID" ]; then
    echo "Using local model file: $MODEL_ID"
    # Make sure it's executable if it's a llamafile
    if [[ $MODEL_ID == *.llamafile ]]; then
        chmod +x "$MODEL_ID"
    fi
else
    echo "Error: Unsupported model specification: $MODEL_ID"
    exit 1
fi

# Verify the model file exists
if [ ! -f "$MODEL_ID" ]; then
    echo "Error: Model file not found at $MODEL_ID"
    exit 1
fi

echo "Using model file: $MODEL_ID"
echo "Setup complete!"
exit 0 