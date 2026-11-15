import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { EmployeeRecord, RoomDefinition, RoomId } from '../types/hq';
import { createFloorGridTexture } from './textures';
import { createOfficeMaterials } from './materials';
import {
  buildEmployeeAvatar,
  buildOfficeArchitecture,
  getOverviewCameraPreset,
  getRoomById,
  getStateBeaconHex,
  type EmployeeRig,
} from './builders';

interface NeonOfficeCanvasProps {
  rooms: RoomDefinition[];
  employees: EmployeeRecord[];
  focusedRoomId: RoomId | null;
  selectedEmployeeId: string | null;
  onSelectRoom: (roomId: RoomId) => void;
  onSelectEmployee: (employeeId: string) => void;
}

// Reusable math scratchpad outside render loop (zero GC)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _deltaVec = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function NeonOfficeCanvas({
  rooms,
  employees,
  focusedRoomId,
  selectedEmployeeId,
  onSelectRoom,
  onSelectEmployee,
}: NeonOfficeCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Refs synced from React props so WebGL canvas never remounts
  const employeesRef = useRef(employees);
  const roomsRef = useRef(rooms);
  const onSelectRoomRef = useRef(onSelectRoom);
  const onSelectEmployeeRef = useRef(onSelectEmployee);
  const cameraTransitionRef = useRef<{ active: boolean; pos: THREE.Vector3; target: THREE.Vector3 }>({
    active: false,
    pos: new THREE.Vector3(0, 21, 24),
    target: new THREE.Vector3(0, 0.5, 0),
  });
  const rigsRef = useRef<Map<string, EmployeeRig>>(new Map());
  const selectedEmpRef = useRef<string | null>(selectedEmployeeId);

  employeesRef.current = employees;
  roomsRef.current = rooms;
  onSelectRoomRef.current = onSelectRoom;
  onSelectEmployeeRef.current = onSelectEmployee;
  selectedEmpRef.current = selectedEmployeeId;

  // Trigger smooth camera preset transition when focusedRoomId or selectedEmployeeId changes
  useEffect(() => {
    if (selectedEmployeeId) {
      const rig = rigsRef.current.get(selectedEmployeeId);
      if (rig) {
        cameraTransitionRef.current = {
          active: true,
          pos: new THREE.Vector3(rig.currentPos.x + 3.8, 4.4, rig.currentPos.z + 5.2),
          target: new THREE.Vector3(rig.currentPos.x, 1.15, rig.currentPos.z),
        };
        return;
      }
    }

    if (focusedRoomId) {
      const room = getRoomById(roomsRef.current, focusedRoomId);
      if (room) {
        cameraTransitionRef.current = {
          active: true,
          pos: new THREE.Vector3(room.cameraPosition.x, room.cameraPosition.y, room.cameraPosition.z),
          target: new THREE.Vector3(room.cameraTarget.x, room.cameraTarget.y, room.cameraTarget.z),
        };
        return;
      }
    }

    const overview = getOverviewCameraPreset();
    cameraTransitionRef.current = {
      active: true,
      pos: overview.pos,
      target: overview.target,
    };
  }, [focusedRoomId, selectedEmployeeId]);

  // Sync employee target slots & states into existing 3D rigs
  useEffect(() => {
    for (const emp of employees) {
      const rig = rigsRef.current.get(emp.id);
      if (!rig) continue;
      rig.targetPos.set(emp.targetSlot.x, 0, emp.targetSlot.z);
      rig.targetYaw = emp.targetSlot.facingYaw;
      rig.state = emp.state;
      const beaconHex = getStateBeaconHex(emp.state);
      rig.beaconMat.color.setHex(beaconHex);
      rig.beaconMat.emissive.setHex(beaconHex);
    }
  }, [employees]);

  // One-time WebGL initialization
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.015);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 180);
    const overview = getOverviewCameraPreset();
    camera.position.copy(overview.pos);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Mandatory studio environment reflection map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Balanced 3-point institutional lighting rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x090d16, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    keyLight.position.set(16, 28, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 85;
    keyLight.shadow.camera.left = -24;
    keyLight.shadow.camera.right = 24;
    keyLight.shadow.camera.top = 24;
    keyLight.shadow.camera.bottom = -24;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-18, 14, -20);
    scene.add(rimLight);

    // OrbitControls with damping (disabled damping on Software WebGL per guidelines)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minPolarAngle = 0.18;
    controls.minDistance = 4;
    controls.maxDistance = 46;
    controls.target.copy(overview.target);

    const cancelTransitionOnUserInput = () => {
      cameraTransitionRef.current.active = false;
    };
    controls.addEventListener('start', cancelTransitionOnUserInput);

    // Build textures, materials, 9 rooms, and 8 employee rigs
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const floorTex = createFloorGridTexture(maxAniso);
    const materials = createOfficeMaterials(floorTex, isSoftwareGl);

    const arch = buildOfficeArchitecture(scene, roomsRef.current, materials, maxAniso, isSoftwareGl);
    const allDisposables: Array<{ dispose: () => void }> = [floorTex, envTarget, ...arch.disposables];
    const clickTargets: THREE.Object3D[] = [...arch.roomClickTargets];

    const rigs = new Map<string, EmployeeRig>();
    for (const emp of employeesRef.current) {
      const built = buildEmployeeAvatar(emp, materials);
      scene.add(built.rig.group);
      rigs.set(emp.id, built.rig);
      clickTargets.push(built.rig.hitbox);
      allDisposables.push(...built.disposables);
    }
    rigsRef.current = rigs;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting for clicking 3D avatars or rooms (layer 1 only)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return; // Ignore orbit drags

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickTargets, false);
      if (hits.length === 0) return;

      const empHit = hits.find((h) => h.object.userData?.kind === 'employee');
      if (empHit) {
        onSelectEmployeeRef.current(empHit.object.userData.employeeId);
        return;
      }

      const roomHit = hits.find((h) => h.object.userData?.kind === 'room');
      if (roomHit) {
        onSelectRoomRef.current(roomHit.object.userData.roomId);
      }
    };

    let lastHoverCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 75) return;
      lastHoverCheck = now;

      const rect = renderer.domElement.getBoundingClientRect();
      _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickTargets, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation loop with software WebGL afterDraw pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Rotate central trading floor hologram subtly
      arch.hologramMesh.rotation.y += dt * 0.45;
      arch.hologramMesh.position.y = 1.45 + Math.sin(elapsed * 1.4) * 0.08;

      // Animate all 8 employee avatars smoothly toward backend target coordinates
      rigs.forEach((rig) => {
        _deltaVec.subVectors(rig.targetPos, rig.currentPos);
        const dist = _deltaVec.length();

        if (dist > 0.06) {
          // Walk smoothly at ~3.6 m/s
          const step = Math.min(dist, dt * 3.6);
          _deltaVec.normalize().multiplyScalar(step);
          rig.currentPos.add(_deltaVec);
          rig.group.position.copy(rig.currentPos);

          const moveYaw = Math.atan2(_deltaVec.x, _deltaVec.z);
          rig.currentYaw = THREE.MathUtils.damp(rig.currentYaw, moveYaw, 10, dt);
          rig.group.rotation.y = rig.currentYaw;

          // Stride kinematics
          const stride = Math.sin(elapsed * 9.5 + rig.phaseOffset);
          rig.legL.rotation.x = stride * 0.55;
          rig.legR.rotation.x = -stride * 0.55;
          rig.armL.rotation.x = -stride * 0.45;
          rig.armR.rotation.x = stride * 0.45;
        } else {
          rig.currentPos.copy(rig.targetPos);
          rig.group.position.copy(rig.currentPos);
          rig.currentYaw = THREE.MathUtils.damp(rig.currentYaw, rig.targetYaw, 8, dt);
          rig.group.rotation.y = rig.currentYaw;

          // Settled posture by backend state
          rig.legL.rotation.x = THREE.MathUtils.damp(rig.legL.rotation.x, 0, 10, dt);
          rig.legR.rotation.x = THREE.MathUtils.damp(rig.legR.rotation.x, 0, 10, dt);

          const isActiveWork =
            rig.state === 'ANALYZING' ||
            rig.state === 'RESEARCHING' ||
            rig.state === 'EXECUTING' ||
            rig.state === 'MONITORING_TRADE';
          const armRest = isActiveWork ? -0.45 + Math.sin(elapsed * 5 + rig.phaseOffset) * 0.08 : 0;
          rig.armL.rotation.x = THREE.MathUtils.damp(rig.armL.rotation.x, armRest, 8, dt);
          rig.armR.rotation.x = THREE.MathUtils.damp(rig.armR.rotation.x, -armRest * 0.85, 8, dt);
        }

        // Floating state beacon bob & spin
        rig.beaconMesh.rotation.y += dt * 1.4;
        rig.beaconMesh.position.y = 1.98 + Math.sin(elapsed * 2.2 + rig.phaseOffset) * 0.04;

        // Highlight selected avatar floor ring
        const isSelected = selectedEmpRef.current === rig.id;
        rig.ringMat.opacity = isSelected ? 1.0 : 0.65;
      });

      // Smooth exponential camera preset transition
      if (cameraTransitionRef.current.active) {
        _camGoalPos.copy(cameraTransitionRef.current.pos);
        _camGoalTarget.copy(cameraTransitionRef.current.target);

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 5.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 5.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 5.5, dt);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 6.0, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 6.0, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 6.0, dt);

        if (
          camera.position.distanceTo(_camGoalPos) < 0.08 &&
          controls.target.distanceTo(_camGoalTarget) < 0.08
        ) {
          cameraTransitionRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', cancelTransitionOnUserInput);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      materials.dispose();
      allDisposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-[#060913] overflow-hidden">
      <div ref={mountRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#060913]/95 text-slate-200 p-6">
          <div className="max-w-md text-center border border-slate-800 bg-slate-900/90 p-6 rounded-xl">
            <h3 className="font-[var(--font-display)] text-lg font-semibold text-white">
              3D Viewport Recovering
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              WebGL context was temporarily suspended by the browser. Restoring scene geometry and lighting automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
