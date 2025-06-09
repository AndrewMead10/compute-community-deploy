# P2P LLM Sharing

This electron app now includes peer-to-peer (P2P) functionality that allows you to share your local LLM with other users over a WebRTC connection.

## How it Works

The P2P backend implements the architecture described in the deployment guide:

```
┌───────────────┐        HTTPS/WSS           ┌─────────────────┐
│  Browser App  │ ─────────────────────────▶ │  Signalling Hub │
│ (computecomm) │ ◀───────────────────────── │  (WebRTC-Star)  │
└─────▲─────────┘            SDP + ICE        └──────▲──────────┘
      │ libp2p / WebRTC DC                       │
      │ (noise-encrypted multiplexed stream)     │
      ▼                                           │
┌──────────────────┐          TCP/Unix socket     │
│ Electron Helper  │ ─────────────────────────────┘
│ (libp2p node)    │      localhost:8000
│                  │ ───► Llama-cpp server
└──────────────────┘
```

## Features

- **WebRTC Transport**: Direct peer-to-peer connections with NAT traversal
- **Circuit Relay Support**: Fallback relay connections for difficult network setups  
- **API Key Authentication**: Optional API key requirement for accessing your LLM
- **Connection Limits**: Configurable maximum number of simultaneous connections
- **Real-time Monitoring**: Live connection status and peer management
- **Shareable URLs**: Easy sharing with automatically generated peer URLs

## Usage

### 1. Start your LLM

First, make sure you have a local llama.cpp server running (typically on `127.0.0.1:8000`).

### 2. Configure P2P Settings

- **Signalling Server**: Leave blank to use the default WebRTC-star server, or specify your own
- **Llama.cpp Endpoint**: Configure the host and port of your local LLM server
- **API Key**: Optional - set an API key to require authentication from peers
- **Max Connections**: Limit the number of simultaneous peer connections (1-10)

### 3. Start P2P Sharing

Click "Start P2P Sharing" to:
- Initialize the libp2p node with WebRTC transport
- Generate a unique Peer ID
- Create a shareable URL (automatically copied to clipboard)
- Begin listening for peer connections

### 4. Share Your LLM

Share the generated URL with others who want to access your LLM. They can use this URL in browser applications that support libp2p WebRTC connections.

## Protocol Details

### Request Format

Peers send JSON requests over the libp2p stream:

```json
{
  "prompt": "Your prompt here",
  "max_tokens": 100,
  "temperature": 0.7,
  "top_p": 0.9,
  "stream": false,
  "apiKey": "optional-api-key",
  "parameters": {
    // Additional llama.cpp parameters
  }
}
```

### Response Format

The backend responds with:

```json
{
  "success": true,
  "data": {
    // llama.cpp response data
  }
}
```

Or on error:

```json
{
  "success": false,
  "error": "Error description"
}
```

## Security Features

- **Noise Encryption**: All libp2p connections are encrypted with the Noise protocol
- **API Key Authentication**: Optional API key validation for incoming requests
- **Connection Limits**: Protection against DoS via connection limiting
- **Resource Controls**: Built-in safeguards to prevent abuse

## Browser Client Integration

To connect to your shared LLM from a browser application, use js-libp2p with WebRTC transport:

```javascript
import { createLibp2p } from 'libp2p'
import { webRTC } from '@libp2p/webrtc'
import { noise } from '@chainsafe/libp2p-noise'
import { mplex } from '@libp2p/mplex'

const libp2p = await createLibp2p({
  transports: [webRTC()],
  connectionEncryption: [noise()],
  streamMuxers: [mplex()]
})

// Dial the electron helper using the shareable URL
const connection = await libp2p.dial('p2p://peer-id@signalling-server')
const stream = await connection.newStream('/llama/1.0.0')

// Send request and receive response
// Implementation depends on your specific client needs
```

## Troubleshooting

### Connection Issues

- Ensure your firewall allows WebRTC traffic
- Try different signalling servers if the default doesn't work
- Check that your local LLM server is running and accessible

### Performance

- WebRTC connections are direct peer-to-peer, so latency depends on network distance
- Connection limits help prevent resource exhaustion
- Monitor the logs for connection and error details

### NAT Traversal

- WebRTC includes STUN/TURN mechanisms for NAT traversal
- Circuit relay provides a fallback when direct connections fail
- Most residential networks support WebRTC connections

## Dependencies

The P2P functionality uses these key libraries:

- `libp2p` - Core peer-to-peer networking
- `@libp2p/webrtc` - WebRTC transport implementation  
- `@libp2p/tcp` - TCP transport for local connections
- `@chainsafe/libp2p-noise` - Noise encryption protocol
- `@libp2p/mplex` - Stream multiplexing
- `node-fetch` - HTTP client for llama.cpp communication

## Development

To modify or extend the P2P functionality:

1. **Backend Logic**: See `p2p-backend.js` for the core libp2p implementation
2. **Main Process**: Check `main.js` for IPC handlers and process management  
3. **Frontend**: Look at `renderer.js` for UI interactions and event handling
4. **Styling**: Update `styles.css` for visual customizations 