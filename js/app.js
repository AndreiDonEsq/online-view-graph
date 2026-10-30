/**
 * app.js
 * 
 * Main controller for the Mentoring Activities 2D Matrix application.
 * Manages view transitions, facilitator interactions, SVG events,
 * and data synchronization.
 */

import { AppState, getGraphTheme } from './state.js';
import { GraphRenderer } from './graph.js';

class MentoringMatrixApp {
  constructor() {
    this.state = new AppState();
    this.graphRenderer = new GraphRenderer({ width: 440, height: 380 });
    this.miniGraphRenderer = new GraphRenderer({ width: 340, height: 290 });

    this.currentView = 'setup';
    this.activePromptIndex = 0;
    this.activeParticipantId = null;

    this.initDOMElements();
    this.bindEvents();

    // Subscribe to state changes
    this.state.subscribe(() => this.onStateChanged());

    // Initial view decision
    if (this.state.prompts.length > 0 && this.state.participants.length > 0) {
      this.switchView('overview');
    } else {
      this.switchView('setup');
      this.renderSetupPromptRows(6); // Default 6 blank prompt rows ready to fill
    }
  }

  /**
   * Cache references to key DOM elements.
   */
  initDOMElements() {
    // Floating Exit Presentation Mode Button
    this.btnFloatingExitPresentation = document.getElementById('btn-floating-exit-presentation');

    // Nav buttons
    this.navBtnSetup = document.getElementById('nav-btn-setup');
    this.navBtnRate = document.getElementById('nav-btn-rate');
    this.navBtnOverview = document.getElementById('nav-btn-overview');

    // Views
    this.viewSetup = document.getElementById('view-setup');
    this.viewRate = document.getElementById('view-rate');
    this.viewOverview = document.getElementById('view-overview');

    // Setup elements
    this.inputNumPrompts = document.getElementById('input-num-prompts');
    this.btnApplyNumPrompts = document.getElementById('btn-apply-num-prompts');
    this.btnAddPromptRow = document.getElementById('btn-add-prompt-row');
    this.promptsContainer = document.getElementById('prompts-input-container');
    this.textareaParticipants = document.getElementById('textarea-participants');
    this.participantsPreviewPills = document.getElementById('participants-preview-pills');
    this.btnStartSession = document.getElementById('btn-start-session');

    // Rating elements
    this.ratePromptTag = document.getElementById('rate-prompt-tag');
    this.ratePromptTitle = document.getElementById('rate-prompt-title');
    this.btnPrevPrompt = document.getElementById('btn-prev-prompt');
    this.btnNextPrompt = document.getElementById('btn-next-prompt');
    this.btnViewGraphsShortcut = document.getElementById('btn-view-graphs-shortcut');
    this.quickParticipantBar = document.getElementById('quick-participant-bar');
    this.interactiveGraphContainer = document.getElementById('interactive-graph-container');
    this.participantSlidersList = document.getElementById('participant-sliders-list');
    this.ratingsCountSummary = document.getElementById('ratings-count-summary');

    // Overview elements
    this.allGraphsGrid = document.getElementById('all-graphs-grid');
    this.overviewLegendPills = document.getElementById('overview-legend-pills');
    this.btnTogglePresentation = document.getElementById('btn-toggle-presentation');
    this.btnPrint = document.getElementById('btn-print');
    this.btnExportJson = document.getElementById('btn-export-json');
    this.btnImportJson = document.getElementById('btn-import-json');
    this.btnOverviewEdit = document.getElementById('btn-overview-edit');
    this.btnResetSession = document.getElementById('btn-reset-session');

    // Modal elements
    this.modalJson = document.getElementById('modal-json');
    this.modalJsonTitle = document.getElementById('modal-json-title');
    this.textareaJsonData = document.getElementById('textarea-json-data');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.btnCopyJson = document.getElementById('btn-copy-json');
    this.btnApplyImportedJson = document.getElementById('btn-apply-imported-json');
  }

