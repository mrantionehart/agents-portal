/**
 * @jest-environment node
 */
import { hasMedia, isReadingLesson, readingLessonStatus } from '@/lib/training/reading-lessons'

const reading = (id: string) => ({ id, body_markdown: '## T\n\nText.' })
const video = (id: string) => ({ id, r2_key_en: 'k.mp4' })

describe('reading-lesson rules', () => {
  it('classifies reading, video, both and neither', () => {
    expect([isReadingLesson(reading('a')), hasMedia(reading('a'))]).toEqual([true, false])
    expect([isReadingLesson(video('b')), hasMedia(video('b'))]).toEqual([false, true])
    const both = { id: 'c', body_markdown: 'x', youtube_id_en: 'y' }
    expect([isReadingLesson(both), hasMedia(both)]).toEqual([true, true])
    expect(isReadingLesson({ id: 'd', body_markdown: '   ' })).toBe(false)
  })
  it('a module with no reading lessons is always complete (existing video courses unchanged)', () => {
    expect(readingLessonStatus([video('v1'), video('v2')], [])).toMatchObject({ required: 0, complete: true })
  })
  it('requires every reading lesson; started-but-not-completed does not count', () => {
    const ls = ['1', '2', '3', '4', '5', '6'].map((n) => reading(`v_v1_14_${n}`))
    const five = ls.slice(0, 5).map((l) => ({ video_id: l.id, completed: true }))
    expect(readingLessonStatus(ls, five)).toMatchObject({ done: 5, required: 6, complete: false, remaining: ['v_v1_14_6'] })
    expect(readingLessonStatus(ls, [...five, { video_id: 'v_v1_14_6', completed: false }]).complete).toBe(false)
    expect(readingLessonStatus(ls, [...five, { video_id: 'v_v1_14_6', completed: true }]).complete).toBe(true)
  })
  it('accepts the page\'s progress map and ignores certification lessons', () => {
    const ls = [reading('a'), { ...reading('cert'), certification_id: 'x' }]
    expect(readingLessonStatus(ls, { a: { video_id: 'a', completed: true } })).toMatchObject({ required: 1, complete: true })
  })
})
