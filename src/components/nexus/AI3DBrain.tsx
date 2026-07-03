"use client";

/**
 * AI3DBrain — CSS-based 3D rotating wireframe sphere.
 * Represents the "AI brain" of NEXUS AI.
 * Uses CSS 3D transforms + perspective to create a rotating
 * wireframe globe with neural connection lines.
 */
export function AI3DBrain({ size = 120 }: { size?: number }) {
  const rings = [];
  const ringCount = 8;

  for (let i = 0; i < ringCount; i++) {
    const angle = (180 / ringCount) * i;
    rings.push(
      <div
        key={i}
        className="absolute inset-0 rounded-full border border-primary/20"
        style={{
          transform: `rotateY(${angle}deg)`,
        }}
      />
    );
  }

  // Horizontal rings
  const hRings = [];
  for (let i = 0; i < 5; i++) {
    const scale = 0.2 + (i * 0.2);
    const offset = (i - 2) * (size * 0.15);
    hRings.push(
      <div
        key={`h-${i}`}
        className="absolute rounded-full border border-primary/15"
        style={{
          width: `${size * scale}px`,
          height: `${size * scale}px`,
          top: `50%`,
          left: `50%`,
          transform: `translate(-50%, -50%) translateY(${offset}px) rotateX(90deg)`,
        }}
      />
    );
  }

  return (
    <div
      className="relative"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        perspective: `${size * 3}px`,
      }}
    >
      {/* Glow behind brain */}
      <div
        className="absolute inset-0 rounded-full bg-primary/10 blur-2xl animate-pulse"
      />
      {/* Rotating wireframe sphere */}
      <div
        className="absolute inset-0 nexus-orbit"
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {rings}
        {hRings}
        {/* Center dot */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/40"
          style={{ width: "6px", height: "6px" }}
        />
        {/* Orbital particles */}
        {[0, 120, 240].map((deg) => (
          <div
            key={`p-${deg}`}
            className="absolute top-1/2 left-1/2 rounded-full bg-primary"
            style={{
              width: "3px",
              height: "3px",
              transform: `rotateY(${deg}deg) translateZ(${size / 2}px) translate(-50%, -50%)`,
              boxShadow: "0 0 8px rgba(0,212,170,0.6)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
