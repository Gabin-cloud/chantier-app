-- Niveau de plan sur les réserves (contrôle tablette → exécution par plan/niveau)

ALTER TABLE public.markers
  ADD COLUMN IF NOT EXISTS plan_level_id UUID
    REFERENCES public.work_control_plan_levels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS markers_plan_level_id_idx ON public.markers(plan_level_id);
