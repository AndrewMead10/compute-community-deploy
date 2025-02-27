# TGI Manager

A desktop application for managing and serving Hugging Face Text Generation Inference models locally.

## Features

- Configure and run TGI models with either CUDA or Llama.cpp backend
- Manage API keys for server access
- Automatic reverse proxy setup
- Support for gated models with Hugging Face tokens
- Automatic installation and setup of Text Generation Inference

## Installation

### Prerequisites

1. Node.js 16+ and npm
2. Python 3.8+
3. CUDA toolkit (for CUDA backend) or Llama.cpp (for CPU backend)
4. Git

### Setup

The application will automatically set up Text Generation Inference and all its dependencies when it starts for the first time. This includes:

1. Installing system dependencies (including Rust and Protobuf)
2. Setting up a Python virtual environment
3. Building text-generation-inference from source
4. Configuring the development environment

Simply run:

```bash
# Install dependencies
npm install

# Build and start the application
npm run build
npm start
```

## Usage

1. Start the application:
```bash
npm start
```

2. Configure your model:
   - Enter the model ID (e.g., "meta-llama/Llama-2-7b-chat-hf")
   - Choose your backend (CUDA or Llama.cpp)
   - Enter your Hugging Face token if using gated models

3. Generate API keys:
   - Create new API keys for external access
   - Enable/disable keys as needed

4. Start the server:
   - Click "Start Server" to launch the TGI instance
   - The server will be accessible via the configured reverse proxy

## API Endpoints

The TGI server exposes the following endpoints:

- `POST /generate`: Generate text from the model
- `GET /health`: Check server health
- `GET /metrics`: Get server metrics

## Development

To run in development mode:

```bash
npm run dev
```

This will start both the Electron app and the FastAPI server with hot reloading.