import * as THREE from 'three';
import { assetUrl } from '../utils/assetUrl.js';

const texLoader = new THREE.TextureLoader();
const textureCache = new Map();

function loadTiled(url, repeat, isColor = false) {
  const resolved = assetUrl(url);
  const key = `${resolved}::${repeat}::${isColor}`;
  if (textureCache.has(key)) return textureCache.get(key);
  const tex = texLoader.load(resolved);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

/**
 * 加载 Poly Haven 真实 1K 摄影级 CC0 PBR 地表与岩壁材质（漫反射 + 法线 + 粗糙度）
 */
export function createRealPBRMaterial(alias, { repeat = 4.5, normalScale = 0.85, roughness = 0.92, color = 0xffffff } = {}) {
  const map = loadTiled(`/textures/pbr/${alias}_diff.jpg`, repeat, true);
  const normalMap = loadTiled(`/textures/pbr/${alias}_nor.jpg`, repeat, false);
  const roughnessMap = loadTiled(`/textures/pbr/${alias}_rough.jpg`, repeat, false);

  return new THREE.MeshStandardMaterial({
    color,
    map,
    normalMap,
    normalScale: new THREE.Vector2(normalScale, normalScale),
    roughnessMap,
    roughness,
    metalness: 0.02,
    envMapIntensity: 0.72,
  });
}

/**
 * 柔和的动物脚底接触阴影贴图
 */
export function getContactShadowTexture() {
  if (textureCache.has('contactShadow')) return textureCache.get('contactShadow');
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(12, 24, 38, 0.42)');
  g.addColorStop(0.55, 'rgba(12, 24, 38, 0.18)');
  g.addColorStop(1, 'rgba(12, 24, 38, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  textureCache.set('contactShadow', tex);
  return tex;
}

/**
 * 星球表面微颗粒法线细节（避免纯平滑塑料反光）
 */
export function getSoftMicroBumpTexture() {
  if (textureCache.has('microBump')) return textureCache.get('microBump');
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  let s = 42;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = 115 + (s % 28);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  textureCache.set('microBump', tex);
  return tex;
}
