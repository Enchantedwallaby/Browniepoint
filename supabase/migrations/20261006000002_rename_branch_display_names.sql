UPDATE public.branches
SET name = CASE name
  WHEN 'Main Branch' THEN 'Moodubidre'
  WHEN 'Branch 1' THEN 'Alvas Vidayagiri'
  WHEN 'Branch 2' THEN 'Alvas Mijar'
END
WHERE name IN ('Main Branch', 'Branch 1', 'Branch 2');