-- $1 = start_member_id, $2 = target_member_id, $3 = max_depth
WITH RECURSIVE relation_path AS (
  SELECT
    $1::BIGINT AS member_id,
    ARRAY[$1::BIGINT] AS path,
    0 AS depth

  UNION ALL

  SELECT
    next_member.member_id,
    relation_path.path || next_member.member_id,
    relation_path.depth + 1
  FROM relation_path
  JOIN LATERAL (
    SELECT father_id AS member_id
    FROM members
    WHERE member_id = relation_path.member_id AND father_id IS NOT NULL

    UNION

    SELECT mother_id AS member_id
    FROM members
    WHERE member_id = relation_path.member_id AND mother_id IS NOT NULL

    UNION

    SELECT spouse_id AS member_id
    FROM members
    WHERE member_id = relation_path.member_id AND spouse_id IS NOT NULL

    UNION

    SELECT member_id
    FROM members
    WHERE father_id = relation_path.member_id OR mother_id = relation_path.member_id
  ) AS next_member ON true
  WHERE relation_path.depth < COALESCE($3::INT, 20)
    AND NOT next_member.member_id = ANY(relation_path.path)
)
SELECT relation_path.path, relation_path.depth
FROM relation_path
WHERE member_id = $2
ORDER BY depth
LIMIT 1;
