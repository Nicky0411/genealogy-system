import { query } from "../db/query";
import { pool } from "../db/pool";

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

export async function getSpouseAndChildren(memberId: number) {
  const memberResult = await query<MemberRow>(
    `SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id FROM members WHERE member_id = $1`,
    [memberId]
  );
  if (memberResult.rows.length === 0) return null;

  const m = memberResult.rows[0];
  const [spouseResult, childrenResult] = await Promise.all([
    m.spouse_id
      ? query<MemberRow>(
          `SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id FROM members WHERE member_id = $1`,
          [m.spouse_id]
        )
      : Promise.resolve({ rows: [] }),
    query<MemberRow>(
      `SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id FROM members WHERE father_id = $1 OR mother_id = $1 ORDER BY birth_year, member_id`,
      [memberId]
    )
  ]);

  return {
    member: toMember(m),
    spouse: spouseResult.rows.length > 0 ? toMember(spouseResult.rows[0]) : null,
    children: childrenResult.rows.map(toMember)
  };
}

export async function getUnmarriedMalesOver50(familyId: number) {
  const result = await query<MemberRow>(
    `SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id
     FROM members
     WHERE family_id = $1
       AND gender = 'M'
       AND spouse_id IS NULL
       AND birth_year IS NOT NULL
       AND (EXTRACT(YEAR FROM CURRENT_DATE) - birth_year) > 50
     ORDER BY birth_year, member_id`,
    [familyId]
  );
  return result.rows.map(toMember);
}

export async function getBornBeforeGenAverage(familyId: number) {
  const result = await query<MemberRow>(
    `WITH gen_avg AS (
       SELECT generation, AVG(birth_year)::NUMERIC(10,2) AS avg_birth_year, COUNT(*)::INT AS gen_count
       FROM members
       WHERE family_id = $1 AND birth_year IS NOT NULL
       GROUP BY generation
     )
     SELECT m.member_id, m.family_id, m.name, m.gender, m.birth_year, m.death_year, m.generation,
            m.father_id, m.mother_id, m.spouse_id, m.birthplace, m.biography,
            g.avg_birth_year, g.gen_count
     FROM members m
     JOIN gen_avg g ON m.generation = g.generation
     WHERE m.family_id = $1
       AND m.birth_year IS NOT NULL
       AND m.birth_year < g.avg_birth_year
     ORDER BY m.generation, m.birth_year, m.member_id`,
    [familyId]
  );
  return result.rows.map((row: MemberRow & { avg_birth_year?: string; gen_count?: number }) => ({
    ...toMember(row),
    avgBirthYear: row.avg_birth_year ? Number(row.avg_birth_year) : null,
    genCount: row.gen_count ?? 0
  }));
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

export async function getGreatGrandchildrenPerformance(memberId: number) {
  // verify member exists
  const memberResult = await query<MemberRow>(
    `SELECT member_id, family_id, name, gender, birth_year, death_year, generation FROM members WHERE member_id = $1`,
    [memberId]
  );
  if (memberResult.rows.length === 0) return null;

  const descQuery = `
    WITH RECURSIVE descendants AS (
      SELECT child.*, 1 AS depth
      FROM members child
      WHERE child.father_id = $1 OR child.mother_id = $1
      UNION ALL
      SELECT child.*, d.depth + 1
      FROM descendants d
      JOIN members child ON child.father_id = d.member_id OR child.mother_id = d.member_id
      WHERE d.depth < 4
    )
    SELECT member_id, family_id, name, gender, birth_year, death_year, generation, depth
    FROM descendants
    ORDER BY depth, generation, member_id
  `;

  // with indexes — EXPLAIN ANALYZE to get actual execution plan + timing
  const withClient = await pool.connect();
  let withPlanText = "";
  let withExecMs: number | null = null;
  let withTimedOut = false;
  try {
    await withClient.query("SET LOCAL statement_timeout = '30s'");
    // 30s timeout for with-index query
    const withExplainResult = await withClient.query<{ "QUERY PLAN": string }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${descQuery}`,
      [memberId]
    );
    withPlanText = withExplainResult.rows.map((r) => r["QUERY PLAN"]).join("\n");
    const match = withPlanText.match(/Execution Time:\s*([\d.]+)\s*ms/);
    withExecMs = match ? Number(match[1]) : null;
  } catch {
    withTimedOut = true;
  } finally {
    withClient.release();
  }

  // count actual rows (separate lightweight query)
  const actualResult = await query<MemberRow>(descQuery, [memberId]);

  // without indexes: EXPLAIN (no ANALYZE) for estimated plan, then try ANALYZE with timeout
  const client = await pool.connect();
  let withoutPlanRows: { "QUERY PLAN": string }[] = [];
  let withoutTimedOut = false;
  let withoutActualMs: number | null = null;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL enable_indexscan = off");
    await client.query("SET LOCAL enable_bitmapscan = off");
    await client.query("SET LOCAL enable_indexonlyscan = off");
    // first get estimated plan (no ANALYZE, returns instantly)
    const estPlanResult = await client.query<{ "QUERY PLAN": string }>(
      `EXPLAIN (BUFFERS, FORMAT TEXT) ${descQuery}`,
      [memberId]
    );
    withoutPlanRows = estPlanResult.rows;
    // then try actual execution with timeout
    try {
      await client.query("SET LOCAL statement_timeout = '30s'");
      const actualResult = await client.query<{ "QUERY PLAN": string }>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${descQuery}`,
        [memberId]
      );
      // extract actual timing from ANALYZE result
      const actualText = actualResult.rows.map((r) => r["QUERY PLAN"]).join("\n");
      const actualMatch = actualText.match(/Execution Time:\s*([\d.]+)\s*ms/);
      withoutActualMs = actualMatch ? Number(actualMatch[1]) : null;
    } catch {
      withoutTimedOut = true;
    }
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
  const withoutPlanText = withoutPlanRows.map((r) => r["QUERY PLAN"]).join("\n");

  return {
    member: toMember(memberResult.rows[0]),
    descendantCount: actualResult.rows.length,
    withIndex: {
      planText: withPlanText,
      execMs: withExecMs,
      timedOut: withTimedOut
    },
    withoutIndex: {
      planText: withoutPlanText,
      execMs: withoutActualMs,
      timedOut: withoutTimedOut
    }
  };
}
