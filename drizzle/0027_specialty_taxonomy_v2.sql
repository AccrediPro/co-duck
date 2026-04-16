-- Migration: 0027_specialty_taxonomy_v2
-- Purpose: Coerce coach_profiles.specialties from string[] → Array<{category, subNiches[]}>
--
-- Before: ["Health & Wellness", "Career Coaching", "Life Coaching"]
-- After:  [{"category":"Health & Wellness","subNiches":[]},{"category":"Career","subNiches":[]},{"category":"Life","subNiches":[]}]
--
-- This migration:
-- 1. Iterates over every published coach profile with specialties set
-- 2. For each element in the JSON array, detects if it's already in new shape (has "category" key)
--    and skips; otherwise wraps the string value into the new object shape
-- 3. The coercion maps old labels to canonical category labels where possible;
--    unrecognised strings are kept as-is in the category field with empty subNiches

UPDATE coach_profiles
SET specialties = (
  SELECT jsonb_agg(
    CASE
      -- Already in new shape: has "category" key → pass through
      WHEN jsonb_typeof(elem) = 'object' AND (elem ? 'category') THEN elem
      -- Old string element → wrap into new shape
      ELSE jsonb_build_object(
        'category',
        CASE elem::text
          -- Normalise old labels to new canonical category labels
          WHEN '"Health & Wellness"'   THEN 'Health & Wellness'
          WHEN '"Life Coaching"'       THEN 'Life'
          WHEN '"Career Coaching"'     THEN 'Career'
          WHEN '"Executive Coaching"'  THEN 'Leadership'
          WHEN '"Business Coaching"'   THEN 'Business'
          WHEN '"Relationship Coaching"' THEN 'Relationship'
          WHEN '"Leadership Coaching"' THEN 'Leadership'
          WHEN '"Mindset & Motivation"' THEN 'Mindset'
          WHEN '"Financial Coaching"'  THEN 'Financial'
          WHEN '"Parenting Coaching"'  THEN 'Life'
          WHEN '"Spiritual Coaching"'  THEN 'Life'
          WHEN '"Performance Coaching"' THEN 'Performance'
          -- Unknown string: strip outer quotes and use as-is
          ELSE trim(both '"' from elem::text)
        END,
        'subNiches', '[]'::jsonb
      )
    END
  )
  FROM jsonb_array_elements(specialties) AS elem
)
WHERE specialties IS NOT NULL
  AND jsonb_typeof(specialties) = 'array'
  AND jsonb_array_length(specialties) > 0;
