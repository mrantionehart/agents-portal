// HARTFELT READY D6 — reading lessons.
//
// A lesson is a `training_videos` row. One whose `body_markdown` holds text is
// a READING lesson; one with a media key is a VIDEO lesson; a row may be both.
// Completion is the learner's own `training_video_progress` row
// (`completed = true`) — the same record video lessons use, so there is one
// progress system. A module that has reading lessons opens its quiz only
// when every reading lesson is complete; the Vault migration enforces the same
// rule in the database (training_quiz_results_reading_prereq), so EASE and the
// portal cannot disagree. Modules without reading lessons — every module that
// existed before D6 — are unchanged.

export interface LessonRow {
  readonly id: string
  readonly body_markdown?: string | null
  readonly youtube_id_en?: string | null
  readonly youtube_id_es?: string | null
  readonly r2_key_en?: string | null
  readonly r2_key_es?: string | null
  readonly certification_id?: string | null
}

export interface LessonProgress {
  readonly video_id: string
  readonly completed: boolean | null
}

export function isReadingLesson(v: LessonRow): boolean {
  return typeof v.body_markdown === 'string' && v.body_markdown.trim().length > 0
}

export function hasMedia(v: LessonRow): boolean {
  return !!(v.youtube_id_en || v.youtube_id_es || v.r2_key_en || v.r2_key_es)
}

/** Reading-lesson completion for one module's lessons. `complete` is true when the module has none. */
export function readingLessonStatus(
  moduleLessons: readonly LessonRow[],
  progress: readonly LessonProgress[] | Readonly<Record<string, LessonProgress | undefined>>,
): { required: number; done: number; complete: boolean; remaining: string[] } {
  const done = new Set<string>()
  const rows = Array.isArray(progress) ? progress : Object.values(progress)
  for (const p of rows as (LessonProgress | undefined)[]) if (p && p.completed === true) done.add(p.video_id)
  const reading = moduleLessons.filter((v) => isReadingLesson(v) && !v.certification_id)
  const remaining = reading.filter((v) => !done.has(v.id)).map((v) => v.id)
  return { required: reading.length, done: reading.length - remaining.length, complete: remaining.length === 0, remaining }
}
