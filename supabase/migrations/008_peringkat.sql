-- 008: tombol buka/tutup peringkat (leaderboard) per ujian. Awalnya tertutup.
alter table public.ujian
  add column if not exists peringkat_terbuka boolean not null default false;