  /**
   * Bind event handlers to UI buttons and inputs.
   */
  bindEvents() {
    // Navigation
    this.navBtnSetup.addEventListener('click', () => this.switchView('setup'));
    this.navBtnRate.addEventListener('click', () => this.switchView('rate'));
    this.navBtnOverview.addEventListener('click', () => this.switchView('overview'));

    // Presentation Mode toggle & exit
    this.btnTogglePresentation.addEventListener('click', () => {
      document.body.classList.toggle('presentation-mode');
    });

    if (this.btnFloatingExitPresentation) {
      this.btnFloatingExitPresentation.addEventListener('click', () => {
        document.body.classList.remove('presentation-mode');
      });
    }

    // Keyboard 'Escape' key exits presentation mode easily
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('presentation-mode')) {
        document.body.classList.remove('presentation-mode');
      }
    });

    // Setup actions
    this.btnApplyNumPrompts.addEventListener('click', () => {
      const count = parseInt(this.inputNumPrompts.value, 10) || 1;
      this.renderSetupPromptRows(count);
    });

    this.btnAddPromptRow.addEventListener('click', () => {
      this.addSetupPromptRow('');
      this.inputNumPrompts.value = this.promptsContainer.children.length;
    });

    this.textareaParticipants.addEventListener('input', () => {
      this.updateParticipantsPreview();
    });

    this.btnStartSession.addEventListener('click', () => this.handleStartSession());

    // Rating navigation
    this.btnPrevPrompt.addEventListener('click', () => this.navigatePrompt(-1));
    this.btnNextPrompt.addEventListener('click', () => this.navigatePrompt(1));
    this.btnViewGraphsShortcut.addEventListener('click', () => this.switchView('overview'));

    // Overview actions
    this.btnPrint.addEventListener('click', () => window.print());
    this.btnOverviewEdit.addEventListener('click', () => this.switchView('rate'));

    this.btnResetSession.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all prompts and ratings?')) {
        this.state.resetAll();
        this.renderSetupPromptRows(6);
        this.textareaParticipants.value = '';
        this.participantsPreviewPills.innerHTML = '';
        this.switchView('setup');
      }
    });

    // JSON export / import modal
    this.btnExportJson.addEventListener('click', () => {
      this.modalJsonTitle.textContent = 'Backup Session Data (JSON)';
      this.textareaJsonData.value = this.state.exportJSON();
      this.btnApplyImportedJson.style.display = 'none';
      this.modalJson.style.display = 'flex';
    });

    this.btnImportJson.addEventListener('click', () => {
      this.modalJsonTitle.textContent = 'Paste Session JSON to Restore';
      this.textareaJsonData.value = '';
      this.btnApplyImportedJson.style.display = 'inline-flex';
      this.modalJson.style.display = 'flex';
    });

    this.btnCloseModal.addEventListener('click', () => {
      this.modalJson.style.display = 'none';
    });

    this.btnCopyJson.addEventListener('click', () => {
      navigator.clipboard.writeText(this.textareaJsonData.value);
      alert('JSON copied to clipboard!');
    });

    this.btnApplyImportedJson.addEventListener('click', () => {
      try {
        this.state.importJSON(this.textareaJsonData.value);
        this.modalJson.style.display = 'none';
        this.switchView('overview');
      } catch (err) {
        alert('Invalid JSON: ' + err.message);
      }
    });
  }

  /**
   * Switch between Setup, Rate, and Overview views.
   * @param {'setup'|'rate'|'overview'} viewName 
   */
  switchView(viewName) {
    this.currentView = viewName;

    // View panels
    this.viewSetup.classList.toggle('active', viewName === 'setup');
    this.viewRate.classList.toggle('active', viewName === 'rate');
    this.viewOverview.classList.toggle('active', viewName === 'overview');

    // Nav buttons styling
    this.navBtnSetup.className = viewName === 'setup' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    this.navBtnRate.className = viewName === 'rate' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
    this.navBtnOverview.className = viewName === 'overview' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';

    if (viewName === 'rate') {
      this.renderRateScreen();
    } else if (viewName === 'overview') {
      this.renderOverviewScreen();
    }
  }

  /**
   * Reaction to AppState changes.
   */
  onStateChanged() {
    if (this.currentView === 'rate') {
      this.renderRateScreen();
    } else if (this.currentView === 'overview') {
      this.renderOverviewScreen();
    }
  }

  /* ------------------------------------------------------------------------
   * 1. SETUP SCREEN CONTROLLER
   * ------------------------------------------------------------------------ */

  /**
   * Render N input rows for prompts in the Setup screen.
   */
  renderSetupPromptRows(count) {
    const existingTexts = Array.from(this.promptsContainer.querySelectorAll('input.prompt-text-input'))
      .map(inp => inp.value);

    this.promptsContainer.innerHTML = '';
    const total = Math.max(1, Math.min(24, count));

    for (let i = 0; i < total; i++) {
      const initialText = existingTexts[i] || (this.state.prompts[i]?.text ?? '');
      this.addSetupPromptRow(initialText, i + 1);
    }
    this.inputNumPrompts.value = total;
  }

  /**
   * Add a single prompt input row.
   */
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
      this.reindexSetupRows();
    });

    this.promptsContainer.appendChild(row);
  }

  reindexSetupRows() {
    const rows = this.promptsContainer.querySelectorAll('.prompt-row');
    rows.forEach((row, idx) => {
      row.querySelector('.prompt-badge').textContent = `#${idx + 1}`;
    });
    this.inputNumPrompts.value = rows.length;
  }

  /**
   * Parse participant names from the textarea and render live preview pills with 3-letter codes.
   */
  updateParticipantsPreview() {
    const raw = this.textareaParticipants.value;
    const names = raw.split(/[\n,]/).map(n => n.trim()).filter(n => n.length > 0);
    this.participantsPreviewPills.innerHTML = '';

    names.forEach((name, idx) => {
      const code = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || `P${idx + 1}`;
      const pill = document.createElement('div');
      pill.className = 'participant-pill';
      pill.innerHTML = `
        <span class="pill-code-badge">${code}</span>
        <span>${this.escapeHTML(name)}</span>
      `;
      this.participantsPreviewPills.appendChild(pill);
    });
  }

  /**
   * Validate setup inputs and transition to rating.
   */
  handleStartSession() {
    const promptInputs = Array.from(this.promptsContainer.querySelectorAll('input.prompt-text-input'));
    const promptTexts = promptInputs.map(inp => inp.value.trim()).filter(t => t.length > 0);

    if (promptTexts.length === 0) {
      alert('Please enter at least one question or activity prompt.');
      return;
    }

    const rawParticipants = this.textareaParticipants.value;
    const participantNames = rawParticipants.split(/[\n,]/).map(n => n.trim()).filter(n => n.length > 0);

    if (participantNames.length === 0) {
      alert('Please enter at least one participant name.');
      return;
    }

    this.state.setPrompts(promptTexts);
    this.state.setParticipants(participantNames);
    this.activePromptIndex = 0;
    this.activeParticipantId = this.state.participants[0]?.id || null;

    this.switchView('rate');
  }

  /* ------------------------------------------------------------------------
   * 2. INTERACTIVE RATING SCREEN CONTROLLER
   * ------------------------------------------------------------------------ */

  navigatePrompt(direction) {
    const total = this.state.prompts.length;
    if (total === 0) return;
    this.activePromptIndex = (this.activePromptIndex + direction + total) % total;
    this.renderRateScreen();
  }

  renderRateScreen() {
    const prompt = this.state.prompts[this.activePromptIndex];
    if (!prompt) {
      if (this.state.prompts.length === 0) {
        this.switchView('setup');
        return;
      }
      this.activePromptIndex = 0;
      return this.renderRateScreen();
    }

    // Theme color for this active graph
    const theme = getGraphTheme(this.activePromptIndex);

    // Header info matching graph theme color
    this.ratePromptTag.textContent = `Activity ${this.activePromptIndex + 1} of ${this.state.prompts.length}`;
    this.ratePromptTag.style.backgroundColor = theme.fill;
    this.ratePromptTag.style.color = theme.primary;
    this.ratePromptTag.style.border = `1px solid ${theme.stroke}`;
    this.ratePromptTitle.textContent = prompt.text;

    // Quick participant selection bar
    this.renderQuickParticipantBar(theme);

    // Render interactive SVG Graph
    this.renderInteractiveGraph(prompt, theme);

    // Render Sliders List
    this.renderParticipantSliders(prompt, theme);
  }

  renderQuickParticipantBar(theme) {
    this.quickParticipantBar.innerHTML = '';
    const participants = this.state.participants;

    if (!this.activeParticipantId || !participants.some(p => p.id === this.activeParticipantId)) {
      this.activeParticipantId = participants[0]?.id || null;
    }

    participants.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isActive = p.id === this.activeParticipantId;
      btn.className = `participant-select-btn ${isActive ? 'active' : ''}`;

      if (isActive) {
        btn.style.backgroundColor = theme.primary;
        btn.style.borderColor = theme.primary;
      } else {
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
      }

      btn.innerHTML = `
        <span class="pill-code-badge" style="${isActive ? 'background:#ffffff; color:' + theme.primary : 'background:' + theme.primary + '; color:#ffffff'}">${p.code}</span>
        <span>${this.escapeHTML(p.name)}</span>
      `;
      btn.addEventListener('click', () => {
        this.activeParticipantId = p.id;
        this.renderRateScreen();
      });
      this.quickParticipantBar.appendChild(btn);
    });
  }

  renderInteractiveGraph(prompt, theme) {
    this.interactiveGraphContainer.innerHTML = '';

    const ratings = this.state.ratings[prompt.id] || {};
    const svg = this.graphRenderer.renderSVG(
      prompt,
      this.activePromptIndex,
      this.state.participants,
      ratings,
      {
        isInteractive: true,
        activeParticipantId: this.activeParticipantId
      }
    );

    // Click on graph to set active participant's rating directly
    svg.addEventListener('click', (e) => {
      if (!this.activeParticipantId) return;

      const rect = svg.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * this.graphRenderer.width;
      const clickY = ((e.clientY - rect.top) / rect.height) * this.graphRenderer.height;

      const good = this.graphRenderer.invertX(clickX);
      const fun = this.graphRenderer.invertY(clickY);

      this.state.setRating(prompt.id, this.activeParticipantId, good, fun);
    });

    // Drag-and-drop support for participant nodes
    let isDragging = false;
    let draggedParticipantId = null;

    svg.addEventListener('mousedown', (e) => {
      const node = e.target.closest('.point-node');
      if (node) {
        isDragging = true;
        draggedParticipantId = node.getAttribute('data-participant-id');
        this.activeParticipantId = draggedParticipantId;
        e.stopPropagation();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || !draggedParticipantId) return;

      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * this.graphRenderer.width;
      const mouseY = ((e.clientY - rect.top) / rect.height) * this.graphRenderer.height;

      const good = this.graphRenderer.invertX(mouseX);
      const fun = this.graphRenderer.invertY(mouseY);

      this.state.setRating(prompt.id, draggedParticipantId, good, fun);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        draggedParticipantId = null;
      }
    });

    this.interactiveGraphContainer.appendChild(svg);
  }

  renderParticipantSliders(prompt, theme) {
    this.participantSlidersList.innerHTML = '';
    const participants = this.state.participants;
    const promptRatings = this.state.ratings[prompt.id] || {};

    let ratedCount = 0;

    participants.forEach(p => {
      const rating = promptRatings[p.id];
      const hasRating = !!rating;
      if (hasRating) ratedCount++;

      const goodVal = rating ? rating.good : 5.0;
      const funVal = rating ? rating.fun : 5.0;
      const isActive = p.id === this.activeParticipantId;

      const card = document.createElement('div');
      card.className = `participant-slider-card ${isActive ? 'active' : ''}`;
      if (isActive) {
        card.style.borderColor = theme.primary;
        card.style.boxShadow = `0 0 0 1px ${theme.primary}`;
      }

      card.innerHTML = `
        <div class="slider-card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="pill-code-badge" style="background-color: ${theme.primary};">${p.code}</span>
            <strong>${this.escapeHTML(p.name)}</strong>
          </div>
          <div>
            ${hasRating ? `
              <button type="button" class="btn btn-secondary btn-sm btn-clear-rating" title="Remove rating">Clear</button>
            ` : `
              <span style="font-size: 0.75rem; color: #94a3b8;">Not rated yet</span>
            `}
          </div>
        </div>
        <div class="slider-group">
          <!-- Useful / Good Slider -->
          <div class="slider-control">
            <label>
              <span>Good / Useful:</span>
              <strong class="good-val-badge" style="color: ${theme.primary};">${hasRating ? goodVal : '-'}</strong>
            </label>
            <input type="range" class="range-good" min="1" max="10" step="0.5" value="${goodVal}" style="accent-color: ${theme.primary};">
          </div>
          <!-- Fun Slider -->
          <div class="slider-control">
            <label>
              <span>Fun:</span>
              <strong class="fun-val-badge" style="color: ${theme.primary};">${hasRating ? funVal : '-'}</strong>
            </label>
            <input type="range" class="range-fun" min="1" max="10" step="0.5" value="${funVal}" style="accent-color: ${theme.primary};">
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (!e.target.closest('input') && !e.target.closest('button')) {
          this.activeParticipantId = p.id;
          this.renderQuickParticipantBar(theme);
          this.renderParticipantSliders(prompt, theme);
          this.renderInteractiveGraph(prompt, theme);
        }
      });

      const goodInput = card.querySelector('.range-good');
      const funInput = card.querySelector('.range-fun');
      const clearBtn = card.querySelector('.btn-clear-rating');

      const handleSliderChange = () => {
        const newGood = parseFloat(goodInput.value);
        const newFun = parseFloat(funInput.value);
        this.activeParticipantId = p.id;
        this.state.setRating(prompt.id, p.id, newGood, newFun);
      };

      goodInput.addEventListener('input', handleSliderChange);
      funInput.addEventListener('input', handleSliderChange);

      if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.state.removeRating(prompt.id, p.id);
        });
      }

      this.participantSlidersList.appendChild(card);
    });

    this.ratingsCountSummary.textContent = `${ratedCount} of ${participants.length} rated`;
  }

  /* ------------------------------------------------------------------------
   * 3. ALL GRAPHS GRID CONTROLLER (Reproducing the user's sketch)
   * ------------------------------------------------------------------------ */

  renderOverviewScreen() {
    // 1. Participant Legend Bar (Showing 3-letter codes)
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

    // 2. Grid of prompt graph cards (1, 2, 3, 4, 5, 6...)
    this.allGraphsGrid.innerHTML = '';

    if (this.state.prompts.length === 0) {
      this.allGraphsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <h3>No prompts configured yet.</h3>
          <button class="btn btn-primary" style="margin-top: 1rem;" onclick="document.getElementById('nav-btn-setup').click()">
            Go to Setup
          </button>
        </div>
      `;
      return;
    }

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

      // Render mini SVG graph for this prompt
      const svgWrapper = card.querySelector('.card-svg-wrapper');
      const ratings = this.state.ratings[prompt.id] || {};

      const svg = this.miniGraphRenderer.renderSVG(
        prompt,
        idx,
        this.state.participants,
        ratings,
        {
          compact: true,
          isInteractive: false
        }
      );
      svgWrapper.appendChild(svg);

      // Clicking any card navigates to Rate mode for that specific prompt
      card.addEventListener('click', () => {
        this.activePromptIndex = idx;
        this.switchView('rate');
      });

      this.allGraphsGrid.appendChild(card);
    });
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
