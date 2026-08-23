-- Add notification preferences and prompt tracking fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hasSeenNotificationPrompt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notificationPrefs" JSONB;

-- Add deviceType field to push_subscriptions table
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "deviceType" VARCHAR(255);
