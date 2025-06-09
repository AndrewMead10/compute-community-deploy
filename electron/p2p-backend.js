// Polyfill for CustomEvent in Node.js environment
if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  };
}

class P2PBackend {
  constructor(options = {}) {
    this.node = null;
    this.signallingServer = '/dns4/signaler.computecommunity.com/tcp/443/wss/p2p-webrtc-star/';
    this.llamaCppPort = 15876; // Port from run.sh, its the fastapi server middleware
    this.llamaCppHost = '127.0.0.1';
    this.isRunning = false;
    this.connections = new Set();
    this.maxConnections = 5;
    this.apiKey = null;
    this.onPeerConnect = options.onPeerConnect || (() => {});
    this.onPeerDisconnect = options.onPeerDisconnect || (() => {});
    this.onError = options.onError || console.error;
    this.onStatusUpdate = options.onStatusUpdate || (() => {});
    
    // Store references to dynamically imported modules
    this.libp2pModules = null;
    this.fetch = null;
    this.uint8arrays = null;
  }

  async loadLibp2pModules() {
    if (this.libp2pModules) return this.libp2pModules;
    
    try {
      const [
        { createLibp2p },
        { tcp },
        { webRTC },
        { circuitRelayTransport },
        { noise },
        { yamux },
        { identify },
        { ping },
        { pipe }
      ] = await Promise.all([
        import('libp2p'),
        import('@libp2p/tcp'),
        import('@libp2p/webrtc'),
        import('@libp2p/circuit-relay-v2'),
        import('@chainsafe/libp2p-noise'),
        import('@chainsafe/libp2p-yamux'),
        import('@libp2p/identify'),
        import('@libp2p/ping'),
        import('it-pipe')
      ]);

      this.libp2pModules = {
        createLibp2p,
        tcp,
        webRTC,
        circuitRelayTransport,
        noise,
        yamux,
        identify,
        ping,
        pipe
      };

      return this.libp2pModules;
    } catch (error) {
      console.error('Failed to load libp2p modules:', error);
      throw new Error(`Failed to load libp2p modules: ${error.message}`);
    }
  }

  async loadFetch() {
    if (this.fetch) return this.fetch;
    
    try {
      const { default: fetch } = await import('node-fetch');
      this.fetch = fetch;
      return this.fetch;
    } catch (error) {
      console.error('Failed to load node-fetch:', error);
      throw new Error(`Failed to load node-fetch: ${error.message}`);
    }
  }

  async loadUint8arrays() {
    if (this.uint8arrays) return this.uint8arrays;
    
    try {
      const { fromString, toString } = await import('uint8arrays');
      this.uint8arrays = { fromString, toString };
      return this.uint8arrays;
    } catch (error) {
      console.error('Failed to load uint8arrays:', error);
      throw new Error(`Failed to load uint8arrays: ${error.message}`);
    }
  }

