-- Supabase Storage setup for absence PDF documents
-- Project: ohzcnlcfduvfxbgppwgl
-- Run this in Supabase SQL Editor.

-- 1) Ensure private bucket exists
insert into storage.buckets (id, name, public)
values ('absence-documents', 'absence-documents', false)
on conflict (id) do nothing;

-- 2) RLS policies for anon usage from app
-- NOTE: Because the app currently uses anon key without Supabase Auth,
-- these policies allow anon access scoped only by bucket and folder pattern.

-- Upload policy (insert)
drop policy if exists "absence_documents_anon_insert" on storage.objects;
create policy "absence_documents_anon_insert"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'absence-documents'
  and (
    name like 'ausencias/%'
    or name like 'folhas/%'
  )
);

-- Read policy (select) required to create signed URLs from client
drop policy if exists "absence_documents_anon_select" on storage.objects;
create policy "absence_documents_anon_select"
on storage.objects
for select
to anon
using (
  bucket_id = 'absence-documents'
  and (
    name like 'ausencias/%'
    or name like 'folhas/%'
  )
);

-- Update policy (optional)
drop policy if exists "absence_documents_anon_update" on storage.objects;
create policy "absence_documents_anon_update"
on storage.objects
for update
to anon
using (
  bucket_id = 'absence-documents'
  and (
    name like 'ausencias/%'
    or name like 'folhas/%'
  )
)
with check (
  bucket_id = 'absence-documents'
  and (
    name like 'ausencias/%'
    or name like 'folhas/%'
  )
);

-- Delete policy (optional)
drop policy if exists "absence_documents_anon_delete" on storage.objects;
create policy "absence_documents_anon_delete"
on storage.objects
for delete
to anon
using (
  bucket_id = 'absence-documents'
  and (
    name like 'ausencias/%'
    or name like 'folhas/%'
  )
);
