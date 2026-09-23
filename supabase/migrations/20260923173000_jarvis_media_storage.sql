-- JARVIS media storage: Supabase Storage replaces Cloudflare R2.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'jarvis-media',
  'jarvis-media',
  false,
  52428800,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "jarvis media read own files" on storage.objects;
create policy "jarvis media read own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'jarvis-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "jarvis media insert own files" on storage.objects;
create policy "jarvis media insert own files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'jarvis-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "jarvis media update own files" on storage.objects;
create policy "jarvis media update own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'jarvis-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'jarvis-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "jarvis media delete own files" on storage.objects;
create policy "jarvis media delete own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'jarvis-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
