import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { query } from "../db/query";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { assertFamilyAccess } from "../services/access";

export const familiesRouter = Router();

familiesRouter.use(requireAuth);

const familySchema = z.object({
  familyName: z.string().min(1).max(120),
  surname: z.string().min(1).max(40),
  description: z.string().max(2000).optional()
});

familiesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await query(
      `
      SELECT f.family_id AS "familyId",
             f.family_name AS "familyName",
             f.surname,
             f.description,
             f.updated_at AS "revisionTime",
             creator.username AS "createdByUsername",
             fu.role,
             COUNT(m.member_id)::INT AS "memberCount"
      FROM families f
      JOIN family_users fu ON fu.family_id = f.family_id
      JOIN users creator ON creator.user_id = f.created_by
      LEFT JOIN members m ON m.family_id = f.family_id
      WHERE fu.user_id = $1
      GROUP BY f.family_id, creator.username, fu.role
      ORDER BY f.created_at DESC
      `,
      [req.user!.userId]
    );
    res.json({
      data: result.rows.map((row) => ({
        ...row,
        familyId: Number(row.familyId)
      }))
    });
  })
);

familiesRouter.get(
  "/:familyId/stats",
  asyncHandler(async (req, res) => {
    const familyId = Number(req.params.familyId);
    await assertFamilyAccess(req.user!.userId, familyId);

    const result = await query(
      `
      SELECT
        COUNT(*)::INT AS total,
        COUNT(CASE WHEN gender = 'M' THEN 1 END)::INT AS male,
        COUNT(CASE WHEN gender = 'F' THEN 1 END)::INT AS female
      FROM members
      WHERE family_id = $1
      `,
      [familyId]
    );

    res.json({ data: result.rows[0] });
  })
);

familiesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = familySchema.parse(req.body);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      const familyResult = await client.query(
        `
        INSERT INTO families (family_name, surname, description, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING family_id AS "familyId",
                  family_name AS "familyName",
                  surname,
                  description,
                  updated_at AS "revisionTime"
        `,
        [input.familyName, input.surname, input.description ?? null, req.user!.userId]
      );
      await client.query(
        `
        INSERT INTO family_users (family_id, user_id, role)
        VALUES ($1, $2, 'owner')
        `,
        [familyResult.rows[0].familyId, req.user!.userId]
      );
      await client.query("COMMIT");
      res.status(201).json({
        data: {
          ...familyResult.rows[0],
          familyId: Number(familyResult.rows[0].familyId),
          createdByUsername: req.user!.username,
          role: "owner",
          memberCount: 0
        }
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

familiesRouter.patch(
  "/:familyId",
  asyncHandler(async (req, res) => {
    const familyId = Number(req.params.familyId);
    const input = familySchema.partial().parse(req.body);
    await assertFamilyAccess(req.user!.userId, familyId);

    const result = await query(
      `
      UPDATE families
      SET family_name = COALESCE($2, family_name),
          surname = COALESCE($3, surname),
          description = COALESCE($4, description)
      WHERE family_id = $1
      RETURNING family_id AS "familyId",
                family_name AS "familyName",
                surname,
                description,
                updated_at AS "revisionTime"
      `,
      [familyId, input.familyName ?? null, input.surname ?? null, input.description ?? null]
    );
    res.json({
      data: {
        ...result.rows[0],
        familyId: Number(result.rows[0].familyId)
      }
    });
  })
);

familiesRouter.delete(
  "/:familyId",
  asyncHandler(async (req, res) => {
    const familyId = Number(req.params.familyId);
    await assertFamilyAccess(req.user!.userId, familyId);
    await query("DELETE FROM families WHERE family_id = $1", [familyId]);
    res.status(204).send();
  })
);
