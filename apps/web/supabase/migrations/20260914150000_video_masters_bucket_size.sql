-- Ensure video masters can accept longer recordings once the project global
-- storage limit is raised (bucket limit cannot exceed the global limit).
update storage.buckets
set file_size_limit = 5368709120 -- 5 GiB
where id = 'video-masters'
  and (file_size_limit is null or file_size_limit < 5368709120);
