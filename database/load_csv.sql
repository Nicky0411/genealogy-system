BEGIN;
SET CONSTRAINTS ALL DEFERRED;

TRUNCATE invitations, family_users, members, families, users RESTART IDENTITY CASCADE;

\copy users(user_id, username, password_hash, email, created_at, updated_at) FROM 'database/seed/users.csv' WITH (FORMAT csv, HEADER true);
\copy families(family_id, family_name, surname, description, created_by, created_at, updated_at) FROM 'database/seed/families.csv' WITH (FORMAT csv, HEADER true);
\copy family_users(family_id, user_id, role, joined_at) FROM 'database/seed/family_users.csv' WITH (FORMAT csv, HEADER true);
\copy members(member_id, family_id, name, gender, birth_year, death_year, generation, father_id, mother_id, spouse_id, birthplace, biography, created_at, updated_at) FROM 'database/seed/members.csv' WITH (FORMAT csv, HEADER true);

SELECT SETVAL('users_user_id_seq', COALESCE((SELECT MAX(user_id) FROM users), 1), true);
SELECT SETVAL('families_family_id_seq', COALESCE((SELECT MAX(family_id) FROM families), 1), true);
SELECT SETVAL('members_member_id_seq', COALESCE((SELECT MAX(member_id) FROM members), 1), true);

COMMIT;
