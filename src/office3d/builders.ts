import * as THREE from 'three';
import type { EmployeeRecord, EmployeeState, RoomDefinition, RoomId } from '../types/hq';
import type { OfficeMaterialLibrary } from './materials';
import {
  createContactShadowTexture,
  createRoomLabelTexture,
  createScreenTexture,
} from './textures';

export interface EmployeeRig {
  id: string;
  group: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  headGroup: THREE.Group;
  visorMat: THREE.MeshStandardMaterial;
  beaconMat: THREE.MeshStandardMaterial;
  beaconMesh: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  hitbox: THREE.Mesh;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  currentYaw: number;
  targetYaw: number;
  state: EmployeeState;
  phaseOffset: number;
}

const STATE_BEACON_COLORS: Record<EmployeeState, number> = {
  IDLE: 0x64748b,
  ANALYZING: 0x06b6d4,
  RESEARCHING: 0x8b5cf6,
  DISCUSSING: 0x38bdf8,
  WAITING_FOR_APPROVAL: 0xf59e0b,
  EXECUTING: 0x10b981,
  MONITORING_TRADE: 0x2dd4bf,
  COMPLETED: 0x22c55e,
  ERROR: 0xef4444,
};

function createWorkstationGroup(
  mats: OfficeMaterialLibrary,
  accentColor: number,
  screenTexture: THREE.Texture,
  width = 2.0,
): THREE.Group {
  const desk = new THREE.Group();

  // Desk surface
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.9), mats.deskTopMat);
  top.position.y = 0.76;
  top.castShadow = true;
  top.receiveShadow = true;
  desk.add(top);

  // Left & Right metallic legs
  const legGeo = new THREE.BoxGeometry(0.08, 0.74, 0.76);
  const legL = new THREE.Mesh(legGeo, mats.deskFrameMat);
  legL.position.set(-width / 2 + 0.1, 0.37, 0);
  legL.castShadow = true;
  desk.add(legL);

  const legR = new THREE.Mesh(legGeo, mats.deskFrameMat);
  legR.position.set(width / 2 - 0.1, 0.37, 0);
  legR.castShadow = true;
  desk.add(legR);

  // Accent underglow trim bar
  const trimMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, 0.03, 0.04), trimMat);
  trim.position.set(0, 0.71, 0.43);
  desk.add(trim);

  // Monitor stand + dual angled screens
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.34, 12), mats.deskFrameMat);
  stand.position.set(0, 0.94, -0.22);
  desk.add(stand);

  const screenMat = new THREE.MeshStandardMaterial({
    map: screenTexture,
    emissiveMap: screenTexture,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.18,
    metalness: 0.1,
  });

  const monitorFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.48, 0.04), mats.serverChassisMat);
  monitorFrameL.position.set(-0.46, 1.14, -0.2);
  monitorFrameL.rotation.y = 0.18;
  desk.add(monitorFrameL);

  const monitorGlassL = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.42), screenMat);
  monitorGlassL.position.set(-0.456, 1.14, -0.175);
  monitorGlassL.rotation.y = 0.18;
  desk.add(monitorGlassL);

  const monitorFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.48, 0.04), mats.serverChassisMat);
  monitorFrameR.position.set(0.46, 1.14, -0.2);
  monitorFrameR.rotation.y = -0.18;
  desk.add(monitorFrameR);

  const monitorGlassR = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.42), screenMat);
  monitorGlassR.position.set(0.456, 1.14, -0.175);
  monitorGlassR.rotation.y = -0.18;
  desk.add(monitorGlassR);

  return desk;
}

function createChairGroup(mats: OfficeMaterialLibrary, accentColor: number): THREE.Group {
  const chair = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.05, 16), mats.deskFrameMat);
  base.position.y = 0.03;
  chair.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 12), mats.deskFrameMat);
  stem.position.y = 0.24;
  chair.add(stem);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.46), mats.chairMat);
  seat.position.y = 0.46;
  seat.castShadow = true;
  chair.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.07), mats.chairMat);
  back.position.set(0, 0.76, -0.2);
  back.castShadow = true;
  chair.add(back);

  const stripMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.9,
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.02), stripMat);
  strip.position.set(0, 0.95, -0.24);
  chair.add(strip);

  return chair;
}

