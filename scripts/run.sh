#!/bin/bash

# Script to start the llamafile server and FastAPI middleware
# Arguments:
# $1 - Backend (CPU, CUDA, METAL, etc.)
# $2 - Model ID (path or HF model ID)
# $3 - RAM Memory Allocation (percentage)
# $4 - GPU Memory Allocation (percentage)

BACKEND=$1
MODEL_ID=$2
RAM_MEMORY=$3
GPU_MEMORY=$4

echo "Starting llamafile server with backend: $BACKEND and model: $MODEL_ID"
echo "Memory settings: RAM ${RAM_MEMORY}%, GPU ${GPU_MEMORY}%"

# Function to find the actual model file path
find_model_path() {
    local model_id="$1"
    
    # If it's already a valid file path, use it
    if [[ -f "$model_id" ]]; then
        echo "$model_id"
        return
    fi
    
    # If it's in repo:file format, find the downloaded file
    if [[ $model_id == *":"* ]]; then
        local model_file=$(echo $model_id | cut -d':' -f2)
        local model_path="../models/$(basename $model_file)"
        if [[ -f "$model_path" ]]; then
            echo "$model_path"
            return
        fi
    fi
    
    # If it's a HuggingFace repo ID, find GGUF files in models directory
    if [[ $model_id == *"/"* ]]; then
        # Look for any GGUF file in the models directory
        local gguf_file=$(find ../models/ -name "*.gguf" -type f | head -n 1)
        if [[ -f "$gguf_file" ]]; then
            echo "$gguf_file"
            return
        fi
    fi
    
    # Return empty if not found
    echo ""
}

# Find the actual model file
MODEL_PATH=$(find_model_path "$MODEL_ID")

if [[ -z "$MODEL_PATH" ]]; then
    echo "Error: Could not find model file for $MODEL_ID"
    echo "Please ensure the model has been downloaded using download.sh"
    exit 1
fi

echo "Using model file: $MODEL_PATH"

# Check if llamafile server exists
if [[ ! -f "../bin/llamafile-server" ]]; then
    echo "Error: llamafile server not found at ../bin/llamafile-server"
    echo "Please run download.sh first to download the llamafile server"
    exit 1
fi

# Build llamafile server command with memory and backend settings
LLAMAFILE_CMD="../bin/llamafile-server --server --v2 --listen 0.0.0.0:14238 --model $MODEL_PATH"

# Add backend-specific flags
if [ "$BACKEND" == "CUDA" ]; then
    LLAMAFILE_CMD="$LLAMAFILE_CMD --n-gpu-layers 999"  # Use GPU layers
    if [ -n "$GPU_MEMORY" ] && [ "$GPU_MEMORY" -gt 0 ]; then
        # Note: llamafile may not have direct GPU memory percentage control
        # This is a placeholder for potential future support
        echo "GPU memory allocation: ${GPU_MEMORY}% (Note: llamafile may not support percentage-based GPU memory allocation)"
    fi
elif [ "$BACKEND" == "METAL" ]; then
    LLAMAFILE_CMD="$LLAMAFILE_CMD --n-gpu-layers 999"  # Use GPU layers on Metal
    if [ -n "$GPU_MEMORY" ] && [ "$GPU_MEMORY" -gt 0 ]; then
        echo "GPU memory allocation: ${GPU_MEMORY}% (Note: llamafile may not support percentage-based GPU memory allocation)"
    fi
elif [ "$BACKEND" == "CPU" ]; then
    LLAMAFILE_CMD="$LLAMAFILE_CMD --n-gpu-layers 0"  # Force CPU only
    if [ -n "$RAM_MEMORY" ] && [ "$RAM_MEMORY" -gt 0 ]; then
        # Calculate threads based on available CPU cores
        cpu_cores=$(nproc 2>/dev/null || echo "4")
        threads=$(( cpu_cores * 2 ))
        if [ -n "$threads" ] && [ "$threads" -lt 1 ]; then
            threads=1
        fi
        LLAMAFILE_CMD="$LLAMAFILE_CMD --threads $threads"
        echo "Using $threads threads"
    fi
fi

# Add additional common flags
LLAMAFILE_CMD="$LLAMAFILE_CMD --ctx-size 16384"  # Context size

echo "Starting llamafile server..."
echo "Command: $LLAMAFILE_CMD"

# Start llamafile server in background
$LLAMAFILE_CMD &
LLAMAFILE_PID=$!

# Wait for the server to start
echo "Waiting for llamafile server to start..."
sleep 5

# Check if llamafile server is running
if ! kill -0 $LLAMAFILE_PID 2>/dev/null; then
    echo "Error: llamafile server failed to start"
    exit 1
fi

echo "llamafile server started successfully (PID: $LLAMAFILE_PID)"

# Activate virtual environment for Python middleware
echo "Activating Python virtual environment..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    source "../python/venv/bin/activate"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    source "../python/venv/Scripts/activate"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    source "../python/venv/bin/activate"
else
    echo "Unsupported operating system: $OSTYPE"
    kill $LLAMAFILE_PID
    exit 1
fi

# Start the FastAPI middleware
echo "Starting FastAPI middleware on port 15876..."
cd ../python
python main.py &
MIDDLEWARE_PID=$!

# Function to handle script termination
cleanup() {
    echo ""
    echo "Shutting down servers..."
    if [ -n "$MIDDLEWARE_PID" ]; then
        echo "Stopping FastAPI middleware (PID: $MIDDLEWARE_PID)..."
        kill $MIDDLEWARE_PID 2>/dev/null
    fi
    if [ -n "$LLAMAFILE_PID" ]; then
        echo "Stopping llamafile server (PID: $LLAMAFILE_PID)..."
        kill $LLAMAFILE_PID 2>/dev/null
    fi
    echo "Cleanup complete."
    exit 0
}

# Set up trap to catch termination signals
trap cleanup SIGINT SIGTERM

# Keep the script running and show status
echo ""
echo "=== Servers Status ==="
echo "llamafile server: http://127.0.0.1:14238 (PID: $LLAMAFILE_PID)"
echo "FastAPI middleware: http://127.0.0.1:15876 (PID: $MIDDLEWARE_PID)"
echo ""
echo "Both servers are running. Press Ctrl+C to stop."

# Monitor both processes
while true; do
    # Check if llamafile server is still running
    if ! kill -0 $LLAMAFILE_PID 2>/dev/null; then
        echo "Error: llamafile server has stopped unexpectedly"
        cleanup
    fi
    
    # Check if middleware is still running
    if ! kill -0 $MIDDLEWARE_PID 2>/dev/null; then
        echo "Error: FastAPI middleware has stopped unexpectedly"
        cleanup
    fi
    
    sleep 10
done 