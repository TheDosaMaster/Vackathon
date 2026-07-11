export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'INITIALIZING' | 'CONNECTED' | 'ERROR';

export interface LogMessage {
  id: string;
  timestamp: Date;
  direction: 'sent' | 'received' | 'system';
  content: string;
}

export class McpClient {
  private sseUrl: string;
  private eventSource: EventSource | null = null;
  private postUrl: string | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private requestIdCounter = 1;
  private pendingRequests = new Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }>();

  private onStatusChangeCallback: ((status: ConnectionStatus) => void) | null = null;
  private onLogCallback: ((log: LogMessage) => void) | null = null;

  constructor(sseUrl: string) {
    this.sseUrl = sseUrl;
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.onStatusChangeCallback = callback;
  }

  public onLog(callback: (log: LogMessage) => void) {
    this.onLogCallback = callback;
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(newStatus);
    }
  }

  private log(direction: 'sent' | 'received' | 'system', content: any) {
    if (this.onLogCallback) {
      this.onLogCallback({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date(),
        direction,
        content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      });
    }
  }

  public async connect(): Promise<void> {
    if (this.status !== 'DISCONNECTED' && this.status !== 'ERROR') {
      return;
    }

    this.setStatus('CONNECTING');
    this.log('system', `Connecting to SSE endpoint: ${this.sseUrl}`);

    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource(this.sseUrl);

        // Handle EventSource connection errors
        this.eventSource.onerror = (err) => {
          this.log('system', `EventSource connection failed. Check if server is running at ${this.sseUrl}`);
          this.setStatus('ERROR');
          this.disconnect();
          reject(new Error('EventSource failed to connect'));
        };

        // Server sends the "endpoint" event to specify the client-to-server POST messages target.
        this.eventSource.addEventListener('endpoint', async (event: any) => {
          try {
            const rawPath = event.data;
            // Resolve the post target relative to the sseUrl
            const resolvedUrl = new URL(rawPath, this.sseUrl).toString();
            this.postUrl = resolvedUrl;
            this.log('system', `Received post message endpoint: ${resolvedUrl}`);
            
            // Connection is established, now initialize the protocol
            this.setStatus('INITIALIZING');
            await this.initializeProtocol();
            resolve();
          } catch (e: any) {
            this.log('system', `Failed to initialize protocol: ${e.message}`);
            this.setStatus('ERROR');
            this.disconnect();
            reject(e);
          }
        });

        // Listen for incoming JSON-RPC messages from the server
        this.eventSource.addEventListener('message', (event: MessageEvent) => {
          this.handleIncomingMessage(event.data);
        });

      } catch (e: any) {
        this.log('system', `Connection setup failed: ${e.message}`);
        this.setStatus('ERROR');
        reject(e);
      }
    });
  }

  private handleIncomingMessage(dataStr: string) {
    try {
      const message = JSON.parse(dataStr);
      this.log('received', message);

      if (message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          if (message.error) {
            pending.reject(message.error);
          } else {
            pending.resolve(message.result);
          }
        }
      } else {
        // This is a notification or progress event from the server
        this.log('system', `Received server notification: ${JSON.stringify(message)}`);
      }
    } catch (e: any) {
      this.log('system', `Failed to parse message: ${dataStr} - Error: ${e.message}`);
    }
  }

  private async initializeProtocol(): Promise<void> {
    this.log('system', 'Sending MCP initialize request...');
    const result = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true }
      },
      clientInfo: {
        name: 'vite-mcp-playground',
        version: '1.0.0'
      }
    });

    this.log('system', `Server initialized: ${result.serverInfo.name} (v${result.serverInfo.version})`);
    
    // Send initialized notification (which expects no response)
    await this.sendNotification('notifications/initialized');
    
    this.setStatus('CONNECTED');
    this.log('system', 'MCP Connection fully established and ready!');
  }

  private async sendRequest(method: string, params: any = {}): Promise<any> {
    if (!this.postUrl) {
      throw new Error('No post URL available. Client is not connected.');
    }

    const id = this.requestIdCounter++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      // Set a timeout for the request
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} (id: ${id}) timed out after 15 seconds`));
        }
      }, 15000);

      this.pendingRequests.set(id, {
        resolve: (res) => {
          clearTimeout(timeoutId);
          resolve(res);
        },
        reject: (err) => {
          clearTimeout(timeoutId);
          reject(err);
        }
      });

      this.log('sent', payload);

      fetch(this.postUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }).catch((err) => {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        this.log('system', `Network error posting message: ${err.message}`);
        reject(err);
      });
    });
  }

  private async sendNotification(method: string, params: any = {}): Promise<void> {
    if (!this.postUrl) {
      throw new Error('No post URL available. Client is not connected.');
    }

    const payload = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.log('sent', payload);

    await fetch(this.postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    }).catch((err) => {
      this.log('system', `Network error sending notification: ${err.message}`);
    });
  }

  public async listTools(): Promise<any> {
    return this.sendRequest('tools/list');
  }

  public async callTool(name: string, args: any = {}): Promise<any> {
    return this.sendRequest('tools/call', {
      name,
      arguments: args
    });
  }

  public async listResources(): Promise<any> {
    return this.sendRequest('resources/list');
  }

  public async readResource(uri: string): Promise<any> {
    return this.sendRequest('resources/read', {
      uri
    });
  }

  public async listPrompts(): Promise<any> {
    return this.sendRequest('prompts/list');
  }

  public async getPrompt(name: string, args: any = {}): Promise<any> {
    return this.sendRequest('prompts/get', {
      name,
      arguments: args
    });
  }

  public disconnect() {
    this.log('system', 'Disconnecting...');
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.postUrl = null;
    
    // Reject any pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    
    this.setStatus('DISCONNECTED');
    this.log('system', 'Disconnected from server.');
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }
}
