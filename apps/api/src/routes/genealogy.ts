import { Router } from "express";
import { query } from "../db/query";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { assertFamilyAccess } from "../services/access";
import { getAncestors, getDescendants, getRelationPath, getSpouseAndChildren, getUnmarriedMalesOver50, getBornBeforeGenAverage, getGreatGrandchildrenPerformance } from "../services/genealogyService";

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
    const maxDepth = req.query.maxDepth ? Number(req.query.maxDepth) : undefined;
    const familyId = await getMemberFamilyId(memberId);
    if (!familyId) {
      res.status(404).json({ message: "Member not found" });
      return;
    }
    await assertFamilyAccess(req.user!.userId, familyId);
    res.json({ data: await getAncestors(memberId, maxDepth) });
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
    const maxDepth = Number(req.query.maxDepth ?? 24);
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

// Query 1: spouse and children by member ID
genealogyRouter.get(
  "/members/:memberId/spouse-children",
  asyncHandler(async (req, res) => {
    const memberId = Number(req.params.memberId);
    const familyId = await getMemberFamilyId(memberId);
    if (!familyId) {
      res.status(404).json({ message: "Member not found" });
      return;
    }
    await assertFamilyAccess(req.user!.userId, familyId);
    res.json({ data: await getSpouseAndChildren(memberId) });
  })
);

// Query 4: unmarried males over 50 in a family
genealogyRouter.get(
  "/families/:familyId/unmarried-males-over-50",
  asyncHandler(async (req, res) => {
    const familyId = Number(req.params.familyId);
    await assertFamilyAccess(req.user!.userId, familyId);
    res.json({ data: await getUnmarriedMalesOver50(familyId) });
  })
);

// Query 5: members born before generation average in a family
genealogyRouter.get(
  "/families/:familyId/born-before-gen-avg",
  asyncHandler(async (req, res) => {
    const familyId = Number(req.params.familyId);
    await assertFamilyAccess(req.user!.userId, familyId);
    res.json({ data: await getBornBeforeGenAverage(familyId) });
  })
);

// Performance comparison: great-grandchildren query with/without indexes
genealogyRouter.get(
  "/performance/great-grandchildren",
  asyncHandler(async (req, res) => {
    const memberId = Number(req.query.memberId);
    const familyId = await getMemberFamilyId(memberId);
    if (!familyId) {
      res.status(404).json({ message: "Member not found" });
      return;
    }
    await assertFamilyAccess(req.user!.userId, familyId);
    const result = await getGreatGrandchildrenPerformance(memberId);
    if (!result) {
      res.status(404).json({ message: "Member not found" });
      return;
    }
    res.json({ data: result });
  })
);
