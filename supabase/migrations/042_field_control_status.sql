-- Statuts terrain à 4 couleurs : conforme, à lever, à contrôler plus tard, en attente

UPDATE public.markers
SET control_result = 'pending'
WHERE control_result = 'partial';

UPDATE public.work_control_executions
SET control_result = 'pending'
WHERE control_result = 'partial';

ALTER TABLE public.markers
  DROP CONSTRAINT IF EXISTS markers_control_result_check;

ALTER TABLE public.markers
  ADD CONSTRAINT markers_control_result_check
  CHECK (
    control_result IS NULL
    OR control_result IN ('ok', 'ko', 'deferred', 'pending')
  );

ALTER TABLE public.work_control_executions
  DROP CONSTRAINT IF EXISTS work_control_executions_control_result_check;

ALTER TABLE public.work_control_executions
  ADD CONSTRAINT work_control_executions_control_result_check
  CHECK (control_result IN ('pending', 'ok', 'ko', 'deferred'));
