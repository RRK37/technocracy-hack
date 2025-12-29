'use client';

import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { SimulationCharacter } from '@/src/lib/character';
import { InteractionGraph } from '@/src/lib/interactionGraph';
import { GraphSnapshot } from '@/src/lib/interactionGraphHistory';
import { CharacterState, WORLD_CONFIG } from '@/src/lib/world';

interface World3DCanvasProps {
    characters: SimulationCharacter[];
    interactionGraph?: InteractionGraph;
    isPlaybackMode?: boolean;
    playbackSnapshot?: GraphSnapshot | null;
}

// Agent sphere component
function AgentSphere({ character, isPlayback }: { character: SimulationCharacter; isPlayback: boolean }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const isConversing = character.state === CharacterState.CONVERSING;

    // Color based on state
    const color = isPlayback
        ? '#f59e0b' // Amber in playback
        : isConversing
            ? '#66ccff' // Blue when conversing
            : '#ff6b6b'; // Red default

    useFrame(() => {
        if (meshRef.current) {
            // Map character coordinates to Three.js coordinates
            // X stays X, Y becomes Z (depth), Z becomes Y (height)
            meshRef.current.position.set(
                character.x - WORLD_CONFIG.WIDTH / 2,
                character.z - WORLD_CONFIG.DEPTH / 2,
                character.y - WORLD_CONFIG.HEIGHT / 2
            );
        }
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[20, 16, 16]} />
            <meshStandardMaterial
                color={color}
                emissive={isConversing ? '#66ccff' : '#000000'}
                emissiveIntensity={isConversing ? 0.3 : 0}
            />
        </mesh>
    );
}

// Single dynamic line that updates each frame
function DynamicLine({
    charA,
    charB,
    weight,
    characters
}: {
    charA: string;
    charB: string;
    weight: number;
    characters: SimulationCharacter[];
}) {
    const lineRef = useRef<any>(null);
    // Reuse buffer to avoid GC pressure
    const positionsBuffer = useRef(new Float32Array(6));

    const MAX_WEIGHT = 800;
    const normalizedWeight = Math.min(weight / MAX_WEIGHT, 1.0);
    const lineWidth = 1 + normalizedWeight * 5;
    const opacity = 0.3 + normalizedWeight * 0.5;

    // Update line geometry every frame
    useFrame(() => {
        if (!lineRef.current?.geometry) return;

        const a = characters.find(c => c.id === charA);
        const b = characters.find(c => c.id === charB);
        if (!a || !b) return;

        // Reuse the buffer instead of creating new Float32Array
        const buf = positionsBuffer.current;
        buf[0] = a.x - WORLD_CONFIG.WIDTH / 2;
        buf[1] = a.z - WORLD_CONFIG.DEPTH / 2;
        buf[2] = a.y - WORLD_CONFIG.HEIGHT / 2;
        buf[3] = b.x - WORLD_CONFIG.WIDTH / 2;
        buf[4] = b.z - WORLD_CONFIG.DEPTH / 2;
        buf[5] = b.y - WORLD_CONFIG.HEIGHT / 2;

        lineRef.current.geometry.setPositions(buf);
    });

    // Get initial positions
    const a = characters.find(c => c.id === charA);
    const b = characters.find(c => c.id === charB);
    if (!a || !b) return null;

    const initialPoints = [
        new THREE.Vector3(
            a.x - WORLD_CONFIG.WIDTH / 2,
            a.z - WORLD_CONFIG.DEPTH / 2,
            a.y - WORLD_CONFIG.HEIGHT / 2
        ),
        new THREE.Vector3(
            b.x - WORLD_CONFIG.WIDTH / 2,
            b.z - WORLD_CONFIG.DEPTH / 2,
            b.y - WORLD_CONFIG.HEIGHT / 2
        )
    ];

    return (
        <Line
            ref={lineRef}
            points={initialPoints}
            color={new THREE.Color(100 / 255, 200 / 255, 255 / 255)}
            lineWidth={lineWidth}
            transparent
            opacity={opacity}
        />
    );
}

