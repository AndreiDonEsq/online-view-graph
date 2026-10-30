/**
 * graph.js
 * 
 * Renders individual 2D coordinate graphs as responsive SVG elements.
 * Features:
 * - Hand-drawn / chalkboard inspired or clean modern axes labeled "FUN" and "GOOD" with arrows.
 * - Participant points represented by their initial letter badge with their designated color.
 * - Smooth enclosing cluster bubble (convex hull + rounded bezier offset) around group answers.
 * - Interactive dragging and click-to-place support for facilitators.
 */

import { Geometry } from './geometry.js';

export class GraphRenderer {
  /**
   * @param {Object} options Configuration options
   */
  constructor(options = {}) {
    this.width = options.width || 380;
    this.height = options.height || 340;
    this.padding = options.padding || { top: 40, right: 35, bottom: 45, left: 55 };
    this.minVal = 1;
    this.maxVal = 10;
  }

  /**
   * Convert data score (1-10) to SVG pixel coordinate X.
   */
  scaleX(goodVal) {
    const plotWidth = this.width - this.padding.left - this.padding.right;
    const ratio = (goodVal - this.minVal) / (this.maxVal - this.minVal);
    return this.padding.left + ratio * plotWidth;
  }

  /**
   * Convert data score (1-10) to SVG pixel coordinate Y (inverted: 10 at top, 1 at bottom).
   */
  scaleY(funVal) {
    const plotHeight = this.height - this.padding.top - this.padding.bottom;
    const ratio = (funVal - this.minVal) / (this.maxVal - this.minVal);
    return (this.height - this.padding.bottom) - ratio * plotHeight;
  }

  /**
   * Convert SVG pixel X coordinate back to data score (1-10).
   */
  invertX(pixelX) {
    const plotWidth = this.width - this.padding.left - this.padding.right;
    const ratio = (pixelX - this.padding.left) / plotWidth;
    const val = this.minVal + ratio * (this.maxVal - this.minVal);
    return Math.max(this.minVal, Math.min(this.maxVal, Math.round(val * 10) / 10));
  }

  /**
   * Convert SVG pixel Y coordinate back to data score (1-10).
   */
  invertY(pixelY) {
    const plotHeight = this.height - this.padding.top - this.padding.bottom;
    const ratio = ((this.height - this.padding.bottom) - pixelY) / plotHeight;
    const val = this.minVal + ratio * (this.maxVal - this.minVal);
    return Math.max(this.minVal, Math.min(this.maxVal, Math.round(val * 10) / 10));
  }

