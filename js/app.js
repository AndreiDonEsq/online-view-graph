/**
 * app.js
 * 
 * Main controller for the Mentoring Activities 2D Matrix application.
 * Supports:
 * 1. Host Mode: Facilitator creates a room, shares QR/link, paces through prompts,
 *    and reveals all graphs at the end.
 * 2. Participant Mode: Participants join via phone, enter their name, rate each prompt
 *    with touch sliders, and see final graphs when finished.
 */

import { AppState, getGraphTheme } from './state.js';
import { GraphRenderer } from './graph.js';
import { RoomNetwork } from './network.js';

class MentoringMatrixApp {
  constructor() {
    this.graphRenderer = new GraphRenderer({ width: 440, height: 380 });
    this.miniGraphRenderer = new GraphRenderer({ width: 340, height: 290 });

    // Mode determination
    const urlParams = new URLSearchParams(window.location.search);
    this.isParticipant = urlParams.has('room');
    this.roomTopic = urlParams.get('room') || null;
    this.roomCode = urlParams.get('code') || (this.roomTopic ? this.roomTopic.substring(0, 5).toUpperCase() : null);
    this.state = this.isParticipant
      ? new AppState(`mentoring_participant_state_${this.roomTopic}`)
      : new AppState();

    // Host state
    this.hostStatus = 'setup'; // 'setup' | 'waiting' | 'active' | 'finished'
    this.activePromptIndex = 0;
    this.network = null;
    this.heartbeatTimer = null;

    // Participant state
    this.paxStoragePrefix = `mentoring_pax_${this.roomTopic || 'host'}_`;
    this.paxId = localStorage.getItem(`${this.paxStoragePrefix}id`) || sessionStorage.getItem(`${this.paxStoragePrefix}id`) || null;
    this.paxName = localStorage.getItem(`${this.paxStoragePrefix}name`) || sessionStorage.getItem(`${this.paxStoragePrefix}name`) || '';
    this.paxCode = localStorage.getItem(`${this.paxStoragePrefix}code`) || sessionStorage.getItem(`${this.paxStoragePrefix}code`) || '';
    this.paxSubmittedForPrompt = {}; // { [promptId]: true }

    this.initDOMElements();
    this.bindEvents();

    if (this.isParticipant) {
      this.initParticipantFlow();
    } else {
      this.initHostFlow();
    }
  }

