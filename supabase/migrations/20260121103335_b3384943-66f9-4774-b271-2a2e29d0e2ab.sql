-- Add ai_generated column to activities table
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false;

-- Add index for analytics queries
CREATE INDEX IF NOT EXISTS idx_activities_ai_generated 
ON public.activities(organization_id, ai_generated, created_at);