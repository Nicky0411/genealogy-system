export type Gender = "M" | "F";
export type FamilyRole = "owner" | "editor" | "viewer";

export interface Family {
  familyId: number;
  familyName: string;
  surname: string;
  description?: string | null;
  role?: FamilyRole;
}

export interface Member {
  memberId: number;
  familyId: number;
  name: string;
  gender: Gender;
  birthYear?: number | null;
  deathYear?: number | null;
  generation: number;
  fatherId?: number | null;
  motherId?: number | null;
  spouseId?: number | null;
}

export interface RelationPath {
  depth: number;
  path: Member[];
}
