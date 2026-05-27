-- 将 $1 替换为需要测试的 member_id，将 $2 替换为 family_id。

EXPLAIN ANALYZE
WITH RECURSIVE descendants AS (
  SELECT member_id, father_id, mother_id, generation, 1 AS depth
  FROM members
  WHERE father_id = $1 OR mother_id = $1

  UNION ALL

  SELECT child.member_id, child.father_id, child.mother_id, child.generation, descendants.depth + 1
  FROM descendants
  JOIN members child
    ON child.father_id = descendants.member_id
    OR child.mother_id = descendants.member_id
)
SELECT COUNT(*)
FROM descendants;

EXPLAIN ANALYZE
SELECT member_id, name, generation
FROM members
WHERE family_id = $2
  AND name ILIKE '%明%'
ORDER BY generation
LIMIT 50;

EXPLAIN ANALYZE
SELECT generation, AVG(death_year - birth_year)
FROM members
WHERE family_id = $2
  AND birth_year IS NOT NULL
  AND death_year IS NOT NULL
GROUP BY generation
ORDER BY generation;
