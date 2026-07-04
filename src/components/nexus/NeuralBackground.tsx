"use client";

import { useEffect, useRef } from "react";

/**
 * NeuralBackground — animated particle network canvas.
 * Renders a living neural network visualization behind the UI:
 * - Nodes (particles) drift slowly across the screen
 * - Lines connect nearby nodes (synapses)
 * - Pulses travel along connections (neural activity)
 * - Teal color scheme matching NEXUS AI theme
 * - Theme-aware: reads --nexus-glow-rgba from CSS so it adapts to
 *   light/dark mode, and re-reads when the theme class on <html> changes.
 *
 * Performance: capped at 40 nodes, 60fps, pauses when tab hidden.
 */
export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let running = true;

    // Theme color cache — updated when theme changes
    let glowRgb = "0, 212, 170"; // default dark teal
    let lineOpacityMultiplier = 1;

    function readThemeColors() {
      const styles = getComputedStyle(document.documentElement);
      const raw = styles.getPropertyValue("--nexus-glow-rgba").trim();
      if (raw) glowRgb = raw;
      // In light mode, reduce line opacity so the network is subtle
      const isDark = document.documentElement.classList.contains("dark");
      lineOpacityMultiplier = isDark ? 1 : 0.5;
    }
    readThemeColors();

    // Watch for theme class changes on <html> (next-themes toggles .dark)
    const themeObserver = new MutationObserver(() => {
      readThemeColors();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Resize handler
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Particle system
    const PARTICLE_COUNT = Math.min(40, Math.floor(window.innerWidth / 30));
    const MAX_DISTANCE = 150;
    const PULSE_SPEED = 2;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      pulsePhase: number;
    }

    interface Pulse {
      fromIdx: number;
      toIdx: number;
      progress: number;
    }

    const particles: Particle[] = [];
    const pulses: Pulse[] = [];

    // Initialize particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 1,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Spawn neural pulses randomly
    function spawnPulse() {
      if (pulses.length < 8 && particles.length > 2) {
        const from = Math.floor(Math.random() * particles.length);
        let to = Math.floor(Math.random() * particles.length);
        if (to === from) to = (to + 1) % particles.length;
        const dx = particles[from].x - particles[to].x;
        const dy = particles[from].y - particles[to].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DISTANCE) {
          pulses.push({ fromIdx: from, toIdx: to, progress: 0 });
        }
      }
      setTimeout(spawnPulse, 500 + Math.random() * 1500);
    }
    spawnPulse();

    // Animation loop
    function animate() {
      if (!running || !ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update + draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulsePhase += 0.02;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Draw particle (glowing dot)
        const glow = 0.3 + Math.sin(p.pulsePhase) * 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${glowRgb}, ${glow})`;
        ctx.fill();

        // Outer glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${glowRgb}, ${glow * 0.15})`;
        ctx.fill();
      }

      // Draw connections (synapses)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DISTANCE) {
            const opacity = (1 - dist / MAX_DISTANCE) * 0.15 * lineOpacityMultiplier;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${glowRgb}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw + update neural pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        const from = particles[pulse.fromIdx];
        const to = particles[pulse.toIdx];
        if (!from || !to) {
          pulses.splice(i, 1);
          continue;
        }
        pulse.progress += PULSE_SPEED / 100;

        if (pulse.progress >= 1) {
          pulses.splice(i, 1);
          continue;
        }

        // Interpolate position
        const px = from.x + (to.x - from.x) * pulse.progress;
        const py = from.y + (to.y - from.y) * pulse.progress;

        // Draw pulse (bright moving dot)
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${glowRgb}, 0.8)`;
        ctx.fill();

        // Pulse trail
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${glowRgb}, 0.2)`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    }

    animate();

    // Pause when tab hidden (performance)
    function handleVisibility() {
      running = !document.hidden;
      if (running) animate();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
