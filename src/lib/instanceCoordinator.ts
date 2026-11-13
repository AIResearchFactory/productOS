/**
 * instanceCoordinator.ts
 * Multi-tab / PWA instance coordinator for productOS.
 * Ensures only one active window maintains file watchers and SSE connections,
 * avoiding connection socket exhaustion and project-switch ping-pong races.
 */

export interface InstanceCoordinationState {
  isPrimary: boolean;
  hasOtherInstance: boolean;
  primaryInstanceId: string | null;
  instanceId: string;
}

type StateListener = (state: InstanceCoordinationState) => void;

class InstanceCoordinator {
  private instanceId: string;
  private isPrimary: boolean = true;
  private hasOtherInstance: boolean = false;
  private primaryInstanceId: string | null = null;
  private channel: BroadcastChannel | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private listeners: Set<StateListener> = new Set();
  private isInitialized = false;

  private STORAGE_KEY_PRIMARY = 'productos_primary_instance_data';
  private SESSION_KEY_INSTANCE_ID = 'productos_tab_session_instance_id';
  private HEARTBEAT_TTL_MS = 6000;
  private HEARTBEAT_INTERVAL_MS = 2000;

  constructor() {
    if (typeof window === 'undefined') {
      this.instanceId = 'mock_instance';
      return;
    }

    // Reuse existing session tab ID on page reloads to prevent false collision
    const existingSessionId = sessionStorage.getItem(this.SESSION_KEY_INSTANCE_ID);
    if (existingSessionId) {
      this.instanceId = existingSessionId;
    } else {
      this.instanceId = `inst_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;
      try {
        sessionStorage.setItem(this.SESSION_KEY_INSTANCE_ID, this.instanceId);
      } catch {
        // Ignore storage errors (private browsing quota)
      }
    }
  }

  public init(): void {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    try {
      this.channel = new BroadcastChannel('productos_instance_coordination');
      this.channel.onmessage = this.handleChannelMessage.bind(this);
    } catch (err) {
      console.warn('[InstanceCoordinator] BroadcastChannel not supported:', err);
    }

    // Check existing primary lock in localStorage
    this.evaluatePrimaryLock();

    // Start periodic heartbeat and liveliness checks
    this.startHeartbeat();

    // Handle tab closing
    window.addEventListener('beforeunload', this.handleUnload.bind(this));
    window.addEventListener('storage', this.handleStorageEvent.bind(this));

    // Announce presence
    this.postMessage({
      type: 'ANNOUNCE',
      instanceId: this.instanceId,
      isPrimary: this.isPrimary
    });
  }

  public getState(): InstanceCoordinationState {
    return {
      isPrimary: this.isPrimary,
      hasOtherInstance: this.hasOtherInstance,
      primaryInstanceId: this.primaryInstanceId,
      instanceId: this.instanceId
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  private evaluatePrimaryLock() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY_PRIMARY);
      if (raw) {
        const data = JSON.parse(raw);
        const age = Date.now() - (data.timestamp || 0);

        if (data.instanceId === this.instanceId) {
          // This tab was already the primary (e.g. page refreshed)
          this.isPrimary = true;
          this.hasOtherInstance = false;
          this.primaryInstanceId = this.instanceId;
          this.writeHeartbeat();
          return;
        }

        if (age < this.HEARTBEAT_TTL_MS) {
          // Active primary instance exists elsewhere!
          this.isPrimary = false;
          this.hasOtherInstance = true;
          this.primaryInstanceId = data.instanceId;
          return;
        }
      }

      // No active primary found, claim it
      this.claimPrimary();
    } catch {
      this.isPrimary = true;
    }
  }

  public claimPrimary() {
    this.isPrimary = true;
    this.hasOtherInstance = false;
    this.primaryInstanceId = this.instanceId;
    this.writeHeartbeat();

    this.postMessage({
      type: 'CLAIM_PRIMARY',
      instanceId: this.instanceId
    });

    this.notify();
  }

  public yieldPrimary(newPrimaryId?: string) {
    this.isPrimary = false;
    this.hasOtherInstance = true;
    this.primaryInstanceId = newPrimaryId || null;
    this.notify();
  }

  private writeHeartbeat() {
    if (!this.isPrimary) return;
    try {
      localStorage.setItem(this.STORAGE_KEY_PRIMARY, JSON.stringify({
        instanceId: this.instanceId,
        timestamp: Date.now()
      }));
    } catch {
      // Storage quota or disabled
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isPrimary) {
        this.writeHeartbeat();
      } else {
        // If secondary, check if the primary instance has gone silent
        try {
          const raw = localStorage.getItem(this.STORAGE_KEY_PRIMARY);
          if (raw) {
            const data = JSON.parse(raw);
            const age = Date.now() - (data.timestamp || 0);
            if (age > this.HEARTBEAT_TTL_MS) {
              // Primary timed out or crashed without clean unload
              this.hasOtherInstance = false;
              this.primaryInstanceId = null;
              this.notify();
            }
          } else {
            this.hasOtherInstance = false;
            this.primaryInstanceId = null;
            this.notify();
          }
        } catch {
          // Ignore
        }
      }
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private handleChannelMessage(event: MessageEvent) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'ANNOUNCE') {
      if (data.instanceId !== this.instanceId) {
        if (this.isPrimary) {
          // Respond to inform the newcomer that we are the active primary
          this.postMessage({
            type: 'PRIMARY_ACK',
            instanceId: this.instanceId
          });
        }
      }
    } else if (data.type === 'PRIMARY_ACK') {
      if (data.instanceId !== this.instanceId) {
        // Another instance answered that it is primary
        if (!this.isPrimary) {
          this.hasOtherInstance = true;
          this.primaryInstanceId = data.instanceId;
          this.notify();
        }
      }
    } else if (data.type === 'CLAIM_PRIMARY') {
      if (data.instanceId !== this.instanceId) {
        // Another tab explicitly claimed primary
        this.yieldPrimary(data.instanceId);
      }
    } else if (data.type === 'PRIMARY_CLOSED') {
      if (data.instanceId === this.primaryInstanceId) {
        this.hasOtherInstance = false;
        this.primaryInstanceId = null;
        this.notify();
      }
    } else if (data.type === 'OPEN_DOCUMENT_REQUEST') {
      // If we are primary, open this document!
      if (this.isPrimary && data.fileName) {
        window.dispatchEvent(new CustomEvent('productos:open-document', {
          detail: { fileName: data.fileName, hash: data.hash }
        }));
      }
    }
  }

  private handleStorageEvent(e: StorageEvent) {
    if (e.key === this.STORAGE_KEY_PRIMARY) {
      if (e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.instanceId !== this.instanceId) {
            this.hasOtherInstance = true;
            this.primaryInstanceId = data.instanceId;
            if (this.isPrimary) {
              // A different instance wrote to primary
              this.isPrimary = false;
            }
            this.notify();
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  private handleUnload() {
    if (this.isPrimary) {
      try {
        localStorage.removeItem(this.STORAGE_KEY_PRIMARY);
      } catch {
        // Ignore
      }
      this.postMessage({
        type: 'PRIMARY_CLOSED',
        instanceId: this.instanceId
      });
    }
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.channel) this.channel.close();
  }

  public requestOpenDocumentInPrimary(fileName: string, hash?: string) {
    this.postMessage({
      type: 'OPEN_DOCUMENT_REQUEST',
      fileName,
      hash
    });
  }

  private postMessage(msg: Record<string, any>) {
    try {
      this.channel?.postMessage(msg);
    } catch {
      // Channel closed or unsupported
    }
  }
}

export const instanceCoordinator = new InstanceCoordinator();
