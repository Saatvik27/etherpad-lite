import { Socket } from 'socket.io-client';

export class SocketService {
  private socket: Socket | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log('[AI Chat Widget] Attempting to connect to socket...');
        
        // Get socket from parent window (Etherpad's socket)
        const parentWindow = window.parent || window;
        console.log('[AI Chat Widget] Parent window:', parentWindow);
        
        const pad = (parentWindow as any).pad;
        console.log('[AI Chat Widget] Pad object:', pad);
        
        const padSocket = pad?.socket;
        console.log('[AI Chat Widget] Pad socket:', padSocket);

        if (padSocket && padSocket.connected) {
          this.socket = padSocket;
          console.log('[AI Chat Widget] Socket connected successfully!');
          this.setupListeners();
          resolve();
        } else if (padSocket) {
          // Socket exists but not connected yet, wait for it
          console.log('[AI Chat Widget] Socket exists but not connected, waiting...');
          padSocket.on('connect', () => {
            this.socket = padSocket;
            console.log('[AI Chat Widget] Socket connected after waiting!');
            this.setupListeners();
            resolve();
          });
          
          // Timeout after 5 seconds
          setTimeout(() => {
            if (!this.socket) {
              reject(new Error('Socket connection timeout'));
            }
          }, 5000);
        } else {
          console.error('[AI Chat Widget] Pad socket not found');
          reject(new Error('Pad socket not found'));
        }
      } catch (error) {
        console.error('[AI Chat Widget] Connection error:', error);
        reject(error);
      }
    });
  }

  private setupListeners() {
    if (!this.socket) return;

    console.log('[AI Chat Widget] Setting up socket listeners...');

    this.socket.on('message', (msg: any) => {
      console.log('[AI Chat Widget] Received message:', msg);
      
      // Handle AI messages sent directly (not wrapped in COLLABROOM)
      if (msg.type === 'AI_RESPONSE' || msg.type === 'AI_HISTORY' || msg.type === 'AI_PAD_MODIFIED') {
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
    });
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
      this.messageHandlers.clear();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }
}

export const socketService = new SocketService();
