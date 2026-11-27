-- 0003_skill_categories.sql
-- Skills become one CV entry per category instead of one entry per skill.
--
-- Before: each skill was its own row, the skill in `title` and its category
-- label in `organization`. Categories were assembled on the page from rows
-- that happened to sit next to each other in sort order, so a new skill with
-- the "wrong" number split its category in two.
--
-- After: a skill row IS the category. `title` is the label ("Core stack"),
-- `highlights` is the ordered list of skills, and `sort_order` orders the
-- categories. No schema change: both columns, and their translations, exist.
--
-- This folds the old rows into the new shape. Rows sharing a label become one
-- row whose skills keep their old order; categories are numbered by where
-- their first skill sat. Danish titles carry over as Danish highlights (with
-- English filling any gaps, since highlights translate as a whole list), and a
-- Danish category label carries over as the Danish title. The per-skill
-- highlights, description, location and dates were never shown, so nothing
-- visible is lost.

WITH old AS (
    SELECT id, title, organization, sort_order, created_at,
           NULLIF(translations -> 'da' ->> 'title', '')        AS da_title,
           NULLIF(translations -> 'da' ->> 'organization', '') AS da_label
    FROM cv_entries
    WHERE kind = 'skill'
),
grouped AS (
    SELECT organization                                                   AS label,
           array_agg(title ORDER BY sort_order, created_at)               AS skills,
           array_agg(COALESCE(da_title, title) ORDER BY sort_order, created_at) AS da_skills,
           bool_or(da_title IS NOT NULL)                                  AS has_da_skills,
           max(da_label)                                                  AS da_label,
           min(sort_order)                                                AS first_sort,
           min(created_at)                                                AS first_created
    FROM old
    GROUP BY organization
),
inserted AS (
    INSERT INTO cv_entries (kind, title, highlights, sort_order, translations)
    SELECT 'skill', label, skills,
           (row_number() OVER (ORDER BY first_sort, first_created) - 1)::int,
           CASE WHEN has_da_skills OR da_label IS NOT NULL THEN
               jsonb_build_object('da', jsonb_build_object(
                   'title', COALESCE(da_label, ''),
                   'highlights', CASE WHEN has_da_skills THEN to_jsonb(da_skills)
                                      ELSE '[]'::jsonb END))
           ELSE '{}'::jsonb END
    FROM grouped
    RETURNING id
)
DELETE FROM cv_entries WHERE id IN (SELECT id FROM old);
