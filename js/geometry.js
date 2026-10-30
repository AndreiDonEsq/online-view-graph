/**
 * geometry.js
 * 
 * Provides robust 2D geometric algorithms:
 * 1. Convex Hull computation using Andrew's Monotone Chain algorithm.
 * 2. Minkowski sum / rounded convex dilation:
 *    Computes a mathematically guaranteed, non-self-intersecting, smooth enclosing
 *    bubble with uniform margin R around all participant points.
 *    No folds, no X-pinches, and all badges are strictly contained inside.
 */

export const Geometry = {
  /**
   * Cross product of vectors OA and OB.
   */
  crossProduct(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  },

  /**
   * Euclidean distance between two points.
   */
  distance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  },

  /**
   * Computes the 2D convex hull of an array of points {x, y}.
   * Returns vertices in counter-clockwise order without collinear mid-points.
   * 
   * @param {Array<{x: number, y: number}>} points 
   * @returns {Array<{x: number, y: number}>}
   */
  computeConvexHull(points) {
    if (!points || points.length === 0) return [];
    if (points.length === 1) return [{ ...points[0] }];

    // Deduplicate points within a tiny tolerance
    const unique = [];
    for (const p of points) {
      if (!unique.some(u => Math.hypot(u.x - p.x, u.y - p.y) < 1.0)) {
        unique.push({ x: p.x, y: p.y });
      }
    }

    if (unique.length <= 2) return unique;

    // Sort lexicographically by X then Y
    const sorted = [...unique].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

    // Lower hull
    const lower = [];
    for (const p of sorted) {
      while (lower.length >= 2 && this.crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    // Upper hull
    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && this.crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    lower.pop();
    upper.pop();

    return lower.concat(upper);
  },

  /**
   * Generates a clean, smooth, non-self-intersecting SVG path (Minkowski sum of convex hull + circle of radius R)
   * that strictly encloses all participant points without folds or X-pinches.
   * 
   * @param {Array<{x: number, y: number}>} points - Pixel positions of participant points
   * @param {number} padding - Clearance radius in pixels (default: 28px)
   * @returns {string|null} - SVG path `d` string
   */
  generateEnclosingBubblePath(points, padding = 28) {
    if (!points || points.length === 0) return null;

    const R = Math.max(16, padding);

    // Case 1: Exactly 1 point -> Clean circle
    if (points.length === 1) {
      const { x, y } = points[0];
      return `M ${(x - R).toFixed(1)},${y.toFixed(1)} ` +
             `a ${R},${R} 0 1,0 ${(R * 2).toFixed(1)},0 ` +
             `a ${R},${R} 0 1,0 ${(-R * 2).toFixed(1)},0 Z`;
    }

    const hull = this.computeConvexHull(points);

    // If all points are essentially at the same spot
    if (hull.length === 1) {
      return this.generateEnclosingBubblePath([hull[0]], R);
    }

    // Case 2: 2 points (or all points are collinear) -> Clean capsule/stadium
    if (hull.length === 2) {
      const [p1, p2] = hull;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy);

      if (len < 1e-3) {
        return this.generateEnclosingBubblePath([p1], R);
      }

      // Unit perpendicular normal
      const nx = -dy / len;
      const ny = dx / len;

      const a1 = { x: p1.x + nx * R, y: p1.y + ny * R };
      const a2 = { x: p2.x + nx * R, y: p2.y + ny * R };
      const b1 = { x: p2.x - nx * R, y: p2.y - ny * R };
      const b2 = { x: p1.x - nx * R, y: p1.y - ny * R };

      return `M ${a1.x.toFixed(1)},${a1.y.toFixed(1)} ` +
             `L ${a2.x.toFixed(1)},${a2.y.toFixed(1)} ` +
             `A ${R} ${R} 0 0 1 ${b1.x.toFixed(1)},${b1.y.toFixed(1)} ` +
             `L ${b2.x.toFixed(1)},${b2.y.toFixed(1)} ` +
             `A ${R} ${R} 0 0 1 ${a1.x.toFixed(1)},${a1.y.toFixed(1)} Z`;
    }

    // Case 3: 3 or more non-collinear points
    // Mathematical Minkowski sum: offset each edge outward by R,
    // and connect adjacent edges at vertices with circular arcs of radius R.
    const n = hull.length;
    const cx = hull.reduce((sum, p) => sum + p.x, 0) / n;
    const cy = hull.reduce((sum, p) => sum + p.y, 0) / n;

    const segments = [];
    const normals = [];

    for (let i = 0; i < n; i++) {
      const p1 = hull[i];
      const p2 = hull[(i + 1) % n];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;

      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;

      // Candidate perpendicular normals
      let nx = -dy / len;
      let ny = dx / len;

      // Ensure normal points outward away from polygon centroid
      if (nx * (mx - cx) + ny * (my - cy) < 0) {
        nx = -nx;
        ny = -ny;
      }

      normals.push({ x: nx, y: ny });
      segments.push({
        start: { x: p1.x + nx * R, y: p1.y + ny * R },
        end: { x: p2.x + nx * R, y: p2.y + ny * R }
      });
    }

    // Assemble the continuous smooth SVG path
    let path = `M ${segments[0].start.x.toFixed(1)},${segments[0].start.y.toFixed(1)} `;

    for (let i = 0; i < n; i++) {
      const nextIdx = (i + 1) % n;
      const n1 = normals[i];
      const n2 = normals[nextIdx];
      const cross = n1.x * n2.y - n1.y * n2.x;
      const sweep = cross > 0 ? 1 : 0;

      // Line along offset edge
      path += `L ${segments[i].end.x.toFixed(1)},${segments[i].end.y.toFixed(1)} `;
      // Rounded circular arc around the hull vertex to the next offset edge
      path += `A ${R} ${R} 0 0 ${sweep} ${segments[nextIdx].start.x.toFixed(1)},${segments[nextIdx].start.y.toFixed(1)} `;
    }

    path += 'Z';
    return path;
  }
};
