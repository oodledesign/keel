-- Bind assist runs to a disposal + fix Adding a Disposal step routes.

ALTER TABLE sops.runs
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sops.runs.context IS
  'Assist context, e.g. {"listingId":"<uuid>"} for disposal playbooks.';

-- Point post-create steps at the disposal detail tabs (need [id] from run.context).
UPDATE sops.playbook_steps AS ps
SET target_route = v.target_route
FROM sops.playbooks p
CROSS JOIN (
  VALUES
    (1, '/app/[account]/listings/[id]/media'),
    (2, '/app/[account]/listings/[id]/media'),
    (3, '/app/[account]/listings/[id]/marketing'),
    (4, '/app/[account]/listings/[id]/media'),
    (5, '/app/[account]/listings/[id]/management'),
    (6, '/app/[account]/listings/[id]/management')
) AS v(position, target_route)
WHERE ps.playbook_id = p.id
  AND p.title = 'Adding a Disposal'
  AND ps.position = v.position;
