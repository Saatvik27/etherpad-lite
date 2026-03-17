import { Socket } from 'socket.io-client';

export class SocketService {
  private socket: Socket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private onDisconnectCallback: (() => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private listenersAttached = false;
  private disconnectListener: (() => void) | null = null;
  private connectListener: (() => void) | null = null;
  private messageListener: ((msg: any) => void) | null = null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const attemptConnection = (retryCount = 0) => {
        try {
          console.log(`[AI Chat Widget] Connection attempt ${retryCount + 1}...`);
          
          // Get socket from parent window (Etherpad's socket)
          const parentWindow = window.parent || window;
          const pad = (parentWindow as any).pad;
          const padSocket = pad?.socket;

          if (padSocket && padSocket.connected) {
            this.socket = padSocket;
            console.log('[AI Chat Widget] Socket connected successfully!');
            this.setupListeners();
            this.reconnectAttempts = 0;
            if (this.onConnectCallback) {
              this.onConnectCallback();
            }
            resolve();
          } else if (padSocket) {
            // Socket exists but not connected yet, wait for it
            console.log('[AI Chat Widget] Socket exists but not connected, waiting...');
            
            const connectHandler = () => {
              this.socket = padSocket;
              console.log('[AI Chat Widget] Socket connected after waiting!');
              this.setupListeners();
              this.reconnectAttempts = 0;
              if (this.onConnectCallback) {
                this.onConnectCallback();
              }
              resolve();
            };
            
            padSocket.once('connect', connectHandler);
            
            // Timeout after 3 seconds, then retry
            setTimeout(() => {
              if (!this.socket && retryCount < 3) {
                padSocket.off('connect', connectHandler);
                attemptConnection(retryCount + 1);
              } else if (!this.socket) {
                reject(new Error('Socket connection timeout'));
              }
            }, 3000);
          } else {
            // Pad object not ready yet, retry
            if (retryCount < 5) {
              console.log('[AI Chat Widget] Pad socket not ready, retrying in 1s...');
              setTimeout(() => attemptConnection(retryCount + 1), 1000);
            } else {
              console.error('[AI Chat Widget] Pad socket not found after retries');
              reject(new Error('Pad socket not found'));
            }
          }
        } catch (error) {
          console.error('[AI Chat Widget] Connection error:', error);
          if (retryCount < 5) {
            setTimeout(() => attemptConnection(retryCount + 1), 1000);
          } else {
            reject(error);
          }
        }
      };
      
      attemptConnection();
    });
  }

  private setupListeners() {
    if (!this.socket) return;

    if (this.listenersAttached) {
      return;
    }

    console.log('[AI Chat Widget] Setting up socket listeners...');

    this.disconnectListener = () => {
      console.warn('[AI Chat Widget] Socket disconnected');
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
      this.attemptReconnect();
    };

    this.connectListener = () => {
      console.log('[AI Chat Widget] Socket reconnected');
      this.reconnectAttempts = 0;
      if (this.onConnectCallback) {
        this.onConnectCallback();
      }
    };

    this.messageListener = (msg: any) => {
      console.log('[AI Chat Widget] Received message:', msg);
      
      // Handle AI messages sent directly (not wrapped in COLLABROOM)
      if (
        msg.type === 'AI_RESPONSE' ||
        msg.type === 'AI_HISTORY' ||
        msg.type === 'AI_PAD_MODIFIED' ||
        msg.type === 'AI_SESSIONS' ||
        msg.type === 'AI_SESSION_CREATED' ||
        msg.type === 'AI_SESSION_CLEARED'
      ) {
        const handler = this.messageHandlers.get(msg.type);
        if (handler) {
          console.log('[AI Chat Widget] Calling handler for:', msg.type);
          handler(msg.data);
        } else {
          console.warn('[AI Chat Widget] No handler registered for:', msg.type);
        }
        return;
      }
      
      // Handle COLLABROOM wrapped messages
      if (msg.type === 'COLLABROOM' && msg.data) {
        const { type, data } = msg.data;
        const handler = this.messageHandlers.get(type);
        if (handler) {
          console.log('[AI Chat Widget] Calling handler for COLLABROOM:', type);
          handler(data);
        }
      }
    };

    this.socket.on('disconnect', this.disconnectListener);
    this.socket.on('connect', this.connectListener);
    this.socket.on('message', this.messageListener);
    this.listenersAttached = true;
  }

  private removeListeners() {
    if (!this.socket || !this.listenersAttached) return;

    if (this.disconnectListener) {
      this.socket.off('disconnect', this.disconnectListener);
      this.disconnectListener = null;
    }
    if (this.connectListener) {
      this.socket.off('connect', this.connectListener);
      this.connectListener = null;
    }
    if (this.messageListener) {
      this.socket.off('message', this.messageListener);
      this.messageListener = null;
    }
    this.listenersAttached = false;
  }

  on(eventType: string, handler: (data: any) => void) {
    console.log('[AI Chat Widget] Registering handler for:', eventType);
    this.messageHandlers.set(eventType, handler);
  }

  off(eventType: string) {
    this.messageHandlers.delete(eventType);
  }

  send(type: string, data: any) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }

    this.socket.emit('message', {
      type: 'COLLABROOM',
      component: 'pad',
      data: {
        type,
        ...data,
      },
    });
  }

  disconnect() {
    if (this.socket) {
      this.removeListeners();
      this.messageHandlers.clear();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }
  
  onDisconnect(callback: () => void) {
    this.onDisconnectCallback = callback;
  }

  onConnect(callback: () => void) {
    this.onConnectCallback = callback;
  }
  
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[AI Chat Widget] Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`[AI Chat Widget] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
    
    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[AI Chat Widget] Reconnection failed:', error);
      });
    }, this.reconnectDelay);
  }
}

export const socketService = new SocketService();
