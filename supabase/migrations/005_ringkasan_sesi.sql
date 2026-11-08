-- 005 – ringkasan jumlah jawaban per sesi (untuk pantauan admin)
-- Menghitung jumlah soal yang sudah dijawab tiap siswa dalam satu ujian,
-- langsung di database supaya cepat walau pesertanya banyak.

create or replace function ringkasan_sesi(p_ujian_id bigint)
returns table (sesi_id bigint, jumlah_jawaban bigint)
language sql
stable
set search_path = public
as $$
  select j.sesi_id, count(*)::bigint
  from jawaban j
  join sesi_ujian s on s.id = j.sesi_id
  where s.ujian_id = p_ujian_id
  group by j.sesi_id
  order by j.sesi_id;
$$;

-- Hanya server (service role) yang boleh memanggil fungsi ini
revoke all on function ringkasan_sesi(bigint) from public, anon, authenticated;
grant execute on function ringkasan_sesi(bigint) to service_role;
