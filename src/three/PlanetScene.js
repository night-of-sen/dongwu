import * as THREE from 'three';
import { BIOMES } from '../data/biomes.js';
import { instantiatePropGLB } from './ModelLoader.js';
import { getSoftMicroBumpTexture } from './ProceduralTextures.js';

const UP = new THREE.Vector3(0, 1, 0);

// 轻量确定性 3D 连续噪声，用于雕刻真实起伏的有机海岸线、丘陵与雪山
function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise3D(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const n000 = hash3(ix, iy, iz);
  const n100 = hash3(ix + 1, iy, iz);
  const n010 = hash3(ix, iy + 1, iz);
  const n110 = hash3(ix + 1, iy + 1, iz);
  const n001 = hash3(ix, iy, iz + 1);
  const n101 = hash3(ix + 1, iy, iz + 1);
  const n011 = hash3(ix, iy + 1, iz + 1);
  const n111 = hash3(ix + 1, iy + 1, iz + 1);

  const nx00 = n000 + (n100 - n000) * ux;
  const nx10 = n010 + (n110 - n010) * ux;
  const nx01 = n001 + (n101 - n001) * ux;
  const nx11 = n011 + (n111 - n011) * ux;

  const nxy0 = nx00 + (nx10 - nx00) * uy;
  const nxy1 = nx01 + (nx11 - nx01) * uy;

  return nxy0 + (nxy1 - nxy0) * uz;
}

function fbm3D(x, y, z) {
  let v = 0;
  let amp = 0.52;
  let freq = 1.0;
  for (let i = 0; i < 4; i++) {
    v += noise3D(x * freq, y * freq, z * freq) * amp;
    freq *= 2.08;
    amp *= 0.48;
  }
  return v;
}

/**
 * 宏观层：高精有机地形雕刻 3D 微缩动物星球
 * - 20,480 平滑三角面雕刻真实有机海湾、丘陵、雪峰、热带雨林与珊瑚环礁
 * - 独立透明高光动态海洋层（呈现清澈浅海蓝绿渐变与日光反光）
 * - GLSL 菲涅尔大气柔光晕 + 多层立体云团
 * - 平滑化 CC0 3D 树木/岩石精准贴合真实起伏地形高度
 */
export class PlanetScene {
  constructor() {
    this.root = new THREE.Group();
    this.planetGroup = new THREE.Group();
    this.root.add(this.planetGroup);

    this.baseRadius = 2.98;
    this.seaLevel = 3.035;
    this.biomeCenters = BIOMES.map((b) => ({
      biome: b,
      normal: new THREE.Vector3(...b.planetDir).normalize(),
    }));

    this.biomeAnchors = new Map();
    this.clickableMeshes = [];

    this.rotY = -0.9;
    this.rotX = 0.22;
    this.velY = 0;
    this.velX = 0;
    this.autoSpin = true;
    this.targetRot = null;

    this.hoveredBiomeId = null;
    this.clouds = [];
    this.stars = null;
    this.time = 0;

    this._buildSculptedTerrainSphere();
    this._buildShimmeringOcean();
    this._buildAtmosphereGlow();
    this._buildBiomeLandmarks();
    this._buildOrbitingClouds();
    this._buildStarfield();
  }

