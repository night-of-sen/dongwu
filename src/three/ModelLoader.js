import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetUrl } from '../utils/assetUrl.js';

const loader = new GLTFLoader();
const cache = new Map();
let reptileBumpTex = null;

/**
 * 细腻写实爬行动物/大象皮肤微鳞凹凸贴图（仅用于无自带贴图的恐龙模型，增强近景质感）
 */
function getReptileSkinBump() {
  if (reptileBumpTex) return reptileBumpTex;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 8) {
    for (let x = 0; x < size; x += 8) {
      const ox = (y / 8) % 2 === 0 ? 0 : 4;
      const shade = 110 + ((x * 13 + y * 29) % 45);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.beginPath();
      ctx.arc((x + ox) % size, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  reptileBumpTex = new THREE.CanvasTexture(canvas);
  reptileBumpTex.wrapS = THREE.RepeatWrapping;
  reptileBumpTex.wrapT = THREE.RepeatWrapping;
  reptileBumpTex.repeat.set(8, 8);
  return reptileBumpTex;
}

/**
 * 写实材质增强：完整保留高精 PBR 贴图与锐利细节，移除发白发糊的 sheen 雾感
 */
function polishRealisticMaterials(root, { isReptile = false, tintHex = null } = {}) {
  const skinBump = isReptile ? getReptileSkinBump() : null;

  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((m) => {
      if (!m) return;
      // 保留所有原始高清贴图，开启各向异性过滤避免斜视角发糊
      if (m.map) {
        m.map.anisotropy = 8;
        m.map.needsUpdate = true;
      }
      if (m.normalMap) {
        m.normalMap.anisotropy = 8;
      }
      if (m.roughnessMap) {
        m.roughnessMap.anisotropy = 4;
      }
      if (m.roughness !== undefined && !m.roughnessMap) {
        m.roughness = Math.max(0.45, Math.min(0.82, m.roughness));
      }
      if (m.metalness !== undefined && !m.metalnessMap) {
        m.metalness = Math.min(0.1, m.metalness);
      }
      if (m.envMapIntensity !== undefined) {
        m.envMapIntensity = 0.78;
      }
      // 仅对无贴图的恐龙模型叠加细腻皮肤凹凸与自然写实色温
      if (isReptile && !m.map && !m.normalMap && m.isMeshStandardMaterial) {
        m.bumpMap = skinBump;
        m.bumpScale = 0.025;
        m.roughness = 0.72;
        if (tintHex !== null && m.color) {
          m.color.lerp(new THREE.Color(tintHex), 0.45);
        }
      }
      // 避免全透明材质出现深度排序异常
      if (m.alphaTest === 0 && m.map && m.transparent) {
        m.alphaTest = 0.35;
      }
    });
  });
}

/**
 * 逐顶点精确计算 SkinnedMesh 在真实骨骼姿态下的世界包围盒
 * 彻底根治 Box3.setFromObject 误算导致动物悬空或半截埋地的问题！
 */
function computeTrueSkinnedBox(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  let hasAny = false;

  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
    const pos = obj.geometry.attributes.position;
    if (obj.isSkinnedMesh && obj.skeleton) {
      obj.skeleton.update();
      // 对超高面数模型适度抽样加速，保证精度同时耗时 < 2ms
      const step = pos.count > 12000 ? 4 : 1;
      for (let i = 0; i < pos.count; i += step) {
        obj.getVertexPosition(i, v);
        v.applyMatrix4(obj.matrixWorld);
        box.expandByPoint(v);
        hasAny = true;
      }
    } else {
      const step = pos.count > 12000 ? 4 : 1;
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
        box.expandByPoint(v);
        hasAny = true;
      }
    }
  });

  if (!hasAny) {
    box.setFromObject(root);
  }
  return box;
}

export function loadGLTF(url) {
  const resolved = assetUrl(url);
  if (!cache.has(resolved)) {
    cache.set(
      resolved,
      new Promise((resolve, reject) => {
        loader.load(resolved, resolve, undefined, reject);
      })
    );
  }
  return cache.get(resolved);
}

export function findAnimationClip(clips, preferredNames = []) {
  if (!clips || clips.length === 0) return null;
  for (const name of preferredNames) {
    if (!name) continue;
    const lower = name.toLowerCase();
    const exact = clips.find((c) => {
      const cn = c.name.toLowerCase();
      return cn === lower || cn.endsWith(`|${lower}`) || cn.endsWith(`_${lower}`);
    });
    if (exact) return exact;
  }
  for (const name of preferredNames) {
    if (!name) continue;
    const lower = name.toLowerCase();
    const partial = clips.find((c) => c.name.toLowerCase().includes(lower));
    if (partial) return partial;
  }
  return clips[0];
}

/**
 * 加载静态写实环境 GLB / Poly Haven glTF（精准贴地 y = 0，保留完整高清 PBR 贴图）
 */
