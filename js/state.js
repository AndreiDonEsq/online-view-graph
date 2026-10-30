/**
 * state.js
 * 
 * Manages the application state, local storage persistence,
 * graph themes (color per graph/prompt), and participant 3-letter codes.
 */

// Distinct theme colors for each individual graph (Prompt 1 = Red, Prompt 2 = Blue, etc.)
// Directly matching the workshop sketch.
export const GRAPH_THEMES = [
  { id: 1, name: 'Red',    primary: '#ef4444', fill: 'rgba(239, 68, 68, 0.12)', stroke: 'rgba(239, 68, 68, 0.55)' },
  { id: 2, name: 'Blue',   primary: '#3b82f6', fill: 'rgba(59, 130, 246, 0.12)', stroke: 'rgba(59, 130, 246, 0.55)' },
  { id: 3, name: 'Cyan',   primary: '#06b6d4', fill: 'rgba(6, 182, 212, 0.12)', stroke: 'rgba(6, 182, 212, 0.55)' },
  { id: 4, name: 'Green',  primary: '#10b981', fill: 'rgba(16, 185, 129, 0.12)', stroke: 'rgba(16, 185, 129, 0.55)' },
  { id: 5, name: 'Maroon', primary: '#991b1b', fill: 'rgba(153, 27, 27, 0.12)', stroke: 'rgba(153, 27, 27, 0.55)' },
  { id: 6, name: 'Purple', primary: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.12)', stroke: 'rgba(139, 92, 246, 0.55)' },
  { id: 7, name: 'Amber',  primary: '#f59e0b', fill: 'rgba(245, 158, 11, 0.12)', stroke: 'rgba(245, 158, 11, 0.55)' },
  { id: 8, name: 'Pink',   primary: '#ec4899', fill: 'rgba(236, 72, 153, 0.12)', stroke: 'rgba(236, 72, 153, 0.55)' },
  { id: 9, name: 'Teal',   primary: '#0d9488', fill: 'rgba(13, 148, 136, 0.12)', stroke: 'rgba(13, 148, 136, 0.55)' },
  { id: 10, name: 'Indigo', primary: '#6366f1', fill: 'rgba(99, 102, 241, 0.12)', stroke: 'rgba(99, 102, 241, 0.55)' }
];

export function getGraphTheme(index) {
  return GRAPH_THEMES[index % GRAPH_THEMES.length];
}

const STORAGE_KEY = 'mentoring_activity_matrix_state_v2';

export class AppState {
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    this.prompts = [];        // [{ id: 1, text: 'Activity description' }]
    this.participants = [];   // [{ id: 'p1', name: 'Alice', code: 'ALI' }]
    this.ratings = {};        // { [promptId]: { [participantId]: { good: 7, fun: 8 } } }
    this.activePromptId = null;
    this.activeParticipantId = null;
    this.subscribers = new Set();

    this.loadFromStorage();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    this.saveToStorage();
    for (const callback of this.subscribers) {
      try {
        callback(this);
      } catch (err) {
        console.error('State subscriber error:', err);
      }
    }
  }

  saveToStorage() {
    try {
      const data = {
        prompts: this.prompts,
        participants: this.participants,
        ratings: this.ratings,
        activePromptId: this.activePromptId,
        activeParticipantId: this.activeParticipantId
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save state to localStorage:', e);
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.prompts)) this.prompts = data.prompts;
      if (Array.isArray(data.participants)) {
        // Ensure 3-letter codes exist
        this.participants = data.participants.map((p, idx) => ({
          ...p,
          code: p.code || p.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || `P${idx+1}`
        }));
      }
      if (data.ratings && typeof data.ratings === 'object') this.ratings = data.ratings;
      this.activePromptId = data.activePromptId || (this.prompts[0]?.id ?? null);
      this.activeParticipantId = data.activeParticipantId || (this.participants[0]?.id ?? null);
    } catch (e) {
      console.warn('Could not parse saved state from localStorage:', e);
    }
  }

  resetAll() {
    this.prompts = [];
    this.participants = [];
    this.ratings = {};
    this.activePromptId = null;
    this.activeParticipantId = null;
    localStorage.removeItem(this.storageKey);
    this.notify();
  }

  setPrompts(promptTexts) {
    this.prompts = promptTexts
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map((text, idx) => ({
        id: idx + 1,
        text
      }));

    if (!this.prompts.some(p => p.id === this.activePromptId)) {
      this.activePromptId = this.prompts[0]?.id ?? null;
    }
    this.notify();
  }

  addPrompt(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const nextId = this.prompts.length > 0 ? Math.max(...this.prompts.map(p => p.id)) + 1 : 1;
    this.prompts.push({ id: nextId, text: trimmed });
    if (!this.activePromptId) this.activePromptId = nextId;
    this.notify();
  }

  /**
   * Set participant names. Automatically generates first 3-letter code (e.g. 'AND', 'ELE').
   * @param {Array<string>} names 
   */
  setParticipants(names) {
    const cleanNames = names.map(n => n.trim()).filter(n => n.length > 0);

    this.participants = cleanNames.map((name, idx) => {
      // First 3 alphanumeric characters
      let code = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
      if (!code) code = `P${idx + 1}`;

      return {
        id: `p_${idx + 1}`,
        name,
        code
      };
    });

    if (!this.participants.some(p => p.id === this.activeParticipantId)) {
      this.activeParticipantId = this.participants[0]?.id ?? null;
    }
    this.notify();
  }

  setRating(promptId, participantId, good, fun) {
    if (!this.ratings[promptId]) {
      this.ratings[promptId] = {};
    }

    const clampedGood = Math.max(1, Math.min(10, Math.round(good * 10) / 10));
    const clampedFun = Math.max(1, Math.min(10, Math.round(fun * 10) / 10));

    this.ratings[promptId][participantId] = {
      good: clampedGood,
      fun: clampedFun
    };

    this.notify();
  }

  removeRating(promptId, participantId) {
    if (this.ratings[promptId] && this.ratings[promptId][participantId]) {
      delete this.ratings[promptId][participantId];
      this.notify();
    }
  }

  getRating(promptId, participantId) {
    return this.ratings[promptId]?.[participantId] || null;
  }

  exportJSON() {
    return JSON.stringify({
      version: '2.0',
      exportedAt: new Date().toISOString(),
      prompts: this.prompts,
      participants: this.participants,
      ratings: this.ratings
    }, null, 2);
  }

  importJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data.prompts) || !Array.isArray(data.participants)) {
      throw new Error('Invalid JSON format: missing prompts or participants.');
    }
    this.prompts = data.prompts;
    this.participants = data.participants.map((p, idx) => ({
      ...p,
      code: p.code || p.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || `P${idx+1}`
    }));
    this.ratings = data.ratings || {};
    this.activePromptId = this.prompts[0]?.id ?? null;
    this.activeParticipantId = this.participants[0]?.id ?? null;
    this.notify();
  }
}
