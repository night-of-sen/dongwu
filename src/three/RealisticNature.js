import * as THREE from 'three';

const texCache = new Map();

function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * 写实树皮漫反射 + 凹凸贴图（细腻纵向树皮裂纹、光影层次与淡淡青苔）
 */
function getBarkTextures(variant = 'oak') {
  const key = `bark_${variant}`;
  if (texCache.has(key)) return texCache.get(key);

  const w = 256;
  const h = 512;
  const cDiff = document.createElement('canvas');
  cDiff.width = w;
  cDiff.height = h;
  const ctx = cDiff.getContext('2d');

  const cBump = document.createElement('canvas');
  cBump.width = w;
  cBump.height = h;
  const bctx = cBump.getContext('2d');

  const palettes = {
    oak: ['#5a4230', '#443020', '#6e533d', '#4c5938'],
    autumn: ['#523c2c', '#3c2b1e', '#694e3a', '#4a5436'],
    pine: ['#4d3426', '#382218', '#644432', '#3d4530'],
    palm: ['#7c6044', '#5c442e', '#947656', '#695138'],
    banyan: ['#4f4334', '#382f24', '#635644', '#3d5836'],
  };
  const [base, dark, light, moss] = palettes[variant] || palettes.oak;

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, w, h);

  const rand = seededRand(variant.length * 913 + 77);

  if (variant === 'palm') {
    // 棕榈树干特有的横向叶痕环纹
    for (let y = 0; y < h; y += 16) {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.33, y + 3, w * 0.66, y - 3, w, y);
      ctx.stroke();

      ctx.strokeStyle = light;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 4);
      ctx.lineTo(w, y + 4);
      ctx.stroke();

      bctx.strokeStyle = '#383838';
      bctx.lineWidth = 4;
      bctx.beginPath();
      bctx.moveTo(0, y);
      bctx.lineTo(w, y);
      bctx.stroke();
    }
  } else {
    // 纵向树皮沟壑与斑驳苔藓
    for (let i = 0; i < 160; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 40 + rand() * 140;
      const lw = 1.5 + rand() * 4.5;
      ctx.strokeStyle = i % 3 === 0 ? light : dark;
      ctx.globalAlpha = 0.25 + rand() * 0.45;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 14, y + len * 0.5, x + (rand() - 0.5) * 10, y + len);
      ctx.stroke();

      bctx.strokeStyle = i % 3 === 0 ? '#c8c8c8' : '#303030';
      bctx.globalAlpha = 0.5;
      bctx.lineWidth = lw;
      bctx.beginPath();
      bctx.moveTo(x, y);
      bctx.lineTo(x + (rand() - 0.5) * 8, y + len);
      bctx.stroke();
    }
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = moss;
      ctx.beginPath();
      ctx.ellipse(rand() * w, rand() * h, 6 + rand() * 14, 12 + rand() * 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const map = new THREE.CanvasTexture(cDiff);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  const res = { map, bumpMap };
  texCache.set(key, res);
  return res;
}

/**
 * 高精细透明通道植物叶片簇贴图（独立叶片轮廓 + 主叶脉 + 阳光通透层次）
 */
