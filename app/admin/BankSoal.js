'use client';
import { useEffect, useState } from 'react';
import Teks from './Teks';

const kotak = { backgroundColor: '#f7fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' };
const isian = { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px', boxSizing: 'border-box' };
const tombol = (warna, mati) => ({
  backgroundColor: mati ? '#a0aec0' : warna, color: '#fff', border: 'none', padding: '7px 14px',
  borderRadius: '6px', cursor: mati ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px',
});
const NAMA_TIPE = { PG: 'Pilihan ganda', PG_KOMPLEKS: 'PG kompleks', BENAR_SALAH: 'Benar-salah', JODOH: 'Menjodohkan' };

const tanggal = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' }) : '');

// Mengubah kunci dari database menjadi bentuk yang mudah diedit.
function kunciEditor(s) {
  const k = s.kunci;
  if (s.tipe === 'PG') return Array.isArray(k) ? String(k[0] ?? '') : String(k ?? '');
  if (s.tipe === 'PG_KOMPLEKS') return Array.isArray(k) ? [...k] : [];
  if (s.tipe === 'BENAR_SALAH') {
    const n = Array.isArray(s.opsi) ? s.opsi.length : 0;
    return Array.from({ length: n }, (_, i) => Array.isArray(k) && (k[i] === true || k[i] === 'B' || k[i] === 'true'));
  }
  return null;
}

function ringkasKunci(s) {
  const k = kunciEditor(s);
  if (s.tipe === 'PG') return k || '-';
  if (s.tipe === 'PG_KOMPLEKS') return k.length ? k.join(', ') : '-';
  if (s.tipe === 'BENAR_SALAH') return k.map((x) => (x ? 'B' : 'S')).join(', ');
  return '(pasangan)';
}

export default function BankSoal({ sandi, onKeluar }) {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [info, setInfo] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const [mapelId, setMapelId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [cari, setCari] = useState('');
  const [cariAktif, setCariAktif] = useState('');
  const [offset, setOffset] = useState(0);

  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tampilBatch, setTampilBatch] = useState(false);

  const panggil = async (metode, alamat, isi) => {
    const headers = { 'x-admin-password': sandi };
    if (isi) headers['Content-Type'] = 'application/json';
    const res = await fetch(alamat, { method: metode, headers, body: isi ? JSON.stringify(isi) : undefined, cache: 'no-store' });
    let json = {};
    try { json = await res.json(); } catch { /* bukan JSON */ }
    if (res.status === 401) { onKeluar(); return { res, json, keluar: true }; }
    return { res, json, keluar: false };
  };

  const muat = async (o = offset) => {
    const p = new URLSearchParams();
    if (mapelId) p.set('mapel_id', mapelId);
    if (batchId) p.set('batch_id', batchId);
    if (cariAktif) p.set('q', cariAktif);
    p.set('offset', String(o));
    try {
      const { res, json, keluar } = await panggil('GET', `/api/admin/soal?${p.toString()}`);
      if (keluar) return;
      if (!res.ok) { setGalat(json.pesan || 'Gagal memuat bank soal.'); return; }
      setGalat('');
      setData(json);
    } catch {
      setGalat('Tidak bisa menghubungi server. Periksa koneksi internet.');
    }
  };

  useEffect(() => { muat(offset); }, [mapelId, batchId, cariAktif, offset]);

  const kirim = async (body, pesan) => {
    setGalat(''); setInfo(''); setSibuk(true);
    try {
      const { res, json, keluar } = await panggil('POST', '/api/admin/soal', body);
      if (keluar) return false;
      if (!res.ok) { setGalat(json.pesan || 'Terjadi kesalahan.'); return false; }
      if (pesan) setInfo(typeof pesan === 'function' ? pesan(json) : pesan);
      await muat(offset);
      return true;
    } catch {
      setGalat('Tidak bisa menghubungi server. Perubahan belum tersimpan.');
      return false;
    } finally {
      setSibuk(false);
    }
  };

  const mulaiEdit = (s) => {
    const opsiTeks = {};
    if (Array.isArray(s.opsi)) s.opsi.forEach((o) => { opsiTeks[o.k] = o.teks; });
    setDraft({
      pertanyaan: s.pertanyaan || '',
      opsiTeks,
      kunci: kunciEditor(s),
      skor: String(s.skor ?? 1),
      pembahasan: s.pembahasan || '',
      isi: s.stimulus ? s.stimulus.isi || '' : '',
      url: s.stimulus ? s.stimulus.url_gambar || '' : '',
    });
    setEditId(s.id);
    setGalat(''); setInfo('');
  };

  const simpanEdit = async (s) => {
    const edit = ['PG', 'PG_KOMPLEKS', 'BENAR_SALAH'].includes(s.tipe);
    const body = { aksi: 'ubah', id: s.id, pertanyaan: draft.pertanyaan, skor: draft.skor, pembahasan: draft.pembahasan };
    if (edit) { body.opsi_teks = draft.opsiTeks; body.kunci = draft.kunci; }
    const ok = await kirim(body, null);
    if (!ok) return;
    if (s.stimulus && (draft.isi !== (s.stimulus.isi || '') || draft.url !== (s.stimulus.url_gambar || ''))) {
      const ok2 = await kirim({ aksi: 'ubah_stimulus', id: s.stimulus.id, isi: draft.isi, url_gambar: draft.url }, null);
      if (!ok2) return;
    }
    setInfo(`Soal #${s.id} disimpan.`);
    setEditId(null);
    setDraft(null);
  };

  const hapusSoal = (s) => {
    if (!confirm(`Hapus soal #${s.id} secara permanen?\n\n"${String(s.pertanyaan).slice(0, 120)}"\n\nKunci dan pembahasannya ikut terhapus.`)) return;
    kirim({ aksi: 'hapus', id: s.id }, `Soal #${s.id} dihapus.`);
  };

  const hapusBatch = (b) => {
    const ketik = prompt(
      `Hapus SEMUA ${b.jumlah} soal dari file impor "${b.nama_file || '#' + b.id}" (batch #${b.id})?\n\nSoal, kunci, dan bacaan dari file ini ikut terhapus dan tidak bisa dikembalikan. Hanya bisa jika belum dipakai di ujian mana pun.\n\nKetik HAPUS (huruf besar) untuk melanjutkan:`
    );
    if (ketik === null) return;
    if (ketik.trim() !== 'HAPUS') { setGalat('Penghapusan dibatalkan: kata HAPUS tidak diketik dengan benar.'); return; }
    if (String(batchId) === String(b.id)) setBatchId('');
    kirim({ aksi: 'hapus_batch', batch_id: b.id }, (j) => `${j.dihapus} soal dari file impor #${b.id} dihapus.`);
  };

  const namaMapel = Object.fromEntries((data?.mapel || []).map((m) => [m.id, m.nama]));
  const total = data?.total || 0;
  const perHalaman = data?.per_halaman || 50;

  const ubahDraft = (bagian) => setDraft((d) => ({ ...d, ...bagian }));

  const editor = (s) => {
    if (!draft) return null;
    const edit = ['PG', 'PG_KOMPLEKS', 'BENAR_SALAH'].includes(s.tipe);
    return (
      <div style={{ marginTop: '10px', borderTop: '1px dashed #cbd5e0', paddingTop: '10px' }}>
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4a5568' }}>Pertanyaan</label>
        <textarea value={draft.pertanyaan} onChange={(e) => ubahDraft({ pertanyaan: e.target.value })} rows={3} style={{ ...isian, width: '100%', marginBottom: '8px' }} />

        {edit && Array.isArray(s.opsi) && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#4a5568', marginBottom: '4px' }}>
              {s.tipe === 'PG' && 'Pilihan (tandai satu kunci yang benar)'}
              {s.tipe === 'PG_KOMPLEKS' && 'Pilihan (centang semua kunci yang benar)'}
              {s.tipe === 'BENAR_SALAH' && 'Pernyataan (tentukan Benar atau Salah)'}
            </div>
            {s.opsi.map((o, i) => (
              <div key={o.k} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
                {s.tipe === 'PG' && (
                  <input type="radio" name={`kunci-${s.id}`} checked={draft.kunci === o.k} onChange={() => ubahDraft({ kunci: o.k })} style={{ marginTop: '10px' }} />
                )}
                {s.tipe === 'PG_KOMPLEKS' && (
                  <input
                    type="checkbox"
                    checked={Array.isArray(draft.kunci) && draft.kunci.includes(o.k)}
                    onChange={(e) => ubahDraft({ kunci: e.target.checked ? [...draft.kunci, o.k] : draft.kunci.filter((x) => x !== o.k) })}
                    style={{ marginTop: '10px' }}
                  />
                )}
                {s.tipe !== 'BENAR_SALAH' && <b style={{ marginTop: '7px', width: '18px' }}>{o.k}</b>}
                <textarea
                  value={draft.opsiTeks[o.k] ?? ''}
                  onChange={(e) => ubahDraft({ opsiTeks: { ...draft.opsiTeks, [o.k]: e.target.value } })}
                  rows={2}
                  style={{ ...isian, flex: 1 }}
                />
                {s.tipe === 'BENAR_SALAH' && (
                  <select
                    value={draft.kunci[i] ? 'B' : 'S'}
                    onChange={(e) => ubahDraft({ kunci: draft.kunci.map((x, j) => (j === i ? e.target.value === 'B' : x)) })}
                    style={{ ...isian, width: '90px' }}
                  >
                    <option value="B">Benar</option>
                    <option value="S">Salah</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
        {!edit && (
          <div style={{ fontSize: '12px', color: '#c05621', marginBottom: '8px' }}>
            Pilihan dan kunci untuk tipe soal ini belum bisa diubah dari sini. Pertanyaan, skor, dan pembahasan tetap bisa diubah.
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4a5568', display: 'block' }}>Skor</label>
            <input type="number" min="0" step="any" value={draft.skor} onChange={(e) => ubahDraft({ skor: e.target.value })} style={{ ...isian, width: '90px' }} />
          </div>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4a5568', display: 'block' }}>Pembahasan</label>
            <textarea value={draft.pembahasan} onChange={(e) => ubahDraft({ pembahasan: e.target.value })} rows={2} style={{ ...isian, width: '100%' }} />
          </div>
        </div>

        {s.stimulus && (
          <div style={{ backgroundColor: '#fffaf0', border: '1px solid #fbd38d', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#c05621', marginBottom: '4px' }}>
              Bacaan / gambar (kode {s.stimulus.kode || s.stimulus.id}). Perubahan ini berlaku untuk semua soal yang memakai bacaan yang sama.
            </div>
            <textarea value={draft.isi} onChange={(e) => ubahDraft({ isi: e.target.value })} rows={5} style={{ ...isian, width: '100%', marginBottom: '6px' }} />
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4a5568', display: 'block' }}>Alamat gambar (beberapa gambar dipisah koma)</label>
            <input type="text" value={draft.url} onChange={(e) => ubahDraft({ url: e.target.value })} style={{ ...isian, width: '100%' }} />
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => simpanEdit(s)} disabled={sibuk} style={tombol('#38a169', sibuk)}>Simpan Perubahan</button>
          <button onClick={() => { setEditId(null); setDraft(null); }} disabled={sibuk} style={tombol('#718096', sibuk)}>Batal</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {info && <div style={{ backgroundColor: '#f0fff4', border: '1px solid #9ae6b4', color: '#22543d', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '14px' }}>{info}</div>}
      {galat && <div style={{ backgroundColor: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '14px' }}>{galat}</div>}

      <div style={kotak}>
        <div style={{ fontSize: '14px', color: '#4a5568', marginBottom: '10px' }}>
          <b>Bank Soal.</b> Ubah kunci dan teks soal, atau hapus soal yang salah impor. Soal yang sudah dipakai di ujian tidak bisa dihapus, dan soal yang dipakai ujian yang sedang aktif tidak bisa diubah.
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setOffset(0); setCariAktif(cari.trim()); }}
          style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
        >
          <select value={mapelId} onChange={(e) => { setMapelId(e.target.value); setOffset(0); }} style={isian}>
            <option value="">Semua mapel</option>
            {(data?.mapel || []).map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
          </select>
          <select value={batchId} onChange={(e) => { setBatchId(e.target.value); setOffset(0); }} style={{ ...isian, maxWidth: '260px' }}>
            <option value="">Semua file impor</option>
            {(data?.batch || []).map((b) => <option key={b.id} value={b.id}>#{b.id} · {b.nama_file || 'tanpa nama'} ({b.jumlah})</option>)}
          </select>
          <input type="text" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kata di pertanyaan…" style={{ ...isian, flex: '1 1 200px' }} />
          <button type="submit" style={tombol('#3182ce', false)}>Cari</button>
        </form>
        <div style={{ marginTop: '10px' }}>
          <button onClick={() => setTampilBatch(!tampilBatch)} style={{ ...tombol('#4a5568', false), backgroundColor: '#e2e8f0', color: '#4a5568' }}>
            {tampilBatch ? 'Sembunyikan' : 'Kelola'} file impor ({(data?.batch || []).length})
          </button>
        </div>
        {tampilBatch && (
          <div style={{ marginTop: '10px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
            {(data?.batch || []).length === 0 && <div style={{ padding: '10px', fontSize: '13px', color: '#718096' }}>Belum ada file impor.</div>}
            {(data?.batch || []).map((b) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #edf2f7', fontSize: '13px' }}>
                <span>#{b.id} · {b.nama_file || 'tanpa nama'} · {b.jumlah} soal · {tanggal(b.created_at)}</span>
                <button onClick={() => hapusBatch(b)} disabled={sibuk} style={tombol('#e53e3e', sibuk)}>Hapus file ini</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!data && !galat && <div style={{ fontSize: '14px', color: '#718096' }}>Memuat bank soal…</div>}

      {data && (
        <>
          <div style={{ fontSize: '13px', color: '#718096', marginBottom: '8px' }}>
            {total} soal ditemukan{total > perHalaman ? ` · menampilkan ${offset + 1}-${Math.min(offset + perHalaman, total)}` : ''}
          </div>
          {data.soal.length === 0 && <div style={{ fontSize: '14px', color: '#718096' }}>Tidak ada soal yang cocok.</div>}
          {data.soal.map((s) => (
            <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '10px', backgroundColor: editId === s.id ? '#f7fbff' : '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                <div style={{ fontSize: '12px', color: '#718096' }}>
                  <b>#{s.id}</b> · {namaMapel[s.mapel_id] || 'mapel ?'} · {NAMA_TIPE[s.tipe] || s.tipe} · skor {s.skor} · batch #{s.batch_id}
                  {s.stimulus ? ` · bacaan ${s.stimulus.kode || s.stimulus.id}` : ''}
                </div>
                <div style={{ fontSize: '12px' }}>
                  Kunci: <b style={{ color: '#22543d' }}>{ringkasKunci(s)}</b>
                </div>
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                <Teks>{s.pertanyaan}</Teks>
              </div>
              {s.dipakai.length > 0 && (
                <div style={{ fontSize: '12px', color: '#2b6cb0', marginTop: '6px' }}>
                  Dipakai di: {[...new Set(s.dipakai.map((u) => `${u.nama} (${u.status})`))].join(', ')}
                </div>
              )}
              {editId !== s.id && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button onClick={() => mulaiEdit(s)} disabled={sibuk} style={tombol('#3182ce', sibuk)}>Ubah</button>
                  <button onClick={() => hapusSoal(s)} disabled={sibuk || s.dipakai.length > 0} style={tombol('#e53e3e', sibuk || s.dipakai.length > 0)} title={s.dipakai.length ? 'Soal ini dipakai di ujian' : ''}>Hapus</button>
                </div>
              )}
              {editId === s.id && editor(s)}
            </div>
          ))}
          {total > perHalaman && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => setOffset(Math.max(0, offset - perHalaman))} disabled={offset === 0} style={tombol('#4a5568', offset === 0)}>← Sebelumnya</button>
              <button onClick={() => setOffset(offset + perHalaman)} disabled={offset + perHalaman >= total} style={tombol('#4a5568', offset + perHalaman >= total)}>Berikutnya →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
