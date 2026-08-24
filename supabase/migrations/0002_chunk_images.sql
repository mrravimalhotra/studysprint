-- Persist every uploaded page's image (not just text) so RAG results can carry
-- the original diagram/map/figure back to the student, not just its OCR'd caption.

alter table chunks add column if not exists image_path text;

-- Recreate match_chunks to also return the source page's image path.
create or replace function match_chunks (
  query_embedding vector(768),
  match_school_id uuid,
  match_grade_id uuid,
  match_subject_id uuid,
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  section_label text,
  page_number int,
  source_type text,
  image_path text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.section_label,
    c.page_number,
    c.source_type,
    c.image_path,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.school_id = match_school_id
    and c.grade_id = match_grade_id
    and c.subject_id = match_subject_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
