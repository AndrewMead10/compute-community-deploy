#!/bin/bash

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

    # Install dependencies
    if [ ! -f "requirements.txt" ]; then
        echo "requirements.txt not found. Creating a default one."
        cat <<EOT > requirements.txt

fastapi
setuptools 
wheel
cmake
llama-cpp-python

EOT
    fi

    echo "Installing dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt

    echo "Setup complete! Virtual environment is ready."
fi
