// =====================================================================
//  Rendu WebGL écrit à la main (sans bibliothèque 3D)
//  - fond : image de la caméra (texture), en miroir pour la caméra avant
//  - pièces : éclairage diffus + spéculaire, ou style « hologramme »
//    (bord lumineux selon l'angle de vue, lignes de balayage, transparence)
//  - lignes : tapis quadrillé, boîte de sélection
//  - stéréo : deux vues côte à côte décalées de l'écart des yeux (casque à téléphone)
// =====================================================================
import { m4, q4, v3 } from './m3d.js';

const VS_MAILLAGE = `
attribute vec3 aPos; attribute vec3 aNor;
uniform mat4 uModele, uVue, uProj;
varying vec3 vNor; varying vec3 vMonde; varying float vY;
void main() {
  vec4 m = uModele * vec4(aPos, 1.0);
  vMonde = m.xyz; vY = aPos.y;
  vNor = normalize(mat3(uModele) * aNor);
  gl_Position = uProj * uVue * m;
}`;
const FS_MAILLAGE = `
precision mediump float;
varying vec3 vNor; varying vec3 vMonde; varying float vY;
uniform vec3 uCouleur, uOeil; uniform float uHolo, uSurbrillance, uTemps, uAlpha;
void main() {
  vec3 n = normalize(vNor); vec3 v = normalize(uOeil - vMonde);
  if (dot(n, v) < 0.0) n = -n;                      // pièces mal orientées : on éclaire quand même
  vec3 l = normalize(vec3(0.35, 0.8, 0.5));
  float diff = max(dot(n, l), 0.0), spec = pow(max(dot(reflect(-l, n), v), 0.0), 28.0);
  vec3 plein = uCouleur * (0.28 + 0.72 * diff) + vec3(0.35) * spec;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);
  float lignes = 0.75 + 0.25 * step(0.5, fract(vMonde.y * 140.0 - uTemps * 0.6));
  vec3 holo = uCouleur * (0.18 + 0.5 * diff) * lignes + uCouleur * fres * 1.4;
  vec3 c = mix(plein, holo, uHolo) + vec3(0.35, 0.25, 0.25) * uSurbrillance * (0.4 + fres);
  float a = mix(uAlpha, (0.35 + 0.65 * fres) * uAlpha, uHolo);
  gl_FragColor = vec4(c, a);
}`;
const VS_FOND = `
attribute vec2 aPos; varying vec2 vUV; uniform vec4 uRecadre; uniform float uMiroir;
void main() {
  vec2 uv = aPos * 0.5 + 0.5; uv.y = 1.0 - uv.y;
  uv = uRecadre.xy + uv * uRecadre.zw;
  if (uMiroir > 0.5) uv.x = 1.0 - uv.x;
  vUV = uv; gl_Position = vec4(aPos, 0.0, 1.0);
}`;
const FS_FOND = `
precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform float uSombre;
void main() { gl_FragColor = vec4(texture2D(uTex, vUV).rgb * uSombre, 1.0); }`;
const VS_LIGNE = `attribute vec3 aPos; uniform mat4 uVue, uProj, uModele; void main() { gl_Position = uProj * uVue * uModele * vec4(aPos, 1.0); }`;
const FS_LIGNE = `precision mediump float; uniform vec4 uCouleur; void main() { gl_FragColor = uCouleur; }`;

function programme(gl, vs, fs) {
  const c = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, c(gl.VERTEX_SHADER, vs)); gl.attachShader(p, c(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, a = {};
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
  for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i++) { const n = gl.getActiveAttrib(p, i).name; a[n] = gl.getAttribLocation(p, n); }
  return { p, u, a };
}

