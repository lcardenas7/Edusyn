-- Add first-class Live Quiz activity types
ALTER TYPE "ClassroomActivityType" ADD VALUE IF NOT EXISTS 'LIVE_QUIZ';
ALTER TYPE "ClassroomActivityType" ADD VALUE IF NOT EXISTS 'HOME_QUIZ';
