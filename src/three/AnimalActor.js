import * as THREE from 'three';
import { instantiateAnimalGLB, findAnimationClip } from './ModelLoader.js';
import { getContactShadowTexture } from './ProceduralTextures.js';

const STATE_LABELS = {
  idle: '悠闲张望中',
  walk: '自由散步中',
  seek_poi: '正准备去玩耍',
  eat: '津津有味吃东西',
  drink: '咕咚咕咚喝水',
  sleep: '静静休息打盹',
  play: '开心撒欢玩耍',
  interact: '正在认真听你说话',
  greet: '热情向你打招呼',
  trick: '表演拿手绝活！',
  pet: '被摸摸好开心！',
};

const STATE_BADGES = {
  eat: '🍃',
  drink: '💧',
  sleep: '💤',
  play: '✨',
  trick: '🌟',
  pet: '❤️',
};

/**
 * 动物 3D 实体：真实 CC0 骨骼动画 GLB + 防穿模避障与动物互斥分离 AI
 */
export class AnimalActor {
  constructor(config, biome) {
    this.config = config;
    this.biome = biome;
    this.group = new THREE.Group();
    const startY = config.locomotion === 'water' ? 0.05 : config.locomotion === 'air' ? 1.55 : 0;
    this.group.position.set(config.homePosition[0], startY, config.homePosition[2]);

    this.visualHolder = new THREE.Group();
    this.group.add(this.visualHolder);

    // 真实加载后的模型几何尺寸（加载前给出合理默认值）
    this.bodyRadius = Math.max(0.55, (config.targetSize || 1.6) * 0.34);
    this.modelHeight = (config.targetSize || 1.6) * 0.78;
    this.mixer = null;
    this.clips = [];
    this.actions = new Map();
    this.activeAction = null;
    this.isLoaded = false;
    this.swimUniforms = null;
    this.rigBones = null;
    this.gaitPhase = Math.random() * Math.PI * 2;
    this.gaitWeight = 0;
    this.roarWeight = 0;

    // 陆地动物脚下柔和接触阴影
    if (config.locomotion === 'land') {
      const shadowMat = new THREE.MeshBasicMaterial({
        map: getContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      this.contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), shadowMat);
      this.contactShadow.rotation.x = -Math.PI / 2;
      this.contactShadow.position.y = 0.018;
      this.group.add(this.contactShadow);
    }

    // 脚下柔和选中光环（启用 polygonOffset 防闪烁）
    const ringGeo = new THREE.RingGeometry(0.65, 0.85, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.selectRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectRing.rotation.x = -Math.PI / 2;
    this.selectRing.position.y = 0.03;
    this.group.add(this.selectRing);

    // 隐形儿童友好点击碰撞体（加载完成后自动匹配真实尺寸）
    const hitGeo = new THREE.SphereGeometry(0.95, 10, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.hitCollider = new THREE.Mesh(hitGeo, hitMat);
    this.hitCollider.position.y = 0.8;
    this.hitCollider.userData.animalId = config.id;
    this.group.add(this.hitCollider);

    // AI 状态
    this.state = 'idle';
    this.stateTimer = 1.4 + Math.random() * 2.2;
    this.targetPos = this.group.position.clone();
    this.targetPoi = null;
    this.isInteracting = false;
    this.overrideAnim = null;
    this.overrideTimer = 0;
    this.trickElapsed = 0;

    this.needs = {
      energy: 60 + Math.random() * 35,
      hunger: 55 + Math.random() * 35,
      play: 45 + Math.random() * 45,
    };

    this.time = Math.random() * 20;
    this.isNight = false;
    this.hovered = false;
    this.desiredYaw = Math.random() * Math.PI * 2;
    this.group.rotation.y = this.desiredYaw;

    this.readyPromise = this._loadModel();
  }

  async _loadModel() {
    if (!this.config.glbUrl) return;
    try {
      const idleNames = this.config.animationMap?.idle || ['Idle', 'Survey', 'Animation', 'Swim'];
      const inst = await instantiateAnimalGLB(this.config.glbUrl, {
        targetSize: this.config.targetSize || 1.75,
        yawOffset: this.config.yawOffset || 0,
        idleClipNames: idleNames,
        isReptile: Boolean(this.config.isReptile),
        tintHex: this.config.tintHex ?? null,
        swimBend: Boolean(this.config.swimBend),
      });

      this.visualHolder.clear();
      this.visualHolder.add(inst.root);
      this.mixer = inst.mixer;
      this.clips = inst.clips;
      this.hasClips = this.clips.length > 0;
      this.swimUniforms = inst.swimUniforms || null;
      this.modelHeight = Math.max(0.8, inst.height);
      this.bodyRadius = Math.max(0.48, Math.min(1.15, inst.bodyRadius));
      this.isLoaded = true;

      if (this.config.proceduralRig === 'lion_quadruped') {
        this._initProceduralRig(inst.root);
      }

      // 标记所有子 Mesh 供射线拾取
      inst.root.traverse((c) => {
        c.userData.animalId = this.config.id;
      });

      // 调整脚底接触阴影、光环与点击热区匹配真实包围盒
      if (this.contactShadow) {
        const s = Math.max(1.2, this.bodyRadius * 2.2);
        this.contactShadow.scale.set(s, s, 1);
      }
      const ringScale = Math.max(0.85, this.bodyRadius * 1.28);
      this.selectRing.scale.setScalar(ringScale);
      const hitRadius = Math.max(0.85, this.bodyRadius * 1.35);
      this.hitCollider.scale.setScalar(hitRadius / 0.95);
      this.hitCollider.position.y = Math.max(0.55, this.modelHeight * 0.5);

      this._playAnimForState(this.overrideAnim || this.state, true);
    } catch (err) {
      console.error(`加载动物 GLB 失败 (${this.config.id}):`, err);
    }
  }

  /**
   * 绑定狮子 37 根真实骨骼引用，用于实时驱动四足行走、直立大吼绝活、挥爪打招呼、猫咪撒娇与低头咀嚼
   */
  _initProceduralRig(root) {
    const findBone = (substr) => {
      let found = null;
      root.traverse((obj) => {
        if (!found && obj.name && obj.name.includes(substr)) {
          found = obj;
        }
      });
      return found;
    };

    this.rigBones = {
      spine: findBone('Bip01-Spine_5'),
      spine1: findBone('Bip01-Spine1'),
      neck: findBone('Bip01-Neck_7'),
      neck1: findBone('Bip01-Neck1_8'),
      head: findBone('Bip01-Head'),
      mouth: findBone('BN_Mouth_01'),
      lUpperArm: findBone('Bip01-L-UpperArm'),
      lForearm: findBone('Bip01-L-Forearm'),
      lHand: findBone('Bip01-L-Hand'),
      rUpperArm: findBone('Bip01-R-UpperArm'),
      rForearm: findBone('Bip01-R-Forearm'),
      rHand: findBone('Bip01-R-Hand'),
      lThigh: findBone('Bip01-L-Thigh'),
      lCalf: findBone('Bip01-L-Calf'),
      lHock: findBone('Bip01-L-HorseLink'),
      rThigh: findBone('Bip01-R-Thigh'),
      rCalf: findBone('Bip01-R-Calf'),
      rHock: findBone('Bip01-R-HorseLink'),
      tail1: findBone('BN_Tail_01'),
      tail2: findBone('BN_Tail_02'),
      tail3: findBone('BN_Tail_03'),
      tail4: findBone('BN_Tail_04'),
    };

    // 超级大吼 3D 金色声波光环（表演绝活时从狮口向外扩散，视觉反馈极强）
    this.roarRings = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.RingGeometry(0.18, 0.27, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: i === 1 ? 0xfff1a8 : 0xffbe3b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.roarRings.push(mesh);
    }

    this.rigWeights = { trick: 0, greet: 0, pet: 0, eat: 0 };
  }

  /**
   * 在基础待机骨骼动画之上实时叠加自然四足步态与四大专属互动动作（使用局部四元数旋转避免万向锁）
   */
  _applyProceduralRig(dt) {
    const b = this.rigBones;
    if (!b) return;

    const active = this.overrideAnim || this.state;
    const isMoving = !this.isInteracting && (this.state === 'walk' || this.state === 'seek_poi');
    const isPlay = active === 'play';
    const targetGait = isMoving ? 1.0 : isPlay ? 0.72 : 0.0;
    this.gaitWeight += (targetGait - this.gaitWeight) * Math.min(1, dt * 7.5);

    const rw = this.rigWeights;
    const blendTo = (key, target, rate = 7.0) => {
      rw[key] += (target - rw[key]) * Math.min(1, dt * rate);
      return rw[key];
    };
    const wTrick = blendTo('trick', active === 'trick' ? 1 : 0, 6.5);
    const wGreet = blendTo('greet', active === 'greet' ? 1 : 0, 7.5);
    const wPet = blendTo('pet', active === 'pet' ? 1 : 0, 7.0);
    const wEat = blendTo('eat', active === 'eat' || active === 'drink' ? 1 : 0, 7.0);

    const strideFreq = isPlay ? 9.0 : 6.4;
    if (this.gaitWeight > 0.005) {
      this.gaitPhase += dt * strideFreq;
    }

    // 1. 四足对角线行走步态
    const w = this.gaitWeight * (1 - Math.min(1, wTrick + wGreet));
    if (w > 0.005) {
      const p = this.gaitPhase;
      const pOpp = p + Math.PI;
      const pHindR = p + 0.35;
      const pHindL = pOpp + 0.35;

      if (b.lUpperArm) b.lUpperArm.rotateX(-Math.sin(p) * 0.42 * w);
      if (b.lForearm) b.lForearm.rotateX(Math.max(0, Math.cos(p)) * 0.56 * w);
      if (b.lHand) b.lHand.rotateX(-Math.max(0, Math.cos(p)) * 0.32 * w);

      if (b.rUpperArm) b.rUpperArm.rotateX(-Math.sin(pOpp) * 0.42 * w);
      if (b.rForearm) b.rForearm.rotateX(Math.max(0, Math.cos(pOpp)) * 0.56 * w);
      if (b.rHand) b.rHand.rotateX(-Math.max(0, Math.cos(pOpp)) * 0.32 * w);

      if (b.rThigh) b.rThigh.rotateX(Math.sin(pHindR) * 0.40 * w);
      if (b.rCalf) b.rCalf.rotateX(-Math.max(0, Math.cos(pHindR)) * 0.48 * w);
      if (b.rHock) b.rHock.rotateX(Math.max(0, Math.cos(pHindR)) * 0.36 * w);

      if (b.lThigh) b.lThigh.rotateX(Math.sin(pHindL) * 0.40 * w);
      if (b.lCalf) b.lCalf.rotateX(-Math.max(0, Math.cos(pHindL)) * 0.48 * w);
      if (b.lHock) b.lHock.rotateX(Math.max(0, Math.cos(pHindL)) * 0.36 * w);

      if (b.neck) b.neck.rotateX(Math.sin(p * 2) * 0.06 * w);
      if (b.spine1) b.spine1.rotateY(Math.sin(p) * 0.045 * w);
      this.visualHolder.position.y = Math.abs(Math.sin(p)) * 0.045 * w;
    } else if (wTrick < 0.01) {
      this.visualHolder.position.y *= Math.max(0, 1 - dt * 10);
    }

    // 2. 专属绝活（trick）：草原之王前爪腾空高高直立 + 仰天超级大吼 + 3D 金色声波扩散！
    if (wTrick > 0.01) {
      const t = this.trickElapsed;
      // 0~0.18s 迅捷蓄力 -> 0.18~2.75s 高高腾空直立大吼 -> 2.75~3.4s 威风落地
      let rear = 0;
      if (t < 0.18) {
        rear = (t / 0.18) * 0.35;
      } else if (t < 2.75) {
        const u = Math.min(1, (t - 0.18) / 0.28);
        rear = 0.35 + 0.65 * (1 - Math.pow(1 - u, 3));
      } else {
        const u = Math.min(1, (t - 2.75) / 0.55);
        rear = Math.max(0, 1 - u * u);
      }
      const rW = rear * wTrick;

      if (rW > 0.005) {
        const roarShake = Math.sin(t * 15) * 0.11;
        const pawSwipe = Math.sin(t * 9.5) * 0.28;
        const jawOpen = 0.62 + 0.24 * Math.abs(Math.sin(t * 7.5));

        // Spine1 负 X 精确抬起整个上半身、鬃毛与双前肢，同时双后脚严丝合缝扎根地面！
        if (b.spine1) b.spine1.rotateX(-0.78 * rW);
        if (b.neck) b.neck.rotateX(-0.18 * rW);
        if (b.neck1) b.neck1.rotateX(-0.14 * rW);
        if (b.head) {
          b.head.rotateX(-0.16 * rW);
          b.head.rotateZ(roarShake * rW);
        }
        if (b.mouth) b.mouth.rotateX(-jawOpen * rW);

        // 双前爪腾空高举并威风挥舞
        if (b.lUpperArm) b.lUpperArm.rotateX((-0.85 + pawSwipe) * rW);
        if (b.lForearm) b.lForearm.rotateX((0.92 - pawSwipe * 0.45) * rW);
        if (b.lHand) b.lHand.rotateX(0.32 * rW);

        if (b.rUpperArm) b.rUpperArm.rotateX((-0.85 - pawSwipe) * rW);
        if (b.rForearm) b.rForearm.rotateX((0.92 + pawSwipe * 0.45) * rW);
        if (b.rHand) b.rHand.rotateX(0.32 * rW);
      }

      // 更新 3D 金色吼叫声波光环（从高昂狮口前方层层扩散）
      if (this.roarRings) {
        const showWave = rW > 0.45 && t > 0.25 && t < 2.75;
        this.roarRings.forEach((ring, idx) => {
          if (!showWave) {
            ring.visible = false;
            return;
          }
          const phase = ((t - 0.25) * 1.4 + idx / 3) % 1;
          ring.visible = true;
          ring.position.set(0, this.modelHeight * 1.12 + phase * 0.35, 0.55 + phase * 1.65);
          const s = 0.5 + phase * 3.0;
          ring.scale.setScalar(s);
          ring.material.opacity = (1 - phase) * 0.78 * rW;
        });
      }
    } else if (this.roarRings) {
      this.roarRings.forEach((r) => {
        r.visible = false;
      });
    }

    // 3. 热情打招呼（greet）：微微昂胸 + 高高抬起右前爪挥手问好！
    if (wGreet > 0.01) {
      const wave = Math.sin(this.time * 9.5);
      if (b.spine1) b.spine1.rotateX(-0.28 * wGreet);
      if (b.lUpperArm) b.lUpperArm.rotateX(0.24 * wGreet);
      if (b.rUpperArm) b.rUpperArm.rotateX((-1.32 + wave * 0.16) * wGreet);
      if (b.rForearm) b.rForearm.rotateX((0.55 + wave * 0.38) * wGreet);
      if (b.rHand) b.rHand.rotateX((0.28 + wave * 0.25) * wGreet);
      if (b.head) {
        b.head.rotateX(0.08 * wGreet);
        b.head.rotateY(0.22 * wGreet);
      }
      if (b.mouth) b.mouth.rotateX(-0.28 * (0.6 + 0.4 * Math.sin(this.time * 5.0)) * wGreet);
    }

    // 4. 摸摸它（pet）：变身大猫咪俯身伸懒腰 + 左右歪头蹭蹭撒娇
    if (wPet > 0.01) {
      const nuzzle = Math.sin(this.time * 5.2);
      if (b.spine1) b.spine1.rotateX(0.24 * wPet);
      if (b.lUpperArm) b.lUpperArm.rotateX(-0.34 * wPet);
      if (b.rUpperArm) b.rUpperArm.rotateX(-0.34 * wPet);
      if (b.neck) {
        b.neck.rotateX(-0.16 * wPet);
        b.neck.rotateZ(nuzzle * 0.16 * wPet);
      }
      if (b.head) {
        b.head.rotateY(nuzzle * 0.32 * wPet);
        b.head.rotateX(-0.12 * wPet);
      }
    }

    // 5. 喂点心 / 聊美食（eat）：深低头大口咀嚼
    if (wEat > 0.01) {
      const chomp = Math.abs(Math.sin(this.time * 7.2));
      if (b.spine1) b.spine1.rotateX(0.16 * wEat);
      if (b.neck) b.neck.rotateX((0.46 + chomp * 0.08) * wEat);
      if (b.neck1) b.neck1.rotateX(0.24 * wEat);
      if (b.head) b.head.rotateX(0.18 * wEat);
      if (b.mouth) b.mouth.rotateX(-0.46 * chomp * wEat);
    }

    // 6. 尾巴连续自然摆动（待机轻摆，行走/开心/绝活大幅摇动）
    const tailAmp = 0.08 + w * 0.14 + (wPet + wGreet + wTrick) * 0.22;
    const tailFreq = 2.6 + w * 2.2 + (wPet + wGreet) * 3.0;
    if (b.tail1) b.tail1.rotateZ(Math.sin(this.time * tailFreq) * tailAmp);
    if (b.tail2) b.tail2.rotateZ(Math.sin(this.time * tailFreq - 0.65) * tailAmp * 1.15);
    if (b.tail3) b.tail3.rotateZ(Math.sin(this.time * tailFreq - 1.3) * tailAmp * 1.25);
    if (b.tail4) b.tail4.rotateZ(Math.sin(this.time * tailFreq - 1.95) * tailAmp * 1.3);
  }

  _playAnimForState(stateKey, immediate = false) {
    if (!this.mixer || !this.clips.length) return;
    const candidates = this.config.animationMap?.[stateKey] || this.config.animationMap?.idle || ['Idle', 'Swim'];
    const clip = findAnimationClip(this.clips, candidates);
    if (!clip) return;

    let action = this.actions.get(clip.name);
    if (!action) {
      action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);
    }

    // 针对不同行为微调动画播放速度，更有生命力
    if (stateKey === 'sleep') {
      action.timeScale = 0.45;
    } else if (stateKey === 'play' || stateKey === 'trick') {
      action.timeScale = 1.18;
    } else if (stateKey === 'walk' || stateKey === 'seek_poi') {
      action.timeScale = 1.05;
    } else {
      action.timeScale = 0.92;
    }

    if (this.activeAction === action) return;

    action.reset().play();
    if (this.activeAction && !immediate) {
      this.activeAction.crossFadeTo(action, 0.28, false);
    }
    this.activeAction = action;
  }

  setNightMode(isNight) {
    this.isNight = isNight;
  }

  enterInteraction(cameraPos) {
    this.isInteracting = true;
    this.state = 'interact';
    this.triggerAction('greet', 2.0);
    if (cameraPos) this.facePoint(cameraPos);
  }

  exitInteraction() {
    this.isInteracting = false;
    this.overrideAnim = null;
    this.overrideTimer = 0;
    this.state = 'idle';
    this.stateTimer = 1.5 + Math.random() * 2.0;
    this._playAnimForState('idle');
  }

  triggerAction(actionName, duration = 2.6) {
    this.overrideAnim = actionName;
    this.overrideTimer = duration;
    this.trickElapsed = 0;
    this._playAnimForState(actionName);
  }

  facePoint(worldVec) {
    const dx = worldVec.x - this.group.position.x;
    const dz = worldVec.z - this.group.position.z;
    if (dx * dx + dz * dz > 0.001) {
      this.desiredYaw = Math.atan2(dx, dz);
    }
  }

  getReadableStatus() {
    const active = this.overrideAnim || this.state;
    return STATE_LABELS[active] || '自由活动中';
  }

  getBadgeEmoji() {
    const active = this.overrideAnim || this.state;
    return STATE_BADGES[active] || '';
  }

  getHeadWorldPosition(target = new THREE.Vector3()) {
    target.copy(this.group.position);
    target.y += this.modelHeight + 0.35;
    return target;
  }

  /**
   * 检查某地面/水面坐标是否完全安全（不与任何树木/石头/水池/沙滩或岛屿边缘穿模）
   */
  _isPositionClear(x, z, obstacles, margin = 0.35) {
    const maxR = 5.4 - this.bodyRadius;
    if (x * x + z * z > maxR * maxR) return false;
    for (const obs of obstacles) {
      const minD = obs.radius + this.bodyRadius + margin;
      const dx = x - obs.x;
      const dz = z - obs.z;
      if (dx * dx + dz * dz < minD * minD) return false;
    }
    return true;
  }

  _findSafeRandomTarget(obstacles) {
    const maxR = Math.min(this.config.wanderRadius || 4.3, 5.2 - this.bodyRadius);
    for (let attempt = 0; attempt < 24; attempt++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * (maxR - 0.6);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (this._isPositionClear(x, z, obstacles, 0.4)) {
        return new THREE.Vector3(x, this.group.position.y, z);
      }
    }
    return new THREE.Vector3(0, this.group.position.y, 0);
  }

  _chooseNextAutonomousBehavior(obstacles) {
    const pois = this.biome.pois || [];
    const sleepThreshold = this.isNight ? 62 : 32;

    if (this.needs.energy < sleepThreshold) {
      const poi = pois.find((p) => p.type === 'sleep');
      if (poi) {
        this._goToPoi(poi, obstacles);
        return;
      }
    }

    if (this.needs.hunger < 42) {
      const wantType = Math.random() < 0.55 ? 'eat' : 'drink';
      const poi = pois.find((p) => p.type === wantType) || pois[0];
      if (poi) {
        this._goToPoi(poi, obstacles);
        return;
      }
    }

    if (this.needs.play < 45 && Math.random() < 0.5) {
      const poi = pois.find((p) => p.type === 'play');
      if (poi) {
        this._goToPoi(poi, obstacles);
        return;
      }
    }

    if (Math.random() < 0.74) {
      this.state = 'walk';
      this.targetPoi = null;
      this.targetPos.copy(this._findSafeRandomTarget(obstacles));
      this.stateTimer = 4.5 + Math.random() * 4.0;
      this._playAnimForState('walk');
    } else {
      this.state = 'idle';
      this.stateTimer = 2.2 + Math.random() * 2.5;
      this._playAnimForState('idle');
    }
  }

  _goToPoi(poi, obstacles) {
    this.state = 'seek_poi';
    this.targetPoi = poi;
    // 在 POI 周围找一个完全不穿障碍物的安全落点
    let chosen = null;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.6;
      const x = poi.position[0] + Math.cos(a) * r;
      const z = poi.position[2] + Math.sin(a) * r;
      if (this._isPositionClear(x, z, obstacles, 0.22)) {
        chosen = new THREE.Vector3(x, this.group.position.y, z);
        break;
      }
    }
    this.targetPos.copy(chosen || this._findSafeRandomTarget(obstacles));
    this.stateTimer = 8.0;
    this._playAnimForState('walk');
  }

