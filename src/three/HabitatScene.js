import * as THREE from 'three';
import { getAnimalsByBiome } from '../data/animals.js';
import { AnimalActor } from './AnimalActor.js';
import { instantiatePropGLB } from './ModelLoader.js';
import { createRealPBRMaterial } from './ProceduralTextures.js';
import {
  createRealisticTree,
  createNaturalPond,
  createPhotographicWaterMaterial,
} from './RealisticNature.js';

function buildOrganicIslandGeometry(topR, bottomR, height, radialSegs = 64) {
  const geo = new THREE.CylinderGeometry(topR, bottomR, height, radialSegs, 8, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.1) {
      const ang = Math.atan2(z, x);
      const t = (y + height * 0.5) / height;
      const wobble = 1 + Math.sin(ang * 5 + 0.4) * 0.028 + Math.cos(ang * 8 - 0.7) * 0.016;
      const skirtScale = t < 0.82 ? wobble * (0.96 + 0.05 * Math.sin(ang * 6 + t * 4)) : wobble;
      pos.setX(i, x * skirtScale);
      pos.setZ(i, z * skirtScale);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * 微观层：真实 Poly Haven 摄影级 PBR 地表/岩壁 + 写实自然树木/扫描灌木岩石 + 有机自然水潭 + 高精动物与防穿模碰撞系统
 */
export class HabitatScene {
  constructor(biome) {
    this.biome = biome;
    this.root = new THREE.Group();
    this.actors = [];
    this.obstacles = [];
    this.vfxItems = [];
    this.swayTrees = [];
    this.naturalPond = null;
    this.waterMat = null;
    this.waterMesh = null;
    this.particles = null;
    this.time = 0;

    this._buildIslandBase();
    this._registerCollidersAndLoadProps();
    this._buildAmbientParticles();
    this._spawnAnimals();
    this.readyPromise = Promise.all(this.actors.map((a) => a.readyPromise));
  }

  _buildIslandBase() {
    const cliffMat = createRealPBRMaterial('cliff', {
      repeat: 3.5,
      normalScale: 1.1,
      roughness: 0.94,
      color: this.biome.cliffTint ?? (this.biome.id === 'snow' ? 0xdbe9f4 : 0xd8cec2),
    });

    const pbrKey = this.biome.pbrAlias || this.biome.id;
    const groundMat = createRealPBRMaterial(pbrKey, {
      repeat: this.biome.id === 'snow' ? 4.0 : 4.8,
      normalScale: this.biome.id === 'snow' ? 0.6 : 0.95,
      roughness: this.biome.id === 'snow' ? 0.82 : 0.94,
      color: this.biome.groundTint ?? (this.biome.id === 'meadow' ? 0xf2fae8 : 0xffffff),
    });

    if (this.biome.isWaterBiome) {
      const seabedGeo = buildOrganicIslandGeometry(7.2, 6.6, 1.0, 64);
      const seabed = new THREE.Mesh(seabedGeo, groundMat);
      seabed.position.y = -1.3;
      seabed.receiveShadow = true;
      this.root.add(seabed);

      const underGeo = buildOrganicIslandGeometry(6.5, 3.4, 2.2, 48);
      const under = new THREE.Mesh(underGeo, cliffMat);
      under.position.y = -2.85;
      this.root.add(under);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(7.1, 0.34, 16, 64), cliffMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -0.32;
      rim.receiveShadow = true;
      this.root.add(rim);

      this.waterMat = createPhotographicWaterMaterial(this.biome.waterColor, {
        opacity: 0.72,
        isPond: false,
      });
      const lagoonGeo = new THREE.CircleGeometry(7.05, 64);
      const radAttr = new Float32Array(lagoonGeo.attributes.position.count);
      const posAttr = lagoonGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        radAttr[i] = Math.hypot(posAttr.getX(i), posAttr.getY(i)) / 7.05;
      }
      lagoonGeo.setAttribute('aRadial', new THREE.BufferAttribute(radAttr, 1));
      this.waterMesh = new THREE.Mesh(lagoonGeo, this.waterMat);
      this.waterMesh.rotation.x = -Math.PI / 2;
      this.waterMesh.position.y = 0.06;
      this.root.add(this.waterMesh);

      const b = this.biome.beachZone;
      const beachGeo = new THREE.SphereGeometry(3.25, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const beach = new THREE.Mesh(beachGeo, groundMat);
      beach.scale.set(1.0, 0.32, 1.0);
      beach.position.set(b.x, -0.78, b.z);
      beach.receiveShadow = true;
      this.root.add(beach);

      this.obstacles.push({ x: b.x, z: b.z, radius: b.radius + 0.35, type: 'beach' });
    } else {
      // 岩壁底座（侧边有机起伏）+ 顶部独立平面法线草地/雪地圆盘（彻底杜绝放射状反光条纹）
      const topGeo = buildOrganicIslandGeometry(7.25, 6.85, 0.95, 64);
      const topMesh = new THREE.Mesh(topGeo, cliffMat);
      topMesh.position.y = -0.49;
      topMesh.receiveShadow = true;
      this.root.add(topMesh);

      const surfaceDisc = new THREE.Mesh(new THREE.CircleGeometry(7.15, 64), groundMat);
      surfaceDisc.rotation.x = -Math.PI / 2;
      surfaceDisc.position.y = 0.0;
      surfaceDisc.receiveShadow = true;
      this.root.add(surfaceDisc);

      const underGeo = buildOrganicIslandGeometry(6.75, 3.4, 2.25, 48);
      const underMesh = new THREE.Mesh(underGeo, cliffMat);
      underMesh.position.y = -2.02;
      this.root.add(underMesh);

      // 有机自然水潭（不规则岸线 + 河岸卵石群 + 荷叶睡莲 / 极地浮冰 + 摇曳芦苇 + 摄影级水波焦散）
      if (this.biome.pond) {
        this.naturalPond = createNaturalPond(this.biome);
        this.waterMat = this.naturalPond.waterMat;
        this.root.add(this.naturalPond.group);
        const { x, z, radius } = this.biome.pond;
        this.obstacles.push({ x, z, radius: radius * 1.12, type: 'pond' });
      }
    }
  }

  _registerCollidersAndLoadProps() {
    let idx = 1;
    for (const prop of this.biome.props || []) {
      idx += 1;
      if (prop.collide && prop.collide > 0) {
        this.obstacles.push({
          x: prop.x,
          z: prop.z,
          radius: prop.collide,
          type: 'prop',
        });
      }

      let baseY = 0;
      if (this.biome.isWaterBiome) {
        baseY = prop.onBeach ? 0.16 : -0.78;
      }

      if (prop.treeType) {
        const tree = createRealisticTree(prop.treeType, {
          height: prop.height || 4.0,
          seed: idx * 31 + (prop.rot || 0) * 100,
        });
        tree.group.position.set(prop.x, baseY, prop.z);
        tree.group.rotation.y = prop.rot || 0;
        this.root.add(tree.group);
        this.swayTrees.push(tree);
        continue;
      }

      instantiatePropGLB(prop.url, {
        targetHeight: prop.height,
        rotationY: prop.rot || 0,
        sinkOffset: prop.sink ?? 0.03,
        tintHex: prop.tintHex ?? null,
      })
        .then((inst) => {
          inst.group.position.set(prop.x, baseY, prop.z);
          this.root.add(inst.group);
        })
        .catch((err) => {
          console.warn('生态道具加载失败:', prop.url, err);
        });
    }
  }

  _buildAmbientParticles() {
    const count = 55;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 13;
      positions[i * 3 + 1] = 0.5 + Math.random() * 5.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 13;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const colorMap = {
      pollen: 0xffe484,
      snow: 0xffffff,
      firefly: 0xd9ff66,
      bubble: 0xc2f5ff,
    };
    const mat = new THREE.PointsMaterial({
      color: colorMap[this.biome.particleType] || 0xffffff,
      size: this.biome.particleType === 'snow' ? 0.16 : 0.12,
      transparent: true,
      opacity: 0.72,
    });
    this.particles = new THREE.Points(geo, mat);
    this.root.add(this.particles);
  }

  _spawnAnimals() {
    const list = getAnimalsByBiome(this.biome.id);
    list.forEach((cfg) => {
      const actor = new AnimalActor(cfg, this.biome);
      this.actors.push(actor);
      this.root.add(actor.group);
    });
  }

  getActorById(id) {
    return this.actors.find((a) => a.config.id === id) || null;
  }

  getClickableMeshes() {
    const arr = [];
    this.actors.forEach((a) => {
      a.group.traverse((c) => {
        if (c.isMesh) arr.push(c);
      });
    });
    return arr;
  }

  setNightMode(isNight) {
    this.actors.forEach((a) => a.setNightMode(isNight));
    if (this.particles && this.biome.particleType === 'firefly') {
      this.particles.material.opacity = isNight ? 1.0 : 0.5;
      this.particles.material.size = isNight ? 0.2 : 0.12;
    }
  }

  spawnVfx(type, worldPos) {
    if (type === 'heart') {
      for (let i = 0; i < 6; i++) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 12, 10),
          new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xff6b8b : 0xffb3c1, transparent: true, opacity: 1 })
        );
        mesh.position.copy(worldPos).add(new THREE.Vector3((Math.random() - 0.5) * 0.9, 0.35, (Math.random() - 0.5) * 0.9));
        this.root.add(mesh);
        this.vfxItems.push({
          mesh,
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.45, 1.15 + Math.random() * 0.55, (Math.random() - 0.5) * 0.45),
          life: 1.2,
          maxLife: 1.2,
        });
      }
    } else if (type === 'food') {
      const snack = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 14, 12),
        new THREE.MeshStandardMaterial({ color: this.biome.foodColor || 0x8be252, roughness: 0.45 })
      );
      snack.position.copy(worldPos).add(new THREE.Vector3(0, 1.35, 0.45));
      this.root.add(snack);
      this.vfxItems.push({
        mesh: snack,
        vel: new THREE.Vector3(0, -1.6, -0.25),
        gravity: 2.8,
        floorY: 0.18,
        life: 1.35,
        maxLife: 1.35,
      });
    } else if (type === 'sparkle') {
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const col = this.biome.id === 'coast' || this.biome.id === 'snow' ? 0x7ae2ff : 0xffd166;
        const star = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 10, 8),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1 })
        );
        star.position.copy(worldPos);
        this.root.add(star);
        this.vfxItems.push({
          mesh: star,
          vel: new THREE.Vector3(Math.cos(ang) * 1.25, 1.45 + Math.random() * 0.75, Math.sin(ang) * 1.25),
          gravity: 2.2,
          life: 1.1,
          maxLife: 1.1,
        });
      }
    }
  }

  getProjectedAnimalBadges(camera, width, height) {
    const out = [];
    const pos = new THREE.Vector3();
    this.actors.forEach((actor) => {
      const emoji = actor.getBadgeEmoji();
      if (!emoji && !actor.hovered) return;
      actor.getHeadWorldPosition(pos);
      pos.project(camera);
      if (pos.z > 1) return;
      out.push({
        id: actor.config.id,
        name: actor.config.name,
        emoji: emoji || actor.config.emoji,
        hovered: actor.hovered,
        x: (pos.x * 0.5 + 0.5) * width,
        y: (-pos.y * 0.5 + 0.5) * height,
      });
    });
    return out;
  }

  update(dt, cameraPos) {
    this.time += dt;

    if (this.naturalPond) {
      this.naturalPond.update(this.time);
    } else if (this.waterMat) {
      this.waterMat.uniforms.uTime.value = this.time;
    }

    for (const tree of this.swayTrees) {
      tree.swayGroup.rotation.z = Math.sin(this.time * 1.15 + tree.swayPhase) * 0.018;
      tree.swayGroup.rotation.x = Math.cos(this.time * 0.9 + tree.swayPhase) * 0.012;
    }

    if (this.particles) {
      const arr = this.particles.geometry.attributes.position.array;
      const type = this.biome.particleType;
      for (let i = 0; i < arr.length; i += 3) {
        if (type === 'snow') {
          arr[i + 1] -= dt * 0.85;
          arr[i] += Math.sin(this.time + i) * dt * 0.25;
          if (arr[i + 1] < 0.2) arr[i + 1] = 6.0;
        } else if (type === 'bubble') {
          arr[i + 1] += dt * 0.55;
          if (arr[i + 1] > 4.5) arr[i + 1] = 0.2;
        } else {
          arr[i + 1] += Math.sin(this.time * 1.5 + i) * dt * 0.18;
          arr[i] += Math.cos(this.time * 0.9 + i) * dt * 0.15;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    this.actors.forEach((a) => a.update(dt, cameraPos, this.obstacles, this.actors));

    for (let i = this.vfxItems.length - 1; i >= 0; i--) {
      const item = this.vfxItems[i];
      item.life -= dt;
      if (item.gravity) item.vel.y -= item.gravity * dt;
      item.mesh.position.addScaledVector(item.vel, dt);
      if (item.floorY !== undefined && item.mesh.position.y < item.floorY) {
        item.mesh.position.y = item.floorY;
        item.vel.set(0, 0, 0);
      }
      if (item.mesh.material.transparent) {
        item.mesh.material.opacity = Math.max(0, item.life / item.maxLife);
      }
      if (item.life <= 0) {
        this.root.remove(item.mesh);
        item.mesh.geometry?.dispose();
        item.mesh.material?.dispose();
        this.vfxItems.splice(i, 1);
      }
    }
  }
}
