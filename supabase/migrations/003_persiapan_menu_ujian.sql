-- 003 – persiapan menu Ujian

-- 1. Setiap ujian hanya untuk satu mapel
alter table ujian add column if not exists mapel_id bigint references mapel(id);

-- 2. Urutan soal acak per siswa disimpan di sesi ujian (supaya tidak berubah saat halaman dimuat ulang)
alter table sesi_ujian add column if not exists urutan jsonb;

-- 3. Hanya satu ujian yang boleh berstatus 'aktif' dalam satu waktu
create unique index if not exists ujian_satu_aktif
  on ujian ((true)) where status = 'aktif';
