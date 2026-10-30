import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const networkSource = await readFile(new URL('../js/network.js', import.meta.url), 'utf8');
const appSource = (await readFile(new URL('../js/app.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '');

function harness() {
  const sources = [], requests = [], errors = [], timers = new Map();
  let timerId = 0;
  const context = vm.createContext({
    console, TextEncoder, AbortController,
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    window: { addEventListener() {} },
    EventSource: class {
      constructor(url) { this.url = url; sources.push(this); }
      close() { this.closed = true; }
    },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      return { ok: true };
    }
  });
  vm.runInContext(networkSource.replace('export class', 'class') + '\nthis.RoomNetwork = RoomNetwork;', context);
  vm.runInContext(appSource + '\nthis.App = MentoringMatrixApp;', context);
  const app = Object.create(context.App.prototype);
  return { context, app, sources, requests, errors, timers,
    network(onMessage = () => {}) {
      return new context.RoomNetwork('test_room', onMessage, { onError: m => errors.push(m) });
    }
  };
}

test('SSE errors keep one subscription for native browser reconnection', () => {
  const h = harness(), network = h.network();
  h.sources[0].onopen();
  assert.equal(network.isConnected, true);
  h.sources[0].onerror();
  h.sources[0].onerror();
  assert.equal(network.isConnected, false);
  assert.equal(h.sources.length, 1);
  assert.equal(h.sources[0].closed, undefined);
  assert.equal(h.timers.size, 0);
  h.sources[0].onopen();
  assert.equal(network.isConnected, true);
  network.disconnect();
  h.sources[0].onopen();
  assert.equal(network.isConnected, false);
});

test('publishes JSON as plain text and surfaces HTTP 429 failures', async () => {
  const h = harness(), network = h.network();
  assert.equal(await network.publish({ type: 'pax_join' }), true);
  assert.equal(h.requests[0].headers['Content-Type'], 'text/plain;charset=UTF-8');
  assert.equal(JSON.parse(h.requests[0].body).type, 'pax_join');
  h.context.fetch = async () => ({ ok: false, status: 429 });
  assert.equal(await network.publish({ type: 'pax_join' }), false);
  assert.match(h.errors[0], /limit reached/);
});

test('rejects oversized UTF-8 messages before ntfy converts them to attachments', async () => {
  const h = harness(), network = h.network();
  assert.equal(await network.publish({ text: '🌍'.repeat(1100) }), false);
  assert.equal(h.requests.length, 0);
  assert.match(h.errors[0], /message limit/);
});

test('parses room messages and reports unsupported attachment updates', () => {
  const h = harness(), messages = [];
  h.network(message => messages.push(message));
  h.sources[0].onmessage({ data: JSON.stringify({ event: 'message', message: '{"type":"host_sync"}' }) });
  assert.equal(messages[0].type, 'host_sync');
  h.sources[0].onmessage({ data: JSON.stringify({ event: 'message', attachment: { url: 'file' } }) });
  assert.match(h.errors[0], /message limit/);
});

test('disconnect aborts in-flight publishes and prevents further requests', async () => {
  const h = harness(), network = h.network();
  h.context.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  const pending = network.publish({ type: 'pax_vote' });
  network.disconnect();
  assert.equal(await pending, false);
  assert.equal(await network.publish({ type: 'pax_join' }), false);
  assert.equal(h.errors.length, 0);
  assert.equal(h.timers.size, 0);
});

test('joining waits for the subscription to open', () => {
  const h = harness();
  Object.assign(h.app, { paxId: 'p1', paxName: 'Alice', paxCode: 'ALI', network: h.network(), paxJoinAttempt: 0 });
  h.app.requestPaxJoin();
  assert.equal(h.requests.length, 0);
  h.sources[0].onopen();
  h.app.requestPaxJoin();
  assert.equal(h.requests.length, 1);
});

test('a failed vote is not saved locally or reported as confirmed', async () => {
  const h = harness();
  Object.assign(h.app, {
    state: { prompts: [{ id: 1 }], ratings: {} }, activePromptIndex: 0,
    paxId: 'p1', pendingVotes: new Map(),
    paxSliderGood: { value: '8' }, paxSliderFun: { value: '7' },
    paxSubmitStatus: { style: {} }, btnPaxSubmitVote: {},
    network: { publish: async () => false }
  });
  h.app.handlePaxSubmitVote();
  await Promise.resolve();
  assert.match(h.app.paxSubmitStatus.textContent, /not been confirmed/);
  assert.deepEqual(h.app.state.ratings, {});
  assert.equal(h.app.btnPaxSubmitVote.textContent, 'Send Again');
});

test('only a host snapshot containing the vote confirms it', () => {
  const h = harness();
  Object.assign(h.app, {
    state: { prompts: [{ id: 1 }], ratings: {} }, activePromptIndex: 0,
    paxId: 'p1', pendingVotes: new Map([[1, { good: 8, fun: 7 }]]),
    paxSubmitStatus: {}, btnPaxSubmitVote: {}, paxWaitingHeading: {}, paxWaitingStatus: {},
    switchPaxView() {}
  });
  const sync = { status: 'waiting', participants: [{ id: 'p1' }], ratings: { 1: { p1: { good: 5, fun: 5 } } } };
  h.app.handlePaxReceivedHostSync(sync);
  assert.equal(h.app.pendingVotes.size, 1);
  sync.ratings[1].p1 = { good: 8, fun: 7 };
  h.app.handlePaxReceivedHostSync(sync);
  assert.equal(h.app.pendingVotes.size, 0);
  assert.match(h.app.paxSubmitStatus.textContent, /received by the facilitator/);
});

test('a burst of host changes sends one latest snapshot, with sequential updates', async () => {
  const h = harness(), sent = [];
  let finishFirst;
  Object.assign(h.app, {
    state: { prompts: [], participants: [], ratings: {} },
    activePromptIndex: 0, hostNetworkStatus: {}, setRoomError() {},
    network: { isConnected: true, publish(payload) {
      sent.push(payload);
      return sent.length === 1 ? new Promise(resolve => { finishFirst = resolve; }) : Promise.resolve(true);
    } }
  });
  h.app.broadcastHostState();
  h.app.activePromptIndex = 1;
  h.app.broadcastHostState();
  assert.equal(h.timers.size, 1);
  const firstTimer = [...h.timers.values()][0];
  h.timers.clear();
  const publishing = firstTimer();
  assert.equal(sent[0].promptIndex, 1);
  h.app.activePromptIndex = 2;
  h.app.broadcastHostState();
  await h.app.flushHostState();
  assert.equal(sent.length, 1);
  finishFirst(true);
  await publishing;
  assert.equal(sent.length, 2);
  assert.equal(sent[1].promptIndex, 2);
});

function workshop(participantCount = 15, promptCount = 6) {
  const participants = Array.from({ length: participantCount }, (_, i) => ({
    id: `pax_mi0xzhhi_${String(i).padStart(4, '0')}`, name: `Participant ${i + 1}`, code: 'PAR'
  }));
  const prompts = Array.from({ length: promptCount }, (_, i) => ({
    id: i + 1, text: `Activity ${i + 1}: Discuss a practical mentoring situation and rate its impact and fun.`
  }));
  const ratings = Object.fromEntries(prompts.map(prompt => [prompt.id,
    Object.fromEntries(participants.map((p, i) => [p.id, { good: 1 + (i % 10), fun: 5.5 }]))
  ]));
  return { type: 'host_sync', status: 'finished', roomCode: 'ABCDE', promptIndex: promptCount - 1,
    prompts, participants, ratings };
}

test('15 participants and six complete activities fit in one message and round-trip every rating', async () => {
  const h = harness(), received = [], network = h.network(message => received.push(message));
  const snapshot = workshop();
  assert.ok(new TextEncoder().encode(JSON.stringify(snapshot)).length > 4096);
  assert.equal(await network.publish(snapshot), true);
  const body = h.requests[0].body;
  const bytes = new TextEncoder().encode(body).length;
  assert.ok(bytes < 4096, `Snapshot is ${bytes} bytes`);
  h.sources[0].onmessage({ data: JSON.stringify({ event: 'message', message: body }) });
  assert.deepEqual(JSON.parse(JSON.stringify(received[0])), snapshot);
});

test('15 participants can join, submit 90 votes, and receive facilitator confirmation', async () => {
  const h = harness(), snapshot = workshop();
  let latest;
  const network = h.network(message => { latest = message; });
  h.sources[0].onopen();
  Object.assign(h.app, {
    network, state: { prompts: snapshot.prompts, participants: [], ratings: {},
      notify() {}, setRating(promptId, paxId, good, fun) {
        this.ratings[promptId] ??= {};
        this.ratings[promptId][paxId] = { good, fun };
      } },
    hostStatus: 'waiting', roomCode: 'ABCDE', activePromptIndex: 0,
    renderJoinedPaxPills() {}, renderHostActivePrompt() {},
    hostNetworkStatus: {}, setRoomError() {}
  });
  for (const participant of snapshot.participants) {
    h.app.handleHostIncomingMessage({ type: 'pax_join', paxId: participant.id, name: participant.name });
  }
  await h.app.flushHostState();
  h.app.hostStatus = 'active';
  for (const [i, prompt] of snapshot.prompts.entries()) {
    h.app.activePromptIndex = i;
    for (const p of snapshot.participants) {
      h.app.handleHostIncomingMessage({ type: 'pax_vote', paxId: p.id, promptId: prompt.id, good: 8, fun: 7 });
    }
    await h.app.flushHostState();
    const body = h.requests.at(-1).body;
    h.sources[0].onmessage({ data: JSON.stringify({ event: 'message', message: body }) });
    assert.equal(Object.keys(latest.ratings[prompt.id]).length, 15);
    for (const p of snapshot.participants) assert.equal(latest.ratings[prompt.id][p.id].good, 8);
  }
  assert.equal(h.requests.length, 7, 'One join snapshot and one batched snapshot per activity');
});

test('refreshing the facilitator restores the same room without resetting participants or ratings', () => {
  const h = harness(), storage = new Map();
  h.context.sessionStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  };
  Object.assign(h.app, {
    roomTopic: 'mentoring_same_room', roomCode: 'ABCDE', hostStatus: 'active', activePromptIndex: 2
  });
  h.app.saveHostRoom();
  const restored = Object.create(h.context.App.prototype);
  const state = workshop();
  let connected = false;
  Object.assign(restored, { state, renderJoinedPaxPills() {}, connectHostRoom() { connected = true; } });
  assert.equal(restored.restoreHostRoom(), true);
  assert.equal(connected, true);
  assert.equal(restored.roomTopic, h.app.roomTopic);
  assert.equal(restored.activePromptIndex, 2);
  assert.equal(restored.state, state);
  storage.set('mentoring_host_room', '{"roomTopic":"bad","roomCode":"ABCDE","hostStatus":"active","activePromptIndex":99}');
  assert.equal(restored.restoreHostRoom(), false);
});
