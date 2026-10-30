/**
 * state.js
 * 
 * Manages the application state, local storage persistence,
 * participant color assignments, and pub/sub updates.
 */

// Distinct, vibrant color palette for participant identification
export const PARTICIPANT_PALETTE = [
  '#ef4444', // Red / Crimson
  '#3b82f6', // Bright Blue
  '#10b981', // Emerald Green
  '#f59e0b', // Amber / Orange
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#f97316', // Bright Orange
  '#14b8a6', // Teal
  '#a855f7', // Purple
  '#e11d48', // Rose
  '#0284c7', // Sky Blue
  '#059669', // Dark Emerald
  '#d97706'  // Ochre
];

const STORAGE_KEY = 'mentoring_activity_matrix_state_v1';

export class AppState {
  constructor() {
    this.prompts = [];        // [{ id: 1, text: 'Activity description' }]
    this.participants = [];   // [{ id: 'p1', name: 'Alice', initial: 'A', color: '#...' }]
    this.ratings = {};        // { [promptId]: { [participantId]: { good: 7, fun: 8 } } }
    this.activePromptId = null;
    this.activeParticipantId = null;
    this.subscribers = new Set();

    this.loadFromStorage();
  }

  /**
   * Subscribe to state change notifications.
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
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

  /**
   * Save current state to browser localStorage.
   */
  saveToStorage() {
    try {
      const data = {
        prompts: this.prompts,
        participants: this.participants,
        ratings: this.ratings,
        activePromptId: this.activePromptId,
        activeParticipantId: this.activeParticipantId
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save state to localStorage:', e);
    }
  }

  /**
   * Load saved session from browser localStorage.
   */
  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.prompts)) this.prompts = data.prompts;
      if (Array.isArray(data.participants)) this.participants = data.participants;
      if (data.ratings && typeof data.ratings === 'object') this.ratings = data.ratings;
      this.activePromptId = data.activePromptId || (this.prompts[0]?.id ?? null);
      this.activeParticipantId = data.activeParticipantId || (this.participants[0]?.id ?? null);
    } catch (e) {
      console.warn('Could not parse saved state from localStorage:', e);
    }
  }

  /**
   * Clear all stored session data.
   */
  resetAll() {
    this.prompts = [];
    this.participants = [];
    this.ratings = {};
    this.activePromptId = null;
    this.activeParticipantId = null;
    localStorage.removeItem(STORAGE_KEY);
    this.notify();
  }

  /**
   * Set the list of prompts (activities to rate).
   * @param {Array<string>} promptTexts 
   */
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

  /**
   * Add a new prompt.
   * @param {string} text 
   */
  addPrompt(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const nextId = this.prompts.length > 0 ? Math.max(...this.prompts.map(p => p.id)) + 1 : 1;
    this.prompts.push({ id: nextId, text: trimmed });
    if (!this.activePromptId) this.activePromptId = nextId;
    this.notify();
  }

  /**
   * Set participant names. Automatically generates initials and distinct colors.
   * @param {Array<string>} names 
   */
  setParticipants(names) {
    const cleanNames = names.map(n => n.trim()).filter(n => n.length > 0);
    
    // Track initials to resolve duplicates if needed (e.g. A vs An)
    const initialCounts = {};
    cleanNames.forEach(n => {
      const init = n.charAt(0).toUpperCase();
      initialCounts[init] = (initialCounts[init] || 0) + 1;
    });

    this.participants = cleanNames.map((name, idx) => {
      let initial = name.charAt(0).toUpperCase();
      // If multiple people share the same initial, use first 2 chars
      if (initialCounts[initial] > 1 && name.length >= 2) {
        initial = name.substring(0, 2).toUpperCase();
      }

      return {
        id: `p_${idx + 1}`,
        name,
        initial,
        color: PARTICIPANT_PALETTE[idx % PARTICIPANT_PALETTE.length]
      };
    });

    if (!this.participants.some(p => p.id === this.activeParticipantId)) {
      this.activeParticipantId = this.participants[0]?.id ?? null;
    }
    this.notify();
  }

  /**
   * Record or update a participant's rating for a specific prompt.
   * 
   * @param {number} promptId 
   * @param {string} participantId 
   * @param {number} good - Rating from 1 to 10 for Useful / Good
   * @param {number} fun  - Rating from 1 to 10 for Fun
   */
  setRating(promptId, participantId, good, fun) {
    if (!this.ratings[promptId]) {
      this.ratings[promptId] = {};
    }

    // Clamp values between 1 and 10, round to 1 decimal place
    const clampedGood = Math.max(1, Math.min(10, Math.round(good * 10) / 10));
    const clampedFun = Math.max(1, Math.min(10, Math.round(fun * 10) / 10));

    this.ratings[promptId][participantId] = {
      good: clampedGood,
      fun: clampedFun
    };

    this.notify();
  }

  /**
   * Delete rating for a participant on a prompt.
   */
  removeRating(promptId, participantId) {
    if (this.ratings[promptId] && this.ratings[promptId][participantId]) {
      delete this.ratings[promptId][participantId];
      this.notify();
    }
  }

  /**
   * Retrieve rating for a specific prompt and participant.
   */
  getRating(promptId, participantId) {
    return this.ratings[promptId]?.[participantId] || null;
  }

  /**
   * Export the entire state as a downloadable JSON object.
   */
  exportJSON() {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      prompts: this.prompts,
      participants: this.participants,
      ratings: this.ratings
    }, null, 2);
  }

  /**
   * Import state from a JSON string.
   */
  importJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data.prompts) || !Array.isArray(data.participants)) {
      throw new Error('Invalid JSON format: missing prompts or participants.');
    }
    this.prompts = data.prompts;
    this.participants = data.participants;
    this.ratings = data.ratings || {};
    this.activePromptId = this.prompts[0]?.id ?? null;
    this.activeParticipantId = this.participants[0]?.id ?? null;
    this.notify();
  }
}
