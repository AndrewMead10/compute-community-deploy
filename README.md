# LLM API Server with Authentication and Usage Tracking

This project provides a user-friendly interface for running LLM models using llama-cpp-python, with API key authentication and usage tracking.

## Features

- **Easy Model Setup**: Run LLM models with different backends (CPU, CUDA, Metal, OpenBLAS)
- **API Key Authentication**: Secure your API with user-specific API keys
- **Usage Tracking**: Track API usage statistics per user
- **System Monitoring**: Monitor CPU, memory, and GPU usage
- **User Management**: Add and delete API keys through the UI

## Architecture

The system consists of the following components:

1. **Electron App**: The main user interface for managing models, users, and viewing system information
2. **Setup Script**: Installs llama-cpp-python with the appropriate backend and downloads models
3. **LLama-cpp-python Server**: Runs the LLM model and provides the OpenAI-compatible API
4. **FastAPI Middleware**: Handles API key authentication and usage tracking

## How It Works

1. When you click "Run Model" in the UI, the system:
   - Runs the setup.sh script to install llama-cpp-python with the selected backend
   - Downloads the model if it's a Hugging Face model ID
   - Starts the llama-cpp-python server on port 8000
   - Starts the FastAPI middleware on port 8080

2. The FastAPI middleware:
   - Authenticates API requests using API keys
   - Tracks usage statistics per user
   - Forwards requests to the llama-cpp-python server
   - Returns responses to the client

3. To use the API:
   - Send requests to http://localhost:8080/v1/... (same endpoints as OpenAI API)
   - Include your API key in the "api-key" header

## API Endpoints

The middleware provides the following endpoints:

- All OpenAI-compatible endpoints from llama-cpp-python (forwarded)
- `/admin/usage`: Get usage statistics for all users

## Usage Statistics

The system tracks the following usage statistics per user:

- Total number of requests
- Total number of tokens used
- Last request timestamp
- Endpoint usage counts

## Requirements

- Python 3.8+
- Node.js 14+
- Electron
- For CUDA backend: NVIDIA GPU with CUDA toolkit
- For Metal backend: Apple Silicon or AMD GPU on macOS

## License

MIT 