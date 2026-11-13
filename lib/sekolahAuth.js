import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'crypto';

export const MASA_TOKEN_JAM = 12;
export const BATAS_SALAH = 5;
export const JEDA_MENIT = 5;

// Tanpa huruf/angka yang mirip (0 O 1 l I).
const HURUF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const npsnValid = (s) => /^[0-9]{8}$/.test(String(s || ''));

export function buatSandi() {
  const b = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += HURUF[b[i] % HURUF.length];
  return s;
}

const hitung = (sandi, garam) =>
  new Promise((ok, gagal) => scrypt(sandi, garam, 32, (e, k) => (e ? gagal(e) : ok(k))));

export async function hashSandi(sandi) {
  const garam = randomBytes(16);
  const k = await hitung(String(sandi), garam);
  return `s1$${garam.toString('hex')}$${k.toString('hex')}`;
}

export async function cekSandi(sandi, tersimpan) {
  try {
    const [v, g, h] = String(tersimpan || '').split('$');
    if (v !== 's1' || !g || !h) return false;
    const k = await hitung(String(sandi), Buffer.from(g, 'hex'));
    const asli = Buffer.from(h, 'hex');
    return k.length === asli.length && timingSafeEqual(k, asli);
  } catch {
    return false;
  }
}

const b64 = (s) => Buffer.from(s).toString('base64url');
const tanda = (isi, rahasia) => createHmac('sha256', rahasia).update(isi).digest('hex');

export function buatToken(npsn, rahasia) {
  const exp = Date.now() + MASA_TOKEN_JAM * 3600 * 1000;
  const isi = b64(`${npsn}.${exp}`);
  return `${isi}.${tanda(isi, rahasia)}`;
}

// Mengembalikan NPSN bila token sah dan belum kedaluwarsa, selain itu null.
export function bacaToken(token, rahasia) {
  try {
    if (!rahasia || typeof token !== 'string') return null;
    const [isi, ttd] = token.split('.');
    if (!isi || !ttd) return null;
    const benar = Buffer.from(tanda(isi, rahasia));
    const ada = Buffer.from(ttd);
    if (benar.length !== ada.length || !timingSafeEqual(benar, ada)) return null;
    const [npsn, exp] = Buffer.from(isi, 'base64url').toString().split('.');
    if (!npsnValid(npsn) || !(Number(exp) > Date.now())) return null;
    return npsn;
  } catch {
    return null;
  }
}

export function npsnDariRequest(request) {
  return bacaToken(request.headers.get('x-sekolah-token') || '', process.env.SEKOLAH_RAHASIA);
}
