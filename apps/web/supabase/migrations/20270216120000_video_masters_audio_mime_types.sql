-- Screen recordings upload separate mic / system AAC sidecars (audio-mic.m4a,
-- audio-system.m4a) next to master.mp4. The bucket only allowed video + JSON,
-- so every sidecar upload was rejected.
update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/json',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac'
]
where id = 'video-masters';
