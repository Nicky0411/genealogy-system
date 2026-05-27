import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { query } from "../db/query";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { httpError } from "../middleware/error";
import { assertFamilyAccess } from "../services/access";

export const invitationsRouter = Router();

invitationsRouter.use(requireAuth);

const createInvitationSchema = z.object({
  familyId: z.number().int().positive(),
  username: z.string().min(1).max(64)
});

const invitationActionSchema = z.object({
  action: z.enum(["accept", "reject"])
});

invitationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await query(
      `
      SELECT i.invitation_id AS "invitationId",
             i.family_id AS "familyId",
             f.family_name AS "familyName",
             f.surname,
             inviter.username AS "inviterUsername",
             i.status,
             i.created_at AS "createdAt"
      FROM invitations i
      JOIN families f ON f.family_id = i.family_id
      JOIN users inviter ON inviter.user_id = i.inviter_id
      WHERE i.invitee_id = $1
        AND i.status = 'pending'
      ORDER BY i.created_at DESC
      `,
      [req.user!.userId]
    );

    res.json({
      data: result.rows.map((row) => ({
        ...row,
        invitationId: Number(row.invitationId),
        familyId: Number(row.familyId)
      }))
    });
  })
);

invitationsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createInvitationSchema.parse(req.body);
    await assertFamilyAccess(req.user!.userId, input.familyId);

    const invitee = await query<{ user_id: string; username: string }>(
      "SELECT user_id, username FROM users WHERE username = $1 LIMIT 1",
      [input.username]
    );

    const inviteeRow = invitee.rows[0];
    if (!inviteeRow) {
      throw httpError(404, "User not found");
    }

    const inviteeId = Number(inviteeRow.user_id);
    if (inviteeId === req.user!.userId) {
      throw httpError(400, "Cannot invite yourself");
    }

    const existingAccess = await query(
      `
      SELECT 1
      FROM family_users
      WHERE family_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [input.familyId, inviteeId]
    );

    if (existingAccess.rows.length > 0) {
      throw httpError(400, "User already has access to this family");
    }

    const result = await query(
      `
      INSERT INTO invitations (family_id, inviter_id, invitee_id, status)
      VALUES ($1, $2, $3, 'pending')
      ON CONFLICT (family_id, invitee_id, status)
      DO UPDATE SET inviter_id = EXCLUDED.inviter_id,
                    created_at = NOW(),
                    responded_at = NULL
      RETURNING invitation_id AS "invitationId",
                family_id AS "familyId",
                invitee_id AS "inviteeId",
                status,
                created_at AS "createdAt"
      `,
      [input.familyId, req.user!.userId, inviteeId]
    );

    const row = result.rows[0];
    res.status(201).json({
      data: {
        ...row,
        invitationId: Number(row.invitationId),
        familyId: Number(row.familyId),
        inviteeId
      }
    });
  })
);

invitationsRouter.patch(
  "/:invitationId",
  asyncHandler(async (req, res) => {
    const invitationId = Number(req.params.invitationId);
    const input = invitationActionSchema.parse(req.body);

    const invitationResult = await query<{ invitation_id: string; family_id: string; status: string }>(
      `
      SELECT invitation_id, family_id, status
      FROM invitations
      WHERE invitation_id = $1
        AND invitee_id = $2
      LIMIT 1
      `,
      [invitationId, req.user!.userId]
    );

    const invitation = invitationResult.rows[0];
    if (!invitation) {
      throw httpError(404, "Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw httpError(400, "Invitation has already been handled");
    }

    const nextStatus = input.action === "accept" ? "accepted" : "rejected";
    const familyId = Number(invitation.family_id);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `
        UPDATE invitations
        SET status = $2,
            responded_at = NOW()
        WHERE invitation_id = $1
        `,
        [invitationId, nextStatus]
      );

      if (input.action === "accept") {
        await client.query(
          `
          INSERT INTO family_users (family_id, user_id, role)
          VALUES ($1, $2, 'editor')
          ON CONFLICT (family_id, user_id)
          DO UPDATE SET role = EXCLUDED.role
          `,
          [familyId, req.user!.userId]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    res.json({ data: { invitationId, familyId, status: nextStatus } });
  })
);
