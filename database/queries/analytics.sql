-- $1 = family_id

-- 1. 统计平均寿命最长的一代
SELECT
  generation,
  COUNT(*) AS member_count,
  ROUND(AVG(death_year - birth_year)::NUMERIC, 2) AS average_lifespan
FROM members
WHERE family_id = $1
  AND birth_year IS NOT NULL
  AND death_year IS NOT NULL
GROUP BY generation
HAVING COUNT(*) >= 2
ORDER BY average_lifespan DESC, member_count DESC
LIMIT 1;

-- 2. 查询年龄超过 50 岁且无配偶的男性
SELECT
  member_id,
  name,
  birth_year,
  generation
FROM members
WHERE family_id = $1
  AND gender = 'M'
  AND spouse_id IS NULL
  AND birth_year IS NOT NULL
  AND COALESCE(death_year, EXTRACT(YEAR FROM CURRENT_DATE)::INT) - birth_year > 50
ORDER BY generation, birth_year;

-- 3. 找出出生年份早于该辈分平均出生年份的成员
WITH generation_average AS (
  SELECT generation, AVG(birth_year) AS avg_birth_year
  FROM members
  WHERE family_id = $1 AND birth_year IS NOT NULL
  GROUP BY generation
)
SELECT
  member.member_id,
  member.name,
  member.generation,
  member.birth_year,
  generation_average.avg_birth_year
FROM members member
JOIN generation_average USING (generation)
WHERE member.family_id = $1
  AND member.birth_year < generation_average.avg_birth_year
ORDER BY member.generation, member.birth_year;
