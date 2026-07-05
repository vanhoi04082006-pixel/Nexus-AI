"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ===== AI Core — rotating wireframe sphere with orbiting nodes ===== */
function AICore() {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= 0.005;
      innerRef.current.rotation.z += 0.002;
    }
    if (outerRef.current) {
      outerRef.current.rotation.x += 0.001;
      outerRef.current.rotation.z -= 0.003;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Inner solid sphere (dark core) */}
      <mesh ref={innerRef}>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial
          color="#060b14"
          emissive="#00d4aa"
          emissiveIntensity={0.15}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Wireframe sphere 1 */}
      <mesh>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color="#00d4aa" wireframe transparent opacity={0.15} />
      </mesh>

      {/* Wireframe sphere 2 (outer) */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[1.8, 8, 8]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.1} />
      </mesh>

      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial color="#00d4aa" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

/* ===== Orbiting Nodes ===== */
function OrbitingNodes() {
  const groupRef = useRef<THREE.Group>(null);

  const nodes = useMemo(() => {
    const arr: { position: [number, number, number]; color: string; size: number; speed: number }[] = [];
    const colors = ["#00d4aa", "#38bdf8", "#a78bfa", "#f59e0b"];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const radius = 2.5 + Math.random() * 1.5;
      const height = (Math.random() - 0.5) * 3;
      arr.push({
        position: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
        color: colors[i % colors.length],
        size: 0.04 + Math.random() * 0.06,
        speed: 0.5 + Math.random() * 0.5,
      });
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => (
        <OrbitingNode key={i} {...node} />
      ))}
    </group>
  );
}

function OrbitingNode({ position, color, size, speed }: { position: [number, number, number]; color: string; size: number; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.3;
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </mesh>
  );
}

/* ===== Particle Field ===== */
function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const count = 800;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const c = Math.random();
      if (c < 0.6) {
        colors[i * 3] = 0; colors[i * 3 + 1] = 0.83; colors[i * 3 + 2] = 0.67;
      } else if (c < 0.8) {
        colors[i * 3] = 0.22; colors[i * 3 + 1] = 0.74; colors[i * 3 + 2] = 0.97;
      } else {
        colors[i * 3] = 0.66; colors[i * 3 + 1] = 0.55; colors[i * 3 + 2] = 0.98;
      }
    }
    return { positions, colors };
  }, []);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.0003;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[particles.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ===== Main 3D Scene ===== */
export function Scene3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 50 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.5} color="#00d4aa" />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#38bdf8" />
      <AICore />
      <OrbitingNodes />
      <ParticleField />
    </Canvas>
  );
}
