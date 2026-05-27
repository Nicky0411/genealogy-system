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

export async function getAncestors(memberId: number, maxDepth?: number) {
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
        AND ($2::INT IS NULL OR ancestors.depth < $2)
    )
    SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, depth
    FROM ancestors
    ORDER BY depth, generation, member_id
    `,
    [memberId, maxDepth ?? null]
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

export async function getRelationPath(startMemberId: number, targetMemberId: number, maxDepth = 24) {
  if (startMemberId === targetMemberId) {
    const membersResult = await query<MemberRow>(
      `SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id FROM members WHERE member_id = $1`,
      [startMemberId]
    );
    return { depth: 0, path: membersResult.rows.map(toMember) };
  }

  // check direct relationships
  const directResult = await query<{ member_id: string; father_id: string | null; mother_id: string | null; spouse_id: string | null }>(
    `SELECT member_id, father_id, mother_id, spouse_id FROM members WHERE member_id IN ($1, $2)`,
    [startMemberId, targetMemberId]
  );
  if (directResult.rows.length < 2) return null;

  const a = directResult.rows.find((r) => Number(r.member_id) === startMemberId);
  const b = directResult.rows.find((r) => Number(r.member_id) === targetMemberId);
  if (!a || !b) return null;

  // direct spouse
  if ((a.spouse_id && Number(a.spouse_id) === targetMemberId) || (b.spouse_id && Number(b.spouse_id) === startMemberId)) {
    const membersResult = await query<MemberRow>(
      `SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id FROM members WHERE member_id IN ($1, $2) ORDER BY CASE member_id WHEN $1 THEN 1 ELSE 2 END`,
      [startMemberId, targetMemberId]
    );
    return { depth: 1, path: membersResult.rows.map(toMember) };
  }

  // bidirectional ancestor search: go up from both, find LCA
  const halfDepth = Math.ceil(maxDepth / 2);
  const lcaResult = await query<{ lca_id: string; depth_a: number; depth_b: number; path_a: string; path_b: string }>(
    `
    WITH RECURSIVE
    anc_a AS (
      SELECT member_id, member_id::TEXT AS chain, 0 AS depth
      FROM members WHERE member_id = $1
      UNION ALL
      SELECT m.member_id, CONCAT(a.chain, ',', m.member_id::TEXT), a.depth + 1
      FROM anc_a a
      JOIN members cur ON cur.member_id = a.member_id
      JOIN members m ON (m.member_id = cur.father_id OR m.member_id = cur.mother_id)
      WHERE a.depth < $3
    ),
    anc_b AS (
      SELECT member_id, member_id::TEXT AS chain, 0 AS depth
      FROM members WHERE member_id = $2
      UNION ALL
      SELECT m.member_id, CONCAT(b.chain, ',', m.member_id::TEXT), b.depth + 1
      FROM anc_b b
      JOIN members cur ON cur.member_id = b.member_id
      JOIN members m ON (m.member_id = cur.father_id OR m.member_id = cur.mother_id)
      WHERE b.depth < $3
    )
    SELECT a.member_id AS lca_id, a.depth AS depth_a, b.depth AS depth_b,
           a.chain AS path_a, b.chain AS path_b
    FROM anc_a a
    JOIN anc_b b ON a.member_id = b.member_id
    ORDER BY (a.depth + b.depth)
    LIMIT 1
    `,
    [startMemberId, targetMemberId, halfDepth]
  );

  const lcaRow = lcaResult.rows[0];
  if (!lcaRow) return null;

  // path_a goes from start UP to LCA. path_b goes from target UP to LCA.
  // Full path: start → ... → LCA → ... → target
  const pathAIds = lcaRow.path_a.split(",").map(Number);
  const pathBIds = lcaRow.path_b.split(",").map(Number);
  // reverse pathB (currently target → ... → LCA) to be LCA → ... → target
  pathBIds.reverse();
  // combine: pathA (start → LCA) + pathB without duplicate LCA (LCA → target)
  const fullPathIds = [...pathAIds, ...pathBIds.slice(1)];

  const membersResult = await query<MemberRow>(
    `
    SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id
    FROM members
    WHERE member_id = ANY($1::BIGINT[])
    ORDER BY ARRAY_POSITION($1::BIGINT[], member_id)
    `,
    [fullPathIds]
  );

  return {
    depth: fullPathIds.length - 1,
    path: membersResult.rows.map(toMember)
  };
}
