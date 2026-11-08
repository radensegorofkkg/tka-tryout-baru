-- 002 – perbaikan stimulus, data mapel, fungsi simpan_impor

-- 1. Kode stimulus hanya perlu unik di dalam satu impor
alter table stimulus add column if not exists batch_id bigint references impor_batch(id);
alter table stimulus drop constraint if exists stimulus_kode_key;
alter table stimulus add constraint stimulus_batch_kode_unik unique (batch_id, kode);

-- 2. Mata pelajaran awal
insert into mapel (nama) values ('Bahasa Indonesia'), ('Matematika')
on conflict (nama) do nothing;

-- 3. Fungsi simpan impor (semua masuk, atau tidak ada yang masuk)
create or replace function simpan_impor(p_nama_file text, p_stimulus jsonb, p_soal jsonb)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_batch bigint;
  v_map jsonb := '{}'::jsonb;
  v_id bigint;
  v_stim jsonb;
  v_s jsonb;
  v_mapel bigint;
  v_sid bigint;
begin
  insert into impor_batch (nama_file, status, jumlah_soal)
  values (p_nama_file, 'tersimpan', jsonb_array_length(p_soal))
  returning id into v_batch;

  for v_stim in select * from jsonb_array_elements(coalesce(p_stimulus, '[]'::jsonb)) loop
    insert into stimulus (kode, isi, url_gambar, batch_id)
    values (v_stim->>'kode', v_stim->>'isi', nullif(v_stim->>'url_gambar', ''), v_batch)
    returning id into v_id;
    v_map := v_map || jsonb_build_object(v_stim->>'kode', v_id);
  end loop;

  for v_s in select * from jsonb_array_elements(p_soal) loop
    insert into mapel (nama) values (v_s->>'mapel') on conflict (nama) do nothing;
    select id into v_mapel from mapel where nama = v_s->>'mapel';

    v_sid := null;
    if coalesce(v_s->>'kode_stimulus', '') <> '' then
      if not (v_map ? (v_s->>'kode_stimulus')) then
        raise exception 'Kode stimulus % tidak ditemukan', v_s->>'kode_stimulus';
      end if;
      v_sid := (v_map->>(v_s->>'kode_stimulus'))::bigint;
    end if;

    insert into soal (mapel_id, stimulus_id, batch_id, tipe, pertanyaan, opsi, skor, hash_isi)
    values (v_mapel, v_sid, v_batch, v_s->>'tipe', v_s->>'pertanyaan',
            coalesce(v_s->'opsi', '[]'::jsonb),
            coalesce((v_s->>'skor')::numeric, 1), v_s->>'hash_isi')
    returning id into v_id;

    insert into kunci_soal (soal_id, kunci, pembahasan)
    values (v_id, v_s->'kunci', nullif(v_s->>'pembahasan', ''));
  end loop;

  return v_batch;
end;
$$;

-- Hanya server (service role) yang boleh memanggil fungsi ini
revoke all on function simpan_impor(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function simpan_impor(text, jsonb, jsonb) to service_role;
