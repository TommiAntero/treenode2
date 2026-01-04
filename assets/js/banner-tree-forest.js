(function () {
  "use strict";

  const canvas = document.getElementById("bannerTreeCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  let W = 0, H = 0;
  let dpr = Math.min(2, window.devicePixelRatio || 1);

  // Tree template: 10 points in a "tree" shape (normalized around center)
  // Coordinates are relative (unitless) and later scaled.
  // (0,0) is tree center.
  const TREE_TEMPLATE = [
    [ 0.00, -0.55], // top
    [-0.18, -0.40], // upper-left
    [ 0.18, -0.40], // upper-right
    [-0.32, -0.20], // left branch
    [ 0.32, -0.20], // right branch
    [-0.38,  0.10], // left base
    [ 0.38,  0.10], // right base
    [-0.12,  0.10], // inner-left
    [ 0.12,  0.18], // inner-right
    [ 0.00,  0.42]  // trunk bottom
  ];

  const CFG = {
    treeCount: 10,         // number of separate tree symbols
    nodesPerTree: 10,      // fixed by template, keep 10
    minScale: 26,          // px scale of template (smaller = smaller trees)
    maxScale: 44,

    nodeRadius: 5.5,       // circle radius
    nodeAlpha: 0.80,       // opacity

    // Physics
    spring: 0.055,         // pull back to anchor
    damping: 0.86,
    maxSpeed: 7.0,

    // Interaction
    hoverRadius: 95,       // mouse influence radius per node
    repelStrength: 1.15,   // how strongly nodes run away
    noiseStrength: 0.20,   // small extra jitter while repelling

    // Placement constraints (keep away from the central text box)
    safeCenterXMin: 0.34,  // zone to avoid (roughly where the inner box sits)
    safeCenterXMax: 0.66,
    safeCenterYMin: 0.22,
    safeCenterYMax: 0.78,

    // Overall drawing style
    color: "rgba(0,0,0,0.85)"
  };

  const state = {
    trees: [], // each tree has nodes with anchors
    mouse: { x: -9999, y: -9999, active: false },
    lastT: performance.now()
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function rand(lo, hi) {
    return lo + Math.random() * (hi - lo);
  }

  function chooseTreeCenter() {
    // Place trees across banner, avoiding the central box area.
    // We'll try a few random samples; if none good, accept anyway.
    for (let tries = 0; tries < 40; tries++) {
      const nx = Math.random();
      const ny = Math.random();

      const inSafeBox =
        nx > CFG.safeCenterXMin && nx < CFG.safeCenterXMax &&
        ny > CFG.safeCenterYMin && ny < CFG.safeCenterYMax;

      // bias towards edges for aesthetics
      const edgeBias = (nx < 0.2 || nx > 0.8 || ny < 0.25 || ny > 0.85);

      if (!inSafeBox && edgeBias) return [nx * W, ny * H];
      if (!inSafeBox && tries > 15) return [nx * W, ny * H];
    }
    return [Math.random() * W, Math.random() * H];
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.floor(r.width));
    H = Math.max(1, Math.floor(r.height));

    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    initForest();
  }

  function initForest() {
    state.trees = [];

    for (let t = 0; t < CFG.treeCount; t++) {
      const [cx, cy] = chooseTreeCenter();
      const scale = rand(CFG.minScale, CFG.maxScale);

      const nodes = TREE_TEMPLATE.slice(0, CFG.nodesPerTree).map(([tx, ty]) => {
        const ax = cx + tx * scale;
        const ay = cy + ty * scale;
        return {
          ax, ay,   // anchor position
          x: ax,
          y: ay,
          vx: 0,
          vy: 0
        };
      });

      state.trees.push({ cx, cy, scale, nodes });
    }
  }

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    state.mouse.x = e.clientX - r.left;
    state.mouse.y = e.clientY - r.top;
    state.mouse.active = true;
  }

  function onLeave() {
    state.mouse.x = -9999;
    state.mouse.y = -9999;
    state.mouse.active = false;
  }

  function step(dt) {
    const mx = state.mouse.x;
    const my = state.mouse.y;

    for (const tree of state.trees) {
      for (const n of tree.nodes) {
        // Spring back to anchor
        n.vx += (n.ax - n.x) * CFG.spring;
        n.vy += (n.ay - n.y) * CFG.spring;

        if (state.mouse.active) {
          // Repel per node
          const dx = n.x - mx;
          const dy = n.y - my;
          const d = Math.sqrt(dx * dx + dy * dy);

          if (d < CFG.hoverRadius) {
            const t = 1 - d / CFG.hoverRadius; // 0..1
            const f = t * t * CFG.repelStrength;

            const nx = dx / (d || 1);
            const ny = dy / (d || 1);

            n.vx += nx * f * 16;
            n.vy += ny * f * 16;

            // subtle scatter (keeps it organic)
            n.vx += (Math.random() - 0.5) * CFG.noiseStrength;
            n.vy += (Math.random() - 0.5) * CFG.noiseStrength;
          }
        }

        // Damping & cap
        n.vx *= CFG.damping;
        n.vy *= CFG.damping;

        n.vx = clamp(n.vx, -CFG.maxSpeed, CFG.maxSpeed);
        n.vy = clamp(n.vy, -CFG.maxSpeed, CFG.maxSpeed);

        // Integrate
        n.x += n.vx * (dt * 60);
        n.y += n.vy * (dt * 60);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = CFG.color;

    // Draw nodes for all trees
    for (const tree of state.trees) {
      for (const n of tree.nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, CFG.nodeRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function loop(t) {
    const dt = Math.min(0.033, (t - state.lastT) / 1000);
    state.lastT = t;

    step(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // Init
  window.addEventListener("resize", resize);
  // listen on document so it works even when mouse is over the inner box/buttons
  document.addEventListener("mousemove", onMove, { passive: true });
  document.addEventListener("mouseleave", onLeave, { passive: true });

  resize();
  requestAnimationFrame(loop);
})();
