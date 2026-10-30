/**
 * geometry.js
 * 
 * Provides 2D geometric algorithms:
 * 1. Convex Hull computation using Andrew's Monotone Chain algorithm (O(N log N)).
 * 2. Smooth enclosing bubble generation: creates an expanded, rounded SVG path
 *    around a set of points (participants' answers) to show group clustering.
 */

export const Geometry = {
  /**
   * Cross product of vectors OA and OB.
   * A positive cross product indicates a counter-clockwise turn,
   * negative indicates a clockwise turn, and zero indicates collinear points.
   */
  crossProduct(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  },

  /**
   * Euclidean distance between two 2D points.
   */
  distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.hypot(dx, dy);
  },

  /**
   * Computes the 2D convex hull of an array of points {x, y}.
   * Returns an array of points on the hull in counter-clockwise order.
   * 
   * @param {Array<{x: number, y: number}>} points 
   * @returns {Array<{x: number, y: number}>}
   */
  computeConvexHull(points) {
    if (!points || points.length <= 2) {
      return points ? [...points] : [];
    }

    // Sort points lexicographically (first by x, then by y)
    const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

    // Remove duplicates if any
    const unique = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || sorted[i].x !== sorted[i - 1].x || sorted[i].y !== sorted[i - 1].y) {
        unique.push(sorted[i]);
      }
    }
    if (unique.length <= 2) return unique;

    // Build lower hull
    const lower = [];
    for (const p of unique) {
      while (lower.length >= 2 && this.crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    // Build upper hull
    const upper = [];
    for (let i = unique.length - 1; i >= 0; i--) {
      const p = unique[i];
      while (upper.length >= 2 && this.crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    // Pop the last point of each half because it's repeated at the beginning of the other half
    lower.pop();
    upper.pop();

    return lower.concat(upper);
  },

  /**
   * Generates a smooth, rounded SVG path string (a "bubble") enclosing the given points.
   * 
   * @param {Array<{x: number, y: number}>} points - The points to enclose in pixel coordinates
   * @param {number} padding - Padding distance in pixels to expand around points (default: 26px)
   * @returns {string|null} - SVG path `d` attribute string, or null if no points.
   */
  generateEnclosingBubblePath(points, padding = 26) {
    if (!points || points.length === 0) return null;

    // Case 1: Single point -> Return a circular path
    if (points.length === 1) {
      const { x, y } = points[0];
      const r = padding + 6;
      return `M ${x - r},${y} ` +
             `a ${r},${r} 0 1,0 ${r * 2},0 ` +
             `a ${r},${r} 0 1,0 ${-r * 2},0 Z`;
    }

    // Case 2: Two points -> Return a capsule (pill shape)
    if (points.length === 2) {
      const [p1, p2] = points;
      const dist = this.distance(p1, p2);

      // If points are nearly coincident, draw a circle
      if (dist < 1e-4) {
        const r = padding + 6;
        return `M ${p1.x - r},${p1.y} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0 Z`;
      }

      // Unit normal perpendicular to vector p1 -> p2
      const nx = -(p2.y - p1.y) / dist;
      const ny = (p2.x - p1.x) / dist;
      const r = padding + 6;

      const a1 = { x: p1.x + nx * r, y: p1.y + ny * r };
      const a2 = { x: p2.x + nx * r, y: p2.y + ny * r };
      const b1 = { x: p2.x - nx * r, y: p2.y - ny * r };
      const b2 = { x: p1.x - nx * r, y: p1.y - ny * r };

      return `M ${a1.x},${a1.y} ` +
             `L ${a2.x},${a2.y} ` +
             `A ${r},${r} 0 0,1 ${b1.x},${b1.y} ` +
             `L ${b2.x},${b2.y} ` +
             `A ${r},${r} 0 0,1 ${a1.x},${a1.y} Z`;
    }

    // Case 3: Three or more points -> Compute convex hull and expand outward
    const hull = this.computeConvexHull(points);

    if (hull.length === 1) {
      return this.generateEnclosingBubblePath([hull[0]], padding);
    }
    if (hull.length === 2) {
      return this.generateEnclosingBubblePath([hull[0], hull[1]], padding);
    }

    // Calculate outward-expanded vertices
    const n = hull.length;
    const expanded = [];

    for (let i = 0; i < n; i++) {
      const prev = hull[(i - 1 + n) % n];
      const curr = hull[i];
      const next = hull[(i + 1) % n];

      // Segment vector 1 (prev -> curr) and normal
      const d1x = curr.x - prev.x;
      const d1y = curr.y - prev.y;
      const len1 = Math.hypot(d1x, d1y) || 1;
      const n1x = -d1y / len1;
      const n1y = d1x / len1;

      // Segment vector 2 (curr -> next) and normal
      const d2x = next.x - curr.x;
      const d2y = next.y - curr.y;
      const len2 = Math.hypot(d2x, d2y) || 1;
      const n2x = -d2y / len2;
      const n2y = d2x / len2;

      // Average normal (bisector direction pointing outward)
      let bx = n1x + n2x;
      let by = n1y + n2y;
      const blen = Math.hypot(bx, by);

      if (blen < 1e-4) {
        bx = n1x;
        by = n1y;
      } else {
        bx /= blen;
        by /= blen;
      }

      // Mitigate excessive extrusion on sharp corners by clamping factor
      const dot = n1x * bx + n1y * by;
      const scale = Math.min(2.0, 1 / Math.max(0.4, dot));

      expanded.push({
        x: curr.x + bx * padding * scale,
        y: curr.y + by * padding * scale
      });
    }

    // Build a smooth closed spline using midpoints and quadratic curves
    const m = expanded.length;
    if (m === 0) return null;

    // Start at the midpoint between the last and first vertex
    const startMidX = (expanded[m - 1].x + expanded[0].x) / 2;
    const startMidY = (expanded[m - 1].y + expanded[0].y) / 2;

    let path = `M ${startMidX.toFixed(2)},${startMidY.toFixed(2)} `;

    for (let i = 0; i < m; i++) {
      const pCurrent = expanded[i];
      const pNext = expanded[(i + 1) % m];
      const midX = (pCurrent.x + pNext.x) / 2;
      const midY = (pCurrent.y + pNext.y) / 2;

      path += `Q ${pCurrent.x.toFixed(2)},${pCurrent.y.toFixed(2)} ${midX.toFixed(2)},${midY.toFixed(2)} `;
    }

    path += 'Z';
    return path;
  }
};