export async function instantiatePropGLB(
  url,
  { targetHeight = 2.2, rotationY = 0, sinkOffset = 0.02, tintHex = null, maxSpan = 2.6 } = {}
) {
  const gltf = await loadGLTF(url);
  const clone = gltf.scene.clone(true);
  polishRealisticMaterials(clone);
  if (tintHex !== null) {
    const tint = new THREE.Color(tintHex);
    clone.traverse((c) => {
      if (!c.isMesh || !c.material) return;
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      const clonedMats = mats.map((m) => {
        const cm = m.clone();
        if (cm.color) cm.color.lerp(tint, 0.52);
        return cm;
      });
      c.material = Array.isArray(c.material) ? clonedMats : clonedMats[0];
    });
  }

  const rawBox = computeTrueSkinnedBox(clone);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  let scale = targetHeight / Math.max(rawSize.y, 0.001);
  const horizSpan = Math.max(rawSize.x, rawSize.z, 0.001);
  if (maxSpan && horizSpan * scale > maxSpan) {
    scale = maxSpan / horizSpan;
  }

  clone.scale.setScalar(scale);
  const scaledBox = computeTrueSkinnedBox(clone);
  const center = new THREE.Vector3();
  const finalSize = new THREE.Vector3();
  scaledBox.getCenter(center);
  scaledBox.getSize(finalSize);

  const wrapper = new THREE.Group();
  clone.position.set(-center.x, -scaledBox.min.y - sinkOffset, -center.z);
  wrapper.add(clone);
  wrapper.rotation.y = rotationY;

  return {
    group: wrapper,
    size: finalSize,
    radius: Math.max(finalSize.x, finalSize.z) * 0.44,
  };
}

/**
 * 为写实无骨骼鱼类注入 GPU 顶点摆尾游动着色器（头部稳定、躯干与尾鳍流畅正弦波摆动）
 */
function attachFishSwimShader(root) {
  const uniforms = {
    uSwimPhase: { value: 0 },
    uSwimAmp: { value: 1.0 },
  };

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    child.geometry.computeBoundingBox();
    const bb = child.geometry.boundingBox;
    if (!bb) return;
    const minX = bb.min.x;
    const maxX = bb.max.x;
    const spanX = Math.max(maxX - minX, 0.001);
    const maxSwing = spanX * 0.085;

    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const clonedMats = mats.map((mat) => {
      const m = mat.clone();
      m.onBeforeCompile = (shader) => {
        shader.uniforms.uSwimPhase = uniforms.uSwimPhase;
        shader.uniforms.uSwimAmp = uniforms.uSwimAmp;
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
            uniform float uSwimPhase;
            uniform float uSwimAmp;`
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            float fishT = clamp((${maxX.toFixed(4)} - transformed.x) / ${spanX.toFixed(4)}, 0.0, 1.0);
            float bend = sin(uSwimPhase - fishT * 4.4) * (fishT * fishT) * ${maxSwing.toFixed(4)} * uSwimAmp;
            transformed.z += bend;`
          );
      };
      m.customProgramCacheKey = () => `fish-swim-${minX.toFixed(1)}-${maxX.toFixed(1)}`;
      return m;
    });
    child.material = Array.isArray(child.material) ? clonedMats : clonedMats[0];
  });

  return uniforms;
}

/**
 * 加载写实动物 GLB，精准测量真实骨骼顶点最低点使脚掌严丝合缝贴合 y = 0
 */
export async function instantiateAnimalGLB(
  url,
  {
    targetSize = 1.75,
    yawOffset = 0,
    idleClipNames = ['Idle', 'Survey', 'Animation', 'Swim'],
    isReptile = false,
    tintHex = null,
    swimBend = false,
  } = {}
) {
  const gltf = await loadGLTF(url);
  const clonedScene = SkeletonUtils.clone(gltf.scene);
  polishRealisticMaterials(clonedScene, { isReptile, tintHex });
  clonedScene.traverse((c) => {
    if (c.isMesh) c.frustumCulled = false;
  });

  const swimUniforms = swimBend ? attachFishSwimShader(clonedScene) : null;

  const mixer = new THREE.AnimationMixer(clonedScene);
  const clips = gltf.animations || [];

  const idleClip = findAnimationClip(clips, idleClipNames);
  if (idleClip) {
    const tmpAction = mixer.clipAction(idleClip);
    tmpAction.play();
    mixer.update(0.1);
  }

  const rawBox = computeTrueSkinnedBox(clonedScene);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  const maxDim = Math.max(rawSize.x, rawSize.y, rawSize.z, 0.001);
  const scale = targetSize / maxDim;

  clonedScene.scale.setScalar(scale);
  const scaledBox = computeTrueSkinnedBox(clonedScene);
  const center = new THREE.Vector3();
  const finalSize = new THREE.Vector3();
  scaledBox.getCenter(center);
  scaledBox.getSize(finalSize);

  // 水平居中 + 脚掌精准贴地 y = 0 + 朝向统一至 +Z
  const inner = new THREE.Group();
  clonedScene.position.set(-center.x, -scaledBox.min.y, -center.z);
  inner.add(clonedScene);
  inner.rotation.y = yawOffset;

  const root = new THREE.Group();
  root.add(inner);

  return {
    root,
    mixer,
    clips,
    swimUniforms,
    size: finalSize,
    height: finalSize.y,
    bodyRadius: Math.max(0.45, Math.max(finalSize.x, finalSize.z) * 0.42),
  };
}
