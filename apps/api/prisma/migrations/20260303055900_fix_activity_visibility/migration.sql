-- Fix: published activities with isVisible=false should be visible
UPDATE "ClassroomActivity" SET "isVisible" = true WHERE "isPublished" = true AND "isVisible" = false;
