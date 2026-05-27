import { query } from "../db/query";
import { httpError } from "../middleware/error";

interface AccessRow {
  family_id: string;
}

export async function assertFamilyAccess(userId: number, familyId: number) {
  const result = await query<AccessRow>(
    `
    SELECT family_id
    FROM family_users
    WHERE user_id = $1 AND family_id = $2
    LIMIT 1
    `,
    [userId, familyId]
  );

  if (result.rowCount === 0) {
    throw httpError(403, "No permission for this family");
  }
}
