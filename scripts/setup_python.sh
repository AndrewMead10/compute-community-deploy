#!/bin/bash

# Script to set up the Python environment for the FastAPI middleware
# This script only handles Python setup - no model downloads or llamafile setup

echo "Setting up Python environment for FastAPI middleware..."

# Change to python directory
cd ../python

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if a virtual environment already exists
if [ -d "venv" ]; then
    echo "Virtual environment already exists. Skipping setup."
    exit 0
fi

echo "Virtual environment not found. Proceeding with setup."

# Check for Python installation
if ! command_exists python && ! command_exists python3; then
    echo "Python is not installed. Please install it and rerun the script."
    echo "Download it from this link: https://www.python.org/downloads/"
    exit 1
fi

# Use python3 if available, otherwise python
PYTHON_CMD="python"
if command_exists python3; then
    PYTHON_CMD="python3"
fi

echo "Python is installed. Version: $($PYTHON_CMD --version)"

echo "Creating virtual environment..."
$PYTHON_CMD -m venv venv

# Activate virtual environment based on OS
echo "Activating virtual environment..."
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

echo "Installing Python dependencies..."
pip install --upgrade pip

# Install simplified requirements for middleware only
pip install -r requirements.txt

echo "Python environment setup complete!"
exit 0 