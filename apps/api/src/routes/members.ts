import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { query } from "../db/query";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { httpError } from "../middleware/error";
import { assertFamilyAccess } from "../services/access";
import { toMember, type MemberRow } from "../services/genealogyService";

export const membersRouter = Router();

membersRouter.use(requireAuth);

const memberSchema = z.object({
  familyId: z.number().int().positive(),
  name: z.string().min(1).max(80),
  gender: z.enum(["M", "F"]),
  birthYear: z.number().int().min(1).max(9999).nullable().optional(),
  deathYear: z.number().int().min(1).max(9999).nullable().optional(),
  generation: z.number().int().positive(),
  fatherId: z.number().int().positive().nullable().optional(),
  motherId: z.number().int().positive().nullable().optional(),
  spouseId: z.number().int().positive().nullable().optional(),
  birthplace: z.string().max(120).nullable().optional(),
  biography: z.string().max(2000).nullable().optional()
});

membersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const familyId = Number(req.query.familyId);
    const keyword = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const generation = req.query.generation ? Number(req.query.generation) : null;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const offset = Number(req.query.offset ?? 0);

    await assertFamilyAccess(req.user!.userId, familyId);

    const countResult = await query<{ total: string }>(
      `
      SELECT COUNT(*) AS total
      FROM members
      WHERE family_id = $1
        AND ($2 = '' OR name ILIKE '%' || $2 || '%')
        AND ($3::INT IS NULL OR generation = $3)
      `,
      [familyId, keyword, generation]
    );

    const result = await query<MemberRow>(
      `
      SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, birthplace, biography
      FROM members
      WHERE family_id = $1
        AND ($2 = '' OR name ILIKE '%' || $2 || '%')
        AND ($3::INT IS NULL OR generation = $3)
      ORDER BY generation, birth_year NULLS LAST, member_id
      LIMIT $4 OFFSET $5
      `,
      [familyId, keyword, generation, limit, offset]
    );

    res.json({ data: result.rows.map(toMember), total: Number(countResult.rows[0].total) });
  })
);

membersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = memberSchema.parse(req.body);
    await assertFamilyAccess(req.user!.userId, input.familyId);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<MemberRow>(
        `
        INSERT INTO members (
          family_id, name, gender, birth_year, death_year, generation,
          father_id, mother_id, spouse_id, birthplace, biography
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, birthplace, biography
        `,
        [
          input.familyId,
          input.name,
          input.gender,
          input.birthYear ?? null,
          input.deathYear ?? null,
          input.generation,
          input.fatherId ?? null,
          input.motherId ?? null,
          input.spouseId ?? null,
          input.birthplace ?? null,
          input.biography ?? null
        ]
      );
      await client.query("UPDATE families SET updated_at = NOW() WHERE family_id = $1", [input.familyId]);
      await client.query("COMMIT");

      res.status(201).json({ data: toMember(result.rows[0]) });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

membersRouter.get(
  "/:memberId/children",
  asyncHandler(async (req, res) => {
    const memberId = Number(req.params.memberId);

    const parent = await query<MemberRow>(
      `SELECT member_id, family_id FROM members WHERE member_id = $1`,
      [memberId]
    );
    if (!parent.rows[0]) {
      throw httpError(404, "Member not found");
    }
    await assertFamilyAccess(req.user!.userId, Number(parent.rows[0].family_id));

    const result = await query<MemberRow>(
      `
      SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, birthplace, biography
      FROM members
      WHERE father_id = $1 OR mother_id = $1
      ORDER BY gender, birth_year NULLS LAST, member_id
      `,
      [memberId]
    );

    res.json({ data: result.rows.map(toMember) });
  })
);

membersRouter.get(
  "/:memberId",
  asyncHandler(async (req, res) => {
    const memberId = Number(req.params.memberId);
    const result = await query<MemberRow>(
      `
      SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, birthplace, biography
      FROM members
      WHERE member_id = $1
      `,
      [memberId]
    );

    const member = result.rows[0];
    if (!member) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    await assertFamilyAccess(req.user!.userId, Number(member.family_id));
    res.json({ data: toMember(member) });
  })
);

membersRouter.patch(
  "/:memberId",
  asyncHandler(async (req, res) => {
    const memberId = Number(req.params.memberId);
    const input = memberSchema.partial().omit({ familyId: true }).parse(req.body);

    const existing = await query<MemberRow>(
      `
      SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id
      FROM members
      WHERE member_id = $1
      `,
      [memberId]
    );

    const member = existing.rows[0];
    if (!member) {
      throw httpError(404, "Member not found");
    }

    await assertFamilyAccess(req.user!.userId, Number(member.family_id));

    const fieldMap = {
      name: "name",
      gender: "gender",
      birthYear: "birth_year",
      deathYear: "death_year",
      generation: "generation",
      fatherId: "father_id",
      motherId: "mother_id",
      spouseId: "spouse_id",
      birthplace: "birthplace",
      biography: "biography"
    } as const;

    const sets: string[] = [];
    const values: unknown[] = [memberId];

    for (const [inputKey, column] of Object.entries(fieldMap)) {
      const key = inputKey as keyof typeof input;
      if (input[key] !== undefined) {
        values.push(input[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }

    if (sets.length === 0) {
      res.json({ data: toMember(member) });
      return;
    }

    const result = await query<MemberRow>(
      `
      UPDATE members
      SET ${sets.join(", ")}
      WHERE member_id = $1
      RETURNING member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, birthplace, biography
      `,
      values
    );
    await query("UPDATE families SET updated_at = NOW() WHERE family_id = $1", [Number(member.family_id)]);

    res.json({ data: toMember(result.rows[0]) });
  })
);

membersRouter.delete(
  "/:memberId",
  asyncHandler(async (req, res) => {
    const memberId = Number(req.params.memberId);
    const existing = await query<MemberRow>(
      `
      SELECT member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id
      FROM members
      WHERE member_id = $1
      `,
      [memberId]
    );

    const member = existing.rows[0];
    if (!member) {
      throw httpError(404, "Member not found");
    }

    await assertFamilyAccess(req.user!.userId, Number(member.family_id));

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        UPDATE members
        SET father_id = CASE WHEN father_id = $1 THEN NULL ELSE father_id END,
            mother_id = CASE WHEN mother_id = $1 THEN NULL ELSE mother_id END,
            spouse_id = CASE WHEN spouse_id = $1 THEN NULL ELSE spouse_id END
        WHERE family_id = $2
          AND (father_id = $1 OR mother_id = $1 OR spouse_id = $1)
        `,
        [memberId, Number(member.family_id)]
      );
      await client.query("DELETE FROM members WHERE member_id = $1", [memberId]);
      await client.query("UPDATE families SET updated_at = NOW() WHERE family_id = $1", [Number(member.family_id)]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.status(204).send();
  })
);
