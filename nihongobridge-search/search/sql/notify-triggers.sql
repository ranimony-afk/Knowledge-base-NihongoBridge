CREATE OR REPLACE FUNCTION public.notify_nihongobridge_content_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  record_id uuid;
  source_name text;
  changed_at timestamptz;
BEGIN
  record_id := COALESCE(NEW.id, OLD.id);
  changed_at := COALESCE(NEW.updated_at, OLD.updated_at, now());
  source_name := CASE TG_TABLE_NAME
    WHEN 'dictionary_entries' THEN 'dictionary'
    WHEN 'kanji_entries' THEN 'kanji'
    WHEN 'grammar_patterns' THEN 'grammar'
    WHEN 'sentences' THEN 'sentences'
    ELSE TG_TABLE_NAME
  END;
  PERFORM pg_notify(
    '__CHANNEL__',
    json_build_object(
      'table', source_name,
      'id', record_id,
      'operation', TG_OP,
      'changed_at', changed_at
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS dictionary_entries_search_notify ON public.dictionary_entries;
CREATE TRIGGER dictionary_entries_search_notify
AFTER INSERT OR UPDATE OR DELETE ON public.dictionary_entries
FOR EACH ROW EXECUTE FUNCTION public.notify_nihongobridge_content_change();

DROP TRIGGER IF EXISTS kanji_entries_search_notify ON public.kanji_entries;
CREATE TRIGGER kanji_entries_search_notify
AFTER INSERT OR UPDATE OR DELETE ON public.kanji_entries
FOR EACH ROW EXECUTE FUNCTION public.notify_nihongobridge_content_change();

DROP TRIGGER IF EXISTS grammar_patterns_search_notify ON public.grammar_patterns;
CREATE TRIGGER grammar_patterns_search_notify
AFTER INSERT OR UPDATE OR DELETE ON public.grammar_patterns
FOR EACH ROW EXECUTE FUNCTION public.notify_nihongobridge_content_change();

DROP TRIGGER IF EXISTS sentences_search_notify ON public.sentences;
CREATE TRIGGER sentences_search_notify
AFTER INSERT OR UPDATE OR DELETE ON public.sentences
FOR EACH ROW EXECUTE FUNCTION public.notify_nihongobridge_content_change();