// Connection lines component - updates edges every frame
function ConnectionLines({
    characters,
    interactionGraph,
    isPlayback,
    playbackSnapshot
}: {
    characters: SimulationCharacter[];
    interactionGraph?: InteractionGraph;
    isPlayback: boolean;
    playbackSnapshot?: GraphSnapshot | null;
}) {
    const [edgeKeys, setEdgeKeys] = useState<Set<string>>(new Set());
    const edgesRef = useRef<Array<{ charA: string; charB: string; weight: number }>>([]);

    // Update edges on every frame, but only re-render when edge count changes
    useFrame(() => {
        const newEdges = isPlayback && playbackSnapshot
            ? playbackSnapshot.edges
            : (interactionGraph?.getAllEdges() || []);

        // Only trigger re-render when edge count changes
        // (weight/position updates are handled by DynamicLine)
        if (newEdges.length !== edgesRef.current.length) {
            edgesRef.current = newEdges;
            setEdgeKeys(new Set(newEdges.map(e => `${e.charA}-${e.charB}`)));
        }
    });

    return (
        <group>
            {edgesRef.current.map((edge) => (
                <DynamicLine
                    key={`${edge.charA}-${edge.charB}`}
                    charA={edge.charA}
                    charB={edge.charB}
                    weight={edge.weight}
                    characters={characters}
                />
            ))}
        </group>
    );
}

// World boundary box
function WorldBoundary() {
    return (
        <mesh>
            <boxGeometry args={[WORLD_CONFIG.WIDTH, WORLD_CONFIG.DEPTH, WORLD_CONFIG.HEIGHT]} />
            <meshBasicMaterial color="#333355" wireframe transparent opacity={0.2} />
        </mesh>
    );
}

// Main scene component
function Scene({ characters, interactionGraph, isPlaybackMode, playbackSnapshot }: World3DCanvasProps) {
    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <pointLight position={[1000, 1000, 1000]} intensity={1} />
            <pointLight position={[-1000, 500, -500]} intensity={0.5} />
            <directionalLight position={[0, 1000, 0]} intensity={0.3} />

            {/* Grid helper for orientation */}
            <gridHelper
                args={[WORLD_CONFIG.WIDTH, 30, '#444466', '#333344']}
                position={[0, -WORLD_CONFIG.DEPTH / 2, 0]}
            />

            {/* World boundary */}
            <WorldBoundary />

            {/* Orbit controls - click and drag to rotate, scroll to zoom */}
            <OrbitControls
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                minDistance={100}
                maxDistance={5000}
            />

            {/* Connection lines */}
            <ConnectionLines
                characters={characters}
                interactionGraph={interactionGraph}
                isPlayback={isPlaybackMode || false}
                playbackSnapshot={playbackSnapshot}
            />

            {/* Agent spheres */}
            {characters.map((char) => (
                <AgentSphere
                    key={char.id}
                    character={char}
                    isPlayback={isPlaybackMode || false}
                />
            ))}
        </>
    );
}

export function World3DCanvas({ characters, interactionGraph, isPlaybackMode = false, playbackSnapshot }: World3DCanvasProps) {
    return (
        <div className="w-full h-full relative">
            <Canvas
                camera={{
                    position: [0, 1000, 2000],
                    fov: 60,
                    near: 1,
                    far: 10000
                }}
                style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)' }}
            >
                <Scene
                    characters={characters}
                    interactionGraph={interactionGraph}
                    isPlaybackMode={isPlaybackMode}
                    playbackSnapshot={playbackSnapshot}
                />
            </Canvas>
            {/* Instructions overlay */}
            <div className="absolute bottom-4 left-4 bg-black/60 text-white px-3 py-2 rounded-lg text-sm pointer-events-none">
                <span className="font-semibold">Controls:</span> Left-drag to rotate • Right-drag to pan • Scroll to zoom
            </div>
        </div>
    );
}
