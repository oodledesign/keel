-- Align "Adding a Disposal" assist copy with the real draft + marketing flow.
-- Do not rewrite 20261011120000 (already applied); update seeded steps only.

UPDATE sops.playbook_steps AS ps
SET
  title = v.title,
  body_md = v.body_md
FROM sops.playbooks p
CROSS JOIN (
  VALUES
    (
      0,
      'Start the disposal record',
      'Open Disposals and add a disposal. That creates an Untitled disposal draft and opens the editor — changes save automatically. Then fill the name, address, asking rent or price, size (sq ft), and use class. Those fields are not required before the first save.'
    ),
    (
      5,
      'Check listing details for portal publishing',
      'Open Management and review the portal publishing cards so listing fields map correctly to the portal feeds.'
    ),
    (
      6,
      'Publish to the portals and confirm it is live',
      'Publish from Management. Publishing sets status to marketing (not live). Confirm each portal card: a successful push shows published; a failed Property Hive push or republish shows an error on the card — it is not silent.'
    )
) AS v(position, title, body_md)
WHERE ps.playbook_id = p.id
  AND p.title = 'Adding a Disposal'
  AND ps.position = v.position;
