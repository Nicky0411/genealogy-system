-- $1 = member_id
WITH RECURSIVE descendants AS (
  SELECT
    child.member_id,
    child.family_id,
    child.name,
    child.gender,
    child.birth_year,
    child.death_year,
    child.generation,
    1 AS depth,
    ARRAY[$1::BIGINT, child.member_id] AS path
  FROM members child
  WHERE child.father_id = $1 OR child.mother_id = $1

  UNION ALL

  SELECT
    child.member_id,
    child.family_id,
    child.name,
    child.gender,
    child.birth_year,
    child.death_year,
    child.generation,
    descendants.depth + 1 AS depth,
    descendants.path || child.member_id AS path
  FROM descendants
  JOIN members child
    ON child.father_id = descendants.member_id
    OR child.mother_id = descendants.member_id
  WHERE NOT child.member_id = ANY(descendants.path)
)
SELECT *
FROM descendants
ORDER BY depth, generation, member_id;
