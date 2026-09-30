-- Link cards (bookmark previews) on the project canvas.
ALTER TABLE public.project_canvas_items
  DROP CONSTRAINT IF EXISTS project_canvas_items_kind_check;
ALTER TABLE public.project_canvas_items
  ADD CONSTRAINT project_canvas_items_kind_check CHECK (
    kind IN (
      'phase', 'task', 'member', 'client', 'note', 'contact', 'doc',
      'sticky', 'text', 'shape', 'frame', 'image', 'link', 'draw',
      'timeline', 'connector'
    )
  );