  /**
   * 实时防穿模解算：将动物平滑推出所有障碍物、其他动物碰撞体与岛屿边缘外
   */
  _resolveCollisions(obstacles, allActors) {
    const pos = this.group.position;

    // 1. 与环境障碍物（树、石、木桥、水池、沙滩）刚性防穿模
    for (const obs of obstacles) {
      const minD = obs.radius + this.bodyRadius + 0.14;
      const dx = pos.x - obs.x;
      const dz = pos.z - obs.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minD * minD) {
        const dist = Math.sqrt(distSq) || 0.001;
        const push = minD - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }

    // 2. 动物与动物之间互斥防叠穿
    for (const other of allActors) {
      if (other === this) continue;
      const minD = this.bodyRadius + other.bodyRadius + 0.28;
      const dx = pos.x - other.group.position.x;
      const dz = pos.z - other.group.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minD * minD) {
        const dist = Math.sqrt(distSq) || 0.001;
        const push = (minD - dist) * (other.isInteracting ? 1.0 : 0.55);
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      }
    }

    // 3. 限制在岛屿安全边界内，防止掉出悬崖或穿到岛外
    const maxR = 5.55 - this.bodyRadius;
    const rSq = pos.x * pos.x + pos.z * pos.z;
    if (rSq > maxR * maxR) {
      const r = Math.sqrt(rSq);
      pos.x = (pos.x / r) * maxR;
      pos.z = (pos.z / r) * maxR;
    }
  }

  update(dt, cameraPos, obstacles = [], allActors = []) {
    this.time += dt;

    // 需求随时间自然变化
    this.needs.energy = Math.max(10, this.needs.energy - dt * (this.isNight ? 3.2 : 1.4));
    this.needs.hunger = Math.max(10, this.needs.hunger - dt * 1.8);
    this.needs.play = Math.max(10, this.needs.play - dt * 1.5);

    // 选中 / 悬停光环
    const targetRingOpacity = this.isInteracting ? 0.85 : this.hovered ? 0.48 : 0;
    this.selectRing.material.opacity += (targetRingOpacity - this.selectRing.material.opacity) * Math.min(1, dt * 10);

    // 演出计时器
    if (this.overrideTimer > 0) {
      this.overrideTimer -= dt;
      this.trickElapsed += dt;
      if (this.overrideTimer <= 0) {
        this.overrideAnim = null;
        this._playAnimForState(this.state);
      }
    }

    if (this.isInteracting) {
      if (cameraPos) this.facePoint(cameraPos);
    } else {
      this.stateTimer -= dt;

      if (this.state === 'walk' || this.state === 'seek_poi') {
        const dx = this.targetPos.x - this.group.position.x;
        const dz = this.targetPos.z - this.group.position.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.3 && this.stateTimer > 0) {
          // 期望方向 + 前方障碍物平滑切向避让
          let dirX = dx / dist;
          let dirZ = dz / dist;

          for (const obs of obstacles) {
            const ox = this.group.position.x - obs.x;
            const oz = this.group.position.z - obs.z;
            const oDist = Math.hypot(ox, oz) || 0.001;
            const avoidRange = obs.radius + this.bodyRadius + 0.95;
            if (oDist < avoidRange) {
              const weight = (avoidRange - oDist) / avoidRange;
              dirX += (ox / oDist) * weight * 1.8;
              dirZ += (oz / oDist) * weight * 1.8;
            }
          }

          for (const other of allActors) {
            if (other === this) continue;
            const ox = this.group.position.x - other.group.position.x;
            const oz = this.group.position.z - other.group.position.z;
            const oDist = Math.hypot(ox, oz) || 0.001;
            const avoidRange = this.bodyRadius + other.bodyRadius + 0.9;
            if (oDist < avoidRange) {
              const weight = (avoidRange - oDist) / avoidRange;
              dirX += (ox / oDist) * weight * 1.6;
              dirZ += (oz / oDist) * weight * 1.6;
            }
          }

          const len = Math.hypot(dirX, dirZ) || 1;
          dirX /= len;
          dirZ /= len;

          const step = Math.min(dist, this.config.speed * dt);
          this.group.position.x += dirX * step;
          this.group.position.z += dirZ * step;
          this.desiredYaw = Math.atan2(dirX, dirZ);
        } else if (this.state === 'seek_poi' && this.targetPoi) {
          this.state = this.targetPoi.type;
          this.stateTimer = this.state === 'sleep' ? 6.0 : 4.2;
          if (this.state === 'sleep') this.needs.energy = 95;
          if (this.state === 'eat' || this.state === 'drink') this.needs.hunger = 95;
          if (this.state === 'play') this.needs.play = 95;
          // 喝水时面向水潭中心
          if (this.state === 'drink' && this.biome.pond) {
            this.facePoint({ x: this.biome.pond.x, z: this.biome.pond.z });
          }
          this._playAnimForState(this.state);
        } else {
          this.state = 'idle';
          this.stateTimer = 1.8 + Math.random() * 2.2;
          this._playAnimForState('idle');
        }
      } else if (this.stateTimer <= 0) {
        this._chooseNextAutonomousBehavior(obstacles);
      }

      // 每帧执行防穿模碰撞推离（未交互的动物不穿障碍物也不互相穿模）
      this._resolveCollisions(obstacles, allActors);
    }

    // 水生 / 空中 / 陆地动物的专属移动高度与绝活演出
    if (this.config.locomotion === 'water') {
      let swimY = -0.05 + Math.sin(this.time * 2.2 + this.config.homePosition[0]) * 0.08;
      let pitchX = Math.cos(this.time * 2.2 + this.config.homePosition[0]) * 0.06;
      let spinY = 0;

      if (this.overrideAnim === 'trick') {
        const t = this.trickElapsed;
        if (this.config.id === 'orca' || this.config.id === 'dolphin') {
          const speedMul = this.config.id === 'dolphin' ? 2.8 : 2.4;
          const arc = Math.sin(Math.min(t * speedMul, Math.PI * 2));
          swimY = -0.05 + Math.max(0, arc) * (this.config.id === 'dolphin' ? 1.45 : 1.35);
          pitchX = -Math.cos(Math.min(t * speedMul, Math.PI * 2)) * 0.65;
        } else if (this.config.id === 'mantaray') {
          const progress = Math.min(1, t / 2.6);
          swimY = 0.05 + Math.sin(progress * Math.PI) * 0.78;
          pitchX = -progress * Math.PI * 2;
        } else {
          const progress = Math.min(1, t / 2.2);
          swimY = 0.05 + Math.sin(progress * Math.PI * 2) * 0.35;
          spinY = progress * Math.PI * 4;
        }
      } else if (this.overrideAnim === 'pet' || this.overrideAnim === 'greet') {
        swimY = 0.06 + Math.abs(Math.sin(this.time * 6)) * 0.18;
      }

      this.group.position.y += (swimY - this.group.position.y) * Math.min(1, dt * 8);
      if (this.overrideAnim === 'trick' && this.config.id === 'mantaray') {
        this.visualHolder.rotation.x = pitchX;
      } else {
        this.visualHolder.rotation.x += (pitchX - this.visualHolder.rotation.x) * Math.min(1, dt * 8);
      }
      if (this.overrideAnim === 'trick' && (this.config.id === 'coralfish' || this.config.id === 'shark')) {
        this.visualHolder.rotation.y = spinY;
      } else {
        this.visualHolder.rotation.y *= Math.max(0, 1 - dt * 8);
      }
    } else if (this.config.locomotion === 'air') {
      // 空中飞翔动物（绿洲火烈鸟）：优雅盘旋、互动时温柔降落平视，绝活时 360° 螺旋攀升
      const baseAlt = this.isInteracting ? 0.95 : 1.55;
      let flyY = baseAlt + Math.sin(this.time * 2.4 + this.config.homePosition[0]) * 0.2;
      let bankZ = Math.sin(this.time * 1.8) * 0.12;
      let spinY = null;

      if (this.overrideAnim === 'trick') {
        const p = Math.min(1, this.trickElapsed / 2.6);
        flyY = baseAlt + Math.sin(p * Math.PI) * 0.95;
        bankZ = 0.36 * Math.sin(p * Math.PI);
        spinY = p * Math.PI * 2;
      } else if (this.overrideAnim === 'pet' || this.overrideAnim === 'greet') {
        flyY = baseAlt + Math.sin(this.time * 6.0) * 0.14;
      }

      this.group.position.y += (flyY - this.group.position.y) * Math.min(1, dt * 6);
      this.visualHolder.rotation.z += (bankZ - this.visualHolder.rotation.z) * Math.min(1, dt * 6);
      if (spinY !== null) {
        this.visualHolder.rotation.y = spinY;
      } else {
        this.visualHolder.rotation.y *= Math.max(0, 1 - dt * 8);
      }
    } else {
      // 陆地动物：脚底贴地 y = 0，表演绝活/摸摸时呈现专属跃起、回旋或重踏
      let bounceY = 0;
      let trickPitch = 0;
      let trickSpinY = null;

      if (this.overrideAnim === 'trick' && !this.rigBones) {
        const t = this.trickElapsed;
        if (this.config.id === 'fox') {
          const p = Math.min(1, t / 1.45);
          bounceY = Math.sin(p * Math.PI) * 0.62;
          trickSpinY = p * Math.PI * 2;
        } else if (this.config.id === 'stag' || this.config.id === 'doe') {
          const cycle = (t * 1.15) % 1;
          bounceY = Math.sin(cycle * Math.PI) * 0.82;
          trickPitch = -Math.cos(cycle * Math.PI) * 0.24;
        } else if (this.config.id === 'wolf' || this.config.id === 'goat') {
          const cycle = (t * 1.3) % 1;
          bounceY = Math.sin(cycle * Math.PI) * 0.68;
          trickPitch = -Math.cos(cycle * Math.PI) * 0.22;
        } else if (this.config.id === 'husky') {
          bounceY = Math.abs(Math.sin(t * 5.2)) * 0.42;
        } else if (this.config.id === 'bear' || this.config.id === 'polarbear') {
          bounceY = Math.abs(Math.sin(t * 4.0)) * 0.16;
        } else if (this.config.id === 'horse') {
          // 骏马自带 Rear 腾空扬蹄骨骼动作，保持后蹄稳稳踏地！
          bounceY = 0;
        } else if (this.config.id === 'camel') {
          bounceY = Math.abs(Math.sin(t * 4.5)) * 0.22;
        } else {
          // 写实恐龙们自带 roar 咆哮动作 + 微幅有分量感的踏地弹性
          bounceY = Math.abs(Math.sin(t * 3.8)) * 0.12;
        }
      } else if (this.overrideAnim === 'pet' && !this.rigBones) {
        bounceY = Math.abs(Math.sin(this.time * 8.5)) * 0.15;
      }

      this.group.position.y += (bounceY - this.group.position.y) * Math.min(1, dt * 12);
      this.visualHolder.rotation.x += (trickPitch - this.visualHolder.rotation.x) * Math.min(1, dt * 10);
      if (trickSpinY !== null) {
        this.visualHolder.rotation.y = trickSpinY;
      } else {
        this.visualHolder.rotation.y *= Math.max(0, 1 - dt * 10);
      }
    }

    // 平滑转向
    let diff = this.desiredYaw - this.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.group.rotation.y += diff * Math.min(1, dt * 6.5);

    if (this.mixer && this.hasClips) {
      this.mixer.update(dt);
    }
    if (this.rigBones) {
      this._applyProceduralRig(dt);
    }
    if (this.swimUniforms) {
      const moving = !this.isInteracting && (this.state === 'walk' || this.state === 'seek_poi');
      const energetic = this.overrideAnim === 'trick' || this.overrideAnim === 'play' || this.overrideAnim === 'greet';
      const swimFreq = energetic ? 10.5 : moving ? 7.8 : 4.2;
      this.swimUniforms.uSwimPhase.value += dt * swimFreq;
      const targetAmp = energetic ? 1.35 : moving ? 1.05 : 0.62;
      this.swimUniforms.uSwimAmp.value += (targetAmp - this.swimUniforms.uSwimAmp.value) * Math.min(1, dt * 6);
    }
  }
}
