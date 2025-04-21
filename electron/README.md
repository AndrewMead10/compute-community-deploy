# LLM Runner

An Electron application that allows users to easily run Large Language Models (LLMs) with different backends.

## Features

- Run LLMs with different backends (llama.cpp or sgalng)
- Select models from Hugging Face
- View system hardware information
- Manage API keys for users

## Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Python 3.8+ (for the backend server)
- Bash shell (for setup scripts)

## Installation

1. Clone the repository
2. Install dependencies:

```bash
cd electron
npm install
```

## Development

To start the application in development mode:

```bash
npm start
```

## Building

To build the application:

```bash
npm run build
```

## Project Structure

- `main.js` - Main Electron process
- `preload.js` - Preload script for secure IPC communication
- `index.html` - Main application UI
- `renderer.js` - Renderer process for UI interactions
- `styles.css` - Application styling
- `setup.sh` - Script to set up the Python environment and download models
- `main.py` - FastAPI server for running the LLM

## How It Works

1. The user selects a backend (llama.cpp or sgalng) and a model ID from Hugging Face
2. When the "Run Model" button is clicked, the application executes the `setup.sh` script
3. The script sets up a Python environment, installs dependencies, and downloads the model
4. The script then starts a FastAPI server (`main.py`) that serves the LLM
5. The application communicates with the FastAPI server to interact with the LLM

## License

MIT 