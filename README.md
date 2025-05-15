# LLM API Server with Authentication and Usage Tracking

This project provides a user-friendly interface for running LLM models using Mozilla's llamafile, with API key authentication and usage tracking.

## Features

- **Easy Model Setup**: Run LLM models across platforms (macOS, Linux, Windows) without installation
- **API Key Authentication**: Secure your API with user-specific API keys
- **Usage Tracking**: Track API usage statistics per user
- **System Monitoring**: Monitor CPU, memory, and GPU usage
- **User Management**: Add and delete API keys through the UI

## Architecture

The system consists of the following components:

1. **Electron App**: The main user interface for managing models, users, and viewing system information
2. **Setup Script**: Downloads and prepares llamafile models for execution
3. **LLamafile Server**: Runs the LLM model and provides the OpenAI-compatible API
4. **FastAPI Middleware**: Handles API key authentication and usage tracking

## How It Works

1. When you click "Run Model" in the UI, the system:
   - Runs the setup_llamafile.sh script to download the selected model as a llamafile
   - Makes the llamafile executable
   - Starts the llamafile server on port 8000
   - Starts the FastAPI middleware on port 8080

2. The FastAPI middleware:
   - Authenticates API requests using API keys
   - Tracks usage statistics per user
   - Forwards requests to the llamafile server
   - Returns responses to the client

3. To use the API:
   - Send requests to http://localhost:8080/v1/... (same endpoints as OpenAI API)
   - Include your API key in the "api-key" header

## API Endpoints

The middleware provides the following endpoints:

- All OpenAI-compatible endpoints from the llamafile server (forwarded)
- `/admin/usage`: Get usage statistics for all users

## Usage Statistics

The system tracks the following usage statistics per user:

- Total number of requests
- Total number of tokens used
- Last request timestamp
- Endpoint usage counts

## Requirements

- Python 3.8+ (for the middleware only)
- Node.js 14+
- Electron
- For CUDA backend: NVIDIA GPU with installed drivers
- For Metal backend: Apple Silicon or AMD GPU on macOS

## Models

This project uses Mozilla's llamafile versions of popular models, which are single-file executables that run on all major platforms without installation. Some recommended models include:

- **Meta-Llama-3-8B-Instruct**: High-performance 8B parameter model
- **Meta-Llama-3.1-8B**: Multilingual model with 128K context window
- **LLaVA v1.5 7B**: Vision-language model capable of understanding images
- **Whisper**: Speech recognition model for audio transcription

## License

MIT 