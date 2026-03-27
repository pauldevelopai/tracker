-- Add notes column to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS notes TEXT;
