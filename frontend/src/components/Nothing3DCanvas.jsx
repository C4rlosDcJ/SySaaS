import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Nothing3DCanvas({ isDark }) {
    const mountRef = useRef(null);

    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount) return;

        // Scene, Camera, Renderer
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            50,
            currentMount.clientWidth / currentMount.clientHeight,
            0.1,
            1000
        );
        camera.position.z = 24;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        currentMount.appendChild(renderer.domElement);

        // 3D Dot Matrix Matrix Wireframe Icosahedron + Circuit Particles
        const particleCount = 280;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const originalPositions = new Float32Array(particleCount * 3);

        const radius = 8;
        for (let i = 0; i < particleCount; i++) {
            const phi = Math.acos(-1 + (2 * i) / particleCount);
            const theta = Math.sqrt(particleCount * Math.PI) * phi;

            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            originalPositions[i * 3] = x;
            originalPositions[i * 3 + 1] = y;
            originalPositions[i * 3 + 2] = z;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const dotColor = isDark ? 0xffffff : 0x111111;
        const material = new THREE.PointsMaterial({
            color: dotColor,
            size: 0.35,
            transparent: true,
            opacity: isDark ? 0.85 : 0.7
        });

        const pointCloud = new THREE.Points(geometry, material);
        scene.add(pointCloud);

        // Inner Core Ring Wireframe
        const ringGeo = new THREE.TorusGeometry(5, 0.05, 16, 100);
        const ringMat = new THREE.MeshBasicMaterial({
            color: dotColor,
            wireframe: true,
            transparent: true,
            opacity: isDark ? 0.35 : 0.25
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        scene.add(ring);

        // Mouse Parallax
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        const onMouseMove = (e) => {
            const rect = currentMount.getBoundingClientRect();
            mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
        };

        window.addEventListener('mousemove', onMouseMove);

        // Resize handler
        const onResize = () => {
            if (!currentMount) return;
            camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        };
        window.addEventListener('resize', onResize);

        // Animation Loop
        let animationFrameId;
        let clock = new THREE.Clock();

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            const elapsedTime = clock.getElapsedTime();

            targetX += (mouseX - targetX) * 0.05;
            targetY += (mouseY - targetY) * 0.05;

            pointCloud.rotation.y = elapsedTime * 0.15 + targetX * 0.8;
            pointCloud.rotation.x = elapsedTime * 0.08 + targetY * 0.8;

            ring.rotation.x = elapsedTime * -0.2 + targetY * 0.5;
            ring.rotation.y = elapsedTime * 0.25 + targetX * 0.5;

            renderer.render(scene, camera);
        };

        animate();

        // Cleanup
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('resize', onResize);
            if (currentMount && renderer.domElement) {
                currentMount.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            ringGeo.dispose();
            ringMat.dispose();
            renderer.dispose();
        };
    }, [isDark]);

    return (
        <div
            ref={mountRef}
            style={{
                width: '100%',
                height: '100%',
                minHeight: '340px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}
        />
    );
}
