(function () {
  "use strict";

  const canvas = document.getElementById("treeCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;

  const state = {
    nodes: [],
    mouse: { x: -9999, y: -9999, active: false },
    lastT: performance.now(),
    dpr: Math.min(2, window.devicePixelRatio || 1),
  };

  // Tune these
  const CFG = {
    canopyNodes: 220,
    trunkNodes: 45,
    nodeRadius: 2.6,
    repelRadius: 110,
    repelStrength: 0.55,
    returnStrength: 0.06,
    damping: 0.86,
    linkDist: 34,
    linkAlpha: 0.22,
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));

    state.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * state.dpr);
    canvas.height = Math.floor(H * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    buildTree();
  }

  function randn() {
    // Box–Muller
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  function buildTree() {
    const nodes = [];

    // Canopy: width decreases as y goes up, giving a tree silhouette.
    for (let i = 0; i < CFG.canopyNodes; i++) {
      const t = Math.random(); // 0 bottom .. 1 top
      const y = H * (0.2 + 0.65 * (1 - t)); // canopy from ~0.85..0.2
      const halfWidth = (W * 0.22) * (0.25 + (1 - t) ** 0.75); // wider near bottom
      const x = W / 2 + randn() * halfWidth;

      nodes.push(makeNode(x, y));
    }

    // Trunk: a vertical column of nodes
    for (let i = 0; i < CFG.trunkNodes; i++) {
      const t = i / Math.max(1, CFG.trunkNodes - 1);
      const y = H * (0.88 - 0.55 * t);
      const x = W / 2 + randn() * (W * 0.012);

      nodes.push(makeNode(x, y));
    }

    state.nodes = nodes;
  }

  function makeNode(x, y) {
    return {
      ax: x, ay: y,   // anchor (rest position)
      x, y,           // current
      vx: 0, vy: 0,   // velocity
    };
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

    for (const n of state.nodes) {
      // Pull back to anchor
      const toAx = n.ax - n.x;
      const toAy = n.ay - n.y;
      n.vx += toAx * CFG.returnStrength;
      n.vy += toAy * CFG.returnStrength;

      // Repel from mouse
      const dx = n.x - mx;
      const dy = n.y - my;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d < CFG.repelRadius) {
        const f = (1 - d / CFG.repelRadius) * CFG.repelStrength;
        const nx = dx / (d || 1);
        const ny = dy / (d || 1);
        n.vx += nx * f * 18;
        n.vy += ny * f * 18;
      }

      // Integrate
      n.vx *= CFG.damping;
      n.vy *= CFG.damping;
      n.x += n.vx * (dt * 60);
      n.y += n.vy * (dt * 60);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Links: lightweight, local neighborhood (O(n^2) but small enough at ~265 nodes)
    ctx.lineWidth = 1;
    for (let i = 0; i < state.nodes.length; i++) {
      const a = state.nodes[i];
      for (let j = i + 1; j < state.nodes.length; j++) {
        const b = state.nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        const max2 = CFG.linkDist * CFG.linkDist;

        if (d2 < max2) {
          const alpha = CFG.linkAlpha * (1 - d2 / max2);
          ctx.strokeStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Nodes
    for (const n of state.nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, CFG.nodeRadius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.92)";
      ctx.fill();
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
  canvas.addEventListener("mousemove", onMove, { passive: true });
  canvas.addEventListener("mouseleave", onLeave, { passive: true });
  window.addEventListener("resize", resize);

  resize();
  requestAnimationFrame(loop);
})();