  /**
   * 计算星球任意单位方向上的有机地形高度、所属生态与配色
   */
  _samplePlanetSurface(dir) {
    const nCoast = fbm3D(dir.x * 2.6 + 1.3, dir.y * 2.6 - 0.8, dir.z * 2.6 + 2.1);
    const nDetail = fbm3D(dir.x * 5.8 - 2.4, dir.y * 5.8 + 1.7, dir.z * 5.8 - 1.1);

    let bestBiome = null;
    let bestInfluence = -1;

    for (const entry of this.biomeCenters) {
      const dot = dir.dot(entry.normal);
      // 用有机噪声打破圆形边界，形成自然海湾、半岛与岛链
      const warpedDot = dot + (nCoast - 0.5) * 0.26 + (nDetail - 0.5) * 0.09;
      if (warpedDot > bestInfluence) {
        bestInfluence = warpedDot;
        bestBiome = entry.biome;
      }
    }

    // 6 大陆抬升阈值（dot > 0.75 出现浅海沙滩，> 0.80 抬升为有机陆地丘陵，板块间保留湛蓝海峡）
    const landMask = THREE.MathUtils.smoothstep(bestInfluence, 0.75, 0.9);
    const hillNoise = Math.max(0, nDetail - 0.35);

    let elevation = 0;
    if (landMask > 0.001) {
      const peakFactor =
        bestBiome.id === 'snow' || bestBiome.id === 'highland'
          ? 0.25
          : bestBiome.id === 'coast'
            ? 0.09
            : bestBiome.id === 'desert'
              ? 0.14
              : 0.18;
      elevation = 0.04 + landMask * (0.09 + hillNoise * peakFactor);
    } else {
      // 深海微起伏
      elevation = -0.06 + nCoast * 0.04;
    }

    // 柔和分层的自然配色（深蓝海床 → 翡翠浅海 → 沙滩岸线 → 6 大生态地貌 → 高地/雪峰）
    const col = new THREE.Color();
    const deepSea = new THREE.Color(0x1668a8);
    const shallowTurquoise = new THREE.Color(0x3ad6d9);
    const sand = new THREE.Color(0xf6dfa6);

    if (bestInfluence < 0.71) {
      col.copy(deepSea).lerp(new THREE.Color(0x1f8ac4), nCoast);
    } else if (bestInfluence < 0.78) {
      const t = (bestInfluence - 0.71) / 0.07;
      col.copy(shallowTurquoise).lerp(sand, THREE.MathUtils.smoothstep(t, 0.35, 1.0));
    } else {
      const h = THREE.MathUtils.clamp((bestInfluence - 0.78) / 0.2, 0, 1);
      if (bestBiome.id === 'meadow') {
        const lush = new THREE.Color(0x74c957);
        const warmGold = new THREE.Color(0xc5db63);
        const hill = new THREE.Color(0x56aa49);
        col.copy(sand).lerp(lush, THREE.MathUtils.smoothstep(h, 0, 0.28));
        col.lerp(warmGold, nDetail * 0.42);
        col.lerp(hill, THREE.MathUtils.smoothstep(h, 0.6, 1.0) * 0.45);
      } else if (bestBiome.id === 'snow') {
        const iceBlue = new THREE.Color(0xc5ebff);
        const pureSnow = new THREE.Color(0xf9fdff);
        col.copy(iceBlue).lerp(pureSnow, THREE.MathUtils.smoothstep(h, 0.05, 0.55));
      } else if (bestBiome.id === 'dino') {
        const jungle = new THREE.Color(0x3ab563);
        const deepCanopy = new THREE.Color(0x278b50);
        const mossGlow = new THREE.Color(0x7ad45e);
        col.copy(sand).lerp(jungle, THREE.MathUtils.smoothstep(h, 0, 0.25));
        col.lerp(deepCanopy, THREE.MathUtils.smoothstep(h, 0.45, 1.0) * 0.65);
        col.lerp(mossGlow, nDetail * 0.28);
      } else if (bestBiome.id === 'desert') {
        // 金色沙丘：暖金细沙 + 赭红风蚀砂岩 + 绿洲碧绿点缀
        const saharaGold = new THREE.Color(0xf0bd65);
        const terracotta = new THREE.Color(0xd98548);
        const oasisGreen = new THREE.Color(0x63b868);
        col.copy(sand).lerp(saharaGold, THREE.MathUtils.smoothstep(h, 0, 0.3));
        col.lerp(terracotta, THREE.MathUtils.smoothstep(h, 0.45, 1.0) * 0.55);
        if (nDetail < 0.36 && h > 0.45) col.lerp(oasisGreen, 0.52);
      } else if (bestBiome.id === 'highland') {
        // 高山林海：金秋枫叶琥珀 + 针叶翠绿 + 灰褐岩峰
        const alpineGreen = new THREE.Color(0x6b9e4f);
        const autumnAmber = new THREE.Color(0xd98c3f);
        const granite = new THREE.Color(0x9a8f82);
        col.copy(sand).lerp(alpineGreen, THREE.MathUtils.smoothstep(h, 0, 0.28));
        col.lerp(autumnAmber, nDetail * 0.65);
        col.lerp(granite, THREE.MathUtils.smoothstep(h, 0.68, 1.0) * 0.55);
      } else {
        // 珊瑚海湾：清澈浅礁 + 暖金环礁沙滩 + 珊瑚粉点缀
        const coralPink = new THREE.Color(0xff9eb1);
        const palmGreen = new THREE.Color(0x69c766);
        col.copy(shallowTurquoise).lerp(sand, THREE.MathUtils.smoothstep(h, 0, 0.32));
        if (h > 0.48) col.lerp(palmGreen, THREE.MathUtils.smoothstep(h, 0.48, 0.85) * 0.6);
        if (nDetail > 0.66 && h < 0.45) col.lerp(coralPink, 0.45);
      }
    }

    return {
      radius: this.baseRadius + elevation,
      landMask,
      biome: bestBiome,
      color: col,
    };
  }

