/** One SSE subscription per client; EventSource owns reconnection. */
export class RoomNetwork {
  constructor(roomTopic, onMessage, { onOpen, onError } = {}) {
    this.roomTopic = roomTopic;
    this.onError = onError;
    this.isConnected = false;
    this.disconnected = false;
    this.pendingRequests = new Set();
    const url = `https://ntfy.sh/${encodeURIComponent(roomTopic)}`;
    this.url = url;
    this.eventSource = new EventSource(`${url}/sse`);
    this.connectionNotice = setTimeout(() => {
      if (!this.disconnected && !this.isConnected) {
        onError?.('Room service has not responded. Check the network or try a mobile hotspot.');
      }
    }, 12000);
    this.eventSource.onopen = () => {
      if (this.disconnected) return;
      clearTimeout(this.connectionNotice);
      this.isConnected = true;
      onOpen?.();
    };
    this.eventSource.onerror = () => {
      if (this.disconnected) return;
      this.isConnected = false;
      onError?.('Room connection interrupted. Reconnecting automatically…');
    };
    this.eventSource.onmessage = (event) => {
      if (this.disconnected) return;
      let payload;
      try {
        payload = JSON.parse(event.data);
        if (payload.event !== 'message') return;
        if (payload.attachment) {
          onError?.('Room update exceeds the service message limit. Use a smaller workshop.');
          return;
        }
        payload = decodeMessage(payload.message);
      } catch (error) {
        console.warn('[Network] Ignoring malformed room message:', error);
        return;
      }
      onMessage?.(payload);
    };
  }

  async publish(data) {
    if (this.disconnected) return false;
    const body = encodeMessage(data);
    // ntfy turns larger messages into attachments, which are not room updates.
    if (new TextEncoder().encode(body).length > 4096) {
      this.onError?.('Room update exceeds the service message limit. Use a smaller workshop.');
      return false;
    }
    const controller = new AbortController();
    this.pendingRequests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        // A topic endpoint accepts the JSON as message text; avoid a CORS preflight.
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        signal: controller.signal,
        body
      });
      if (!response.ok) {
        this.onError?.(response.status === 429
          ? 'Room service limit reached. Wait before retrying; devices on the same Wi-Fi share limits.'
          : `Room service rejected the update (HTTP ${response.status}). Please retry.`);
        return false;
      }
      return !this.disconnected;
    } catch (error) {
      if (!this.disconnected) this.onError?.('Could not send the room update. Check your connection and retry.');
      return false;
    } finally {
      clearTimeout(timeout);
      this.pendingRequests.delete(controller);
    }
  }

  disconnect() {
    this.disconnected = true;
    this.isConnected = false;
    clearTimeout(this.connectionNotice);
    this.eventSource.close();
    for (const controller of this.pendingRequests) controller.abort();
    this.pendingRequests.clear();
  }
}

// Snapshots index ratings by the participant/prompt lists already in the message.
// This avoids repeating long participant IDs and field names for every rating.
function encodeMessage(data) {
  if (data.type !== 'host_sync') return JSON.stringify(data);
  return JSON.stringify([
    'matrix-sync-1', data.status, data.roomCode, data.promptIndex,
    data.prompts.map(p => [p.id, p.text]),
    data.participants.map(p => [p.id, p.name, p.code]),
    data.prompts.map(prompt => data.participants.map(participant => {
      const rating = data.ratings[prompt.id]?.[participant.id];
      return rating ? [rating.good, rating.fun] : null;
    }))
  ]);
}

function decodeMessage(message) {
  const data = JSON.parse(message);
  if (!Array.isArray(data) || data[0] !== 'matrix-sync-1') return data;
  const [, status, roomCode, promptIndex, promptRows, participantRows, ratingRows] = data;
  const prompts = promptRows.map(([id, text]) => ({ id, text }));
  const participants = participantRows.map(([id, name, code]) => ({ id, name, code }));
  const ratings = Object.fromEntries(prompts.map((prompt, promptIndex) => [
    prompt.id,
    Object.fromEntries(participants.flatMap((participant, participantIndex) => {
      const rating = ratingRows[promptIndex]?.[participantIndex];
      return rating ? [[participant.id, { good: rating[0], fun: rating[1] }]] : [];
    }))
  ]));
  return { type: 'host_sync', status, roomCode, promptIndex, prompts, participants, ratings };
}
