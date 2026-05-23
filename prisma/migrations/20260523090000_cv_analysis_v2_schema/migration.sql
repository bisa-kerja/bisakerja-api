ALTER TABLE "cv_analysis_results"
  ADD COLUMN "schema_version" TEXT NOT NULL DEFAULT 'cv-analysis-v2',
  ADD COLUMN "top_actionables" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "section_reviews" JSONB NOT NULL DEFAULT '[]';

UPDATE "cv_analysis_results"
SET
  "overall_impression" = to_jsonb(
    CASE
      WHEN jsonb_typeof("overall_impression") = 'object' THEN COALESCE("overall_impression"->>'summary', '')
      WHEN jsonb_typeof("overall_impression") = 'string' THEN COALESCE("overall_impression"#>>'{}', '')
      ELSE COALESCE("overall_impression"::text, '')
    END
  ),
  "ats_friendliness" = CASE
    WHEN jsonb_typeof("ats_friendliness") = 'object' THEN jsonb_build_object(
      'score', COALESCE(("ats_friendliness"->>'score')::int, 0),
      'summary', CASE
        WHEN jsonb_typeof("ats_friendliness"->'issues') = 'array' AND jsonb_array_length("ats_friendliness"->'issues') > 0
          THEN COALESCE("ats_friendliness"->'issues'->>0, 'Struktur CV cukup ramah ATS.')
        ELSE 'Struktur CV cukup ramah ATS.'
      END
    )
    ELSE jsonb_build_object('score', 0, 'summary', 'Struktur CV cukup ramah ATS.')
  END,
  "top_actionables" = CASE
    WHEN jsonb_typeof("actionable_improvements") = 'array'
      THEN (
        SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
        FROM (
          SELECT value
          FROM jsonb_array_elements("actionable_improvements")
          LIMIT 3
        ) trimmed
      )
    ELSE '[]'::jsonb
  END,
  "section_reviews" = '[]'::jsonb;

ALTER TABLE "cv_analysis_results"
  ALTER COLUMN "overall_impression" TYPE TEXT USING COALESCE("overall_impression"#>>'{}', '');

ALTER TABLE "cv_analysis_results"
  DROP COLUMN "keyword_optimization",
  DROP COLUMN "experience_quantification",
  DROP COLUMN "actionable_improvements";