  _buildSculptedTerrainSphere() {
    // 细分度 5（20,480 面），地形曲面极致顺滑无棱角
    const geo = new THREE.IcosahedronGeometry(1, 5);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const dir = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      dir.fromBufferAttribute(pos, i).normalize();
      const s = this._samplePlanetSurface(dir);
      pos.setXYZ(i, dir.x * s.radius, dir.y * s.radius, dir.z * s.radius);
      colors[i * 3] = s.color.r;
      colors[i * 3 + 1] = s.color.g;
      colors[i * 3 + 2] = s.color.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.03,
      bumpMap: getSoftMicroBumpTexture(),
      bumpScale: 0.018,
      envMapIntensity: 0.72,
    });

    this.terrainMesh = new THREE.Mesh(geo, terrainMat);
    this.terrainMesh.castShadow = true;
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.userData.isPlanetTerrain = true;
    this.planetGroup.add(this.terrainMesh);
    this.clickableMeshes.push(this.terrainMesh);
  }

  _buildShimmeringOcean() {
    const oceanGeo = new THREE.SphereGeometry(this.seaLevel, 64, 48);
    this.oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x26b6e6,
      roughness: 0.16,
      metalness: 0.06,
      clearcoat: 0.9,
      clearcoatRoughness: 0.14,
      transparent: true,
      opacity: 0.76,
      envMapIntensity: 1.1,
    });
    this.oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMat);
    this.oceanMesh.receiveShadow = true;
    this.oceanMesh.userData.isPlanetTerrain = true;
    this.planetGroup.add(this.oceanMesh);
  }

  _buildAtmosphereGlow() {
    const atmoGeo = new THREE.SphereGeometry(this.seaLevel * 1.11, 48, 36);
    this.atmoUniforms = {
      glowColor: { value: new THREE.Color(0x7be0ff) },
      intensity: { value: 0.75 },
    };
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: this.atmoUniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = pow(clamp(0.72 - dot(vNormal, vViewDir), 0.0, 1.0), 2.6);
          gl_FragColor = vec4(glowColor, rim * intensity);
        }
      `,
    });
    this.atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.planetGroup.add(this.atmoMesh);
  }

  _buildBiomeLandmarks() {
    this.biomeCenters.forEach(({ biome, normal }) => {
      const anchor = new THREE.Group();
      anchor.quaternion.setFromUnitVectors(UP, normal);

      // 柔软发光脉冲定位环（指示生态入口，悬停时亮起）
      const centerSample = this._samplePlanetSurface(normal);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.56, 36),
        new THREE.MeshBasicMaterial({
          color: biome.accentColor,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = centerSample.radius + 0.06;
      anchor.add(ring);

      const propsGroup = new THREE.Group();
      anchor.add(propsGroup);
      this._loadMiniatureGLBProps(propsGroup, biome, normal);

      // 隐形点击热区
      const hitArea = new THREE.Mesh(
        new THREE.SphereGeometry(1.38, 12, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitArea.position.set(0, centerSample.radius + 0.15, 0);
      hitArea.userData.biomeId = biome.id;
      anchor.add(hitArea);
      this.clickableMeshes.push(hitArea);

      this.planetGroup.add(anchor);
      this.biomeAnchors.set(biome.id, {
        biome,
        group: anchor,
        propsGroup,
        ring,
        normal,
        lift: 1,
      });
    });
  }

  async _loadMiniatureGLBProps(propsGroup, biome, biomeNormal) {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, biomeNormal);

    for (const p of biome.planetProps || []) {
      try {
        const inst = await instantiatePropGLB(p.url, {
          targetHeight: p.height * 0.92,
          rotationY: p.rot || 0,
          sinkOffset: 0.04,
        });
        // 将局部坐标转到世界球面方向，查询真实雕刻后的地形高度，精准落座零悬空！
        const localDir = new THREE.Vector3(p.x, this.seaLevel, p.z).normalize();
        const worldDir = localDir.clone().applyQuaternion(q).normalize();
        const surf = this._samplePlanetSurface(worldDir);
        const r = Math.max(this.seaLevel + 0.02, surf.radius - 0.02);

        const holder = new THREE.Group();
        holder.position.copy(localDir).multiplyScalar(r);
        holder.quaternion.setFromUnitVectors(UP, localDir);
        holder.add(inst.group);

        holder.traverse((c) => {
          if (c.isMesh) {
            c.userData.biomeId = biome.id;
            this.clickableMeshes.push(c);
          }
        });
        propsGroup.add(holder);
      } catch (err) {
        console.warn('星球微缩地标加载失败:', p.url, err);
      }
    }
  }

  /**
   * 当点击到有机星球表面任意位置时，找出对应的生态地块
   */
  resolveBiomeFromHit(hit) {
    if (hit?.object?.userData?.biomeId) {
      return hit.object.userData.biomeId;
    }
    if (hit?.point) {
      const localPt = this.planetGroup.worldToLocal(hit.point.clone()).normalize();
      let bestId = null;
      let bestDot = 0.55;
      for (const entry of this.biomeCenters) {
        const d = localPt.dot(entry.normal);
        if (d > bestDot) {
          bestDot = d;
          bestId = entry.biome.id;
        }
      }
      return bestId;
    }
    return null;
  }

  _buildOrbitingClouds() {
    const cloudMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.92,
      sheen: 0.4,
      transparent: true,
      opacity: 0.86,
    });
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Group();
      const s = 0.2 + (i % 3) * 0.055;
      const puffs = [
        [0, 0, 0, s],
        [s * 0.95, -s * 0.1, 0.04, s * 0.78],
        [-s * 0.9, -s * 0.12, 0.03, s * 0.72],
        [s * 0.35, s * 0.36, -0.04, s * 0.64],
      ];
      puffs.forEach(([x, y, z, r]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), cloudMat);
        m.scale.set(1.25, 0.78, 0.95);
        m.position.set(x, y, z);
        cloud.add(m);
      });

      const orbitRadius = 4.25 + (i % 3) * 0.38;
      const angle = (i / 8) * Math.PI * 2;
      const elevation = ((i % 3) - 1) * 1.12;
      cloud.userData = { orbitRadius, angle, elevation, speed: 0.068 + (i % 3) * 0.024 };
      this.root.add(cloud);
      this.clouds.push(cloud);
    }
  }

  _buildStarfield() {
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 16 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfff8d6,
      size: 0.22,
      transparent: true,
      opacity: 0.1,
    });
    this.stars = new THREE.Points(geo, mat);
    this.root.add(this.stars);
  }

  setNightMode(isNight) {
    if (this.stars) this.stars.material.opacity = isNight ? 0.94 : 0.08;
    if (this.atmoUniforms) {
      this.atmoUniforms.glowColor.value.setHex(isNight ? 0x57d8ff : 0x8be4ff);
      this.atmoUniforms.intensity.value = isNight ? 1.05 : 0.72;
    }
    if (this.oceanMat) {
      this.oceanMat.color.setHex(isNight ? 0x165e94 : 0x26b6e6);
    }
  }

  applyDrag(dx, dy) {
    this.targetRot = null;
    this.autoSpin = false;
    this.velY = dx * 0.0075;
    this.velX = dy * 0.0065;
    this.rotY += this.velY;
    this.rotX = THREE.MathUtils.clamp(this.rotX + this.velX, -1.15, 1.15);
  }

  focusBiome(biomeId) {
    const entry = this.biomeAnchors.get(biomeId);
    if (!entry) return;
    const n = entry.normal;
    const targetY = -Math.atan2(n.x, n.z);
    const targetX = Math.asin(THREE.MathUtils.clamp(n.y, -0.95, 0.95));
    this.targetRot = { x: targetX, y: targetY };
    this.velX = 0;
    this.velY = 0;
  }

  setHoveredBiome(biomeId) {
    this.hoveredBiomeId = biomeId;
  }

  getProjectedLabels(camera, width, height) {
    const results = [];
    const worldPos = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const planetQuat = new THREE.Quaternion();
    this.planetGroup.getWorldQuaternion(planetQuat);

    this.biomeAnchors.forEach(({ biome, normal }) => {
      worldNormal.copy(normal).applyQuaternion(planetQuat).normalize();
      worldPos.copy(worldNormal).multiplyScalar(this.seaLevel + 1.12);
      camDir.copy(camera.position).sub(worldPos).normalize();
      const facing = worldNormal.dot(camDir);

      const projected = worldPos.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;

      results.push({
        id: biome.id,
        biome,
        x,
        y,
        visible: facing > 0.14 && projected.z < 1,
        facing,
      });
    });

    return results;
  }

  update(dt) {
    this.time += dt;

    if (this.targetRot) {
      let dy = this.targetRot.y - this.rotY;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.rotY += dy * Math.min(1, dt * 6.5);
      this.rotX += (this.targetRot.x - this.rotX) * Math.min(1, dt * 6.5);
    } else {
      this.rotY += this.velY;
      this.rotX = THREE.MathUtils.clamp(this.rotX + this.velX, -1.15, 1.15);
      this.velY *= Math.pow(0.08, dt);
      this.velX *= Math.pow(0.08, dt);
      if (this.autoSpin || Math.abs(this.velY) < 0.0004) {
        this.rotY += dt * 0.11;
      }
    }

    this.planetGroup.rotation.order = 'XYZ';
    this.planetGroup.rotation.x = this.rotX;
    this.planetGroup.rotation.y = this.rotY;

    // 悬停脉冲光环 + 微缩树轻柔放大反馈
    this.biomeAnchors.forEach((entry, id) => {
      const hovered = id === this.hoveredBiomeId;
      const targetLift = hovered ? 1.08 : 1.0;
      entry.lift += (targetLift - entry.lift) * Math.min(1, dt * 10);
      entry.propsGroup.scale.setScalar(entry.lift);
      const targetOp = hovered ? 0.72 : 0.0;
      entry.ring.material.opacity += (targetOp - entry.ring.material.opacity) * Math.min(1, dt * 10);
      entry.ring.scale.setScalar(1 + Math.sin(this.time * 4.5) * 0.06);
    });

    // 云层缓漂
    this.clouds.forEach((c) => {
      c.userData.angle += c.userData.speed * dt;
      const a = c.userData.angle;
      const r = c.userData.orbitRadius;
      c.position.set(
        Math.cos(a) * r,
        c.userData.elevation + Math.sin(this.time * 1.1 + a) * 0.14,
        Math.sin(a) * r
      );
      c.lookAt(0, c.position.y, 0);
    });

    if (this.stars) this.stars.rotation.y += dt * 0.015;
  }
}
