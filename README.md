# Decentralized LLM GPU Sharing

A desktop application that allows users to share GPU resources for running Large Language Models (LLMs) in a decentralized network.

## Features

- **Hardware Detection**: Automatically detects and displays information about your CPU, RAM, and GPU
- **GPU Benchmarking**: Test your GPU's performance for running LLMs
- **Peer-to-Peer Network**: Connect with friends to share GPU resources
- **LLM Task Management**: Run inference and fine-tuning tasks on local or remote GPUs
- **Real-time Monitoring**: Track GPU usage and task progress

## Screenshots

![Hardware Detection](https://via.placeholder.com/800x450.png?text=Hardware+Detection)
![Network Peers](https://via.placeholder.com/800x450.png?text=Network+Peers)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/decentralized-llm-gpu.git
   cd decentralized-llm-gpu
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

## Development

This application is built with Electron and uses the following libraries:
- Chart.js for data visualization
- systeminformation for hardware detection
- electron-store for persistent settings

### Project Structure

```
decentralized-llm-gpu/
├── main.js           # Main Electron process
├── renderer.js       # Renderer process (UI logic)
├── index.html        # HTML structure
├── styles.css        # CSS styling
└── package.json      # Project configuration
```

### Building for Production

To build the application for production:

```bash
npm run package
```

This will create distributable packages for Windows, macOS, and Linux in the `dist` directory.

## Future Plans

- Integration with FastAPI backend for more advanced LLM operations
- Support for more LLM models and frameworks
- Improved security and authentication
- Distributed training capabilities

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to all the open-source libraries that made this project possible
- Inspired by the need for more accessible AI computing resources 