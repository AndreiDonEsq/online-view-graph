/**
 * network.js
 * 
 * Lightweight, zero-dependency real-time sync service using public HTTPS/SSE pub-sub.
 * Powered by ntfy.sh (standard SSE EventSource + HTTP POST).
 * Works seamlessly across mobile phones (iOS Safari, Android Chrome) and desktops.
 */

export class RoomNetwork {
  /**
   * @param {string} roomTopic - The unique room topic identifier
   * @param {Function} onMessage - Callback for incoming messages
   */
  constructor(roomTopic, onMessage, { onOpen, onError } = {}) {
    this.roomTopic = roomTopic;
    this.onMessage = onMessage;
    this.onOpen = onOpen;
    this.onError = onError;
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.connectionTimer = null;
    this.reconnectAttempt = 0;
    this.disconnected = false;
    this.connect();
  }

  connect() {
    if (this.disconnected) return;
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (e) {}
    }

    // Subscribe via native browser Server-Sent Events (SSE)
    const streamUrl = `https://ntfy.sh/${encodeURIComponent(this.roomTopic)}/sse`;
    this.eventSource = new EventSource(streamUrl);

    this.eventSource.onopen = () => {
      this.isConnected = true;
      clearTimeout(this.connectionTimer);
      this.reconnectAttempt = 0;
      console.log(`[Network] Connected to room: ${this.roomTopic}`);
      this.onOpen?.();
    };

    this.eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'message' && payload.message) {
          const data = JSON.parse(payload.message);
          if (this.onMessage) {
            this.onMessage(data);
          }
        }
      } catch (err) {
        console.debug('[Network] Non-JSON message or parse error:', err);
      }
    };

    const retryConnection = () => {
      clearTimeout(this.connectionTimer);
      console.warn('[Network] SSE connection error, reconnecting with backoff...');
      this.isConnected = false;
      this.eventSource.close();
      this.onError?.('Cannot connect to the room service. Retrying automatically…');
      clearTimeout(this.reconnectTimer);
      const delay = Math.min(10000 * (2 ** this.reconnectAttempt++), 60000);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
    this.eventSource.onerror = retryConnection;
    // Some browsers leave a stalled connection pending without firing onerror.
    this.connectionTimer = setTimeout(retryConnection, 12000);
  }

  /**
   * Publish a message to all participants in this room.
   * @param {Object} data 
   */
  async publish(data) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const url = `https://ntfy.sh/${encodeURIComponent(this.roomTopic)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const message = response.status === 429
          ? 'Room service is temporarily limiting requests. Please wait; joining will retry automatically.'
          : `Could not send to the room (HTTP ${response.status}). Check your connection.`;
        this.onError?.(message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[Network] Publish error:', err);
      this.onError?.('Could not reach the room. Check your connection; joining will retry automatically.');
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  disconnect() {
    this.disconnected = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.connectionTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }
}