function getRoomScreenLines(room: RoomDefinition): string[] {
  switch (room.id) {
    case 'CEO_OFFICE':
      return [
        'ROLE: Executive AI Oversight',
        'MODE: DEMO (LIVE LOCKED)',
        'AI ROUTER: Phase 2 Pending',
        'RISK OVERRIDE: Prohibited',
      ];
    case 'AI_WAR_ROOM':
      return [
        'PROTOCOL: Multi-Agent Debate',
        'VOTING: Evidence-Weighted',
        'CONSENSUS: CRO Veto Protected',
        'STATUS: Phase 1 Routing Ready',
      ];
    case 'RISK_OFFICE':
      return [
        'MAX RISK/TRADE: 0.15% Equity',
        'MAX DAILY LOSS: 1.00%',
        'MAX POSITIONS: 2 · CROSS MARGIN',
        'VERIFIED SL: Mandatory Fail-Closed',
      ];
    case 'TECHNICAL_ROOM':
      return [
        'TIMEFRAMES: 5m 15m 1h 4h 1d',
        'INDICATORS: EMA RSI MACD ATR',
        'MARKET FEED: Not Connected',
        'PHASE: 3 (Intelligence)',
      ];
    case 'TRADING_FLOOR':
      return [
        'HEAD TRADER: Elena Rostova',
        'BTC FILTER: Standby (Phase 3)',
        'EXCHANGE: Binance USD-M',
        'CONNECTION: Not Connected',
      ];
    case 'ORDER_FLOW_LAB':
      return [
        'METRICS: OBI / CVD / OI / Funding',
        'LIQUIDATION STREAM: Standby',
        'EXCHANGE WS: Not Connected',
        'NO FABRICATED DATA',
      ];
    case 'SMC_ROOM':
      return [
        'DETECTOR: BOS / CHoCH / FVG',
        'LIQUIDITY SWEEPS: Queued',
        'DATA SOURCE: Real OHLCV Only',
        'PHASE: 3 (Intelligence)',
      ];
    case 'QUANT_LAB':
      return [
        'ENGINE: Walk-Forward Validation',
        'OVERFIT GUARD: Out-of-Sample',
        'BACKTEST STORE: Phase 6',
        'POSTGRES SCHEMA: Defined',
      ];
    case 'EXECUTION_CENTER':
      return [
        'EXCHANGE: Binance Futures',
        'SL/TP VERIFY: Mandatory Post-Fill',
        'TESTNET API: Not Connected',
        'LIVE MODE: Strictly Locked',
      ];
  }
}