  /**
   * Generate an SVG string or DOM element for a prompt's graph.
   * 
   * @param {Object} prompt - { id, text }
   * @param {Array<Object>} participants - Array of participant objects
   * @param {Object} promptRatings - Ratings for this prompt: { [pId]: { good, fun } }
   * @param {Object} config - { isInteractive, activeParticipantId, showTitle, compact }
   * @returns {SVGElement}
   */
  renderSVG(prompt, participants, promptRatings = {}, config = {}) {
    const {
      isInteractive = false,
      activeParticipantId = null,
      showTitle = true,
      compact = false
    } = config;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    svg.setAttribute('class', `coordinate-graph ${isInteractive ? 'interactive' : ''}`);

    const originX = this.padding.left;
    const originY = this.height - this.padding.bottom;
    const endX = this.width - this.padding.right + 10;
    const endY = this.padding.top - 10;

    // --- Defs: Arrowhead marker and shadow filter ---
    const defs = document.createElementNS(svgNS, 'defs');
    defs.innerHTML = `
      <marker id="arrowhead" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
        <polygon points="0 0, 8 3.5, 0 7" fill="#1e293b" />
      </marker>
      <marker id="arrowhead-fun" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
        <polygon points="0 0, 8 3.5, 0 7" fill="#1e293b" />
      </marker>
      <filter id="badge-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity="0.25" />
      </filter>
      <filter id="active-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#4f46e5" flood-opacity="0.6" />
      </filter>
    `;
    svg.appendChild(defs);

    // --- Subtle Grid & Quadrants ---
    const gridGroup = document.createElementNS(svgNS, 'g');
    gridGroup.setAttribute('class', 'grid-lines');

    // Subtle quadrant dividers at midpoint (5.5)
    const midX = this.scaleX(5.5);
    const midY = this.scaleY(5.5);

    gridGroup.innerHTML = `
      <!-- Midpoint quadrant lines -->
      <line x1="${midX}" y1="${this.padding.top}" x2="${midX}" y2="${originY}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1.5" />
      <line x1="${originX}" y1="${midY}" x2="${this.width - this.padding.right}" y2="${midY}" stroke="#e2e8f0" stroke-dasharray="4,4" stroke-width="1.5" />
    `;
    svg.appendChild(gridGroup);

    // --- Primary Coordinate Axes (X: GOOD, Y: FUN) ---
    const axisGroup = document.createElementNS(svgNS, 'g');
    axisGroup.setAttribute('class', 'axes');

    // X-Axis line with Arrowhead pointing RIGHT
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

    // Y-Axis line with Arrowhead pointing UP
    const yAxis = document.createElementNS(svgNS, 'line');
    yAxis.setAttribute('x1', originX);
    yAxis.setAttribute('y1', originY);
    yAxis.setAttribute('x2', originX);
    yAxis.setAttribute('y2', endY);
    yAxis.setAttribute('stroke', '#0f172a');
    yAxis.setAttribute('stroke-width', '2.5');
    yAxis.setAttribute('stroke-linecap', 'round');
    yAxis.setAttribute('marker-end', 'url(#arrowhead-fun)');
    axisGroup.appendChild(yAxis);

    // Axis Labels: "FUN" and "GOOD" (in bold style matching the sketch)
    const yLabel = document.createElementNS(svgNS, 'text');
    yLabel.setAttribute('x', originX - 12);
    yLabel.setAttribute('y', endY - 6);
    yLabel.setAttribute('text-anchor', 'end');
    yLabel.setAttribute('class', 'axis-title-fun');
    yLabel.setAttribute('fill', '#0f172a');
    yLabel.setAttribute('font-size', '16');
    yLabel.setAttribute('font-weight', '800');
    yLabel.setAttribute('letter-spacing', '0.5px');
    yLabel.textContent = 'FUN';
    axisGroup.appendChild(yLabel);

    const xLabel = document.createElementNS(svgNS, 'text');
    xLabel.setAttribute('x', endX - 10);
    xLabel.setAttribute('y', originY + 28);
    xLabel.setAttribute('text-anchor', 'end');
    xLabel.setAttribute('class', 'axis-title-good');
    xLabel.setAttribute('fill', '#0f172a');
    xLabel.setAttribute('font-size', '16');
    xLabel.setAttribute('font-weight', '800');
    xLabel.setAttribute('letter-spacing', '0.5px');
    xLabel.textContent = 'GOOD';
    axisGroup.appendChild(xLabel);

    // Subtle scale tick marks at 1 and 10
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

    // --- Collect Participant Point Positions ---
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

    // --- Enclosing Cluster Bubble Shape ("Round shape around their answers") ---
    if (pointList.length > 0) {
      const bubblePathD = Geometry.generateEnclosingBubblePath(
        pointList.map(p => ({ x: p.x, y: p.y })),
        pointList.length === 1 ? 18 : 24
      );

      if (bubblePathD) {
        const bubbleEl = document.createElementNS(svgNS, 'path');
        bubbleEl.setAttribute('d', bubblePathD);
        bubbleEl.setAttribute('class', 'cluster-bubble');
        bubbleEl.setAttribute('fill', 'rgba(99, 102, 241, 0.10)');
        bubbleEl.setAttribute('stroke', 'rgba(79, 70, 229, 0.45)');
        bubbleEl.setAttribute('stroke-width', '2');
        bubbleEl.setAttribute('stroke-dasharray', '5,4');
        bubbleEl.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(bubbleEl);
      }
    }

    // --- Participant Letter Avatar Badges ---
    const pointsGroup = document.createElementNS(svgNS, 'g');
    pointsGroup.setAttribute('class', 'participant-points');

    pointList.forEach(pt => {
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', `point-node ${pt.participant.id === activeParticipantId ? 'is-active' : ''}`);
      g.setAttribute('data-participant-id', pt.participant.id);
      g.setAttribute('cursor', isInteractive ? 'grab' : 'pointer');

      // Outer circle (colored badge)
      const radius = compact ? 12 : 14;
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', pt.participant.color);
      circle.setAttribute('stroke', '#ffffff');
      circle.setAttribute('stroke-width', '2.5');
      circle.setAttribute('filter', pt.participant.id === activeParticipantId ? 'url(#active-glow)' : 'url(#badge-shadow)');

      // Letter text inside circle (Participant's Initial)
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', pt.x);
      text.setAttribute('y', pt.y + (compact ? 3.5 : 4.5));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#ffffff');
      text.setAttribute('font-size', compact ? '10' : '12');
      text.setAttribute('font-weight', '700');
      text.setAttribute('pointer-events', 'none');
      text.textContent = pt.participant.initial;

      // Tooltip title
      const tooltip = document.createElementNS(svgNS, 'title');
      tooltip.textContent = `${pt.participant.name} (Good: ${pt.good}, Fun: ${pt.fun})`;
      g.appendChild(tooltip);

      g.appendChild(circle);
      g.appendChild(text);
      pointsGroup.appendChild(g);
    });

    svg.appendChild(pointsGroup);

    return svg;
  }
}
