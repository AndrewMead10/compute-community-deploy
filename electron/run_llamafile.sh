#!/bin/bash

# Script to start the llamafile server and FastAPI middleware
# Arguments:
# $1 - Backend (CPU, CUDA, METAL)
# $2 - Model Path (path to the llamafile)
# $3 - RAM Memory Allocation (percentage)
# $4 - GPU Memory Allocation (percentage)

BACKEND=$1
MODEL_PATH=$2
RAM_MEMORY=$3
GPU_MEMORY=$4

echo "Starting llamafile server with backend: $BACKEND and model: $MODEL_PATH"
echo "Memory settings: RAM ${RAM_MEMORY}%, GPU ${GPU_MEMORY}%"

# Set environment variables based on backend
if [ "$BACKEND" == "CUDA" ]; then
  GPU_PARAMS="-ngl 999"
  echo "Using CUDA backend with GPU acceleration"
elif [ "$BACKEND" == "METAL" ]; then
  GPU_PARAMS="-ngl 999"
  echo "Using Metal backend with GPU acceleration"
else
  GPU_PARAMS="--parallel 4"
  echo "Using CPU backend"
fi

# Check if the model file exists and is executable
if [ ! -f "$MODEL_PATH" ]; then
  echo "Error: Model file not found at $MODEL_PATH"
  exit 1
fi

# Make sure the model file is executable
chmod +x "$MODEL_PATH"

# Start the llamafile HTTP server
echo "Starting llamafile server on port 8000..."
"$MODEL_PATH" -c 8192 --host 127.0.0.1 --port 8000 --nobrowser $GPU_PARAMS &
LLAMAFILE_PID=$!

# Wait for the server to start
echo "Waiting for llamafile server to start..."
sleep 5

# Check if the llamafile server is running
if ! ps -p $LLAMAFILE_PID > /dev/null; then
  echo "Error: Failed to start llamafile server"
  exit 1
fi

# Activate virtual environment if it exists (needed for the FastAPI middleware)
if [ -d "venv" ]; then
  echo "Activating virtual environment for FastAPI middleware..."
  
  # Check the operating system
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    source "venv/bin/activate"
  elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash or Cygwin)
    source "venv/Scripts/activate"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    source "venv/bin/activate"
  else
    echo "Unsupported operating system: $OSTYPE"
    exit 1
  fi
else
  echo "No virtual environment found. Creating one..."
  python -m venv venv
  
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    source "venv/bin/activate"
  elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash or Cygwin)
    source "venv/Scripts/activate"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    source "venv/bin/activate"
  else
    echo "Unsupported operating system: $OSTYPE"
    exit 1
  fi
  
  echo "Installing required packages for FastAPI middleware..."
  pip install --upgrade pip
  pip install fastapi uvicorn httpx
fi

# Start the FastAPI middleware
echo "Starting FastAPI middleware on port 8080"
cd ../deploy
python main.py &
MIDDLEWARE_PID=$!

# Function to handle script termination
cleanup() {
  echo "Shutting down servers..."
  kill $MIDDLEWARE_PID
  kill $LLAMAFILE_PID
  exit 0
}

# Set up trap to catch termination signals
trap cleanup SIGINT SIGTERM

# Keep the script running
echo "Both servers are running. Press Ctrl+C to stop."
wait 