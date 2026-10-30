/**
 * graph.js
 * 
 * Renders individual 2D coordinate graphs as responsive SVG elements.
 * Features:
 * - Hand-drawn / chalkboard inspired axes labeled "FUN" and "GOOD" with arrows.
 * - Single uniform color theme for all letters and the bubble on a specific graph
 *   (e.g., Graph 1 = Red, Graph 2 = Blue, Graph 3 = Cyan).
 * - 3-letter participant pill badges (e.g., 'AND', 'ELE', 'ALE').
 * - Mathematical Minkowski-sum rounded enclosing bubble: no folds, no X-pinches,
 *   strictly enclosing all badges.
 * - Interactive dragging and click-to-place support for facilitators.
 */

import { Geometry } from './geometry.js';
import { getGraphTheme } from './state.js';

export class GraphRenderer {
  constructor(options = {}) {
    this.width = options.width || 420;
    this.height = options.height || 360;
    this.padding = options.padding || { top: 40, right: 35, bottom: 45, left: 55 };
    this.minVal = 1;
    this.maxVal = 10;
  }

  scaleX(goodVal) {
    const plotWidth = this.width - this.padding.left - this.padding.right;
    const ratio = (goodVal - this.minVal) / (this.maxVal - this.minVal);
    return this.padding.left + ratio * plotWidth;
  }

  scaleY(funVal) {
    const plotHeight = this.height - this.padding.top - this.padding.bottom;
    const ratio = (funVal - this.minVal) / (this.maxVal - this.minVal);
    return (this.height - this.padding.bottom) - ratio * plotHeight;
  }

  invertX(pixelX) {
    const plotWidth = this.width - this.padding.left - this.padding.right;
    const ratio = (pixelX - this.padding.left) / plotWidth;
    const val = this.minVal + ratio * (this.maxVal - this.minVal);
    return Math.max(this.minVal, Math.min(this.maxVal, Math.round(val * 10) / 10));
  }

  invertY(pixelY) {
    const plotHeight = this.height - this.padding.top - this.padding.bottom;
    const ratio = ((this.height - this.padding.bottom) - pixelY) / plotHeight;
    const val = this.minVal + ratio * (this.maxVal - this.minVal);
    return Math.max(this.minVal, Math.min(this.maxVal, Math.round(val * 10) / 10));
  }

