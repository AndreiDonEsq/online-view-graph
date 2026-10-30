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

    this.eventSource.onerror = (err) => {
      console.warn('[Network] SSE connection error, reconnecting with backoff...');
      this.isConnected = false;
      this.eventSource.close();
      this.onError?.('Connection interrupted. Reconnecting…');
      clearTimeout(this.reconnectTimer);
      const delay = Math.min(10000 * (2 ** this.reconnectAttempt++), 60000);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
  }

  /**
   * Publish a message to all participants in this room.
   * @param {Object} data 
   */
  async publish(data) {
    try {
      const url = `https://ntfy.sh/${encodeURIComponent(this.roomTopic)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    }
  }

  disconnect() {
    this.disconnected = true;
    clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }
}

