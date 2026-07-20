-- Bibliothèque globale de points de contrôle (champs étendus + lien projet)

ALTER TABLE public.control_library_items
  ADD COLUMN IF NOT EXISTS plan_support_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS help_comment TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS preset_comments JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.phase_checklist_items
  ADD COLUMN IF NOT EXISTS library_item_id UUID
    REFERENCES public.control_library_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS phase_checklist_items_library_item_id_idx
  ON public.phase_checklist_items(library_item_id);
