import * as THREE from 'three';

export interface OfficeMaterialLibrary {
  floorMat: THREE.MeshStandardMaterial;
  roomPadMat: THREE.MeshStandardMaterial;
  deskTopMat: THREE.MeshStandardMaterial;
  deskFrameMat: THREE.MeshStandardMaterial;
  chairMat: THREE.MeshStandardMaterial;
  glassWallMat: THREE.MeshPhysicalMaterial;
  pillarMat: THREE.MeshStandardMaterial;
  serverChassisMat: THREE.MeshStandardMaterial;
  avatarSuitMat: THREE.MeshStandardMaterial;
  avatarSkinMat: THREE.MeshStandardMaterial;
  avatarBootMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createOfficeMaterials(
  floorTexture: THREE.Texture,
  isSoftwareGl: boolean,
): OfficeMaterialLibrary {
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    map: floorTexture,
    roughness: 0.72,
    metalness: 0.15,
  });

  const roomPadMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.55,
    metalness: 0.28,
  });

  const deskTopMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.22,
    metalness: 0.55,
  });

  const deskFrameMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.85,
  });

  const chairMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.8,
    metalness: 0.1,
  });

  const glassWallMat = new THREE.MeshPhysicalMaterial({
    color: 0x7dd3fc,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: isSoftwareGl ? 0.22 : 0.28,
    transmission: 0,
    ior: 1.5,
    clearcoat: 1.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.28,
    metalness: 0.88,
  });

  const serverChassisMat = new THREE.MeshStandardMaterial({
    color: 0x090e1a,
    roughness: 0.4,
    metalness: 0.82,
  });

  const avatarSuitMat = new THREE.MeshStandardMaterial({
    color: 0x172033,
    roughness: 0.72,
    metalness: 0.12,
  });

  const avatarSkinMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.32,
    metalness: 0.45,
  });

  const avatarBootMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.35,
    metalness: 0.65,
  });

  const allMaterials = [
    floorMat,
    roomPadMat,
    deskTopMat,
    deskFrameMat,
    chairMat,
    glassWallMat,
    pillarMat,
    serverChassisMat,
    avatarSuitMat,
    avatarSkinMat,
    avatarBootMat,
  ];

  return {
    floorMat,
    roomPadMat,
    deskTopMat,
    deskFrameMat,
    chairMat,
    glassWallMat,
    pillarMat,
    serverChassisMat,
    avatarSuitMat,
    avatarSkinMat,
    avatarBootMat,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
