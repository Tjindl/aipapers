"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  phase: number;
  phaseSpeed: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

export function NeuralCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;
    let particles: Particle[] = [];
    const PARTICLE_COUNT = 60;
    const ACTIVE_COUNT = 7;
    const LINK_DIST = 140;

    let colors = { ink3: "#9c9590", accent: "#b91c1c" };

    function refreshColors() {
      const s = getComputedStyle(document.documentElement);
      const ink3   = s.getPropertyValue("--ink-3").trim();
      const accent = s.getPropertyValue("--accent").trim();
      if (ink3)   colors.ink3   = ink3;
      if (accent) colors.accent = accent;
    }

    function resize() {
      const el = canvas!.parentElement!;
      canvas!.width  = el.offsetWidth;
      canvas!.height = el.offsetHeight;
    }

    function spawnParticle(): Particle {
      const w = canvas!.width  || 800;
      const h = canvas!.height || 180;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        radius: 1.5 + Math.random() * 1.8,
        active: false,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.01 + Math.random() * 0.02,
      };
    }

    function init() {
      resize();
      refreshColors();
      particles = Array.from({ length: PARTICLE_COUNT }, spawnParticle);
      // Pick ACTIVE_COUNT random particles to glow in accent color
      [...Array(PARTICLE_COUNT).keys()]
        .sort(() => Math.random() - 0.5)
        .slice(0, ACTIVE_COUNT)
        .forEach((i) => { particles[i].active = true; });
    }

    function tick() {
      const w = canvas!.width;
      const h = canvas!.height;
      ctx!.clearRect(0, 0, w, h);

      // Move particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += p.phaseSpeed;
        if (p.x <= 0 || p.x >= w) { p.vx *= -1; p.x = Math.max(0, Math.min(w, p.x)); }
        if (p.y <= 0 || p.y >= h) { p.vy *= -1; p.y = Math.max(0, Math.min(h, p.y)); }
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= LINK_DIST) continue;

          const t = 1 - dist / LINK_DIST;
          const isHot = a.active || b.active;

          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.strokeStyle = isHot
            ? hexToRgba(colors.accent, t * 0.5)
            : hexToRgba(colors.ink3, t * 0.28);
          ctx!.lineWidth = isHot ? 0.9 : 0.55;
          ctx!.stroke();
        }
      }

      // Draw nodes
      for (const p of particles) {
        const pulse = 0.75 + 0.25 * Math.sin(p.phase);
        const r = p.active
          ? p.radius * (1 + 0.25 * Math.sin(p.phase))
          : p.radius;

        if (p.active) {
          // Radial glow
          const grad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
          grad.addColorStop(0, hexToRgba(colors.accent, 0.28 * pulse));
          grad.addColorStop(1, hexToRgba(colors.accent, 0));
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, r * 5, 0, Math.PI * 2);
          ctx!.fillStyle = grad;
          ctx!.fill();
        }

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = p.active
          ? hexToRgba(colors.accent, 0.8 * pulse)
          : hexToRgba(colors.ink3, 0.4);
        ctx!.fill();
      }

      rafId = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement!);

    const mo = new MutationObserver(refreshColors);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    init();
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none", opacity: 0.5 }}
    />
  );
}