export function buildOfficeArchitecture(
  scene: THREE.Scene,
  rooms: RoomDefinition[],
  mats: OfficeMaterialLibrary,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): {
  roomClickTargets: THREE.Mesh[];
  hologramMesh: THREE.Mesh;
  disposables: Array<{ dispose: () => void }>;
} {
  const disposables: Array<{ dispose: () => void }> = [];
  const roomClickTargets: THREE.Mesh[] = [];

  // Main architectural slab floor
  const mainFloorGeo = new THREE.PlaneGeometry(44, 34);
  const mainFloor = new THREE.Mesh(mainFloorGeo, mats.floorMat);
  mainFloor.rotation.x = -Math.PI / 2;
  mainFloor.receiveShadow = true;
  scene.add(mainFloor);
  disposables.push(mainFloorGeo);

  // Subtle perimeter frame border
  const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(40, 0.1, 30));
  const borderMat = new THREE.LineBasicMaterial({ color: 0x0e7490, transparent: true, opacity: 0.45 });
  const borderLine = new THREE.LineSegments(borderGeo, borderMat);
  borderLine.position.y = 0.05;
  scene.add(borderLine);
  disposables.push(borderGeo, borderMat);

  // Build each of the 9 distinct rooms
  for (const room of rooms) {
    const accentHex = new THREE.Color(room.accentColor).getHex();
    const roomGroup = new THREE.Group();
    roomGroup.position.set(room.center.x, 0, room.center.z);

    // Raised room platform pad (Y=0.025 avoids Z-fighting with mainFloor at Y=0)
    const padGeo = new THREE.BoxGeometry(room.size.w, 0.05, room.size.d);
    const pad = new THREE.Mesh(padGeo, mats.roomPadMat);
    pad.position.y = 0.025;
    pad.receiveShadow = true;
    roomGroup.add(pad);
    disposables.push(padGeo);

    // Glowing floor perimeter strip
    const stripGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(room.size.w + 0.02, 0.06, room.size.d + 0.02));
    const stripMat = new THREE.LineBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.72,
    });
    const strip = new THREE.LineSegments(stripGeo, stripMat);
    strip.position.y = 0.03;
    roomGroup.add(strip);
    disposables.push(stripGeo, stripMat);

    // Invisible click target on layer 1 for smooth camera jump when clicking room floor
    const hitGeo = new THREE.PlaneGeometry(room.size.w, room.size.d);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.rotation.x = -Math.PI / 2;
    hitMesh.position.y = 0.06;
    hitMesh.layers.set(1);
    hitMesh.userData = { kind: 'room', roomId: room.id };
    roomGroup.add(hitMesh);
    roomClickTargets.push(hitMesh);
    disposables.push(hitGeo, hitMat);

    // Modern low glass partition walls with open doorway cutouts + corner metallic pillars
    const wallH = 2.6;
    const halfW = room.size.w / 2;
    const halfD = room.size.d / 2;

    const pillarGeo = new THREE.BoxGeometry(0.18, wallH + 0.15, 0.18);
    disposables.push(pillarGeo);
    const corners: Array<[number, number]> = [
      [-halfW, -halfD],
      [halfW, -halfD],
      [-halfW, halfD],
      [halfW, halfD],
    ];
    for (const [cx, cz] of corners) {
      const pillar = new THREE.Mesh(pillarGeo, mats.pillarMat);
      pillar.position.set(cx, (wallH + 0.15) / 2, cz);
      pillar.castShadow = true;
      roomGroup.add(pillar);
    }

    // Back wall glass + side partial glass partitions (leave generous entry openings)
    const backWallGeo = new THREE.PlaneGeometry(room.size.w - 0.2, wallH);
    const backWall = new THREE.Mesh(backWallGeo, mats.glassWallMat);
    backWall.position.set(0, wallH / 2 + 0.05, -halfD);
    backWall.renderOrder = 2;
    roomGroup.add(backWall);
    disposables.push(backWallGeo);

    const sideWallGeo = new THREE.PlaneGeometry(room.size.d * 0.55, wallH);
    const sideWallL = new THREE.Mesh(sideWallGeo, mats.glassWallMat);
    sideWallL.rotation.y = Math.PI / 2;
    sideWallL.position.set(-halfW, wallH / 2 + 0.05, -halfD * 0.42);
    sideWallL.renderOrder = 2;
    roomGroup.add(sideWallL);

    const sideWallR = new THREE.Mesh(sideWallGeo, mats.glassWallMat);
    sideWallR.rotation.y = Math.PI / 2;
    sideWallR.position.set(halfW, wallH / 2 + 0.05, -halfD * 0.42);
    sideWallR.renderOrder = 2;
    roomGroup.add(sideWallR);
    disposables.push(sideWallGeo);

    // Architectural overhead header bar with room nameplate
    const lintelGeo = new THREE.BoxGeometry(room.size.w, 0.14, 0.14);
    const lintel = new THREE.Mesh(lintelGeo, mats.pillarMat);
    lintel.position.set(0, wallH + 0.1, -halfD);
    roomGroup.add(lintel);
    disposables.push(lintelGeo);

    const labelTex = createRoomLabelTexture(room.code, room.shortName, room.accentColor, maxAnisotropy);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
    const labelGeo = new THREE.PlaneGeometry(3.2, 0.78);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.set(0, wallH + 0.52, -halfD + 0.08);
    roomGroup.add(labelMesh);
    disposables.push(labelTex, labelMat, labelGeo);

    // Wall-mounted large market / telemetry display screen
    const screenTex = createScreenTexture(
      room.name.toUpperCase(),
      `${room.code} · ${room.wing.toUpperCase()}`,
      room.accentColor,
      getRoomScreenLines(room),
      maxAnisotropy,
    );
    const screenFrameGeo = new THREE.BoxGeometry(4.0, 1.85, 0.1);
    const screenFrame = new THREE.Mesh(screenFrameGeo, mats.serverChassisMat);
    screenFrame.position.set(0, 1.75, -halfD + 0.12);
    roomGroup.add(screenFrame);

    const screenPlaneGeo = new THREE.PlaneGeometry(3.84, 1.7);
    const screenPlaneMat = new THREE.MeshStandardMaterial({
      map: screenTex,
      emissiveMap: screenTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.65,
      roughness: 0.15,
    });
    const screenPlane = new THREE.Mesh(screenPlaneGeo, screenPlaneMat);
    screenPlane.position.set(0, 1.75, -halfD + 0.18);
    roomGroup.add(screenPlane);
    disposables.push(screenTex, screenFrameGeo, screenPlaneGeo, screenPlaneMat);

    // Room-specific furniture & hardware props
    if (room.id === 'AI_WAR_ROOM') {
      // Round conference table + glowing center ring
      const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.09, 32), mats.deskTopMat);
      tableTop.position.set(0, 0.76, 0.3);
      tableTop.castShadow = true;
      tableTop.receiveShadow = true;
      roomGroup.add(tableTop);

      const tablePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 0.74, 24), mats.deskFrameMat);
      tablePedestal.position.set(0, 0.37, 0.3);
      roomGroup.add(tablePedestal);

      const ringMat = new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 1.5,
      });
      const tableRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 12, 48), ringMat);
      tableRing.rotation.x = Math.PI / 2;
      tableRing.position.set(0, 0.82, 0.3);
      roomGroup.add(tableRing);
      disposables.push(ringMat);
    } else if (room.id === 'QUANT_LAB') {
      // Workstation + Twin Server Rack Towers
      const desk = createWorkstationGroup(mats, accentHex, screenTex, 2.1);
      desk.position.set(0.2, 0, -0.4);
      roomGroup.add(desk);
      const chair = createChairGroup(mats, accentHex);
      chair.position.set(0.2, 0, 0.35);
      roomGroup.add(chair);

      for (const rx of [-2.8, -1.9]) {
        const rack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.8), mats.serverChassisMat);
        rack.position.set(rx, 1.12, -1.6);
        rack.castShadow = true;
        roomGroup.add(rack);
        const ledMat = new THREE.MeshStandardMaterial({
          color: accentHex,
          emissive: accentHex,
          emissiveIntensity: 1.4,
        });
        const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.04), ledMat);
        ledStrip.position.set(rx + 0.25, 1.12, -1.18);
        roomGroup.add(ledStrip);
        disposables.push(ledMat);
      }
    } else if (room.id === 'TRADING_FLOOR') {
      // Multi-station trading floor desks
      const deskLeft = createWorkstationGroup(mats, accentHex, screenTex, 2.0);
      deskLeft.position.set(-3.1, 0, -0.5);
      deskLeft.rotation.y = Math.PI / 2;
      roomGroup.add(deskLeft);

      const deskRight = createWorkstationGroup(mats, accentHex, screenTex, 2.0);
      deskRight.position.set(3.1, 0, -0.5);
      deskRight.rotation.y = -Math.PI / 2;
      roomGroup.add(deskRight);

      const deskFront = createWorkstationGroup(mats, accentHex, screenTex, 2.3);
      deskFront.position.set(0, 0, 1.8);
      deskFront.rotation.y = Math.PI;
      roomGroup.add(deskFront);
    } else {
      // Standard specialized workstation + chair
      const desk = createWorkstationGroup(mats, accentHex, screenTex, 2.2);
      desk.position.set(0, 0, -0.4);
      roomGroup.add(desk);

      const chair = createChairGroup(mats, accentHex);
      chair.position.set(0, 0, 0.45);
      roomGroup.add(chair);
    }

    // Subtle local accent point light (only on GPU or minimal count; skip excessive lights on Software GL)
    if (!isSoftwareGl && (room.id === 'TRADING_FLOOR' || room.id === 'AI_WAR_ROOM' || room.id === 'RISK_OFFICE')) {
      const roomLight = new THREE.PointLight(accentHex, 2.2, 11, 1.8);
      roomLight.position.set(0, 3.2, 0);
      roomGroup.add(roomLight);
    }

    scene.add(roomGroup);
  }

  // Central holographic market-state core on the Trading Floor
  const holoGeo = new THREE.OctahedronGeometry(0.55, 0);
  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0891b2,
    emissiveIntensity: 1.2,
    roughness: 0.15,
    metalness: 0.85,
    wireframe: true,
  });
  const hologramMesh = new THREE.Mesh(holoGeo, holoMat);
  hologramMesh.position.set(0, 1.45, -0.4);
  scene.add(hologramMesh);
  disposables.push(holoGeo, holoMat);

  return { roomClickTargets, hologramMesh, disposables };
}

