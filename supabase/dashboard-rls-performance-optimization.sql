-- Optimización RLS del Dashboard
-- 15 de octubre de 2026

BEGIN;

ALTER POLICY "Users can read visible inventories"
ON public.inventory_sessions
USING (
  (SELECT public.current_user_active())
  AND (
    (SELECT public.is_admin())
    OR area_id = (SELECT public.current_user_area_id())
  )
);

ALTER POLICY "Users can read items from visible inventories"
ON public.inventory_items
USING (
  (SELECT public.current_user_active())
  AND EXISTS (
    SELECT 1
    FROM public.inventory_sessions s
    WHERE s.id = inventory_items.inventory_session_id
      AND (
        (SELECT public.is_admin())
        OR s.area_id = (SELECT public.current_user_area_id())
      )
  )
);

COMMIT;