  /**
   * Generate an SVG DOM element for a prompt's graph.
   * 
   * @param {Object} prompt - { id, text }
   * @param {number} promptIndex - 0-based index for determining graph theme color
   * @param {Array<Object>} participants - Array of participant objects
   * @param {Object} promptRatings - Ratings for this prompt: { [pId]: { good, fun } }
   * @param {Object} config - { isInteractive, activeParticipantId, compact }
   * @returns {SVGElement}
   */
  renderSVG(prompt, promptIndex, participants, promptRatings = {}, config = {}) {
    const {
      isInteractive = false,
      activeParticipantId = null,
      compact = false
    } = config;

    // Theme color for THIS specific graph (All letters & bubble match this theme)
    const theme = getGraphTheme(promptIndex);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    svg.setAttribute('class', `coordinate-graph ${isInteractive ? 'interactive' : ''}`);

    const originX = this.padding.left;
    const originY = this.height - this.padding.bottom;
    const endX = this.width - this.padding.right + 10;
    const endY = this.padding.top - 10;

    // Defs: Filters and markers
    const defs = document.createElementNS(svgNS, 'defs');
    defs.innerHTML = `
      <marker id="arrowhead" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
        <polygon points="0 0, 8 3.5, 0 7" fill="#0f172a" />
      </marker>
      <filter id="badge-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity="0.22" />
      </filter>
      <filter id="active-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${theme.primary}" flood-opacity="0.8" />
      </filter>
    `;
    svg.appendChild(defs);

    // Subtle quadrant dividers at midpoint (5.5)
    const gridGroup = document.createElementNS(svgNS, 'g');
    gridGroup.setAttribute('class', 'grid-lines');
    const midX = this.scaleX(5.5);
    const midY = this.scaleY(5.5);
    gridGroup.innerHTML = `
      <line x1="${midX}" y1="${this.padding.top}" x2="${midX}" y2="${originY}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1.5" />
      <line x1="${originX}" y1="${midY}" x2="${this.width - this.padding.right}" y2="${midY}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1.5" />
    `;
    svg.appendChild(gridGroup);

    // Coordinate Axes (X: GOOD, Y: FUN)
    const axisGroup = document.createElementNS(svgNS, 'g');
    axisGroup.setAttribute('class', 'axes');

    // X-Axis with Arrow pointing RIGHT
    const xAxis = document.createElementNS(svgNS, 'line');
    xAxis.setAttribute('x1', originX);
    xAxis.setAttribute('y1', originY);
    xAxis.setAttribute('x2', endX);
    xAxis.setAttribute('y2', originY);
    xAxis.setAttribute('stroke', '#0f172a');
    xAxis.setAttribute('stroke-width', '2.5');
    xAxis.setAttribute('stroke-linecap', 'round');
    xAxis.setAttribute('marker-end', 'url(#arrowhead)');
    axisGroup.appendChild(xAxis);

    // Y-Axis with Arrow pointing UP
    const yAxis = document.createElementNS(svgNS, 'line');
    yAxis.setAttribute('x1', originX);
    yAxis.setAttribute('y1', originY);
    yAxis.setAttribute('x2', originX);
    yAxis.setAttribute('y2', endY);
    yAxis.setAttribute('stroke', '#0f172a');
    yAxis.setAttribute('stroke-width', '2.5');
    yAxis.setAttribute('stroke-linecap', 'round');
    yAxis.setAttribute('marker-end', 'url(#arrowhead)');
    axisGroup.appendChild(yAxis);

    // Axis Labels: "Fun for Mentor" and "Impactful to Mentee"
    const yLabel = document.createElementNS(svgNS, 'text');
    yLabel.setAttribute('x', originX);
    yLabel.setAttribute('y', endY - 12);
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('fill', '#0f172a');
    yLabel.setAttribute('font-size', compact ? '12' : '14');
    yLabel.setAttribute('font-weight', '800');
    yLabel.textContent = 'Fun for Mentor';
    axisGroup.appendChild(yLabel);

    const xLabel = document.createElementNS(svgNS, 'text');
    xLabel.setAttribute('x', endX);
    xLabel.setAttribute('y', originY + 28);
    xLabel.setAttribute('text-anchor', 'end');
    xLabel.setAttribute('fill', '#0f172a');
    xLabel.setAttribute('font-size', compact ? '12' : '14');
    xLabel.setAttribute('font-weight', '800');
    xLabel.textContent = 'Impactful to Mentee';
    axisGroup.appendChild(xLabel);

    // Ticks
    const ticks = [
      { text: '1', x: this.scaleX(1), y: originY + 16 },
      { text: '10', x: this.scaleX(10), y: originY + 16 },
      { text: '1', x: originX - 14, y: this.scaleY(1) + 4 },
      { text: '10', x: originX - 14, y: this.scaleY(10) + 4 }
    ];
    ticks.forEach(t => {
      const tickEl = document.createElementNS(svgNS, 'text');
      tickEl.setAttribute('x', t.x);
      tickEl.setAttribute('y', t.y);
      tickEl.setAttribute('text-anchor', 'middle');
      tickEl.setAttribute('fill', '#94a3b8');
      tickEl.setAttribute('font-size', '11');
      tickEl.setAttribute('font-weight', '600');
      tickEl.textContent = t.text;
      axisGroup.appendChild(tickEl);
    });
    svg.appendChild(axisGroup);

    // Collect Participant Point Positions
    const pointList = [];
    participants.forEach(p => {
      const rating = promptRatings[p.id];
      if (rating && typeof rating.good === 'number' && typeof rating.fun === 'number') {
        const px = this.scaleX(rating.good);
        const py = this.scaleY(rating.fun);
        pointList.push({
          participant: p,
          good: rating.good,
          fun: rating.fun,
          x: px,
          y: py
        });
      }
    });

    // Enclosing Cluster Bubble (Mathematically guaranteed Minkowski sum)
    if (pointList.length > 0) {
      // Clearance padding ensuring 3-letter pill badges sit completely inside
      const bubblePadding = compact ? 24 : 30;
      const bubblePathD = Geometry.generateEnclosingBubblePath(
        pointList.map(p => ({ x: p.x, y: p.y })),
        bubblePadding
      );

      if (bubblePathD) {
        const bubbleEl = document.createElementNS(svgNS, 'path');
        bubbleEl.setAttribute('d', bubblePathD);
        bubbleEl.setAttribute('class', 'cluster-bubble');
        bubbleEl.setAttribute('fill', theme.fill);
        bubbleEl.setAttribute('stroke', theme.stroke);
        bubbleEl.setAttribute('stroke-width', '2');
        bubbleEl.setAttribute('stroke-dasharray', '5,4');
        bubbleEl.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(bubbleEl);
      }
    }

    // Participant 3-Letter Pill Badges
    const pointsGroup = document.createElementNS(svgNS, 'g');
    pointsGroup.setAttribute('class', 'participant-points');

    const badgeWidth = compact ? 32 : 38;
    const badgeHeight = compact ? 18 : 22;
    const badgeRadius = badgeHeight / 2;

    pointList.forEach(pt => {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', `point-node ${pt.participant.id === activeParticipantId ? 'is-active' : ''}`);
      g.setAttribute('data-participant-id', pt.participant.id);
      g.setAttribute('cursor', isInteractive ? 'grab' : 'pointer');

      // 3-letter badge code (e.g. 'AND', 'ELE', 'ALE')
      const code = pt.participant.code || pt.participant.name.substring(0, 3).toUpperCase();

      // Rounded Pill Shape
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', pt.x - badgeWidth / 2);
      rect.setAttribute('y', pt.y - badgeHeight / 2);
      rect.setAttribute('width', badgeWidth);
      rect.setAttribute('height', badgeHeight);
      rect.setAttribute('rx', badgeRadius);
      rect.setAttribute('ry', badgeRadius);
      // All letters in this graph share this graph's theme color!
      rect.setAttribute('fill', theme.primary);
      rect.setAttribute('stroke', pt.participant.id === activeParticipantId ? '#ffffff' : '#ffffff');
      rect.setAttribute('stroke-width', pt.participant.id === activeParticipantId ? '3' : '2');
      rect.setAttribute('filter', pt.participant.id === activeParticipantId ? 'url(#active-glow)' : 'url(#badge-shadow)');

      // 3-Letter Text inside Badge
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', pt.x);
      text.setAttribute('y', pt.y + (compact ? 3.5 : 4.5));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ffffff');
      text.setAttribute('font-size', compact ? '9' : '11');
      text.setAttribute('font-weight', '800');
      text.setAttribute('letter-spacing', '0.5px');
      text.setAttribute('pointer-events', 'none');
      text.textContent = code;

      // Tooltip
      const tooltip = document.createElementNS(svgNS, 'title');
      tooltip.textContent = `${pt.participant.name} (${code}) — Impactful: ${pt.good}, Fun: ${pt.fun}`;
      g.appendChild(tooltip);

      g.appendChild(rect);
      g.appendChild(text);
      pointsGroup.appendChild(g);
    });

    svg.appendChild(pointsGroup);

    return svg;
  }
}
