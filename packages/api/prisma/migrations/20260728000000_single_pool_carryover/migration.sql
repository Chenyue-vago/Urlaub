-- New vacation rule: a single 28-day pool (no statutory/contractual split) and
-- carry-over of ALL unused days to the following year, usable through Dec 31
-- (instead of Mar 31). Applies to all years — historical rows are reinterpreted
-- under the single-pool model.

-- 1) leave_requests: drop the leave-type distinction entirely.
ALTER TABLE "leave_requests" DROP COLUMN "type";
DROP TYPE "LeaveType";

-- 2) app_settings: collapse statutory_days + contractual_days into one
--    total_days, and move the carry-over deadline to Dec 31.
ALTER TABLE "app_settings" ADD COLUMN "total_days" INTEGER NOT NULL DEFAULT 28;
-- Preserve any customized total for existing rows (sum of the two old buckets).
UPDATE "app_settings" SET "total_days" = "statutory_days" + "contractual_days";
ALTER TABLE "app_settings" DROP COLUMN "statutory_days";
ALTER TABLE "app_settings" DROP COLUMN "contractual_days";

ALTER TABLE "app_settings" ALTER COLUMN "carry_over_deadline" SET DEFAULT '12-31';
-- New rule applies to all years: existing settings move to the Dec 31 deadline.
UPDATE "app_settings" SET "carry_over_deadline" = '12-31';
