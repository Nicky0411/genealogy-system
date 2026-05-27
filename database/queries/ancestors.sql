-- $1 = member_id
WITH RECURSIVE ancestors AS (
  SELECT
    parent.member_id,
    parent.family_id,
    parent.name,
    parent.gender,
    parent.birth_year,
    parent.death_year,
    parent.generation,
    1 AS depth,
    ARRAY[child.member_id, parent.member_id] AS path
  FROM members child
  JOIN members parent
    ON parent.member_id IN (child.father_id, child.mother_id)
  WHERE child.member_id = $1

  UNION ALL

  SELECT
    parent.member_id,
    parent.family_id,
    parent.name,
    parent.gender,
    parent.birth_year,
    parent.death_year,
    parent.generation,
    ancestors.depth + 1 AS depth,
    ancestors.path || parent.member_id AS path
  FROM ancestors
  JOIN members current_member ON current_member.member_id = ancestors.member_id
  JOIN members parent
    ON parent.member_id IN (current_member.father_id, current_member.mother_id)
  WHERE NOT parent.member_id = ANY(ancestors.path)
)
SELECT *
FROM ancestors
ORDER BY depth, generation, member_id;