export function buildEmployeeAvatar(
  employee: EmployeeRecord,
  mats: OfficeMaterialLibrary,
): { rig: EmployeeRig; disposables: Array<{ dispose: () => void }> } {
  const disposables: Array<{ dispose: () => void }> = [];
  const accentHex = new THREE.Color(employee.accentColor).getHex();
  const group = new THREE.Group();
  group.position.set(employee.targetSlot.x, 0, employee.targetSlot.z);
  group.rotation.y = employee.targetSlot.facingYaw;

  // Contact shadow disc grounded at y=0.035
  const shadowTex = createContactShadowTexture();
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowGeo = new THREE.PlaneGeometry(1.05, 1.05);
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.055;
  group.add(shadowPlane);
  disposables.push(shadowTex, shadowMat, shadowGeo);

  // Floor status ring
  const ringGeo = new THREE.RingGeometry(0.42, 0.5, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const ringMesh = new THREE.Mesh(ringGeo, ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.06;
  group.add(ringMesh);
  disposables.push(ringGeo, ringMat);

  // Articulated legs (pivoted at hip y = 0.72)
  const legGeo = new THREE.CapsuleGeometry(0.085, 0.44, 4, 10);
  const bootGeo = new THREE.BoxGeometry(0.16, 0.1, 0.24);
  disposables.push(legGeo, bootGeo);

  const legL = new THREE.Group();
  legL.position.set(-0.13, 0.72, 0);
  const legLMesh = new THREE.Mesh(legGeo, mats.avatarSuitMat);
  legLMesh.position.y = -0.32;
  legLMesh.castShadow = true;
  const bootL = new THREE.Mesh(bootGeo, mats.avatarBootMat);
  bootL.position.set(0, -0.66, 0.04);
  legL.add(legLMesh, bootL);
  group.add(legL);

  const legR = new THREE.Group();
  legR.position.set(0.13, 0.72, 0);
  const legRMesh = new THREE.Mesh(legGeo, mats.avatarSuitMat);
  legRMesh.position.y = -0.32;
  legRMesh.castShadow = true;
  const bootR = new THREE.Mesh(bootGeo, mats.avatarBootMat);
  bootR.position.set(0, -0.66, 0.04);
  legR.add(legRMesh, bootR);
  group.add(legR);

  // Tailored torso jacket + shoulder yoke + glowing insignia
  const torsoGeo = new THREE.CylinderGeometry(0.24, 0.19, 0.62, 12);
  const torso = new THREE.Mesh(torsoGeo, mats.avatarSuitMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  const shoulderGeo = new THREE.BoxGeometry(0.58, 0.12, 0.26);
  const shoulder = new THREE.Mesh(shoulderGeo, mats.deskFrameMat);
  shoulder.position.y = 1.32;
  shoulder.castShadow = true;
  group.add(shoulder);

  const visorMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const chestInsigniaGeo = new THREE.BoxGeometry(0.16, 0.05, 0.04);
  const chestInsignia = new THREE.Mesh(chestInsigniaGeo, visorMat);
  chestInsignia.position.set(0, 1.18, 0.21);
  group.add(chestInsignia);
  disposables.push(torsoGeo, shoulderGeo, visorMat, chestInsigniaGeo);

  // Articulated arms (pivoted at shoulder y = 1.3)
  const armGeo = new THREE.CapsuleGeometry(0.065, 0.4, 4, 8);
  disposables.push(armGeo);

  const armL = new THREE.Group();
  armL.position.set(-0.33, 1.3, 0);
  const armLMesh = new THREE.Mesh(armGeo, mats.avatarSuitMat);
  armLMesh.position.y = -0.24;
  armLMesh.castShadow = true;
  armL.add(armLMesh);
  group.add(armL);

  const armR = new THREE.Group();
  armR.position.set(0.33, 1.3, 0);
  const armRMesh = new THREE.Mesh(armGeo, mats.avatarSuitMat);
  armRMesh.position.y = -0.24;
  armRMesh.castShadow = true;
  armR.add(armRMesh);
  group.add(armR);

  // Head + visor band
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.54;
  const neckGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.12, 10);
  const neck = new THREE.Mesh(neckGeo, mats.deskFrameMat);
  neck.position.y = -0.1;
  const headGeo = new THREE.SphereGeometry(0.17, 18, 16);
  const head = new THREE.Mesh(headGeo, mats.avatarSkinMat);
  head.castShadow = true;
  const visorGeo = new THREE.BoxGeometry(0.28, 0.065, 0.12);
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.02, 0.12);
  headGroup.add(neck, head, visor);
  group.add(headGroup);
  disposables.push(neckGeo, headGeo, visorGeo);

  // Floating state indicator diamond above head
  const beaconGeo = new THREE.OctahedronGeometry(0.11, 0);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: STATE_BEACON_COLORS[employee.state],
    emissive: STATE_BEACON_COLORS[employee.state],
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
  beaconMesh.position.y = 1.98;
  group.add(beaconMesh);
  disposables.push(beaconGeo, beaconMat);

  // Raycasting proxy hitbox on layer 1
  const hitGeo = new THREE.CylinderGeometry(0.45, 0.45, 2.1, 10);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(hitGeo, hitMat);
  hitbox.position.y = 1.05;
  hitbox.layers.set(1);
  hitbox.userData = { kind: 'employee', employeeId: employee.id };
  group.add(hitbox);
  disposables.push(hitGeo, hitMat);

  const initialPos = new THREE.Vector3(employee.targetSlot.x, 0, employee.targetSlot.z);

  return {
    rig: {
      id: employee.id,
      group,
      legL,
      legR,
      armL,
      armR,
      headGroup,
      visorMat,
      beaconMat,
      beaconMesh,
      ringMat,
      hitbox,
      currentPos: initialPos.clone(),
      targetPos: initialPos.clone(),
      currentYaw: employee.targetSlot.facingYaw,
      targetYaw: employee.targetSlot.facingYaw,
      state: employee.state,
      phaseOffset: Math.random() * Math.PI * 2,
    },
    disposables,
  };
}

export function getStateBeaconHex(state: EmployeeState): number {
  return STATE_BEACON_COLORS[state] ?? 0x64748b;
}

export function getOverviewCameraPreset(): { pos: THREE.Vector3; target: THREE.Vector3 } {
  return {
    pos: new THREE.Vector3(0, 21, 24),
    target: new THREE.Vector3(0, 0.5, 0),
  };
}

export function getRoomById(rooms: RoomDefinition[], roomId: RoomId | null): RoomDefinition | undefined {
  if (!roomId) return undefined;
  return rooms.find((r) => r.id === roomId);
}
