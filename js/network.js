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
  constructor(roomTopic, onMessage) {
    this.roomTopic = roomTopic;
    this.onMessage = onMessage;
    this.eventSource = null;
    this.isConnected = false;
    this.connect();
  }

  connect() {
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
      console.log(`[Network] Connected to room: ${this.roomTopic}`);
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
      console.warn('[Network] SSE connection error, browser will auto-retry...');
      this.isConnected = false;
    };
  }

  /**
   * Publish a message to all participants in this room.
   * @param {Object} data 
   */
  async publish(data) {
    try {
      const url = `https://ntfy.sh/${encodeURIComponent(this.roomTopic)}`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.error('[Network] Publish error:', err);
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
    }
  }
}

