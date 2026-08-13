DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentGender') THEN
    CREATE TYPE "StudentGender" AS ENUM ('MALE', 'FEMALE');
  END IF;
END $$;

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "gender" "StudentGender";

ALTER TABLE "student_registration_requests"
  ADD COLUMN IF NOT EXISTS "gender" "StudentGender";
