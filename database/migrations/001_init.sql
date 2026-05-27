CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS families (
  family_id BIGSERIAL PRIMARY KEY,
  family_name VARCHAR(120) NOT NULL,
  surname VARCHAR(40) NOT NULL,
  description TEXT,
  revision_time DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS revision_time DATE NOT NULL DEFAULT CURRENT_DATE;

UPDATE families
SET revision_time = created_at::DATE
WHERE revision_time IS NULL;

CREATE TABLE IF NOT EXISTS family_users (
  family_id BIGINT NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (family_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  invitation_id BIGSERIAL PRIMARY KEY,
  family_id BIGINT NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
  inviter_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  invitee_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (family_id, invitee_id, status)
);

CREATE TABLE IF NOT EXISTS members (
  member_id BIGSERIAL PRIMARY KEY,
  family_id BIGINT NOT NULL REFERENCES families(family_id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
  birth_year INT CHECK (birth_year BETWEEN 1 AND 9999),
  death_year INT CHECK (death_year BETWEEN 1 AND 9999),
  generation INT NOT NULL CHECK (generation > 0),
  father_id BIGINT,
  mother_id BIGINT,
  spouse_id BIGINT,
  birthplace VARCHAR(120),
  biography TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_members_family_member UNIQUE (family_id, member_id),
  CONSTRAINT chk_member_lifespan CHECK (
    death_year IS NULL OR birth_year IS NULL OR death_year >= birth_year
  ),
  CONSTRAINT chk_member_not_own_parent CHECK (
    member_id IS NULL OR (
      (father_id IS NULL OR father_id <> member_id)
      AND (mother_id IS NULL OR mother_id <> member_id)
      AND (spouse_id IS NULL OR spouse_id <> member_id)
    )
  ),
  CONSTRAINT fk_members_father FOREIGN KEY (family_id, father_id)
    REFERENCES members(family_id, member_id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_members_mother FOREIGN KEY (family_id, mother_id)
    REFERENCES members(family_id, member_id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT fk_members_spouse FOREIGN KEY (family_id, spouse_id)
    REFERENCES members(family_id, member_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_spouse_unique
  ON members(spouse_id)
  WHERE spouse_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_families_created_by ON families(created_by);
CREATE INDEX IF NOT EXISTS idx_family_users_user_id ON family_users(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee_status ON invitations(invitee_id, status);
CREATE INDEX IF NOT EXISTS idx_members_family_id ON members(family_id);
CREATE INDEX IF NOT EXISTS idx_members_father_id ON members(father_id);
CREATE INDEX IF NOT EXISTS idx_members_mother_id ON members(mother_id);
CREATE INDEX IF NOT EXISTS idx_members_spouse_id ON members(spouse_id);
CREATE INDEX IF NOT EXISTS idx_members_family_generation ON members(family_id, generation);
CREATE INDEX IF NOT EXISTS idx_members_lower_name ON members(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_members_name_trgm ON members USING GIN (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_families_updated_at ON families;
CREATE TRIGGER trg_families_updated_at
BEFORE UPDATE ON families
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
BEFORE UPDATE ON members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION validate_member_relationships()
RETURNS TRIGGER AS $$
DECLARE
  relative_family BIGINT;
  relative_gender CHAR(1);
  relative_birth INT;
  relative_generation INT;
BEGIN
  IF NEW.father_id IS NOT NULL THEN
    SELECT family_id, gender, birth_year, generation
      INTO relative_family, relative_gender, relative_birth, relative_generation
      FROM members
      WHERE member_id = NEW.father_id;

    IF FOUND THEN
      IF relative_gender <> 'M' THEN
        RAISE EXCEPTION 'father gender must be M';
      END IF;
      IF NEW.birth_year IS NOT NULL AND relative_birth IS NOT NULL AND relative_birth >= NEW.birth_year THEN
        RAISE EXCEPTION 'father birth year must be earlier than child birth year';
      END IF;
      IF relative_generation >= NEW.generation THEN
        RAISE EXCEPTION 'father generation must be earlier than child generation';
      END IF;
    END IF;
  END IF;

  IF NEW.mother_id IS NOT NULL THEN
    SELECT family_id, gender, birth_year, generation
      INTO relative_family, relative_gender, relative_birth, relative_generation
      FROM members
      WHERE member_id = NEW.mother_id;

    IF FOUND THEN
      IF relative_gender <> 'F' THEN
        RAISE EXCEPTION 'mother gender must be F';
      END IF;
      IF NEW.birth_year IS NOT NULL AND relative_birth IS NOT NULL AND relative_birth >= NEW.birth_year THEN
        RAISE EXCEPTION 'mother birth year must be earlier than child birth year';
      END IF;
      IF relative_generation >= NEW.generation THEN
        RAISE EXCEPTION 'mother generation must be earlier than child generation';
      END IF;
    END IF;
  END IF;

  IF NEW.spouse_id IS NOT NULL THEN
    SELECT family_id INTO relative_family
      FROM members
      WHERE member_id = NEW.spouse_id;

    IF FOUND AND relative_family IS DISTINCT FROM NEW.family_id THEN
      RAISE EXCEPTION 'spouse must belong to the same family';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_members_validate_relationships ON members;
CREATE TRIGGER trg_members_validate_relationships
BEFORE INSERT OR UPDATE OF family_id, father_id, mother_id, spouse_id, birth_year, generation
ON members
FOR EACH ROW EXECUTE FUNCTION validate_member_relationships();
