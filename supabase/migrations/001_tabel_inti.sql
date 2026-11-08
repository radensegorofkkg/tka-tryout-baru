-- 001 – tabel inti (dijalankan di Supabase dengan "Run and enable RLS")

-- Perbaikan tabel siswa
alter table students
  add column if not exists created_at timestamptz default now();

-- Mata pelajaran
create table mapel (
  id bigint generated always as identity primary key,
  nama text not null unique
);

-- Bacaan / gambar yang dipakai bersama beberapa soal
create table stimulus (
  id bigint generated always as identity primary key,
  kode text unique,
  isi text,
  url_gambar text,
  created_at timestamptz default now()
);

-- Catatan setiap kali admin mengimpor file soal
create table impor_batch (
  id bigint generated always as identity primary key,
  nama_file text,
  status text not null default 'draft'
    check (status in ('draft','tersimpan','dibatalkan')),
  jumlah_soal int default 0,
  created_at timestamptz default now()
);

-- Bank soal (tanpa kunci jawaban)
create table soal (
  id bigint generated always as identity primary key,
  mapel_id bigint references mapel(id),
  stimulus_id bigint references stimulus(id),
  batch_id bigint references impor_batch(id),
  tipe text not null
    check (tipe in ('PG','PG_KOMPLEKS','BENAR_SALAH','JODOH')),
  pertanyaan text not null,
  url_gambar text,
  opsi jsonb not null default '[]'::jsonb,
  skor numeric not null default 1,
  hash_isi text,
  diarsipkan_at timestamptz,
  created_at timestamptz default now()
);

-- Kunci jawaban dan pembahasan (dipisah supaya bisa dilindungi)
create table kunci_soal (
  soal_id bigint primary key references soal(id) on delete cascade,
  kunci jsonb not null,
  pembahasan text
);

-- Paket ujian / tryout
create table ujian (
  id bigint generated always as identity primary key,
  nama text not null,
  durasi_menit int not null default 60,
  mulai_at timestamptz,
  selesai_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft','aktif','selesai')),
  created_at timestamptz default now()
);

-- Soal mana masuk ujian mana, dan urutannya
create table ujian_soal (
  ujian_id bigint references ujian(id) on delete cascade,
  soal_id bigint references soal(id),
  urutan int not null,
  primary key (ujian_id, soal_id)
);

-- Satu siswa mengerjakan satu ujian satu kali
create table sesi_ujian (
  id bigint generated always as identity primary key,
  ujian_id bigint not null references ujian(id),
  nomor_ujian text not null references students(nomor_ujian),
  mulai_at timestamptz default now(),
  selesai_at timestamptz,
  skor numeric,
  unique (ujian_id, nomor_ujian)
);

-- Jawaban per soal (disimpan sambil mengerjakan)
create table jawaban (
  sesi_id bigint references sesi_ujian(id) on delete cascade,
  soal_id bigint references soal(id),
  jawaban jsonb,
  updated_at timestamptz default now(),
  primary key (sesi_id, soal_id)
);
