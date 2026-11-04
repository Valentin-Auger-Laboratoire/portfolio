/* Laboratoire de cryptographie : moteur écrit à la main (sans bibliothèque).
   SHA-256, HMAC, PBKDF2, AES-128 (chiffrement par bloc, modes CBC et CTR, rembourrage PKCS#7),
   RSA (BigInt : génération des clés, chiffrement, signature), factorisation de petites clés (Pollard rho),
   et estimation de la force d'un mot de passe.
   Pédagogique : ces implémentations ne sont pas protégées contre les attaques par canaux auxiliaires
   (mesure du temps, etc.) et ne doivent pas servir à protéger de vraies données.
   Utilisable dans le navigateur (window.Crypto2) et avec Node (module.exports). */
(function (root, factory) {
  const M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  else root.Crypto2 = M;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Outils octets / texte / hexadécimal ----------
  const utf8 = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
  const fromUtf8 = (b) => (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }).decode(b) : Buffer.from(b).toString('utf8'));
  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  function fromHex(h) {
    h = h.replace(/\s+/g, '');
    if (h.length % 2 || /[^0-9a-f]/i.test(h)) throw new Error('hex');
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  const concat = (...arrs) => { const n = arrs.reduce((s, a) => s + a.length, 0), out = new Uint8Array(n); let o = 0; arrs.forEach((a) => { out.set(a, o); o += a.length; }); return out; };
  const bitsDiff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) { let x = a[i] ^ b[i]; while (x) { d += x & 1; x >>>= 1; } } return d; };

  // ---------- SHA-256 (FIPS 180-4) ----------
  const K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  // trace (facultatif) : reçoit l'état a..h après chaque tour du premier bloc
  function sha256(msg, trace) {
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const len = msg.length, bitLen = len * 8;
    // rembourrage : 1 bit, des zéros, puis la longueur sur 64 bits
    const total = Math.ceil((len + 9) / 64) * 64, m = new Uint8Array(total);
    m.set(msg); m[len] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000)); dv.setUint32(total - 4, bitLen >>> 0);
    const W = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        const T1 = (h + S1 + ch + K256[t] + W[t]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
        const T2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + T1) >>> 0; d = c; c = b; b = a; a = (T1 + T2) >>> 0;
        if (trace && off === 0) trace.push({ t, W: W[t], state: [a, b, c, d, e, f, g, h] });
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const out = new Uint8Array(32), ov = new DataView(out.buffer);
    H.forEach((v, i) => ov.setUint32(i * 4, v));
    return out;
  }
  function hmacSha256(key, msg) {
    if (key.length > 64) key = sha256(key);
    const k = new Uint8Array(64); k.set(key);
    const ipad = k.map((x) => x ^ 0x36), opad = k.map((x) => x ^ 0x5c);
    return sha256(concat(opad, sha256(concat(ipad, msg))));
  }
  // PBKDF2-HMAC-SHA256 (RFC 8018)
  function pbkdf2(password, salt, iterations, dkLen) {
    const blocks = Math.ceil(dkLen / 32), out = new Uint8Array(blocks * 32);
    for (let i = 1; i <= blocks; i++) {
      let u = hmacSha256(password, concat(salt, Uint8Array.of(i >>> 24, (i >>> 16) & 255, (i >>> 8) & 255, i & 255)));
      const t = u.slice();
      for (let k = 1; k < iterations; k++) { u = hmacSha256(password, u); for (let j = 0; j < 32; j++) t[j] ^= u[j]; }
      out.set(t, (i - 1) * 32);
    }
    return out.slice(0, dkLen);
  }

  // ---------- AES-128 (FIPS 197) ----------
  // boîte S calculée (inverse dans GF(2^8) puis transformation affine), pas recopiée d'une table
  const SBOX = new Uint8Array(256), INV = new Uint8Array(256);
  const xtime = (x) => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;
  const gmul = (a, b) => { let r = 0; while (b) { if (b & 1) r ^= a; a = xtime(a); b >>= 1; } return r; };
  (function buildSbox() {
    for (let x = 0; x < 256; x++) {
      let inv = 0;
      if (x) for (let y = 1; y < 256; y++) if (gmul(x, y) === 1) { inv = y; break; }
      let s = inv;
      for (let i = 1; i <= 4; i++) s ^= ((inv << i) | (inv >> (8 - i))) & 0xff;
      SBOX[x] = s ^ 0x63; INV[SBOX[x]] = x;
    }
  })();
  function expandKey(key) {
    const w = new Uint8Array(176); w.set(key);
    let rcon = 1;
    for (let i = 16; i < 176; i += 4) {
      let t = w.slice(i - 4, i);
      if (i % 16 === 0) { t = Uint8Array.of(SBOX[t[1]] ^ rcon, SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]); rcon = xtime(rcon); }
      for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
    }
    return w;
  }
  // état : 16 octets, colonne par colonne (s[r + 4c])
  const addRoundKey = (s, w, r) => { for (let i = 0; i < 16; i++) s[i] ^= w[r * 16 + i]; };
  const subBytes = (s, box) => { for (let i = 0; i < 16; i++) s[i] = box[s[i]]; };
  function shiftRows(s, inv) {
    const t = s.slice();
    for (let r = 1; r < 4; r++) for (let c = 0; c < 4; c++) s[r + 4 * c] = t[r + 4 * ((c + (inv ? -r + 4 : r)) % 4)];
  }
  function mixColumns(s, inv) {
    const m = inv ? [14, 11, 13, 9] : [2, 3, 1, 1];
    for (let c = 0; c < 4; c++) {
      const a = s.slice(4 * c, 4 * c + 4);
      for (let r = 0; r < 4; r++) s[4 * c + r] = gmul(a[0], m[(4 - r) % 4]) ^ gmul(a[1], m[(5 - r) % 4]) ^ gmul(a[2], m[(6 - r) % 4]) ^ gmul(a[3], m[(7 - r) % 4]);
    }
  }
  // trace (facultatif) : état après chaque étape
  function aesEncryptBlock(block, w, trace) {
    const s = Uint8Array.from(block); // copie (un Buffer de Node partagerait sa mémoire avec slice)
    const log = (step, r) => trace && trace.push({ r, step, state: s.slice() });
    log('input', 0);
    addRoundKey(s, w, 0); log('addRoundKey', 0);
    for (let r = 1; r <= 10; r++) {
      subBytes(s, SBOX); log('subBytes', r);
      shiftRows(s, false); log('shiftRows', r);
      if (r < 10) { mixColumns(s, false); log('mixColumns', r); }
      addRoundKey(s, w, r); log('addRoundKey', r);
    }
    return s;
  }
  function aesDecryptBlock(block, w) {
    const s = Uint8Array.from(block);
    addRoundKey(s, w, 10);
    for (let r = 9; r >= 0; r--) {
      shiftRows(s, true); subBytes(s, INV); addRoundKey(s, w, r);
      if (r > 0) mixColumns(s, true);
    }
    return s;
  }
  const pad = (b) => { const n = 16 - (b.length % 16); return concat(b, new Uint8Array(n).fill(n)); };
  function unpad(b) {
    const n = b[b.length - 1];
    if (!n || n > 16 || n > b.length) throw new Error('padding');
    for (let i = b.length - n; i < b.length; i++) if (b[i] !== n) throw new Error('padding');
    return b.slice(0, b.length - n);
  }
  function aesCbcEncrypt(key, iv, data) {
    const w = expandKey(key), p = pad(data), out = new Uint8Array(p.length);
    let prev = iv;
    for (let o = 0; o < p.length; o += 16) {
      const blk = p.slice(o, o + 16).map((x, i) => x ^ prev[i]);
      prev = aesEncryptBlock(blk, w); out.set(prev, o);
    }
    return out;
  }
  function aesCbcDecrypt(key, iv, data) {
    if (data.length % 16) throw new Error('length');
    const w = expandKey(key), out = new Uint8Array(data.length);
    let prev = iv;
    for (let o = 0; o < data.length; o += 16) {
      const c = data.slice(o, o + 16), p = aesDecryptBlock(c, w).map((x, i) => x ^ prev[i]);
      out.set(p, o); prev = c;
    }
    return unpad(out);
  }
  // CTR : compteur de 128 bits (gros-boutiste), le flux de clé est XORé au message, pas de rembourrage
  function aesCtr(key, counter, data) {
    const w = expandKey(key), out = new Uint8Array(data.length), ctr = Uint8Array.from(counter);
    for (let o = 0; o < data.length; o += 16) {
      const ks = aesEncryptBlock(ctr, w);
      for (let i = 0; i < 16 && o + i < data.length; i++) out[o + i] = data[o + i] ^ ks[i];
      for (let i = 15; i >= 0; i--) { ctr[i] = (ctr[i] + 1) & 255; if (ctr[i]) break; }
    }
    return out;
  }

  // ---------- RSA (BigInt) ----------
  const big = (x) => BigInt(x);
  function modPow(b, e, m) { let r = 1n; b %= m; if (b < 0n) b += m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; }
  function egcd(a, b) { let [r0, r1, s0, s1, t0, t1] = [a, b, 1n, 0n, 0n, 1n]; while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; [t0, t1] = [t1, t0 - q * t1]; } return [r0, s0, t0]; }
  function modInv(a, m) { const [g, x] = egcd(((a % m) + m) % m, m); if (g !== 1n) throw new Error('not invertible'); return ((x % m) + m) % m; }
  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a < 0n ? -a : a; };
  // générateur de nombres aléatoires : celui du navigateur si possible, sinon un générateur déterministe (tests)
  function randomBytes(n, rng) {
    if (rng) return Uint8Array.from({ length: n }, () => rng() & 255);
    const b = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
    else require('crypto').randomFillSync(b);
    return b;
  }
  function randomBig(bits, rng) {
    const bytes = randomBytes(Math.ceil(bits / 8), rng);
    let x = 0n; for (const v of bytes) x = (x << 8n) | big(v);
    const extra = bytes.length * 8 - bits;
    return x >> big(extra);
  }
  const SMALL_PRIMES = [3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97].map(big);
  // test de Miller-Rabin
  function isProbablePrime(n, rounds = 24, rng) {
    if (n < 2n) return false;
    for (const p of [2n, ...SMALL_PRIMES]) { if (n === p) return true; if (n % p === 0n) return false; }
    let d = n - 1n, s = 0;
    while (!(d & 1n)) { d >>= 1n; s++; }
    const bits = n.toString(2).length;
    for (let i = 0; i < rounds; i++) {
      const a = 2n + (randomBig(bits, rng) % (n - 3n));
      let x = modPow(a, d, n);
      if (x === 1n || x === n - 1n) continue;
      let comp = true;
      for (let r = 1; r < s; r++) { x = (x * x) % n; if (x === n - 1n) { comp = false; break; } }
      if (comp) return false;
    }
    return true;
  }
  function randomPrime(bits, rng) {
    for (;;) {
      let p = randomBig(bits, rng) | (1n << big(bits - 1)) | (1n << big(bits - 2)) | 1n; // deux bits de poids fort : n a bien 2·bits bits
      if (isProbablePrime(p, 24, rng)) return p;
    }
  }
  function rsaKeygen(bits, rng, e = 65537n) {
    for (;;) {
      const p = randomPrime(bits / 2, rng), q = randomPrime(bits / 2, rng);
      if (p === q) continue;
      const phi = (p - 1n) * (q - 1n);
      if (gcd(e, phi) !== 1n) continue;
      const d = modInv(e, phi), n = p * q;
      return { n, e, d, p, q, phi, bits: n.toString(2).length };
    }
  }
  const bytesToBig = (b) => { let x = 0n; for (const v of b) x = (x << 8n) | big(v); return x; };
  const bigToBytes = (x) => { const out = []; while (x > 0n) { out.unshift(Number(x & 255n)); x >>= 8n; } return Uint8Array.from(out); };
  // « RSA manuel » sans rembourrage (pédagogique : dans la vraie vie on utilise OAEP)
  const rsaEncrypt = (m, k) => { if (m >= k.n) throw new Error('message trop long pour la clé'); return modPow(m, k.e, k.n); };
  const rsaDecrypt = (c, k) => modPow(c, k.d, k.n);
  // signature : on signe le haché SHA-256 réduit modulo n
  const rsaSign = (msg, k) => modPow(bytesToBig(sha256(msg)) % k.n, k.d, k.n);
  const rsaVerify = (msg, sig, k) => modPow(sig, k.e, k.n) === bytesToBig(sha256(msg)) % k.n;
  // Pollard rho (Brent) : factorise une petite clé, limité en nombre d'itérations
  function pollardRho(n, maxIter = 2e6) {
    if (n % 2n === 0n) return { factor: 2n, iters: 1 };
    for (let c = 1n; c < 20n; c++) {
      let x = 2n, y = 2n, d = 1n, it = 0;
      const f = (v) => (v * v + c) % n;
      while (d === 1n && it < maxIter) {
        x = f(x); y = f(f(y)); it++;
        d = gcd(x > y ? x - y : y - x, n);
      }
      if (d !== 1n && d !== n) return { factor: d, iters: it };
      if (it >= maxIter) return null;
    }
    return null;
  }

  // ---------- Mots de passe ----------
  const COMMON = ['123456', 'password', '123456789', '12345678', '12345', 'qwerty', 'azerty', 'motdepasse', 'password1', '111111', '123123', 'abc123', '000000', 'iloveyou', 'admin', 'soleil', 'bonjour', 'doudou', 'chouchou', 'loulou', 'marseille', 'football', 'welcome', 'monkey', 'dragon', 'sunshine', 'qwertyuiop', 'azertyuiop', '1234', '654321', 'letmein', 'princess', 'master', 'superman', 'nicolas', 'camille', 'julien', 'thomas', 'jordan', 'michael'];
  // Estimation simple : taille de l'alphabet utilisé ^ longueur, avec pénalités (mot courant, répétitions, suites)
  function passwordStrength(pw) {
    let pool = 0;
    if (/[a-z]/.test(pw)) pool += 26;
    if (/[A-Z]/.test(pw)) pool += 26;
    if (/[0-9]/.test(pw)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
    const lower = pw.toLowerCase();
    const flags = [];
    let bits = pw.length ? pw.length * Math.log2(Math.max(pool, 1)) : 0;
    if (COMMON.includes(lower) || COMMON.some((c) => c.length >= 5 && lower.includes(c))) { flags.push('common'); bits = Math.min(bits, 10); }
    if (/(.)\1{2,}/.test(pw)) { flags.push('repeat'); bits -= 6; }
    const seq = '0123456789abcdefghijklmnopqrstuvwxyz', kb = 'azertyuiopqsdfghjklmwxcvbnqwertyuiopasdfghjklzxcvbnm';
    for (let i = 0; i + 4 <= lower.length; i++) { const s = lower.substr(i, 4); if (seq.includes(s) || kb.includes(s)) { flags.push('sequence'); bits -= 8; break; } }
    if (/^[A-Z]?[a-z]+[0-9]{1,4}[!?.]?$/.test(pw)) { flags.push('pattern'); bits -= 6; }
    // phrase de passe en mots courants : on compte environ 11 bits par mot (liste de 2 048 mots)
    if (/^[a-zà-ÿ]+([ \-_.][a-zà-ÿ]+)+$/.test(lower) && !flags.includes('common')) { const nw = lower.split(/[ \-_.]/).length; bits = Math.min(bits, nw * 11); flags.push('words'); }
    if (pw.length && pw.length < 8) flags.push('short');
    bits = Math.max(0, bits);
    return { bits, pool, flags, guesses: Math.pow(2, bits) };
  }
  // vitesses d'attaque (essais par seconde), ordres de grandeur pour une carte graphique récente
  const SPEEDS = { online: 10, bcrypt: 2e4, pbkdf2: 1e6, sha256: 1e10, md5: 1e11 };
  const crackSeconds = (guesses, speed) => guesses / 2 / speed; // en moyenne, la moitié de l'espace

  return {
    utf8, fromUtf8, toHex, fromHex, concat, bitsDiff,
    sha256, hmacSha256, pbkdf2,
    SBOX, INV, expandKey, aesEncryptBlock, aesDecryptBlock, aesCbcEncrypt, aesCbcDecrypt, aesCtr, pad, unpad, gmul,
    modPow, modInv, egcd, gcd, isProbablePrime, randomPrime, rsaKeygen, rsaEncrypt, rsaDecrypt, rsaSign, rsaVerify, bytesToBig, bigToBytes, pollardRho, randomBytes,
    passwordStrength, SPEEDS, crackSeconds, COMMON,
  };
});
