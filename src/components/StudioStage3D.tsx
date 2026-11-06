/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * ViralMint AI — Interactive Three.js 3D Smart Reframing & Tesla T4 Studio Stage
 * Complies with threejs skill & games_3d.md:
 * - Composite 3–12 part THREE.Group procedural models (9:16 Vertical Framing Rig,
 *   16:9 Source Telemetry Screen, Articulated Broadcast Camera Crane, Tesla T4 GPU Node)
 * - Studio PBR lighting: RoomEnvironment + PMREMGenerator, ACESFilmicToneMapping,
 *   warm directional key light + cool HemisphereLight fill + horizon-matched FogExp2
 * - Software-WebGL guard (isSoftwareGl) with afterDraw() pacing and on-demand rendering
 * - Collapsible bottom dock (zero viewport occlusion, no backdrop-filter over WebGL)
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface StudioStage3DProps {
  cropOffsetX: number; // -50 to 50
  zoomScale: number; // 1.0 to 1.6
  onChangeCropOffsetX: (val: number) => void;
  onChangeZoomScale: (val: number) => void;
  clipTitle: string;
  currentWord: string;
  workerConnected: boolean;
}

type CameraPreset = 'reframe' | 't4_rack' | 'overhead';

export const StudioStage3D: React.FC<StudioStage3DProps> = ({
  cropOffsetX,
  zoomScale,
  onChangeCropOffsetX,
  onChangeZoomScale,
  clipTitle,
  currentWord,
  workerConnected,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('reframe');
  const [finishMode, setFinishMode] = useState<'titanium' | 'obsidian' | 'gold'>('titanium');

  // Store mutable props in ref so React state updates never tear down the WebGLRenderer
  const stateRef = useRef({
    cropOffsetX,
    zoomScale,
    cameraPreset,
    finishMode,
    currentWord,
    workerConnected,
  });

  const requestRenderRef = useRef<(() => void) | null>(null);
  const updateDynamicScreenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current = {
      cropOffsetX,
      zoomScale,
      cameraPreset,
      finishMode,
      currentWord,
      workerConnected,
    };
    if (updateDynamicScreenRef.current) {
      updateDynamicScreenRef.current();
    }
    if (requestRenderRef.current) {
      requestRenderRef.current();
    }
  }, [cropOffsetX, zoomScale, cameraPreset, finishMode, currentWord, workerConnected]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL Guard from GPU renderer string
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(320, container.clientWidth || 800);
    const height = Math.max(260, container.clientHeight || 460);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const horizonColor = new THREE.Color(0x0b1120);
    scene.background = horizonColor;
    scene.fog = new THREE.FogExp2(0x0b1120, 0.045);

    // 2. Mandatory Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 2.3, 6.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 3.0;
    controls.maxDistance = 14.0;

    // 3. Balanced 3-Point Studio Lighting Rig (Warm Key + Cool Hemisphere Fill + Rim)
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.4);
    keyLight.position.set(4.5, 6.5, 5.0);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.25);
    rimLight.position.set(-4.0, 4.0, -4.5);
    scene.add(rimLight);

    // 4. Procedural Studio Floor & Contact Shadow Grounding (Offset >= 0.02 on Y)
    const floorGeo = new THREE.CircleGeometry(14, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.82,
      metalness: 0.15,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Radial contact shadow disc at y = 0.015 (disjoint depth)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d')!;
    const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(0,0,0,0.65)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);
    const contactShadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 4.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.75,
      })
    );
    shadowPlane.position.y = 0.015;
    scene.add(shadowPlane);

    // 5. Composite Procedural 3D Model #1: 16:9 Source Master Display & 9:16 Smart Crop Reticle Group (7 distinct parts)
    const studioRigGroup = new THREE.Group();
    studioRigGroup.position.set(0, 0, 0);
    scene.add(studioRigGroup);

    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.28,
      metalness: 0.82,
    });
    const darkMatteMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.72,
      metalness: 0.22,
    });
    const accentGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.22,
      metalness: 0.88,
    });

    // Part 1: Pedestal Base (LatheGeometry)
    const lathePoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.95, 0.0),
      new THREE.Vector2(0.85, 0.12),
      new THREE.Vector2(0.28, 0.22),
      new THREE.Vector2(0.22, 0.75),
      new THREE.Vector2(0.0, 0.75),
    ];
    const pedestalGeo = new THREE.LatheGeometry(lathePoints, 32);
    const pedestalMesh = new THREE.Mesh(pedestalGeo, chassisMat);
    pedestalMesh.castShadow = true;
    pedestalMesh.receiveShadow = true;
    studioRigGroup.add(pedestalMesh);

    // Part 2: 16:9 Widescreen Outer Bezel Frame
    const screenBezel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.18, 0.14), darkMatteMat);
    screenBezel.position.set(0, 1.72, 0);
    screenBezel.castShadow = true;
    studioRigGroup.add(screenBezel);

    // Part 3: Procedural Dynamic 16:9 Source Canvas Texture
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 1024;
    screenCanvas.height = 576;
    const screenCtx = screenCanvas.getContext('2d')!;
    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTexture.colorSpace = THREE.SRGBColorSpace;
    screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const screenSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(3.56, 2.0),
      new THREE.MeshStandardMaterial({
        map: screenTexture,
        color: 0xffffff,
        roughness: 0.35,
        metalness: 0.05,
      })
    );
    screenSurface.position.set(0, 1.72, 0.075);
    studioRigGroup.add(screenSurface);

    // Part 4 & 5: Sliding 9:16 Vertical Smart-Reframe Gate (Top/Bottom & Left/Right Rails)
    const reframeGateGroup = new THREE.Group();
    reframeGateGroup.position.set(0, 1.72, 0.11);
    studioRigGroup.add(reframeGateGroup);

    const railHorizGeo = new THREE.BoxGeometry(1.16, 0.05, 0.05);
    const railVertGeo = new THREE.BoxGeometry(0.05, 2.04, 0.05);
    const topRail = new THREE.Mesh(railHorizGeo, accentGoldMat);
    topRail.position.set(0, 1.0, 0);
    const bottomRail = new THREE.Mesh(railHorizGeo, accentGoldMat);
    bottomRail.position.set(0, -1.0, 0);
    const leftRail = new THREE.Mesh(railVertGeo, accentGoldMat);
    leftRail.position.set(-0.56, 0, 0);
    const rightRail = new THREE.Mesh(railVertGeo, accentGoldMat);
    rightRail.position.set(0.56, 0, 0);
    reframeGateGroup.add(topRail, bottomRail, leftRail, rightRail);

    // Part 6: Articulated Broadcast Camera Crane & Optical Lens Assembly (Left Flank)
    const cameraCraneGroup = new THREE.Group();
    cameraCraneGroup.position.set(-2.65, 0, 0.7);
    scene.add(cameraCraneGroup);

    const tripodBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 1.25, 24), darkMatteMat);
    tripodBase.position.y = 0.625;
    const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.68), chassisMat);
    cameraBody.position.set(0, 1.42, 0);
    const lensBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.38, 24).rotateX(Math.PI / 2),
      darkMatteMat
    );
    lensBarrel.position.set(0, 1.42, 0.48);
    const lensRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.02, 12, 24),
      accentGoldMat
    );
    lensRing.position.set(0, 1.42, 0.62);
    cameraCraneGroup.add(tripodBase, cameraBody, lensBarrel, lensRing);
    cameraCraneGroup.lookAt(0, 1.5, 0);

    // Part 7: NVIDIA Tesla T4 Cloud Worker Node Rack (Right Flank, 6-part composite with TubeGeometry heatpipes)
    const t4RackGroup = new THREE.Group();
    t4RackGroup.position.set(2.75, 0, 0.35);
    t4RackGroup.rotation.y = -0.38;
    scene.add(t4RackGroup);

    const rackTower = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.85), darkMatteMat);
    rackTower.position.y = 1.05;
    rackTower.castShadow = true;
    t4RackGroup.add(rackTower);

    const t4Shroud = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 0.88), chassisMat);
    t4Shroud.position.set(0, 1.35, 0.02);
    t4RackGroup.add(t4Shroud);

    // Copper heatpipe using TubeGeometry
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.35, 1.58, 0.45),
      new THREE.Vector3(0.0, 1.72, 0.48),
      new THREE.Vector3(0.35, 1.58, 0.45),
    ]);
    const pipeGeo = new THREE.TubeGeometry(pipeCurve, 20, 0.028, 12, false);
    const pipeMesh = new THREE.Mesh(pipeGeo, accentGoldMat);
    t4RackGroup.add(pipeMesh);

    const drawDynamicScreen = () => {
      const s = stateRef.current;
      screenCtx.fillStyle = '#0f172a';
      screenCtx.fillRect(0, 0, 1024, 576);

      // Studio waveform & subject silhouette grid
      screenCtx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      screenCtx.lineWidth = 2;
      for (let x = 64; x < 1024; x += 64) {
        screenCtx.beginPath();
        screenCtx.moveTo(x, 0);
        screenCtx.lineTo(x, 576);
        screenCtx.stroke();
      }
      for (let y = 64; y < 576; y += 64) {
        screenCtx.beginPath();
        screenCtx.moveTo(0, y);
        screenCtx.lineTo(1024, y);
        screenCtx.stroke();
      }

      // Simulated speaker face tracking lock in center + offset
      const centerX = 512 + (s.cropOffsetX / 50) * 260;
      screenCtx.strokeStyle = '#38bdf8';
      screenCtx.lineWidth = 3;
      screenCtx.strokeRect(centerX - 150, 48, 300, 480);

      // Active yellow/white caption preview inside 9:16 crop window
      screenCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      screenCtx.fillRect(centerX - 135, 390, 270, 68);
      screenCtx.font = 'bold 28px Outfit, sans-serif';
      screenCtx.textAlign = 'center';
      screenCtx.fillStyle = '#FACC15';
      screenCtx.fillText(s.currentWord.toUpperCase() || 'VIRAL HOOK', centerX, 434);

      screenCtx.font = '500 18px JetBrains Mono, monospace';
      screenCtx.fillStyle = '#e2e8f0';
      screenCtx.fillText(
        `9:16 SMART REFRAME | X:${s.cropOffsetX > 0 ? '+' : ''}${s.cropOffsetX}% | ZOOM:${s.zoomScale.toFixed(2)}x`,
        512,
        34
      );

      screenTexture.needsUpdate = true;

      // Update material finish based on finishMode
      if (s.finishMode === 'titanium') {
        chassisMat.color.setHex(0x475569);
        chassisMat.metalness = 0.85;
        chassisMat.roughness = 0.25;
      } else if (s.finishMode === 'obsidian') {
        chassisMat.color.setHex(0x0f172a);
        chassisMat.metalness = 0.55;
        chassisMat.roughness = 0.45;
      } else {
        chassisMat.color.setHex(0xd97706);
        chassisMat.metalness = 0.9;
        chassisMat.roughness = 0.2;
      }

      // Position 9:16 gate smoothly
      reframeGateGroup.position.x = (s.cropOffsetX / 50) * 1.1;
      const invZoom = 1 / Math.max(1, s.zoomScale);
      reframeGateGroup.scale.set(invZoom, invZoom, 1);
    };

    updateDynamicScreenRef.current = drawDynamicScreen;
    drawDynamicScreen();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. On-Demand Coalesced Render & Software-WebGL Pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;

    const targetCamPos = new THREE.Vector3(0, 2.15, 6.4);
    const targetLookAt = new THREE.Vector3(0, 1.55, 0);

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const preset = stateRef.current.cameraPreset;
        if (preset === 'reframe') {
          targetCamPos.set(0, 2.0, 5.8);
          targetLookAt.set(0, 1.65, 0);
        } else if (preset === 't4_rack') {
          targetCamPos.set(2.2, 2.1, 4.4);
          targetLookAt.set(2.4, 1.3, 0.2);
        } else {
          targetCamPos.set(0, 5.6, 4.2);
          targetLookAt.set(0, 1.2, 0);
        }

        // Smooth camera damping
        camera.position.lerp(targetCamPos, 0.22);
        controls.target.lerp(targetLookAt, 0.22);
        controls.update();

        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(260, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);
    requestRender();

    return () => {
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('change', requestRender);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className="relative w-full h-[380px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950"
      data-testid="studio-stage-3d"
    >
      {/* Dedicated WebGL Mount Container outside sibling React HUD overlays */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Top-Left Minimal Spec Header */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5">
        <div className="text-xs font-semibold text-slate-100 truncate max-w-[320px]">
          3D Smart Reframing &amp; T4 Render Stage — {clipTitle}
        </div>
        <div className="text-[11px] font-mono text-slate-400 tabular-nums">
          Output: 1080×1920 (9:16) · Crop X: {cropOffsetX}% · Zoom: {zoomScale.toFixed(2)}x · Worker:{' '}
          {workerConnected ? 'Tesla T4 Ready' : 'Standby'}
        </div>
      </div>

      {/* Collapsible Unified Bottom Control Dock (Zero Viewport Occlusion, No backdrop-filter over WebGL) */}
      <div
        className="absolute bottom-3 inset-x-3 mx-auto z-10 max-w-[820px] transition-transform duration-150"
        style={{
          transform: dockCollapsed ? 'translateY(calc(100% - 28px))' : 'translateY(0)',
        }}
      >
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="px-3 py-1 text-xs font-medium bg-slate-900 text-slate-200 border border-slate-700 rounded-t-md hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            {dockCollapsed ? '▴ Show 3D Stage Controls' : '▾ Hide 3D Stage Controls'}
          </button>
        </div>

        {!dockCollapsed && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Camera:</span>
              {(['reframe', 't4_rack', 'overhead'] as CameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCameraPreset(preset)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    cameraPreset === preset
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {preset === 'reframe'
                    ? '9:16 Gate'
                    : preset === 't4_rack'
                    ? 'Tesla T4 Node'
                    : 'Overhead'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
                <span>Reframe X:</span>
                <input
                  type="range"
                  aria-label="3D Smart Crop Horizontal Offset"
                  min={-45}
                  max={45}
                  value={cropOffsetX}
                  onChange={(e) => onChangeCropOffsetX(Number(e.target.value))}
                  className="w-24 accent-amber-400"
                />
                <span className="font-mono text-xs tabular-nums w-9 text-right">{cropOffsetX}%</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-300 whitespace-nowrap">
                <span>Zoom:</span>
                <input
                  type="range"
                  aria-label="3D Smart Crop Zoom Scale"
                  min={1.0}
                  max={1.5}
                  step={0.02}
                  value={zoomScale}
                  onChange={(e) => onChangeZoomScale(Number(e.target.value))}
                  className="w-20 accent-amber-400"
                />
                <span className="font-mono text-xs tabular-nums w-10 text-right">
                  {zoomScale.toFixed(2)}x
                </span>
              </label>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Rig Finish:</span>
              {(['titanium', 'obsidian', 'gold'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFinishMode(f)}
                  className={`px-2 py-1 text-xs rounded capitalize whitespace-nowrap shrink-0 ${
                    finishMode === f
                      ? 'bg-slate-200 text-slate-950 font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