  /**
   * Cache references to key DOM elements.
   */
  initDOMElements() {
    // Headers
    this.hostHeader = document.getElementById('host-header');
    this.paxHeader = document.getElementById('pax-header');
    this.paxHeaderRoomTitle = document.getElementById('pax-header-room-title');

    // Host Nav
    this.navBtnSetup = document.getElementById('nav-btn-setup');
    this.navBtnWaiting = document.getElementById('nav-btn-waiting');
    this.navBtnLive = document.getElementById('nav-btn-live');
    this.navBtnOverview = document.getElementById('nav-btn-overview');

    // Views
    this.viewSetup = document.getElementById('view-setup');
    this.viewHostWaiting = document.getElementById('view-host-waiting');
    this.viewHostActive = document.getElementById('view-host-active');
    this.viewOverview = document.getElementById('view-overview');

    this.viewPaxJoin = document.getElementById('view-pax-join');
    this.viewPaxWaiting = document.getElementById('view-pax-waiting');
    this.viewPaxRate = document.getElementById('view-pax-rate');
    this.viewPaxResults = document.getElementById('view-pax-results');

    // Host Setup
    this.inputNumPrompts = document.getElementById('input-num-prompts');
    this.btnApplyNumPrompts = document.getElementById('btn-apply-num-prompts');
    this.btnAddPromptRow = document.getElementById('btn-add-prompt-row');
    this.promptsContainer = document.getElementById('prompts-input-container');
    this.btnCreateRoom = document.getElementById('btn-create-room');
    this.btnRefreshEverything = document.getElementById('btn-refresh-everything');
    this.btnOfflineMode = document.getElementById('btn-offline-mode');

    // Host Waiting Room
    this.displayRoomCode = document.getElementById('display-room-code');
    this.roomQrImage = document.getElementById('room-qr-image');
    this.inputShareLink = document.getElementById('input-share-link');
    this.btnCopyShareLink = document.getElementById('btn-copy-share-link');
    this.countJoinedPax = document.getElementById('count-joined-pax');
    this.joinedPaxPills = document.getElementById('joined-pax-pills');
    this.btnHostStartWorkshop = document.getElementById('btn-host-start-workshop');

    // Host Live Control
    this.hostPromptTag = document.getElementById('host-prompt-tag');
    this.hostPromptTitle = document.getElementById('host-prompt-title');
    this.btnHostPrevPrompt = document.getElementById('btn-host-prev-prompt');
    this.btnHostNextPrompt = document.getElementById('btn-host-next-prompt');
    this.hostLivePaxCount = document.getElementById('host-live-pax-count');
    this.hostActiveGraphContainer = document.getElementById('host-active-graph-container');
    this.hostPaxStatusList = document.getElementById('host-pax-status-list');

    // Host Overview
    this.allGraphsGrid = document.getElementById('all-graphs-grid');
    this.overviewLegendPills = document.getElementById('overview-legend-pills');
    this.btnTogglePresentation = document.getElementById('btn-toggle-presentation');
    this.btnFloatingExitPresentation = document.getElementById('btn-floating-exit-presentation');
    this.btnPrint = document.getElementById('btn-print');
    this.btnRestartRoom = document.getElementById('btn-restart-room');

    // Participant elements
    this.paxJoinRoomCode = document.getElementById('pax-join-room-code');
    this.inputPaxName = document.getElementById('input-pax-name');
    this.btnPaxConfirmJoin = document.getElementById('btn-pax-confirm-join');
    this.paxDisplayName = document.getElementById('pax-display-name');
    this.paxRateTag = document.getElementById('pax-rate-tag');
    this.paxBadgePreview = document.getElementById('pax-badge-preview');
    this.paxRatePromptText = document.getElementById('pax-rate-prompt-text');
    this.paxSliderGood = document.getElementById('pax-slider-good');
    this.paxSliderFun = document.getElementById('pax-slider-fun');
    this.paxValGood = document.getElementById('pax-val-good');
    this.paxValFun = document.getElementById('pax-val-fun');
    this.btnPaxSubmitVote = document.getElementById('btn-pax-submit-vote');
    this.paxSubmitStatus = document.getElementById('pax-submit-status');
    this.paxGraphsGrid = document.getElementById('pax-graphs-grid');
  }

