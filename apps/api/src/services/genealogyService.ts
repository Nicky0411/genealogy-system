import { query } from "../db/query";

export interface MemberRow {
  member_id: string;
  family_id: string;
  name: string;
  gender: "M" | "F";
  birth_year: number | null;
  death_year: number | null;
  generation: number;
  father_id?: string | null;
  mother_id?: string | null;
  spouse_id?: string | null;
  birthplace?: string | null;
  biography?: string | null;
  depth?: number;
}

export function toMember(row: MemberRow) {
  return {
    memberId: Number(row.member_id),
    familyId: Number(row.family_id),
    name: row.name,
    gender: row.gender,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    generation: row.generation,
    fatherId: row.father_id ? Number(row.father_id) : null,
    motherId: row.mother_id ? Number(row.mother_id) : null,
    spouseId: row.spouse_id ? Number(row.spouse_id) : null,
    birthplace: row.birthplace,
    biography: row.biography,
    depth: row.depth
  };
}

export async function getAncestors(memberId: number) {
  const result = await query<MemberRow>(
    `
    WITH RECURSIVE ancestors AS (
      SELECT parent.*, 1 AS depth, ARRAY[child.member_id, parent.member_id] AS path
      FROM members child
      JOIN members parent ON parent.member_id IN (child.father_id, child.mother_id)
      WHERE child.member_id = $1

      UNION ALL

      SELECT parent.*, ancestors.depth + 1 AS depth, ancestors.path || parent.member_id AS path
      FROM ancestors
      JOIN members current_member ON current_member.member_id = ancestors.member_id
      JOIN members parent ON parent.member_id IN (current_member.father_id, current_member.mother_id)
      WHERE NOT parent.member_id = ANY(ancestors.path)
    )
    SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, depth
    FROM ancestors
    ORDER BY depth, generation, member_id
    `,
    [memberId]
  );
  return result.rows.map(toMember);
}

export async function getDescendants(memberId: number) {
  const result = await query<MemberRow>(
    `
    WITH RECURSIVE descendants AS (
      SELECT child.*, 1 AS depth, ARRAY[$1::BIGINT, child.member_id] AS path
      FROM members child
      WHERE child.father_id = $1 OR child.mother_id = $1

      UNION ALL

      SELECT child.*, descendants.depth + 1 AS depth, descendants.path || child.member_id AS path
      FROM descendants
      JOIN members child ON child.father_id = descendants.member_id OR child.mother_id = descendants.member_id
      WHERE NOT child.member_id = ANY(descendants.path)
    )
    SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, depth
    FROM descendants
    ORDER BY depth, generation, member_id
    `,
    [memberId]
  );
  return result.rows.map(toMember);
}

export async function getRelationPath(startMemberId: number, targetMemberId: number, maxDepth = 20) {
  const pathResult = await query<{ path: string[]; depth: number }>(
    `
    WITH RECURSIVE relation_path AS (
      SELECT $1::BIGINT AS member_id, ARRAY[$1::BIGINT] AS path, 0 AS depth

      UNION ALL

      SELECT next_member.member_id, relation_path.path || next_member.member_id, relation_path.depth + 1
      FROM relation_path
      JOIN LATERAL (
        SELECT father_id AS member_id FROM members WHERE member_id = relation_path.member_id AND father_id IS NOT NULL
        UNION
        SELECT mother_id AS member_id FROM members WHERE member_id = relation_path.member_id AND mother_id IS NOT NULL
        UNION
        SELECT spouse_id AS member_id FROM members WHERE member_id = relation_path.member_id AND spouse_id IS NOT NULL
        UNION
        SELECT member_id FROM members WHERE father_id = relation_path.member_id OR mother_id = relation_path.member_id
      ) AS next_member ON true
      WHERE relation_path.depth < $3
        AND NOT next_member.member_id = ANY(relation_path.path)
    )
    SELECT path, depth
    FROM relation_path
    WHERE member_id = $2
    ORDER BY depth
    LIMIT 1
    `,
    [startMemberId, targetMemberId, maxDepth]
  );

  const pathRow = pathResult.rows[0];
  if (!pathRow) {
    return null;
  }

  const membersResult = await query<MemberRow>(
    `
    SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id
    FROM members
    WHERE member_id = ANY($1::BIGINT[])
    ORDER BY ARRAY_POSITION($1::BIGINT[], member_id)
    `,
    [pathRow.path]
  );

  return {
    depth: pathRow.depth,
    path: membersResult.rows.map(toMember)
  };
}