function getLeafSprayTexture(palette = 'meadow') {
  const key = `leaf_${palette}`;
  if (texCache.has(key)) return texCache.get(key);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const colorSets = {
    meadow: ['#2e6b29', '#3f8732', '#57a43c', '#74bd49', '#94cf5a'],
    autumn: ['#8f2d14', '#b84318', '#d96c1f', '#eb9828', '#f5be3b'],
    jungle: ['#1b572b', '#266f35', '#348c3e', '#4aa849', '#6ac259'],
    desert: ['#5c7a3b', '#749449', '#8baa57', '#a2bd68', '#688242'],
  };
  const cols = colorSets[palette] || colorSets.meadow;
  const rand = seededRand(palette.length * 733 + 19);

  // 先画细嫩小树枝骨架
  ctx.strokeStyle = '#4e3928';
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.92);
  ctx.quadraticCurveTo(size * 0.48, size * 0.55, size * 0.52, size * 0.16);
  ctx.stroke();

  for (let i = 0; i < 6; i++) {
    const t = 0.28 + i * 0.11;
    const side = i % 2 === 0 ? -1 : 1;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * (1 - t));
    ctx.quadraticCurveTo(size * (0.5 + side * 0.16), size * (1 - t - 0.08), size * (0.5 + side * 0.28), size * (1 - t - 0.16));
    ctx.stroke();
  }

  // 绘制 46 片带叶脉与明暗渐变的真实宽叶片
  const drawLeaf = (cx, cy, len, wid, ang, colA, colB) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, colA);
    grad.addColorStop(1, colB);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.28, -wid, len * 0.72, -wid * 0.85, len, 0);
    ctx.bezierCurveTo(len * 0.72, wid * 0.85, len * 0.28, wid, 0, 0);
    ctx.closePath();
    ctx.fill();

    // 叶脉微高光
    ctx.strokeStyle = 'rgba(255,255,220,0.22)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(len * 0.88, 0);
    ctx.stroke();
    ctx.restore();
  };

  for (let i = 0; i < 48; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = Math.pow(rand(), 0.65) * size * 0.34;
    const cx = size * 0.5 + Math.cos(angle) * dist;
    const cy = size * 0.48 + Math.sin(angle) * dist * 0.92;
    const len = 54 + rand() * 58;
    const wid = len * (0.32 + rand() * 0.14);
    const leafAng = Math.atan2(cy - size * 0.55, cx - size * 0.5) + (rand() - 0.5) * 0.9;
    const idxA = Math.min(cols.length - 2, Math.floor(rand() * (cols.length - 1)));
    drawLeaf(cx, cy, len, wid, leafAng, cols[idxA], cols[idxA + 1]);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

/**
 * 极地雪松精细针叶枝贴图（细腻松针 + 枝头柔和积雪）
 */
function getPineBoughTexture(snowy = true) {
  const key = `pine_bough_${snowy}`;
  if (texCache.has(key)) return texCache.get(key);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const rand = seededRand(snowy ? 401 : 409);

  // 中心木枝与侧枝
  ctx.strokeStyle = '#473022';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.96);
  ctx.lineTo(size * 0.5, size * 0.12);
  ctx.stroke();

  const greens = snowy ? ['#1f4638', '#2a5a48', '#397059', '#4a856b'] : ['#1e4d29', '#2b6634', '#3c7d41', '#52964e'];

  // 大量细腻辐射状松针
  for (let i = 0; i < 420; i++) {
    const t = 0.08 + rand() * 0.84;
    const y = size * (1 - t);
    const maxSpread = (1 - Math.abs(t - 0.45) * 1.35) * size * 0.4;
    const side = rand() < 0.5 ? -1 : 1;
    const ox = size * 0.5 + side * rand() * maxSpread * 0.55;
    const len = 32 + rand() * 48;
    const ang = -Math.PI / 2 + side * (0.45 + rand() * 0.85);
    ctx.strokeStyle = greens[Math.floor(rand() * greens.length)];
    ctx.lineWidth = 2.6 + rand() * 2.2;
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  // 柔和蓬松积雪点缀在松枝上缘
  if (snowy) {
    for (let i = 0; i < 42; i++) {
      const t = 0.16 + rand() * 0.72;
      const y = size * (1 - t);
      const spread = (1 - Math.abs(t - 0.48) * 1.45) * size * 0.34;
      const x = size * 0.5 + (rand() - 0.5) * 2 * spread;
      const r = 10 + rand() * 22;
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(248, 253, 255, 0.92)');
      g.addColorStop(0.7, 'rgba(222, 240, 252, 0.72)');
      g.addColorStop(1, 'rgba(222, 240, 252, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

/**
 * 写实热带椰树羽状棕榈叶贴图（逐片羽状细长叶片 + 阳光光泽）
 */
function getPalmFrondTexture() {
  const key = 'palm_frond';
  if (texCache.has(key)) return texCache.get(key);

  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // 中央叶轴
  ctx.strokeStyle = '#738f34';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.98);
  ctx.lineTo(w * 0.5, h * 0.05);
  ctx.stroke();

  const pairs = 28;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const y = h * (0.94 - t * 0.86);
    const env = Math.sin(Math.pow(t, 0.72) * Math.PI);
    const len = 24 + env * 102;
    for (const side of [-1, 1]) {
      const grad = ctx.createLinearGradient(w * 0.5, y, w * 0.5 + side * len, y - 22);
      grad.addColorStop(0, '#3a7a2c');
      grad.addColorStop(0.55, '#559c39');
      grad.addColorStop(1, '#79ba47');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, y);
      ctx.quadraticCurveTo(w * 0.5 + side * len * 0.55, y - 16, w * 0.5 + side * len, y - 4 - t * 18);
      ctx.quadraticCurveTo(w * 0.5 + side * len * 0.52, y - 4, w * 0.5, y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  texCache.set(key, tex);
  return tex;
}

/**
 * 辅助：沿曲线构造平滑渐变粗细的自然树干/树枝管体
 */
function buildTaperedBranch(points, rStart, rEnd, tubularSegs = 14, radialSegs = 8) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegs, 1, radialSegs, false);
  const pos = geo.attributes.position;
  const ringVerts = radialSegs + 1;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    // 根部自然略微外扩（板根效果），顶部纤细收尖
    const flare = t < 0.16 ? 1 + Math.pow((0.16 - t) / 0.16, 2) * 0.45 : 1;
    const rad = THREE.MathUtils.lerp(rStart, rEnd, Math.pow(t, 0.85)) * flare;
    curve.getPointAt(t, center);
    for (let j = 0; j < ringVerts; j++) {
      const idx = i * ringVerts + j;
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(rad).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return { geo, curve };
}

/**
 * 构造弯曲的交叉叶片簇卡片（避免纸片感，从任何角度看都蓬松自然）
 */
function createCurvedFoliageCard(w, h, bend = 0.22) {
  const geo = new THREE.PlaneGeometry(w, h, 3, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = x / (w * 0.5);
    const ny = y / (h * 0.5);
    const z = -(nx * nx + ny * ny) * bend;
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * 生成写实高精度自然 3D 树木（彻底取代多面体方块低模树）
 * 支持类型：'oak_meadow' | 'autumn_maple' | 'snow_spruce' | 'tropical_palm' | 'rainforest_banyan'
 */
export function createRealisticTree(type = 'oak_meadow', { height = 4.0, seed = 1 } = {}) {
  const rand = seededRand(Math.floor(seed * 997 + type.length * 131));
  const group = new THREE.Group();
  const swayGroup = new THREE.Group();
  group.add(swayGroup);

  if (type === 'tropical_palm') {
    const bark = getBarkTextures('palm');
    const trunkMat = new THREE.MeshStandardMaterial({
      map: bark.map,
      bumpMap: bark.bumpMap,
      bumpScale: 0.04,
      roughness: 0.88,
      metalness: 0.02,
    });
    const leanX = (rand() - 0.5) * 0.9;
    const leanZ = (rand() - 0.5) * 0.9;
    const pts = [
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Vector3(leanX * 0.3, height * 0.34, leanZ * 0.3),
      new THREE.Vector3(leanX * 0.85, height * 0.72, leanZ * 0.85),
      new THREE.Vector3(leanX * 1.1, height * 0.96, leanZ * 1.1),
    ];
    const { geo: trunkGeo, curve } = buildTaperedBranch(pts, 0.19, 0.095, 18, 10);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    swayGroup.add(trunk);

    const crownPos = curve.getPointAt(1);
    const crown = new THREE.Group();
    crown.position.copy(crownPos);
    swayGroup.add(crown);

    // 树冠下的成熟椰果
    const cocoMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.75 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand();
      const coco = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), cocoMat);
      coco.scale.set(0.9, 1.15, 0.9);
      coco.position.set(Math.cos(a) * 0.14, -0.1, Math.sin(a) * 0.14);
      coco.castShadow = true;
      crown.add(coco);
    }

    // 12 片弧形下垂的羽状椰叶
    const frondMat = new THREE.MeshStandardMaterial({
      map: getPalmFrondTexture(),
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.62,
      metalness: 0.04,
    });

    for (let i = 0; i < 12; i++) {
      const tier = i < 7 ? 0 : 1;
      const a = (i / (tier === 0 ? 7 : 5)) * Math.PI * 2 + tier * 0.45 + (rand() - 0.5) * 0.2;
      const len = height * (tier === 0 ? 0.54 : 0.42);
      const wid = len * 0.46;
      const fGeo = new THREE.PlaneGeometry(wid, len, 2, 7);
      fGeo.translate(0, len * 0.5, 0);
      const pos = fGeo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const py = pos.getY(v);
        const px = pos.getX(v);
        const t = Math.max(0, py / len);
        // 优雅拱形垂落曲线 + 叶片沿中轴微折 V 形
        const archZ = -Math.pow(t, 1.75) * len * (tier === 0 ? 0.42 : 0.28);
        const vFold = -Math.abs(px) * 0.25;
        pos.setZ(v, archZ + vFold);
      }
      fGeo.computeVertexNormals();
      const frond = new THREE.Mesh(fGeo, frondMat);
      frond.rotation.order = 'YXZ';
      frond.rotation.y = a;
      frond.rotation.x = tier === 0 ? 1.62 : 1.18;
      frond.castShadow = true;
      frond.receiveShadow = true;
      crown.add(frond);
    }
  } else if (type === 'snow_spruce') {
    const bark = getBarkTextures('pine');
    const trunkMat = new THREE.MeshStandardMaterial({
      map: bark.map,
      bumpMap: bark.bumpMap,
      bumpScale: 0.04,
      roughness: 0.9,
    });
    const pts = [
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Vector3((rand() - 0.5) * 0.08, height * 0.5, (rand() - 0.5) * 0.08),
      new THREE.Vector3(0, height * 0.96, 0),
    ];
    const { geo: trunkGeo } = buildTaperedBranch(pts, 0.17, 0.028, 12, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    swayGroup.add(trunk);

    const boughMat = new THREE.MeshStandardMaterial({
      map: getPineBoughTexture(true),
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.78,
    });

    // 8 层自然下垂的雪松针叶枝（合并为单次 InstancedMesh，零卡顿且外形与真实寒带云杉一致）
    const bGeo = new THREE.PlaneGeometry(1, 1, 2, 4);
    bGeo.translate(0, 0.45, 0);
    const bp = bGeo.attributes.position;
    for (let k = 0; k < bp.count; k++) {
      const u = bp.getY(k);
      bp.setZ(k, -Math.pow(Math.max(0, u), 1.45) * 0.24);
    }
    bGeo.computeVertexNormals();

    const tiers = 8;
    const boughMatrices = [];
    const dummy = new THREE.Object3D();
    for (let t = 0; t < tiers; t++) {
      const frac = t / (tiers - 1);
      const y = height * (0.2 + frac * 0.74);
      const radius = height * (0.37 * (1 - frac * 0.78) + 0.07);
      const count = Math.max(5, Math.round(9 - frac * 4));
      for (let j = 0; j < count; j++) {
        const ang = (j / count) * Math.PI * 2 + t * 0.72 + (rand() - 0.5) * 0.25;
        const bLen = radius * (0.9 + rand() * 0.25);
        const bWid = bLen * 0.85;
        dummy.position.set(0, y, 0);
        dummy.rotation.order = 'YXZ';
        dummy.rotation.set(1.78 - frac * 0.42, ang, 0);
        dummy.scale.set(bWid, bLen, bLen);
        dummy.updateMatrix();
        boughMatrices.push(dummy.matrix.clone());
      }
    }

    const boughInst = new THREE.InstancedMesh(bGeo, boughMat, boughMatrices.length);
    boughMatrices.forEach((m, idx) => boughInst.setMatrixAt(idx, m));
    boughInst.instanceMatrix.needsUpdate = true;
    boughInst.castShadow = true;
    boughInst.receiveShadow = true;
    swayGroup.add(boughInst);
  } else {
    // 阔叶乔木（阳光草甸橡树 / 高山金秋枫树 / 恐龙雨林古榕树）
    const isAutumn = type === 'autumn_maple';
    const isBanyan = type === 'rainforest_banyan';
    const bark = getBarkTextures(isAutumn ? 'autumn' : isBanyan ? 'banyan' : 'oak');
    const trunkMat = new THREE.MeshStandardMaterial({
      map: bark.map,
      bumpMap: bark.bumpMap,
      bumpScale: 0.05,
      roughness: 0.9,
      metalness: 0.02,
    });

    const trunkH = height * (isBanyan ? 0.56 : 0.52);
    const trunkR = height * (isBanyan ? 0.072 : 0.055);
    const pts = [
      new THREE.Vector3(0, -0.06, 0),
      new THREE.Vector3((rand() - 0.5) * 0.22, trunkH * 0.48, (rand() - 0.5) * 0.22),
      new THREE.Vector3((rand() - 0.5) * 0.28, trunkH, (rand() - 0.5) * 0.28),
    ];
    const { geo: trunkGeo, curve: trunkCurve } = buildTaperedBranch(pts, trunkR, trunkR * 0.55, 14, 9);
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    swayGroup.add(trunkMesh);

    const topPt = trunkCurve.getPointAt(1);
    const palette = isAutumn ? 'autumn' : isBanyan ? 'jungle' : 'meadow';
    const leafTex = getLeafSprayTexture(palette);

    const leafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0.02,
    });

    const cardGeo = createCurvedFoliageCard(height * 0.38, height * 0.38, height * 0.05);

    const branchCount = isBanyan ? 6 : 5;
    const canopyCenters = [topPt.clone().add(new THREE.Vector3(0, height * 0.28, 0))];

    for (let i = 0; i < branchCount; i++) {
      const a = (i / branchCount) * Math.PI * 2 + (rand() - 0.5) * 0.45;
      const spread = height * (isBanyan ? 0.34 : 0.28) * (0.85 + rand() * 0.3);
      const lift = height * (0.24 + rand() * 0.16);
      const startPt = trunkCurve.getPointAt(0.74 + rand() * 0.25);
      const midPt = startPt.clone().add(new THREE.Vector3(Math.cos(a) * spread * 0.55, lift * 0.58, Math.sin(a) * spread * 0.55));
      const endPt = startPt.clone().add(new THREE.Vector3(Math.cos(a) * spread, lift, Math.sin(a) * spread));
      const { geo: brGeo } = buildTaperedBranch([startPt, midPt, endPt], trunkR * 0.48, trunkR * 0.14, 8, 6);
      const br = new THREE.Mesh(brGeo, trunkMat);
      br.castShadow = true;
      swayGroup.add(br);
      canopyCenters.push(endPt);
    }

    // 所有树叶簇合批为单次 InstancedMesh（1 Draw Call，阳光/阴影双色实例着色！）
    const leafMatrices = [];
    const leafColors = [];
    const colSun = new THREE.Color(0xffffff);
    const colShade = new THREE.Color(isAutumn ? 0xd9a888 : 0xb5d4b0);
    const dummy = new THREE.Object3D();

    canopyCenters.forEach((center, ci) => {
      const cardsPerCluster = ci === 0 ? 10 : 7;
      const clusterR = height * (ci === 0 ? 0.24 : 0.19);
      for (let k = 0; k < cardsPerCluster; k++) {
        const theta = (k / cardsPerCluster) * Math.PI * 2 + rand() * 0.5;
        const phi = 0.25 + rand() * 1.1;
        const r = clusterR * (0.35 + rand() * 0.72);
        dummy.position.set(
          center.x + Math.sin(phi) * Math.cos(theta) * r,
          center.y + Math.cos(phi) * r * 0.72,
          center.z + Math.sin(phi) * Math.sin(theta) * r
        );
        dummy.rotation.set((rand() - 0.5) * 1.2, theta + (rand() - 0.5) * 0.9, (rand() - 0.5) * 0.9);
        dummy.scale.setScalar(0.8 + rand() * 0.45);
        dummy.updateMatrix();
        leafMatrices.push(dummy.matrix.clone());
        leafColors.push(phi < 0.72 ? colSun : colShade);
      }
    });

    const leafInst = new THREE.InstancedMesh(cardGeo, leafMat, leafMatrices.length);
    leafMatrices.forEach((m, idx) => {
      leafInst.setMatrixAt(idx, m);
      leafInst.setColorAt(idx, leafColors[idx]);
    });
    leafInst.instanceMatrix.needsUpdate = true;
    if (leafInst.instanceColor) leafInst.instanceColor.needsUpdate = true;
    leafInst.castShadow = true;
    leafInst.receiveShadow = true;
    swayGroup.add(leafInst);
  }

  return {
    group,
    swayGroup,
    swayPhase: rand() * Math.PI * 2,
  };
}

/**
 * 写实摄影级水波焦散 + 菲涅尔天空反射 + 不规则岸边泡沫着色器
 */
export function createPhotographicWaterMaterial(baseColorHex, { opacity = 0.84, isPond = false, isSnow = false } = {}) {
  const shallow = new THREE.Color(baseColorHex);
  const deep = shallow.clone().multiplyScalar(isSnow ? 0.45 : 0.42);
  const skyReflect = new THREE.Color(isSnow ? 0xd8f0ff : 0xc8edff);
  const foam = new THREE.Color(0xf4fdff);

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms: {
      uTime: { value: 0 },
      uShallow: { value: shallow },
      uDeep: { value: deep },
      uSky: { value: skyReflect },
      uFoam: { value: foam },
      uOpacity: { value: opacity },
      uIsPond: { value: isPond ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vRadial;
      attribute float aRadial;
      void main() {
        vUv = uv;
        vRadial = aRadial;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uSky;
      uniform vec3 uFoam;
      uniform float uOpacity;
      uniform float uIsPond;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vRadial;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // 双层柔滑干涉焦散纹
      float causticPattern(vec2 p, float t) {
        vec2 p1 = p * 2.3 + vec2(t * 0.35, -t * 0.25);
        vec2 p2 = p * 3.1 + vec2(-t * 0.28, t * 0.31);
        float c1 = sin(p1.x + sin(p1.y * 1.2 + t)) * cos(p1.y + cos(p1.x * 1.1 - t));
        float c2 = sin(p2.x - cos(p2.y * 1.3 - t * 0.8)) * cos(p2.y + sin(p2.x * 1.2 + t * 0.9));
        float v = abs(c1 + c2) * 0.5;
        return smoothstep(0.55, 0.95, 1.0 - v);
      }

      void main() {
        float r = uIsPond > 0.5 ? vRadial : length((vUv - 0.5) * 2.0);
        vec2 wp = vWorldPos.xz;

        // 水深渐变（中心深邃清澈，近岸浅水透亮）
        vec3 baseCol = mix(uDeep, uShallow, smoothstep(0.15, 0.88, r));

        // 阳光水底焦散纹
        float caust = causticPattern(wp * 1.35, uTime * 1.3);
        baseCol += vec3(0.28, 0.42, 0.45) * caust * (0.42 + 0.25 * (1.0 - r));

        // 视角菲涅尔天空高光反射 + 水面星点闪光
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
        baseCol = mix(baseCol, uSky, clamp(fresnel * 0.55, 0.0, 0.52));

        float sparkle = pow(max(0.0, sin(wp.x * 9.0 + uTime * 2.8) * cos(wp.y * 11.0 - uTime * 2.2)), 10.0);
        baseCol += vec3(1.0, 0.98, 0.92) * sparkle * 0.45;

        // 柔和拍岸水波白沫
        float waveRipple = sin(r * 24.0 - uTime * 3.2 + sin(wp.x * 3.0 + wp.y * 3.0)) * 0.025;
        float foamMask = smoothstep(0.84, 0.97, r + waveRipple);
        baseCol = mix(baseCol, uFoam, foamMask * 0.62);

        // 岸边柔和羽化，与鹅卵石湿润岸线自然融合
        float edgeAlpha = 1.0 - smoothstep(0.92, 1.0, r);
        float depthAlpha = mix(uOpacity, uOpacity * 0.72, smoothstep(0.75, 0.96, r));
        gl_FragColor = vec4(baseCol, depthAlpha * edgeAlpha);
      }
    `,
  });
}

/**
 * 构造不规则有机轮廓圆盘几何体（自带 aRadial 归一化半径属性，支持精确岸线泡沫）
 */
function createOrganicDiscGeometry(baseRadius, seed = 1, segs = 56, rings = 6) {
  const randShape = (ang) =>
    1.0 +
    0.13 * Math.sin(ang * 2 + seed) +
    0.08 * Math.cos(ang * 3 - seed * 1.3) +
    0.045 * Math.sin(ang * 5 + seed * 0.7);

  const positions = [];
  const uvs = [];
  const radials = [];
  const indices = [];

  // 中心点
  positions.push(0, 0, 0);
  uvs.push(0.5, 0.5);
  radials.push(0);

  for (let ri = 1; ri <= rings; ri++) {
    const rf = ri / rings;
    for (let si = 0; si < segs; si++) {
      const ang = (si / segs) * Math.PI * 2;
      const r = baseRadius * randShape(ang) * rf;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      positions.push(x, 0, z);
      uvs.push(0.5 + (x / (baseRadius * 2.4)), 0.5 + (z / (baseRadius * 2.4)));
      radials.push(rf);
    }
  }

  // 中心扇形
  for (let si = 0; si < segs; si++) {
    const next = (si + 1) % segs;
    indices.push(0, 1 + next, 1 + si);
  }
  // 外环三角带
  for (let ri = 1; ri < rings; ri++) {
    const rowA = 1 + (ri - 1) * segs;
    const rowB = 1 + ri * segs;
    for (let si = 0; si < segs; si++) {
      const next = (si + 1) % segs;
      indices.push(rowA + si, rowA + next, rowB + next);
      indices.push(rowA + si, rowB + next, rowB + si);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aRadial', new THREE.Float32BufferAttribute(radials, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { geo, radiusAt: (ang) => baseRadius * randShape(ang) };
}

/**
 * 柔和鹅卵石水底纹理
 */
function getPebbleBedTexture(isSnow = false) {
  const key = `pebble_bed_${isSnow}`;
  if (texCache.has(key)) return texCache.get(key);

  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = isSnow ? '#4e758c' : '#58695e';
  ctx.fillRect(0, 0, size, size);

  const rand = seededRand(isSnow ? 881 : 887);
  const cols = isSnow
    ? ['#688ca1', '#7ea1b5', '#426175', '#92b3c7']
    : ['#6d7d6c', '#827762', '#525f52', '#998b70', '#635c4e'];

  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, 3 + rand() * 8, 2 + rand() * 6, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.5, 2.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, tex);
  return tex;
}

/**
 * 打造有机自然水潭（不规则自然水岸 + 鹅卵石岸石群 + 荷叶睡莲 / 极地浮冰 + 芦苇草 + 摄影级水波焦散）
 */
export function createNaturalPond(biome) {
  const { x, z, radius } = biome.pond;
  const isSnow = biome.id === 'snow';
  const isDesert = biome.id === 'desert';
  const seed = biome.id.charCodeAt(0) * 0.37;
  const rand = seededRand(Math.floor(seed * 900) + 17);

  const group = new THREE.Group();
  group.position.set(x, 0, z);

  // 1. 柔和羽化的湿润泥沙/冰霜岸滩过渡层（彻底取代生硬棕色圆环！）
  const { geo: bankGeo, radiusAt } = createOrganicDiscGeometry(radius * 1.18, seed, 56, 5);
  const bankMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    uniforms: {
      uBankColor: { value: new THREE.Color(isSnow ? 0xcce8fa : isDesert ? 0xc89b5a : 0x736348) },
      uBedColor: { value: new THREE.Color(isSnow ? 0x3b6c88 : 0x3d544c) },
    },
    vertexShader: `
      attribute float aRadial;
      varying float vR;
      void main() {
        vR = aRadial;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uBankColor;
      uniform vec3 uBedColor;
      varying float vR;
      void main() {
        vec3 col = mix(uBedColor, uBankColor, smoothstep(0.62, 0.85, vR));
        float alpha = 1.0 - smoothstep(0.84, 1.0, vR);
        gl_FragColor = vec4(col, alpha * 0.92);
      }
    `,
  });
  const bankMesh = new THREE.Mesh(bankGeo, bankMat);
  bankMesh.position.y = 0.012;
  group.add(bankMesh);

  // 2. 水底鹅卵石床
  const { geo: bedGeo } = createOrganicDiscGeometry(radius * 0.96, seed, 48, 4);
  const bedMat = new THREE.MeshStandardMaterial({
    map: getPebbleBedTexture(isSnow),
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const bedMesh = new THREE.Mesh(bedGeo, bedMat);
  bedMesh.position.y = 0.017;
  bedMesh.receiveShadow = true;
  group.add(bedMesh);

  // 3. 摄影级不规则水波焦散水面
  const { geo: waterGeo } = createOrganicDiscGeometry(radius * 1.02, seed, 56, 6);
  const waterMat = createPhotographicWaterMaterial(biome.waterColor, {
    opacity: 0.84,
    isPond: true,
    isSnow,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = 0.032;
  group.add(waterMesh);

  // 4. 沿不规则水岸自然错落分布的河岸鹅卵石与苔藓石块
  const stonePalette = isSnow
    ? [0xd5e9f7, 0xb8d4e8, 0x8ea7ba]
    : isDesert
      ? [0xc9a36f, 0xb58852, 0x997349]
      : [0x828479, 0x6f7567, 0x999282, 0x5c6b54];

  const stoneGeos = [0, 1, 2].map((idx) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    const r = seededRand(500 + idx * 71);
    for (let i = 0; i < p.count; i++) {
      const vx = p.getX(i);
      const vy = p.getY(i);
      const vz = p.getZ(i);
      const n = 0.82 + 0.3 * Math.sin(vx * 3.1 + idx) * Math.cos(vz * 2.9 - idx) + (r() - 0.5) * 0.08;
      p.setXYZ(i, vx * n, vy * n * 0.56, vz * n);
    }
    g.computeVertexNormals();
    return g;
  });

  const stoneCount = 26;
  for (let i = 0; i < stoneCount; i++) {
    const ang = (i / stoneCount) * Math.PI * 2 + (rand() - 0.5) * 0.22;
    // 留出面向草原中心的浅水饮水口，其余岸边自然堆叠大小不一的河石
    const dist = radiusAt(ang) * (0.94 + rand() * 0.16);
    const sx = Math.cos(ang) * dist;
    const sz = Math.sin(ang) * dist;
    const scale = 0.11 + Math.pow(rand(), 1.6) * 0.22;
    const mat = new THREE.MeshStandardMaterial({
      color: stonePalette[Math.floor(rand() * stonePalette.length)],
      roughness: isSnow ? 0.65 : 0.88,
      metalness: 0.04,
    });
    const stone = new THREE.Mesh(stoneGeos[i % stoneGeos.length], mat);
    stone.position.set(sx, scale * 0.26, sz);
    stone.scale.set(scale * (1.0 + rand() * 0.45), scale * (0.7 + rand() * 0.45), scale * (0.9 + rand() * 0.4));
    stone.rotation.set((rand() - 0.5) * 0.2, rand() * Math.PI * 2, (rand() - 0.5) * 0.2);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  // 5. 水面浮物与岸边水草/浮冰（随水流轻轻摇曳）
  const floaters = [];
  const reeds = [];

  if (isSnow) {
    // 极地冰湖：2 块漂浮小浮冰块
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xebf8ff,
      roughness: 0.22,
      clearcoat: 0.7,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 3; i++) {
      const a = 0.6 + i * 2.1;
      const d = radius * (0.3 + rand() * 0.25);
      const floe = new THREE.Mesh(new THREE.CylinderGeometry(0.22 + rand() * 0.16, 0.26 + rand() * 0.16, 0.07, 7), iceMat);
      floe.position.set(Math.cos(a) * d, 0.045, Math.sin(a) * d);
      floe.rotation.y = rand() * Math.PI;
      floe.receiveShadow = true;
      group.add(floe);
      floaters.push({ mesh: floe, baseY: 0.045, phase: rand() * Math.PI * 2 });
    }
  } else {
    // 温暖水潭：浮水荷叶 + 粉白睡莲 + 岸边摇曳芦苇/水草
    const padMat = new THREE.MeshStandardMaterial({ color: 0x4ca644, roughness: 0.65, side: THREE.DoubleSide });
    const petalMat = new THREE.MeshStandardMaterial({
      color: isDesert ? 0xfff5d6 : 0xffb3c6,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const centerMat = new THREE.MeshStandardMaterial({ color: 0xffd15c, roughness: 0.45 });

    const padCount = isDesert ? 3 : 6;
    for (let i = 0; i < padCount; i++) {
      const a = 0.4 + (i / padCount) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      const d = radius * (0.32 + rand() * 0.4);
      const pr = 0.14 + rand() * 0.1;
      // 带经典 V 形缺口的荷叶
      const padGeo = new THREE.CircleGeometry(pr, 16, 0.2, Math.PI * 1.88);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = rand() * Math.PI * 2;
      pad.position.set(Math.cos(a) * d, 0.044, Math.sin(a) * d);
      group.add(pad);
      floaters.push({ mesh: pad, baseY: 0.044, phase: rand() * Math.PI * 2 });

      if (i < 2) {
        const flower = new THREE.Group();
        flower.position.set(pad.position.x, 0.055, pad.position.z);
        for (let p = 0; p < 6; p++) {
          const pa = (p / 6) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.11, 5), petalMat);
          petal.position.set(Math.cos(pa) * 0.045, 0.035, Math.sin(pa) * 0.045);
          petal.rotation.z = -Math.cos(pa) * 0.55;
          petal.rotation.x = Math.sin(pa) * 0.55;
          flower.add(petal);
        }
        const stamen = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), centerMat);
        stamen.position.y = 0.045;
        flower.add(stamen);
        group.add(flower);
        floaters.push({ mesh: flower, baseY: 0.055, phase: floaters[floaters.length - 1].phase });
      }
    }

    // 岸边 4 丛摇曳水草与香蒲芦苇
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x518c3b, roughness: 0.78, side: THREE.DoubleSide });
    const cattailMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
    const clumpAngles = [0.25, 1.35, 2.55, 5.15];
    clumpAngles.forEach((baseA) => {
      const clump = new THREE.Group();
      const d = radiusAt(baseA) * 1.03;
      clump.position.set(Math.cos(baseA) * d, 0, Math.sin(baseA) * d);
      for (let b = 0; b < 7; b++) {
        const bh = 0.34 + rand() * 0.32;
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.022, bh, 4), bladeMat);
        blade.position.set((rand() - 0.5) * 0.22, bh * 0.48, (rand() - 0.5) * 0.22);
        blade.rotation.set((rand() - 0.5) * 0.32, rand() * Math.PI, (rand() - 0.5) * 0.32);
        clump.add(blade);
        if (b === 0 || b === 3) {
          const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.09, 4, 6), cattailMat);
          head.position.set(blade.position.x, bh * 0.82, blade.position.z);
          clump.add(head);
        }
      }
      group.add(clump);
      reeds.push({ group: clump, phase: rand() * Math.PI * 2 });
    });
  }

  return {
    group,
    waterMat,
    update(time) {
      waterMat.uniforms.uTime.value = time;
      for (const f of floaters) {
        f.mesh.position.y = f.baseY + Math.sin(time * 2.1 + f.phase) * 0.008;
      }
      for (const r of reeds) {
        r.group.rotation.z = Math.sin(time * 1.8 + r.phase) * 0.055;
      }
    },
  };
}