export function creerRendu(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL indisponible');
  const PM = programme(gl, VS_MAILLAGE, FS_MAILLAGE), PF = programme(gl, VS_FOND, FS_FOND), PL = programme(gl, VS_LIGNE, FS_LIGNE);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach((k) => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const tampons = new WeakMap();
  const ligneTampon = new Map();

  function tampon(maillage) {
    let t = tampons.get(maillage);
    if (!t) {
      t = { pos: gl.createBuffer(), nor: gl.createBuffer(), n: maillage.positions.length / 3 };
      gl.bindBuffer(gl.ARRAY_BUFFER, t.pos); gl.bufferData(gl.ARRAY_BUFFER, maillage.positions, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.nor); gl.bufferData(gl.ARRAY_BUFFER, maillage.normales, gl.STATIC_DRAW);
      tampons.set(maillage, t);
    }
    return t;
  }
  function lignes(cle, pts) {
    let t = ligneTampon.get(cle);
    if (!t) { t = { b: gl.createBuffer(), n: pts.length / 3 }; gl.bindBuffer(gl.ARRAY_BUFFER, t.b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW); ligneTampon.set(cle, t); }
    return t;
  }
  // tapis quadrillé (1 m x 1 m, pas de 5 cm) et cube unité en fil de fer
  const tapis = []; for (let i = -10; i <= 10; i++) { const x = i * 0.05; tapis.push(x, 0, -0.5, x, 0, 0.5, -0.5, 0, x, 0.5, 0, x); }
  const arêtes = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  const coin = (i) => [(i & 1) ? 0.5 : -0.5, (i & 2) ? 0.5 : -0.5, (i & 4) ? 0.5 : -0.5];
  const fil = []; arêtes.forEach(([a, b]) => fil.push(...coin(a), ...coin(b)));

  let videoPrete = false;
  function majVideo(video) {
    if (!video || video.readyState < 2) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); videoPrete = true; } catch (e) {}
  }

  // vue : { x, y, l, h } en pixels du canvas ; cam : { oeil, q, fov } ; scene : { objets, tapis, temps }
  function dessinerVue(vp, cam, scene, opts) {
    gl.viewport(vp.x, vp.y, vp.l, vp.h);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(vp.x, vp.y, vp.l, vp.h);
    gl.clearColor(0.05, 0.055, 0.07, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // fond caméra : recadré pour garder ses proportions dans la vue
    if (opts.video && videoPrete) {
      const ar = vp.l / vp.h, va = opts.video.videoWidth / opts.video.videoHeight;
      const rec = ar > va ? [0, (1 - va / ar) / 2, 1, va / ar] : [(1 - ar / va) / 2, 0, ar / va, 1];
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
      gl.useProgram(PF.p); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(PF.a.aPos); gl.vertexAttribPointer(PF.a.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.uniform4fv(PF.u.uRecadre, rec); gl.uniform1f(PF.u.uMiroir, opts.miroir ? 1 : 0); gl.uniform1f(PF.u.uSombre, opts.sombre ?? 0.75);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(PF.u.uTex, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    const proj = m4.perspective(cam.fov, vp.l / vp.h, 0.02, 50), vue = m4.vue(cam.oeil, cam.q);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    // tapis
    if (scene.tapis) {
      gl.useProgram(PL.p); const t = lignes('tapis', tapis);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.b); gl.enableVertexAttribArray(PL.a.aPos); gl.vertexAttribPointer(PL.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(PL.u.uVue, false, vue); gl.uniformMatrix4fv(PL.u.uProj, false, proj);
      gl.uniformMatrix4fv(PL.u.uModele, false, m4.trs(scene.tapis.pos, scene.tapis.q || q4.id(), scene.tapis.taille || 1));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform4fv(PL.u.uCouleur, scene.tapis.couleur || [0.55, 0.85, 1, 0.22]); gl.drawArrays(gl.LINES, 0, t.n);
    }
    // pièces : opaques d'abord, puis hologrammes (mélange additif, sans écrire la profondeur)
    const ordre = [...scene.objets].sort((a, b) => (a.holo ? 1 : 0) - (b.holo ? 1 : 0));
    gl.useProgram(PM.p);
    gl.uniformMatrix4fv(PM.u.uVue, false, vue); gl.uniformMatrix4fv(PM.u.uProj, false, proj);
    gl.uniform3fv(PM.u.uOeil, cam.oeil); gl.uniform1f(PM.u.uTemps, scene.temps || 0);
    for (const o of ordre) {
      const t = tampon(o.maillage);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.pos); gl.enableVertexAttribArray(PM.a.aPos); gl.vertexAttribPointer(PM.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.nor); gl.enableVertexAttribArray(PM.a.aNor); gl.vertexAttribPointer(PM.a.aNor, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(PM.u.uModele, false, m4.trs(o.pos, o.q, o.echelle));
      gl.uniform3fv(PM.u.uCouleur, o.couleur); gl.uniform1f(PM.u.uHolo, o.holo ? 1 : 0);
      gl.uniform1f(PM.u.uSurbrillance, o.surbrillance || 0); gl.uniform1f(PM.u.uAlpha, o.alpha ?? 1);
      if (o.holo || (o.alpha ?? 1) < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, o.holo ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      else { gl.disable(gl.BLEND); gl.depthMask(true); }
      gl.drawArrays(gl.TRIANGLES, 0, t.n);
      gl.depthMask(true);
    }
    // boîte de sélection
    gl.useProgram(PL.p); gl.uniformMatrix4fv(PL.u.uVue, false, vue); gl.uniformMatrix4fv(PL.u.uProj, false, proj);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    for (const o of scene.objets) if (o.cadre) {
      const t = lignes('fil', fil), b = o.maillage.boite;
      const centre = v3.mul(v3.add(b.min, b.max), 0.5), dims = v3.sub(b.max, b.min);
      const M = m4.mul(m4.trs(o.pos, o.q, o.echelle), [dims[0] * 1.04, 0, 0, 0, 0, dims[1] * 1.04, 0, 0, 0, 0, dims[2] * 1.04, 0, centre[0], centre[1], centre[2], 1]);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.b); gl.enableVertexAttribArray(PL.a.aPos); gl.vertexAttribPointer(PL.a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(PL.u.uModele, false, M); gl.uniform4fv(PL.u.uCouleur, o.cadre); gl.drawArrays(gl.LINES, 0, t.n);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  // stereo : 0 = une vue ; sinon écart des yeux en mètres (vue gauche / vue droite côte à côte)
  function dessiner(cam, scene, opts = {}) {
    const W = canvas.width, H = canvas.height;
    if (!opts.stereo) { dessinerVue({ x: 0, y: 0, l: W, h: H }, cam, scene, opts); return; }
    const d = v3.mul(q4.tourner(cam.q, [1, 0, 0]), opts.stereo / 2), l = Math.floor(W / 2);
    dessinerVue({ x: 0, y: 0, l, h: H }, { ...cam, oeil: v3.sub(cam.oeil, d) }, scene, opts);
    dessinerVue({ x: l, y: 0, l: W - l, h: H }, { ...cam, oeil: v3.add(cam.oeil, d) }, scene, opts);
  }

  return { gl, dessiner, majVideo };
}
