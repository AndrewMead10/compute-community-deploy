#!/bin/bash

# Script to start the llama-cpp-python server and FastAPI middleware
# Arguments:
# $1 - Backend (CPU, CUDA, etc.)
# $2 - Model ID (path or HF model ID)

BACKEND=$1
MODEL_ID=$2

echo "Starting llama-cpp-python server with backend: $BACKEND and model: $MODEL_ID"

# Set environment variables based on backend
if [ "$BACKEND" == "CUDA" ]; then
  export LLAMA_CUBLAS=1
  echo "Using CUDA backend"
elif [ "$BACKEND" == "METAL" ]; then
  export LLAMA_METAL=1
  echo "Using Metal backend"
elif [ "$BACKEND" == "OPENBLAS" ]; then
  export LLAMA_OPENBLAS=1
  echo "Using OpenBLAS backend"
else
  echo "Using CPU backend"
fi

# Activate virtual environment
source venv/bin/activate

# Check if MODEL_ID is a local file path or a Hugging Face model ID
if [[ -f "$MODEL_ID" ]]; then
  # Local file path
  echo "Starting llama-cpp-python server with local model: $MODEL_ID"
  python -m llama_cpp.server --model "$MODEL_ID" --host 127.0.0.1 --port 8000 &
  LLAMA_PID=$!
elif [[ $MODEL_ID == *":"* ]]; then
  # Specific model file from a repository (repo:model format)
  REPO_ID=$(echo $MODEL_ID | cut -d':' -f1)
  MODEL_FILE=$(echo $MODEL_ID | cut -d':' -f2)
  MODEL_PATH="models/$(basename $MODEL_FILE)"
  
  if [[ -f "$MODEL_PATH" ]]; then
    echo "Starting llama-cpp-python server with downloaded model: $MODEL_PATH"
    python -m llama_cpp.server --model "$MODEL_PATH" --host 127.0.0.1 --port 8000 &
    LLAMA_PID=$!
  else
    echo "Model file not found: $MODEL_PATH"
    exit 1
  fi
else
  # Hugging Face model ID
  echo "Starting llama-cpp-python server with Hugging Face model: $MODEL_ID"
  python -m llama_cpp.server --hf_model_repo_id "$MODEL_ID" --model '*Q4_0.gguf' --host 127.0.0.1 --port 8000 &
  LLAMA_PID=$!
fi

# Wait for the server to start
echo "Waiting for llama-cpp-python server to start..."
sleep 5

# Start the FastAPI middleware
echo "Starting FastAPI middleware on port 8080"
cd ../deploy
python main.py &
MIDDLEWARE_PID=$!

# Function to handle script termination
cleanup() {
  echo "Shutting down servers..."
  kill $MIDDLEWARE_PID
  kill $LLAMA_PID
  exit 0
}

# Set up trap to catch termination signals
trap cleanup SIGINT SIGTERM

# Keep the script running
echo "Both servers are running. Press Ctrl+C to stop."
wait 