  /**
   * Bind DOM event listeners.
   */
  bindEvents() {
    // Presentation Mode toggle & keyboard escape
    if (this.btnTogglePresentation) {
      this.btnTogglePresentation.addEventListener('click', () => {
        document.body.classList.toggle('presentation-mode');
      });
    }

    if (this.btnFloatingExitPresentation) {
      this.btnFloatingExitPresentation.addEventListener('click', () => {
        document.body.classList.remove('presentation-mode');
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('presentation-mode')) {
        document.body.classList.remove('presentation-mode');
      }
    });

    if (this.btnPrint) {
      this.btnPrint.addEventListener('click', () => window.print());
    }

    if (this.btnRestartRoom) {
      this.btnRestartRoom.addEventListener('click', async () => {
        if (confirm('Start a fresh session? This will clear all participants and ratings.')) {
          await this.refreshEverything();
          window.location.href = window.location.pathname;
        }
      });
    }

    // Host Setup handlers
    if (this.btnApplyNumPrompts) {
      this.btnApplyNumPrompts.addEventListener('click', () => {
        const count = parseInt(this.inputNumPrompts.value, 10) || 1;
        this.renderSetupPromptRows(count);
      });
    }

    if (this.btnAddPromptRow) {
      this.btnAddPromptRow.addEventListener('click', () => {
        this.addSetupPromptRow('');
        this.inputNumPrompts.value = this.promptsContainer.children.length;
      });
    }

    if (this.btnCreateRoom) {
      this.btnCreateRoom.addEventListener('click', () => this.handleCreateRoom());
    }
    if (this.btnRefreshEverything) {
      this.btnRefreshEverything.addEventListener('click', async () => {
        this.btnRefreshEverything.disabled = true;
        try {
          await this.refreshEverything();
        } finally {
          this.btnRefreshEverything.disabled = false;
        }
      });
    }

    if (this.btnOfflineMode) {
      this.btnOfflineMode.addEventListener('click', () => {
        const promptInputs = Array.from(this.promptsContainer.querySelectorAll('input.prompt-text-input'));
        const texts = promptInputs.map(inp => inp.value.trim()).filter(t => t.length > 0);
        if (texts.length === 0) {
          alert('Please enter at least one activity prompt.');
          return;
        }
        this.state.setPrompts(texts);
        this.state.setParticipants(['Alice', 'Bob', 'Charlie']);
        this.switchHostView('overview');
      });
    }

    // Host Waiting Room handlers
    if (this.btnCopyShareLink) {
      this.btnCopyShareLink.addEventListener('click', () => {
        this.inputShareLink.select();
        navigator.clipboard.writeText(this.inputShareLink.value);
        this.btnCopyShareLink.textContent = 'Copied! ✓';
        setTimeout(() => { this.btnCopyShareLink.textContent = 'Copy Link'; }, 2000);
      });
    }

    if (this.btnHostStartWorkshop) {
      this.btnHostStartWorkshop.addEventListener('click', () => this.handleHostStartWorkshop());
    }

    // Host Live Control handlers
    if (this.btnHostPrevPrompt) {
      this.btnHostPrevPrompt.addEventListener('click', () => this.navigateHostPrompt(-1));
    }

    if (this.btnHostNextPrompt) {
      this.btnHostNextPrompt.addEventListener('click', () => this.handleHostNextClick());
    }

    // Host Navigation bar tabs
    if (this.navBtnSetup) this.navBtnSetup.addEventListener('click', () => this.switchHostView('setup'));
    if (this.navBtnWaiting) this.navBtnWaiting.addEventListener('click', () => this.switchHostView('waiting'));
    if (this.navBtnLive) this.navBtnLive.addEventListener('click', () => this.switchHostView('active'));
    if (this.navBtnOverview) this.navBtnOverview.addEventListener('click', () => this.switchHostView('overview'));

    // Participant handlers
    if (this.btnPaxConfirmJoin) {
      this.btnPaxConfirmJoin.addEventListener('click', () => this.handlePaxJoinConfirm());
    }

    if (this.inputPaxName) {
      this.inputPaxName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handlePaxJoinConfirm();
      });
    }

    if (this.paxSliderGood && this.paxValGood) {
      this.paxSliderGood.addEventListener('input', () => {
        this.paxValGood.textContent = parseFloat(this.paxSliderGood.value).toFixed(1);
      });
    }

    if (this.paxSliderFun && this.paxValFun) {
      this.paxSliderFun.addEventListener('input', () => {
        this.paxValFun.textContent = parseFloat(this.paxSliderFun.value).toFixed(1);
      });
    }

    if (this.btnPaxSubmitVote) {
      this.btnPaxSubmitVote.addEventListener('click', () => this.handlePaxSubmitVote());
    }
  }

  /* ------------------------------------------------------------------------
   * A. FACILITATOR / HOST FLOW
   * ------------------------------------------------------------------------ */

  initHostFlow() {
    document.documentElement.classList.remove('participant-mode');
    document.body.classList.remove('participant-mode');
    this.hostHeader.style.display = 'flex';
    this.paxHeader.style.display = 'none';
    this.renderSetupPromptRows(6); // 6 blank prompts ready to fill
    this.switchHostView('setup');
  }

  switchHostView(view) {
    document.documentElement.classList.remove('participant-mode');
    document.body.classList.remove('participant-mode');

    // Deactivate all participant views
    this.viewPaxJoin.classList.remove('active');
    this.viewPaxWaiting.classList.remove('active');
    this.viewPaxRate.classList.remove('active');
    this.viewPaxResults.classList.remove('active');

    this.viewSetup.classList.toggle('active', view === 'setup');
    this.viewHostWaiting.classList.toggle('active', view === 'waiting');
    this.viewHostActive.classList.toggle('active', view === 'active');
    this.viewOverview.classList.toggle('active', view === 'overview');

    this.navBtnSetup.style.display = 'inline-flex';
    this.navBtnWaiting.style.display = this.roomTopic ? 'inline-flex' : 'none';
    this.navBtnLive.style.display = (this.hostStatus === 'active' || this.hostStatus === 'finished') ? 'inline-flex' : 'none';
    this.navBtnOverview.style.display = (this.hostStatus === 'finished' || this.state.prompts.length > 0) ? 'inline-flex' : 'none';

    if (view === 'active') {
      this.renderHostActivePrompt();
    } else if (view === 'overview') {
      this.renderOverviewScreen();
    }
  }

  async closeHostRoom() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    const previousNetwork = this.network;
    this.network = null;
    if (previousNetwork) {
      await previousNetwork.publish({ type: 'room_closed' });
      previousNetwork.disconnect();
    }
  }

  async refreshEverything() {
    await this.closeHostRoom();
    this.state.resetAll();
    this.roomTopic = null;
    this.roomCode = null;
    this.hostStatus = 'setup';
    this.activePromptIndex = 0;
    this.displayRoomCode.textContent = '';
    this.inputShareLink.value = '';
    this.roomQrImage.removeAttribute('src');
    this.renderJoinedPaxPills();
    this.switchHostView('setup');
  }

  async handleCreateRoom() {
    const promptInputs = Array.from(this.promptsContainer.querySelectorAll('input.prompt-text-input'));
    const texts = promptInputs.map(inp => inp.value.trim()).filter(t => t.length > 0);

    if (texts.length === 0) {
      alert('Please enter at least one activity prompt to rate.');
      return;
    }

    // A recreated room starts with no participants, ratings, or old connection.
    await this.closeHostRoom();
    this.state.resetAll();
    this.state.setPrompts(texts);
    this.activePromptIndex = 0;
    this.renderJoinedPaxPills();

    // Generate room code and unique topic
    this.roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.roomTopic = `mentoring_${this.roomCode.toLowerCase()}_${Date.now().toString(36)}`;
    this.hostStatus = 'waiting';

    const joinUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(this.roomTopic)}&code=${this.roomCode}`;

    this.displayRoomCode.textContent = this.roomCode;
    this.inputShareLink.value = joinUrl;
    this.roomQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;

    // Connect real-time pub-sub
    const topic = this.roomTopic;
    this.network = new RoomNetwork(topic, (msg) => {
      if (this.network?.roomTopic === topic) this.handleHostIncomingMessage(msg);
    });

    // Periodic state broadcast (heartbeat)
    this.heartbeatTimer = setInterval(() => this.broadcastHostState(), 3500);

    this.broadcastHostState();
    this.switchHostView('waiting');
  }

  broadcastHostState() {
    if (!this.network) return;

    const payload = {
      type: 'host_sync',
      status: this.hostStatus,
      roomCode: this.roomCode,
      promptIndex: this.activePromptIndex,
      prompts: this.state.prompts,
      participants: this.state.participants,
      ratings: this.state.ratings
    };

    this.network.publish(payload);
  }

  handleHostIncomingMessage(msg) {
    if (!this.network) return;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'pax_join') {
      this.handlePaxJoinedOnHost(msg);
    } else if (msg.type === 'pax_vote') {
      this.handlePaxVotedOnHost(msg);
    } else if (msg.type === 'pax_hello') {
      this.broadcastHostState();
    }
  }

  handlePaxJoinedOnHost({ paxId, name, code }) {
    if (!this.state.participants.some(p => p.id === paxId)) {
      this.state.participants.push({
        id: paxId,
        name: name || 'Participant',
        code: code || name.substring(0, 3).toUpperCase()
      });
      this.state.notify();
    }

    this.renderJoinedPaxPills();
    this.broadcastHostState();
  }

  renderJoinedPaxPills() {
    const list = this.state.participants;
    this.countJoinedPax.textContent = list.length;

    if (list.length === 0) {
      this.joinedPaxPills.innerHTML = `<span style="color: #94a3b8; font-size: 0.85rem; font-style: italic;">Waiting for participants to join...</span>`;
      return;
    }

    this.joinedPaxPills.innerHTML = '';
    list.forEach(p => {
      const pill = document.createElement('div');
      pill.className = 'participant-pill';
      pill.innerHTML = `
        <span class="pill-code-badge">${p.code}</span>
        <span>${this.escapeHTML(p.name)}</span>
      `;
      this.joinedPaxPills.appendChild(pill);
    });
  }

  handleHostStartWorkshop() {
    if (this.state.participants.length === 0) {
      if (!confirm('No participants have joined yet. Do you still want to start?')) {
        return;
      }
    }

    this.hostStatus = 'active';
    this.activePromptIndex = 0;
    this.broadcastHostState();
    this.switchHostView('active');
  }

  navigateHostPrompt(dir) {
    const total = this.state.prompts.length;
    if (total === 0) return;
    this.activePromptIndex = (this.activePromptIndex + dir + total) % total;
    this.broadcastHostState();
    this.renderHostActivePrompt();
  }

  handleHostNextClick() {
    const isLast = this.activePromptIndex === this.state.prompts.length - 1;

    if (isLast) {
      // Facilitator clicked "Finish" on the final prompt
      this.hostStatus = 'finished';
      this.broadcastHostState();
      this.switchHostView('overview');
    } else {
      // Advance to next prompt
      this.activePromptIndex++;
      this.broadcastHostState();
      this.renderHostActivePrompt();
    }
  }

  renderHostActivePrompt() {
    const prompt = this.state.prompts[this.activePromptIndex];
    if (!prompt) return;

    const theme = getGraphTheme(this.activePromptIndex);
    const total = this.state.prompts.length;
    const isLast = this.activePromptIndex === total - 1;

    // Header and button labels
    this.hostPromptTag.textContent = `Activity ${this.activePromptIndex + 1} of ${total}`;
    this.hostPromptTag.style.backgroundColor = theme.fill;
    this.hostPromptTag.style.color = theme.primary;
    this.hostPromptTag.style.border = `1px solid ${theme.stroke}`;
    this.hostPromptTitle.textContent = prompt.text;

    // Last prompt button is named "Finish"
    if (isLast) {
      this.btnHostNextPrompt.textContent = 'Finish 🎉';
      this.btnHostNextPrompt.className = 'btn btn-primary btn-lg';
      this.btnHostNextPrompt.style.backgroundColor = '#10b981';
      this.btnHostNextPrompt.style.borderColor = '#059669';
    } else {
      this.btnHostNextPrompt.textContent = 'Next Prompt →';
      this.btnHostNextPrompt.className = 'btn btn-primary';
      this.btnHostNextPrompt.style.backgroundColor = '';
      this.btnHostNextPrompt.style.borderColor = '';
    }

    // Render live updating SVG graph
    this.hostActiveGraphContainer.innerHTML = '';
    const ratings = this.state.ratings[prompt.id] || {};
    const svg = this.graphRenderer.renderSVG(
      prompt,
      this.activePromptIndex,
      this.state.participants,
      ratings,
      { isInteractive: false }
    );
    this.hostActiveGraphContainer.appendChild(svg);

    // Participant voting status list (green checkmarks)
    this.renderHostPaxStatusList(prompt);
  }

  renderHostPaxStatusList(prompt) {
    this.hostPaxStatusList.innerHTML = '';
    const participants = this.state.participants;
    const ratings = this.state.ratings[prompt.id] || {};
    let submittedCount = 0;

    participants.forEach(p => {
      const vote = ratings[p.id];
      const hasVoted = !!vote;
      if (hasVoted) submittedCount++;

      const row = document.createElement('div');
      row.className = `pax-status-row ${hasVoted ? 'submitted' : ''}`;
      row.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="pill-code-badge">${p.code}</span>
          <strong>${this.escapeHTML(p.name)}</strong>
        </div>
        <div>
          ${hasVoted ? `
            <span style="color: #10b981; font-weight: 800; font-size: 0.85rem;">
              ✓ Submitted (Imp: ${vote.good}, Fun: ${vote.fun})
            </span>
          ` : `
            <span style="color: #94a3b8; font-size: 0.8rem; font-style: italic;">
              Thinking...
            </span>
          `}
        </div>
      `;
      this.hostPaxStatusList.appendChild(row);
    });

    this.hostLivePaxCount.textContent = `${submittedCount} of ${participants.length} submitted`;
  }

  handlePaxVotedOnHost({ paxId, promptId, good, fun }) {
    this.state.setRating(promptId, paxId, good, fun);
    if (this.hostStatus === 'active') {
      this.renderHostActivePrompt();
    }
    this.broadcastHostState();
  }

  renderSetupPromptRows(count) {
    const existing = Array.from(this.promptsContainer.querySelectorAll('input.prompt-text-input'))
      .map(inp => inp.value);

    this.promptsContainer.innerHTML = '';
    const total = Math.max(1, Math.min(24, count));

    for (let i = 0; i < total; i++) {
      const initialText = existing[i] || (this.state.prompts[i]?.text ?? '');
      this.addSetupPromptRow(initialText, i + 1);
    }
    this.inputNumPrompts.value = total;
  }

  addSetupPromptRow(text = '', index = null) {
    const rowIdx = index || (this.promptsContainer.children.length + 1);
    const row = document.createElement('div');
    row.className = 'prompt-row';
    row.innerHTML = `
      <div class="prompt-badge">#${rowIdx}</div>
      <input type="text" class="input-text prompt-text-input" placeholder="e.g. Activity ${rowIdx}..." value="${this.escapeHTML(text)}">
      <button type="button" class="btn btn-secondary btn-sm btn-delete-row" title="Delete">✕</button>
    `;

    row.querySelector('.btn-delete-row').addEventListener('click', () => {
      row.remove();
      const rows = this.promptsContainer.querySelectorAll('.prompt-row');
      rows.forEach((r, idx) => { r.querySelector('.prompt-badge').textContent = `#${idx + 1}`; });
      this.inputNumPrompts.value = rows.length;
    });

    this.promptsContainer.appendChild(row);
  }

  renderOverviewScreen() {
    this.overviewLegendPills.innerHTML = '';
    this.state.participants.forEach(p => {
      const pill = document.createElement('div');
      pill.className = 'participant-pill';
      pill.innerHTML = `
        <span class="pill-code-badge">${p.code}</span>
        <span>${this.escapeHTML(p.name)}</span>
      `;
      this.overviewLegendPills.appendChild(pill);
    });

    this.allGraphsGrid.innerHTML = '';
    this.state.prompts.forEach((prompt, idx) => {
      const theme = getGraphTheme(idx);
      const card = document.createElement('div');
      card.className = 'prompt-graph-card';
      card.style.borderTop = `4px solid ${theme.primary}`;

      card.innerHTML = `
        <div class="card-top-info">
          <div class="card-prompt-number" style="color: ${theme.primary};">${idx + 1}</div>
          <div class="card-prompt-title" title="${this.escapeHTML(prompt.text)}">${this.escapeHTML(prompt.text)}</div>
        </div>
        <div class="card-svg-wrapper"></div>
      `;

      const svgWrapper = card.querySelector('.card-svg-wrapper');
      const ratings = this.state.ratings[prompt.id] || {};
      const svg = this.miniGraphRenderer.renderSVG(
        prompt,
        idx,
        this.state.participants,
        ratings,
        { compact: true, isInteractive: false }
      );
      svgWrapper.appendChild(svg);

      this.allGraphsGrid.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------------
   * B. PARTICIPANT / PHONE FLOW
   * ------------------------------------------------------------------------ */

  initParticipantFlow() {
    document.documentElement.classList.add('participant-mode');
    document.body.classList.add('participant-mode');

    // Ensure all host panels are completely hidden
    this.viewSetup.classList.remove('active');
    this.viewHostWaiting.classList.remove('active');
    this.viewHostActive.classList.remove('active');
    this.viewOverview.classList.remove('active');

    this.hostHeader.style.display = 'none';
    this.paxHeader.style.display = 'flex';
    this.paxJoinRoomCode.textContent = this.roomCode || 'ROOM';
    this.paxHeaderRoomTitle.textContent = `Room: ${this.roomCode || ''}`;

    // Connect to room network
    this.network = new RoomNetwork(this.roomTopic, (msg) => this.handlePaxIncomingMessage(msg));

    // Check if participant already entered name
    if (this.paxId && this.paxName) {
      localStorage.setItem(`${this.paxStoragePrefix}id`, this.paxId);
      localStorage.setItem(`${this.paxStoragePrefix}name`, this.paxName);
      localStorage.setItem(`${this.paxStoragePrefix}code`, this.paxCode);
      this.paxDisplayName.textContent = this.paxName;
      this.paxBadgePreview.textContent = this.paxCode;
      this.network.publish({ type: 'pax_join', paxId: this.paxId, name: this.paxName, code: this.paxCode });
      this.switchPaxView('waiting');
    } else {
      this.switchPaxView('join');
    }

    // Ping host for latest state
    this.network.publish({ type: 'pax_hello', paxId: this.paxId });
  }

  switchPaxView(view) {
    document.documentElement.classList.add('participant-mode');
    document.body.classList.add('participant-mode');

    // Explicitly hide all host panels
    this.viewSetup.classList.remove('active');
    this.viewHostWaiting.classList.remove('active');
    this.viewHostActive.classList.remove('active');
    this.viewOverview.classList.remove('active');

    this.viewPaxJoin.classList.toggle('active', view === 'join');
    this.viewPaxWaiting.classList.toggle('active', view === 'waiting');
    this.viewPaxRate.classList.toggle('active', view === 'rate');
    this.viewPaxResults.classList.toggle('active', view === 'results');
  }

  handlePaxJoinConfirm() {
    if (this.btnPaxConfirmJoin.disabled) return;
    const raw = this.inputPaxName.value.trim();
    if (!raw) {
      alert('Please enter your name.');
      return;
    }

    this.paxName = raw;
    this.paxId = this.paxId || localStorage.getItem(`${this.paxStoragePrefix}id`) ||
      `pax_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    this.paxCode = raw.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || 'PAX';

    sessionStorage.setItem(`${this.paxStoragePrefix}id`, this.paxId);
    sessionStorage.setItem(`${this.paxStoragePrefix}name`, this.paxName);
    sessionStorage.setItem(`${this.paxStoragePrefix}code`, this.paxCode);
    localStorage.setItem(`${this.paxStoragePrefix}id`, this.paxId);
    localStorage.setItem(`${this.paxStoragePrefix}name`, this.paxName);
    localStorage.setItem(`${this.paxStoragePrefix}code`, this.paxCode);

    this.paxDisplayName.textContent = this.paxName;
    this.paxBadgePreview.textContent = this.paxCode;

    // Send join message to host
    this.network.publish({
      type: 'pax_join',
      paxId: this.paxId,
      name: this.paxName,
      code: this.paxCode
    });

    this.switchPaxView('waiting');
  }

  handlePaxIncomingMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'room_closed') {
      this.network.disconnect();
      for (const key of ['id', 'name', 'code']) {
        sessionStorage.removeItem(`${this.paxStoragePrefix}${key}`);
        localStorage.removeItem(`${this.paxStoragePrefix}${key}`);
      }
      this.paxId = null;
      this.paxName = '';
      this.paxCode = '';
      this.paxSubmittedForPrompt = {};
      this.state.resetAll();
      this.switchPaxView('join');
      this.paxHeaderRoomTitle.textContent = 'Room Closed';
      this.inputPaxName.disabled = true;
      this.btnPaxConfirmJoin.disabled = true;
      document.getElementById('pax-disconnected-message').hidden = false;
      return;
    }

    if (msg.type === 'host_sync') {
      this.handlePaxReceivedHostSync(msg);
    }
  }

  handlePaxReceivedHostSync(sync) {
    // Sync state locally
    if (Array.isArray(sync.prompts)) this.state.prompts = sync.prompts;
    if (Array.isArray(sync.participants)) this.state.participants = sync.participants;
    if (sync.ratings) this.state.ratings = sync.ratings;

    if (!this.paxId) {
      // Haven't joined yet
      return;
    }

    if (sync.status === 'waiting') {
      this.switchPaxView('waiting');
    } else if (sync.status === 'active') {
      this.renderPaxPromptRating(sync.promptIndex);
    } else if (sync.status === 'finished') {
      this.renderPaxResultsScreen();
    }
  }

  renderPaxPromptRating(promptIndex) {
    const prompt = this.state.prompts[promptIndex];
    if (!prompt) return;

    // Routine host syncs must not overwrite sliders the participant is editing.
    const isEditingCurrentPrompt = this.viewPaxRate.classList.contains('active') &&
      this.activePromptIndex === promptIndex;

    this.activePromptIndex = promptIndex;
    const theme = getGraphTheme(promptIndex);
    const total = this.state.prompts.length;

    this.paxRateTag.textContent = `Activity ${promptIndex + 1} of ${total}`;
    this.paxRateTag.style.backgroundColor = theme.fill;
    this.paxRateTag.style.color = theme.primary;
    this.paxRatePromptText.textContent = prompt.text;
    this.paxBadgePreview.style.backgroundColor = theme.primary;

    if (isEditingCurrentPrompt) return;

    // Check if participant already voted for this prompt
    const existingVote = this.state.ratings[prompt.id]?.[this.paxId];
    if (existingVote) {
      this.paxSliderGood.value = existingVote.good;
      this.paxSliderFun.value = existingVote.fun;
      this.paxValGood.textContent = existingVote.good.toFixed(1);
      this.paxValFun.textContent = existingVote.fun.toFixed(1);
      this.paxSubmitStatus.style.display = 'block';
      this.btnPaxSubmitVote.textContent = 'Update Rating ✓';
    } else {
      this.paxSliderGood.value = 5.0;
      this.paxSliderFun.value = 5.0;
      this.paxValGood.textContent = '5.0';
      this.paxValFun.textContent = '5.0';
      this.paxSubmitStatus.style.display = 'none';
      this.btnPaxSubmitVote.textContent = 'Submit Rating ✓';
    }

    this.switchPaxView('rate');
  }

  handlePaxSubmitVote() {
    const prompt = this.state.prompts[this.activePromptIndex];
    if (!prompt) return;

    const good = parseFloat(this.paxSliderGood.value);
    const fun = parseFloat(this.paxSliderFun.value);

    // Save locally
    this.state.setRating(prompt.id, this.paxId, good, fun);

    // Publish to host
    this.network.publish({
      type: 'pax_vote',
      paxId: this.paxId,
      promptId: prompt.id,
      promptIndex: this.activePromptIndex,
      good,
      fun
    });

    this.paxSubmitStatus.style.display = 'block';
    this.btnPaxSubmitVote.textContent = 'Rating Saved ✓';
  }

  renderPaxResultsScreen() {
    this.paxGraphsGrid.innerHTML = '';

    this.state.prompts.forEach((prompt, idx) => {
      const theme = getGraphTheme(idx);
      const card = document.createElement('div');
      card.className = 'prompt-graph-card';
      card.style.borderTop = `4px solid ${theme.primary}`;

      card.innerHTML = `
        <div class="card-top-info">
          <div class="card-prompt-number" style="color: ${theme.primary};">${idx + 1}</div>
          <div class="card-prompt-title" title="${this.escapeHTML(prompt.text)}">${this.escapeHTML(prompt.text)}</div>
        </div>
        <div class="card-svg-wrapper"></div>
      `;

      const svgWrapper = card.querySelector('.card-svg-wrapper');
      const ratings = this.state.ratings[prompt.id] || {};
      const svg = this.miniGraphRenderer.renderSVG(
        prompt,
        idx,
        this.state.participants,
        ratings,
        { compact: true, isInteractive: false }
      );
      svgWrapper.appendChild(svg);

      this.paxGraphsGrid.appendChild(card);
    });

    this.switchPaxView('results');
  }

  escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instantiate app once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new MentoringMatrixApp();
});
