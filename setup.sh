#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Decentralized LLM GPU Sharing Application...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Please install Node.js (v14 or higher) and try again.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d '.' -f 1)

if [ $NODE_MAJOR_VERSION -lt 14 ]; then
    echo -e "${YELLOW}Node.js version $NODE_VERSION detected. This application requires Node.js v14 or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}Node.js v$NODE_VERSION detected.${NC}"

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Dependencies installed successfully!${NC}"
    echo -e "${YELLOW}You can now run the application with:${NC}"
    echo -e "${GREEN}npm start${NC}"
else
    echo -e "${YELLOW}Failed to install dependencies. Please check the error messages above.${NC}"
    exit 1
fi 