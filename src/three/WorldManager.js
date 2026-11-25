import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getBiomeById } from '../data/biomes.js';
import { getAnimalsByBiome } from '../data/animals.js';
import { assetUrl } from '../utils/assetUrl.js';
import { prefetchGLTFs } from './ModelLoader.js';
import { PlanetScene } from './PlanetScene.js';
import { HabitatScene } from './HabitatScene.js';

/**
 * 3D 引擎总控：渲染器、Poly Haven 真实户外 HDRI 光照、昼夜切换、手机/iPad 自适应运镜、双指缩放与射线拾取
 */
export class WorldManager {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.mode = 'planet'; // 'planet' | 'habitat'
    this.isNight = false;
    this.isTransitioning = false;
    this._nightHdriRequested = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 160);
    this.camera.position.set(0, 0.5, 9.6);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    container.appendChild(this.renderer.domElement);

    // 真实户外 HDRI 环境光（首帧先用轻量环境图过渡，400ms 后加载白天 HDRI，夜间 HDRI 按需加载节省 1.7MB 流量）
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();
    this.dayEnvTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.nightEnvTex = this.dayEnvTex;
    this.scene.environment = this.dayEnvTex;
    this.scene.environmentIntensity = 0.72;
    setTimeout(() => this._loadDayHDRI(), 400);

    this._setupSkyAndLights();

    this.planetScene = new PlanetScene();
    this.scene.add(this.planetScene.root);
    this.habitatScene = null;
    this.currentBiome = null;
    this.selectedActor = null;

    this.camPosTarget = new THREE.Vector3(0, 0.5, 9.6);
    this.camLookCurrent = new THREE.Vector3(0, 0, 0);
    this.camLookTarget = new THREE.Vector3(0, 0, 0);

    // 垂直视锥偏移：选中动物弹出底部对话栏时，将 3D 焦点平滑抬升到上半屏空旷区，绝不遮挡动物！
    this.viewOffsetY = 0;
    this.viewOffsetTargetY = 0;

    this.orbitYaw = 0.65;
    this.orbitPitch = 0.48;
    this.orbitDist = 17.5;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.activePointers = new Map();
    this.pinchStartDist = 0;
    this.pinchStartOrbit = 17.5;
    this.isDragging = false;
    this.dragMoved = 0;
    this.lastX = 0;
    this.lastY = 0;

    this.clock = new THREE.Clock();
    this._bindEvents();
    this._onResize(true);
    this._animate();

    // 首屏渲染稳定后，悄悄后台预热首个推荐板块（阳光草甸）的轻量化动物模型，点击进入秒开！
    setTimeout(() => {
      const meadowAnimals = getAnimalsByBiome('meadow').map((a) => a.glbUrl);
      prefetchGLTFs(meadowAnimals);
    }, 1200);
  }

  _loadDayHDRI() {
    const rgbe = new RGBELoader();
    rgbe.load(
      assetUrl('/hdr/day_sky.hdr'),
      (hdr) => {
        this.dayEnvTex = this.pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        if (!this.isNight) this.scene.environment = this.dayEnvTex;
      },
      undefined,
      () => {}
    );
  }

  _ensureNightHDRI() {
    if (this._nightHdriRequested) return;
    this._nightHdriRequested = true;
    const rgbe = new RGBELoader();
    rgbe.load(
      assetUrl('/hdr/night_sky.hdr'),
      (hdr) => {
        this.nightEnvTex = this.pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        if (this.isNight) this.scene.environment = this.nightEnvTex;
      },
      undefined,
      () => {}
    );
  }

  _setupSkyAndLights() {
    const skyGeo = new THREE.SphereGeometry(65, 40, 24);
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x3a9ee8) },
      bottomColor: { value: new THREE.Color(0xffecc2) },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(bottomColor, topColor, smoothstep(0.18, 0.85, h)), 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // 真实自然光照对比度（主阳刚劲有力，暗部通透有层次，绝不灰蒙发糊）
    this.hemiLight = new THREE.HemisphereLight(0xcbe8ff, 0x6b563c, 0.55);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 2.15);
    this.sunLight.position.set(14, 19, 12);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 54;
    const d = 14.5;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x8bc9ff, 0.35);
    this.rimLight.position.set(-12, 9, -12);
    this.scene.add(this.rimLight);
  }

  _applyAtmosphere() {
    const b = this.currentBiome;
    if (this.isNight) {
      this._ensureNightHDRI();
      this.skyUniforms.topColor.value.setHex(b ? b.skyNightTop : 0x0b1836);
      this.skyUniforms.bottomColor.value.setHex(b ? b.skyNightBottom : 0x203860);
      this.scene.environment = this.nightEnvTex;
      this.scene.environmentIntensity = 0.42;
      this.sunLight.color.setHex(0x9ec4ff);
      this.sunLight.intensity = 0.9;
      this.hemiLight.color.setHex(0x5b7fc2);
      this.hemiLight.groundColor.setHex(0x1a2236);
      this.hemiLight.intensity = 0.45;
    } else {
      this.skyUniforms.topColor.value.setHex(b ? b.skyDayTop : 0x3da6ee);
      this.skyUniforms.bottomColor.value.setHex(b ? b.skyDayBottom : 0xffecc7);
      this.scene.environment = this.dayEnvTex;
      this.scene.environmentIntensity = 0.72;
      this.sunLight.color.setHex(0xfff4d6);
      this.sunLight.intensity = 2.15;
      this.hemiLight.color.setHex(0xcbe8ff);
      this.hemiLight.groundColor.setHex(0x6b563c);
      this.hemiLight.intensity = 0.55;
    }
    this.planetScene.setNightMode(this.isNight);
    this.habitatScene?.setNightMode(this.isNight);
  }

  setNightMode(isNight) {
    this.isNight = Boolean(isNight);
    this._applyAtmosphere();
  }

  /**
   * 根据屏幕宽高比（手机竖屏 / iPad 竖横屏 / 桌面）计算星球与大陆的自适应相机位置
   */
  _getPlanetFraming() {
    const aspect = this.camera.aspect || 1;
    if (aspect < 0.72) {
      // 手机竖屏：拉远镜头并将星球微微上移，彻底避免两侧裁切与底部 3x2 板块栏遮挡
      const z = THREE.MathUtils.clamp(8.6 / Math.max(0.45, aspect), 12.8, 16.5);
      return { pos: new THREE.Vector3(0, 0.15, z), look: new THREE.Vector3(0, -0.58, 0) };
    }
    if (aspect < 1.05) {
      // iPad 竖屏或窄屏
      const z = THREE.MathUtils.clamp(9.6 / Math.max(0.72, aspect), 10.6, 13.0);
      return { pos: new THREE.Vector3(0, 0.35, z), look: new THREE.Vector3(0, -0.28, 0) };
    }
    return { pos: new THREE.Vector3(0, 0.5, 9.6), look: new THREE.Vector3(0, 0, 0) };
  }

  _getDefaultHabitatOrbit() {
    const aspect = this.camera.aspect || 1;
    if (aspect < 0.72) {
      return { dist: 26.0, pitch: 0.54 };
    }
    if (aspect < 1.05) {
      return { dist: 21.5, pitch: 0.5 };
    }
    return { dist: 17.5, pitch: 0.45 };
  }

  /**
   * 聚焦星球到某个地块并进入其 3D 微景观场景（点击瞬间并行预加载模型，大幅缩短等待）
   */
  focusAndEnterBiome(biomeId, onReady) {
    if (this.isTransitioning) return;
    const biome = getBiomeById(biomeId);
    if (!biome) return;

    this.isTransitioning = true;
    this.planetScene.focusBiome(biomeId);
    // 立即并行预热该板块动物模型，转场动画与模型下载重叠进行！
    prefetchGLTFs(getAnimalsByBiome(biomeId).map((a) => a.glbUrl));
    // 镜头向前俯冲接近星球表面
    this.camPosTarget.set(0, 0.1, 6.2);

    this.callbacks.onTransitionStart?.(biome);

    setTimeout(async () => {
      this._switchToHabitat(biome);
      onReady?.(biome);
      const ready = this.habitatScene?.readyPromise || Promise.resolve();
      await Promise.race([ready, new Promise((r) => setTimeout(r, 8000))]);
      setTimeout(() => {
        this.isTransitioning = false;
        this.callbacks.onTransitionEnd?.(biome);
      }, 180);
    }, 380);
  }

  _switchToHabitat(biome) {
    this.mode = 'habitat';
    this.currentBiome = biome;
    this.selectedActor = null;
    this.viewOffsetTargetY = 0;
    this.planetScene.root.visible = false;

    if (this.habitatScene) {
      this.scene.remove(this.habitatScene.root);
    }
    this.habitatScene = new HabitatScene(biome, (loaded, total) => {
      this.callbacks.onLoadProgress?.(biome, loaded, total);
    });
    this.habitatScene.setNightMode(this.isNight);
    this.scene.add(this.habitatScene.root);

    const orbit = this._getDefaultHabitatOrbit();
    this.orbitYaw = 0.62;
    this.orbitPitch = orbit.pitch;
    this.orbitDist = orbit.dist;
    this._updateHabitatOrbitTarget();
    this.camera.position.copy(this.camPosTarget).add(new THREE.Vector3(0, 4.0, 4.0));
    this.camLookCurrent.set(0, 0.4, 0);
    this._applyAtmosphere();
  }

  returnToPlanet(onReady) {
    if (this.isTransitioning || this.mode === 'planet') return;
    this.isTransitioning = true;
    this.selectedActor?.exitInteraction();
    this.selectedActor = null;
    this.viewOffsetTargetY = 0;

    this.callbacks.onTransitionStart?.(null);

    setTimeout(() => {
      this.mode = 'planet';
      this.currentBiome = null;
      if (this.habitatScene) {
        this.scene.remove(this.habitatScene.root);
        this.habitatScene = null;
      }
      this.planetScene.root.visible = true;
      this.planetScene.targetRot = null;
      const framing = this._getPlanetFraming();
      this.camPosTarget.copy(framing.pos);
      this.camLookTarget.copy(framing.look);
      this._applyAtmosphere();
      onReady?.();

      setTimeout(() => {
        this.isTransitioning = false;
        this.callbacks.onTransitionEnd?.(null);
      }, 240);
    }, 400);
  }

  selectAnimal(animalId) {
    if (this.mode !== 'habitat' || !this.habitatScene) return null;
    const actor = this.habitatScene.getActorById(animalId);
    if (!actor) return null;

    if (this.selectedActor && this.selectedActor !== actor) {
      this.selectedActor.exitInteraction();
    }
    this.selectedActor = actor;

    // 根据真实加载后的模型高度、半径与屏幕横竖比动态计算不穿模、不裁切的特写机位
    const pos = actor.group.position;
    const h = actor.modelHeight || 1.4;
    const r = actor.bodyRadius || 0.7;
    const aspect = this.camera.aspect || 1;
    const portraitMul = aspect < 0.72 ? 1.32 : aspect < 1.05 ? 1.14 : 1.0;
    const dist = Math.max(3.4, r * 2.8 + h * 1.15) * portraitMul;
    const camY = Math.max(1.45, h * 0.95 + 0.55);

    const obstacles = this.habitatScene.obstacles || [];
    const currentCamDir = new THREE.Vector2(this.camera.position.x - pos.x, this.camera.position.z - pos.z);
    if (currentCamDir.lengthSq() < 0.01) currentCamDir.set(0.5, 1);
    currentCamDir.normalize();

    let bestScore = -Infinity;
    let bestPos = new THREE.Vector3(pos.x + currentCamDir.x * dist, camY, pos.z + currentCamDir.y * dist);

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      const cx = pos.x + dx * dist;
      const cz = pos.z + dz * dist;

      // 计算与场景内障碍物的最小安全距离（含连线中点，避免树干挡镜头）
      let minClearance = 10;
      for (const obs of obstacles) {
        if (obs.type === 'pond') continue;
        const dEnd = Math.hypot(cx - obs.x, cz - obs.z) - obs.radius;
        const mx = (pos.x + cx) * 0.5;
        const mz = (pos.z + cz) * 0.5;
        const dMid = Math.hypot(mx - obs.x, mz - obs.z) - obs.radius;
        minClearance = Math.min(minClearance, dEnd, dMid);
      }

      // 偏好靠近当前观察方向、远离障碍物、且机位在宽敞岛屿视野开阔处
      const alignScore = dx * currentCamDir.x + dz * currentCamDir.y;
      const centerBonus = Math.hypot(cx, cz) < 10.4 ? 0.6 : -0.3;
      const clearanceScore = minClearance < 0.5 ? minClearance * 4 - 4 : Math.min(2.2, minClearance);
      const score = clearanceScore + alignScore * 0.8 + centerBonus;

      if (score > bestScore) {
        bestScore = score;
        bestPos.set(cx, camY, cz);
      }
    }

    this.camPosTarget.copy(bestPos);
    // 视线正对动物身体中心，配合下方 setViewOffset 将动物整体抬升至上半屏空旷区域，完全不被对话栏遮挡
    this.camLookTarget.set(pos.x, Math.max(0.45, h * 0.52), pos.z);
    const viewW = this.container.clientWidth || window.innerWidth;
    const viewH = this.container.clientHeight || window.innerHeight;
    const offsetFactor = viewW <= 640 ? 0.165 : viewW <= 1024 ? 0.185 : 0.21;
    this.viewOffsetTargetY = Math.round(viewH * offsetFactor);

    actor.enterInteraction(this.camPosTarget);
    return actor;
  }

  deselectAnimal() {
    if (this.selectedActor) {
      this.selectedActor.exitInteraction();
      this.selectedActor = null;
    }
    this.viewOffsetTargetY = 0;
    if (this.mode === 'habitat') {
      this._updateHabitatOrbitTarget();
    }
  }

  triggerSelectedAnimalAction(actionName, vfxType = null, duration = 2.6) {
    if (!this.selectedActor || !this.habitatScene) return;
    this.selectedActor.triggerAction(actionName, duration);
    if (vfxType) {
      const p = this.selectedActor.group.position.clone();
      p.y += Math.max(0.85, (this.selectedActor.modelHeight || 1.2) * 0.78);
      this.habitatScene.spawnVfx(vfxType, p);
    }
  }

  /**
   * 拍摄当前 3D 画面，生成压缩后的拍立得缩略图 DataURL
   */
  captureSnapshot() {
    this.renderer.render(this.scene, this.camera);
    const srcCanvas = this.renderer.domElement;
    const targetW = 480;
    const targetH = Math.round((srcCanvas.height / srcCanvas.width) * targetW);
    const tmp = document.createElement('canvas');
    tmp.width = targetW;
    tmp.height = targetH;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
    return tmp.toDataURL('image/jpeg', 0.82);
  }

  _updateHabitatOrbitTarget() {
    const r = this.orbitDist;
    const y = Math.sin(this.orbitPitch) * r;
    const horiz = Math.cos(this.orbitPitch) * r;
    this.camPosTarget.set(Math.sin(this.orbitYaw) * horiz, Math.max(2.2, y), Math.cos(this.orbitYaw) * horiz);
    this.camLookTarget.set(0, 0.5, 0);
  }

  _bindEvents() {
    const el = this.renderer.domElement;

    const getPointerNDC = (clientX, clientY) => {
      const rect = el.getBoundingClientRect();
      this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const getPinchDistance = () => {
      const pts = Array.from(this.activePointers.values());
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    el.addEventListener('pointerdown', (e) => {
      if (this.isTransitioning) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);

      if (this.activePointers.size === 2) {
        this.isDragging = false;
        this.dragMoved = 999;
        this.pinchStartDist = getPinchDistance();
        this.pinchStartOrbit = this.orbitDist;
        return;
      }

      if (this.activePointers.size === 1) {
        this.isDragging = true;
        this.dragMoved = 0;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });

    el.addEventListener('pointermove', (e) => {
      getPointerNDC(e.clientX, e.clientY);

      if (this.activePointers.has(e.pointerId)) {
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // 手机/iPad 双指捏合缩放宽敞大陆视角
      if (this.activePointers.size === 2) {
        if (this.mode === 'habitat' && !this.selectedActor && this.pinchStartDist > 10) {
          const curDist = getPinchDistance();
          const scale = this.pinchStartDist / Math.max(10, curDist);
          this.orbitDist = THREE.MathUtils.clamp(this.pinchStartOrbit * scale, 8.5, 31.0);
          this._updateHabitatOrbitTarget();
        }
        return;
      }

      if (this.isDragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.dragMoved += Math.hypot(dx, dy);
        this.lastX = e.clientX;
        this.lastY = e.clientY;

        if (this.mode === 'planet') {
          this.planetScene.applyDrag(dx, dy);
        } else if (this.mode === 'habitat' && !this.selectedActor) {
          this.orbitYaw -= dx * 0.007;
          this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy * 0.005, 0.22, 1.08);
          this._updateHabitatOrbitTarget();
        }
        return;
      }

      this._handleHover();
    });

    const onPointerEnd = (e) => {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size > 0) {
        // 从双指回落到单指时重置锚点，避免镜头跳动
        const [remaining] = this.activePointers.values();
        this.lastX = remaining.x;
        this.lastY = remaining.y;
        this.isDragging = true;
        return;
      }
      if (!this.isDragging) return;
      this.isDragging = false;
      if (this.dragMoved < 10 && !this.isTransitioning) {
        getPointerNDC(e.clientX, e.clientY);
        this._handleClick();
      }
    };

    el.addEventListener('pointerup', onPointerEnd);
    el.addEventListener('pointercancel', (e) => {
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size === 0) this.isDragging = false;
    });

    el.addEventListener(
      'wheel',
      (e) => {
        if (this.mode === 'habitat' && !this.selectedActor) {
          this.orbitDist = THREE.MathUtils.clamp(this.orbitDist + e.deltaY * 0.012, 8.5, 31.0);
          this._updateHabitatOrbitTarget();
        }
      },
      { passive: true }
    );

    window.addEventListener('resize', () => this._onResize(false));
  }

  _handleHover() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const el = this.renderer.domElement;

    if (this.mode === 'planet') {
      const hits = this.raycaster.intersectObjects(this.planetScene.clickableMeshes, false);
      const biomeId = hits[0] ? this.planetScene.resolveBiomeFromHit(hits[0]) : null;
      this.planetScene.setHoveredBiome(biomeId);
      el.style.cursor = biomeId ? 'pointer' : 'grab';
    } else if (this.mode === 'habitat' && this.habitatScene) {
      const hits = this.raycaster.intersectObjects(this.habitatScene.getClickableMeshes(), false);
      const animalId = hits[0]?.object?.userData?.animalId || null;
      this.habitatScene.actors.forEach((a) => {
        a.hovered = a.config.id === animalId;
      });
      el.style.cursor = animalId ? 'pointer' : 'grab';
    }
  }

  _handleClick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);

    if (this.mode === 'planet') {
      const hits = this.raycaster.intersectObjects(this.planetScene.clickableMeshes, false);
      const biomeId = hits[0] ? this.planetScene.resolveBiomeFromHit(hits[0]) : null;
      if (biomeId) {
        this.callbacks.onBiomeClicked?.(biomeId);
      }
    } else if (this.mode === 'habitat' && this.habitatScene) {
      const hits = this.raycaster.intersectObjects(this.habitatScene.getClickableMeshes(), false);
      const animalId = hits[0]?.object?.userData?.animalId;
      if (animalId) {
        this.callbacks.onAnimalClicked?.(animalId);
      }
    }
  }

  _onResize(immediate = false) {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;

    if (this.mode === 'planet' && !this.isTransitioning) {
      const framing = this._getPlanetFraming();
      this.camPosTarget.copy(framing.pos);
      this.camLookTarget.copy(framing.look);
      if (immediate) {
        this.camera.position.copy(framing.pos);
        this.camLookCurrent.copy(framing.look);
      }
    } else if (this.mode === 'habitat') {
      if (this.selectedActor) {
        const offsetFactor = w <= 640 ? 0.165 : w <= 1024 ? 0.185 : 0.21;
        this.viewOffsetTargetY = Math.round(h * offsetFactor);
      } else {
        const orbit = this._getDefaultHabitatOrbit();
        this.orbitDist = orbit.dist;
        this.orbitPitch = orbit.pitch;
        this._updateHabitatOrbitTarget();
      }
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = Math.min(0.05, this.clock.getDelta());

    const camLerp = Math.min(1, dt * 5.2);
    this.camera.position.lerp(this.camPosTarget, camLerp);
    this.camLookCurrent.lerp(this.camLookTarget, camLerp);
    this.camera.lookAt(this.camLookCurrent);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    // 平滑应用垂直视锥偏移，动物稳稳居于对话栏上方空旷视野中
    const prevOff = this.viewOffsetY;
    this.viewOffsetY += (this.viewOffsetTargetY - this.viewOffsetY) * Math.min(1, dt * 6.0);
    if (Math.abs(this.viewOffsetY) > 0.4) {
      this.camera.setViewOffset(w, h, 0, this.viewOffsetY, w, h);
    } else if (Math.abs(prevOff) > 0.4) {
      this.camera.clearViewOffset();
    }

    if (this.mode === 'planet') {
      this.planetScene.update(dt);
      const labels = this.planetScene.getProjectedLabels(this.camera, w, h);
      this.callbacks.onPlanetLabelsUpdate?.(labels);
    } else if (this.mode === 'habitat' && this.habitatScene) {
      this.habitatScene.update(dt, this.camera.position);
      const badges = this.habitatScene.getProjectedAnimalBadges(this.camera, w, h);
      this.callbacks.onAnimalBadgesUpdate?.(badges);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
