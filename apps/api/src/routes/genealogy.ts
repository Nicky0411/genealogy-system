import { Router } from "express";
import { query } from "../db/query";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { assertFamilyAccess } from "../services/access";
import { getAncestors, getDescendants, getRelationPath } from "../services/genealogyService";

export const genealogyRouter = Router();

genealogyRouter.use(requireAuth);

async function getMemberFamilyId(memberId: number) {
  const result = await query<{ family_id: string }>("SELECT family_id FROM members WHERE member_id = $1", [memberId]);
  return result.rows[0] ? Number(result.rows[0].family_id) : null;
}

genealogyRouter.get(
  "/members/:memberId/ancestors",
  asyncHandler(async (req, res) => {
    const memberId = Number(req.params.memberId);
    const familyId = await getMemberFamilyId(memberId);
    if (!familyId) {
      res.status(404).json({ message: "Member not found" });
      return;
    }
    await assertFamilyAccess(req.user!.userId, familyId);
    res.json({ data: await getAncestors(memberId) });
  })
);

genealogyRouter.get(
  "/members/:memberId/descendants",
  asyncHandler(async (req, res) => {
    const memberId = Number(req.params.memberId);
    const familyId = await getMemberFamilyId(memberId);
    if (!familyId) {
      res.status(404).json({ message: "Member not found" });
      return;
    }
    await assertFamilyAccess(req.user!.userId, familyId);
    res.json({ data: await getDescendants(memberId) });
  })
);

genealogyRouter.get(
  "/members/:memberId/path",
  asyncHandler(async (req, res) => {
    const startMemberId = Number(req.params.memberId);
    const targetMemberId = Number(req.query.targetId);
    const maxDepth = Number(req.query.maxDepth ?? 20);
    const familyId = await getMemberFamilyId(startMemberId);

    if (!familyId) {
      res.status(404).json({ message: "Member not found" });
      return;
    }

    await assertFamilyAccess(req.user!.userId, familyId);
    res.json({ data: await getRelationPath(startMemberId, targetMemberId, maxDepth) });
  })
);

genealogyRouter.get(
  "/families/:familyId/longest-lived-generation",
  asyncHandler(async (req, res) => {
    const familyId = Number(req.params.familyId);
    await assertFamilyAccess(req.user!.userId, familyId);

    const result = await query(
      `
      SELECT generation,
             COUNT(*)::INT AS "memberCount",
             ROUND(AVG(death_year - birth_year)::NUMERIC, 2) AS "averageLifespan"
      FROM members
      WHERE family_id = $1
        AND birth_year IS NOT NULL
        AND death_year IS NOT NULL
      GROUP BY generation
      HAVING COUNT(*) >= 2
      ORDER BY "averageLifespan" DESC, "memberCount" DESC
      LIMIT 1
      `,
      [familyId]
    );

    res.json({ data: result.rows[0] ?? null });
  })
);