  async start() {
    if (this.isRunning) {
      throw new Error('P2P backend is already running');
    }

    try {
      // Load libp2p modules dynamically
      const { createLibp2p, tcp, webRTC, circuitRelayTransport, noise, yamux, identify, ping } = await this.loadLibp2pModules();

      // Create libp2p node
      this.node = await createLibp2p({
        addresses: {
          listen: [
            '/ip4/0.0.0.0/tcp/0', // TCP transport for direct connections
            '/webrtc' // WebRTC transport
          ]
        },
        transports: [
          tcp(),
          webRTC(),
          circuitRelayTransport()
        ],
        connectionEncryption: [noise()],
        streamMuxers: [yamux()],
        services: {
          identify: identify(),
          ping: ping()
        }
      });

      // Set up protocol handler for LLM requests
      await this.node.handle('/llama/1.0.0', this.handleLlamaRequest.bind(this));

      // Set up connection handlers
      this.node.addEventListener('peer:connect', this.handlePeerConnect.bind(this));
      this.node.addEventListener('peer:disconnect', this.handlePeerDisconnect.bind(this));

      // Start the node
      await this.node.start();
      this.isRunning = true;

      const peerId = this.node.peerId.toString();
      const multiaddrs = this.node.getMultiaddrs();

      this.onStatusUpdate({
        status: 'running',
        peerId,
        multiaddrs: multiaddrs.map(ma => ma.toString()),
        connections: this.connections.size
      });

      console.log('P2P Backend started');
      console.log('Peer ID:', peerId);
      console.log('Listening on:', multiaddrs.map(ma => ma.toString()));

      return {
        peerId,
        multiaddrs: multiaddrs.map(ma => ma.toString()),
        shareableUrl: this.generateShareableUrl(peerId)
      };

    } catch (error) {
      this.onError('Failed to start P2P backend:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    try {
      if (this.node) {
        await this.node.stop();
        this.node = null;
      }
      this.isRunning = false;
      this.connections.clear();

      this.onStatusUpdate({
        status: 'stopped',
        connections: 0
      });

      console.log('P2P Backend stopped');
    } catch (error) {
      this.onError('Error stopping P2P backend:', error);
      throw error;
    }
  }

  generateShareableUrl(peerId) {
    // Create a shareable URL that includes the peer ID and signalling server
    const signallingHost = this.signallingServer.replace('wss://', '').replace('/443/wss/p2p-webrtc-star/', '');
    return `p2p://${peerId}@${signallingHost}`;
  }

  async handleLlamaRequest({ stream, connection }) {
    const remotePeer = connection.remotePeer.toString();
    
    try {
      // Check connection limits
      if (this.connections.size >= this.maxConnections) {
        console.warn(`Connection limit reached. Rejecting connection from ${remotePeer}`);
        await this.sendError(stream, 'Connection limit reached');
        return;
      }

      console.log(`Handling LLM request from peer: ${remotePeer}`);

      // Read the request from the stream
      const requestData = await this.readFromStream(stream);
      
      if (!requestData) {
        await this.sendError(stream, 'No request data received');
        return;
      }

      // Parse the request
      let request;
      try {
        request = JSON.parse(requestData);
      } catch (e) {
        await this.sendError(stream, 'Invalid JSON request');
        return;
      }

      // Validate API key if required
      if (this.apiKey && request.apiKey !== this.apiKey) {
        await this.sendError(stream, 'Invalid API key');
        return;
      }

      // Forward request to local llama-cpp server
      const response = await this.forwardToLlamaCpp(request);
      
      // Send response back through the stream
      await this.writeToStream(stream, JSON.stringify(response));

    } catch (error) {
      console.error(`Error handling request from ${remotePeer}:`, error);
      await this.sendError(stream, 'Internal server error');
    }
  }

  async forwardToLlamaCpp(request) {
    try {
      const fetch = await this.loadFetch();
      const llamaCppUrl = `http://${this.llamaCppHost}:${this.llamaCppPort}`;
      
      // Map the request to llama-cpp format
      const llamaCppRequest = {
        prompt: request.prompt || '',
        max_tokens: request.max_tokens || 100,
        temperature: request.temperature || 0.7,
        top_p: request.top_p || 0.9,
        stream: request.stream || false,
        ...request.parameters // Include any additional parameters
      };

      console.log(`Forwarding request to llama-cpp at ${llamaCppUrl}/completion`);

      const response = await fetch(`${llamaCppUrl}/completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(llamaCppRequest)
      });

      if (!response.ok) {
        throw new Error(`Llama-cpp server responded with status: ${response.status}`);
      }

      const responseData = await response.json();
      return {
        success: true,
        data: responseData
      };

    } catch (error) {
      console.error('Error forwarding to llama-cpp:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async readFromStream(stream) {
    try {
      const { pipe } = await this.loadLibp2pModules();
      const { toString } = await this.loadUint8arrays();
      const chunks = [];
      
      await pipe(
        stream.source,
        async function (source) {
          for await (const chunk of source) {
            chunks.push(chunk.subarray());
          }
        }
      );

      if (chunks.length === 0) return null;
      
      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      return toString(combined);
    } catch (error) {
      console.error('Error reading from stream:', error);
      return null;
    }
  }

  async writeToStream(stream, data) {
    try {
      const { pipe } = await this.loadLibp2pModules();
      const { fromString } = await this.loadUint8arrays();
      await pipe(
        [fromString(data)],
        stream.sink
      );
    } catch (error) {
      console.error('Error writing to stream:', error);
      throw error;
    }
  }

  async sendError(stream, errorMessage) {
    try {
      const errorResponse = JSON.stringify({
        success: false,
        error: errorMessage
      });
      await this.writeToStream(stream, errorResponse);
    } catch (error) {
      console.error('Error sending error response:', error);
    }
  }

  handlePeerConnect(event) {
    const peerId = event.detail.toString();
    this.connections.add(peerId);
    
    console.log(`Peer connected: ${peerId}`);
    console.log(`Active connections: ${this.connections.size}`);
    
    this.onPeerConnect(peerId);
    this.onStatusUpdate({
      status: 'running',
      connections: this.connections.size,
      lastConnected: peerId
    });
  }

  handlePeerDisconnect(event) {
    const peerId = event.detail.toString();
    this.connections.delete(peerId);
    
    console.log(`Peer disconnected: ${peerId}`);
    console.log(`Active connections: ${this.connections.size}`);
    
    this.onPeerDisconnect(peerId);
    this.onStatusUpdate({
      status: 'running',
      connections: this.connections.size,
      lastDisconnected: peerId
    });
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      peerId: this.node ? this.node.peerId.toString() : null,
      connections: this.connections.size,
      multiaddrs: this.node ? this.node.getMultiaddrs().map(ma => ma.toString()) : []
    };
  }
}

module.exports = { P2PBackend }; 