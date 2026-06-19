import { describe, expect, it } from 'vitest'
import {
  createOfflineDecodeSegments,
  getOfflineAudioLimitSamples,
  LOCAL_OFFLINE_MAX_AUDIO_SECONDS,
  offlineAudioExceedsLimit
} from './stt-offline-decode-plan'

function flatten(segments: Float32Array[]): number[] {
  return segments.flatMap((segment) => Array.from(segment))
}

describe('offline decode plan', () => {
  it('returns no segments for empty input', () => {
    expect(Array.from(createOfflineDecodeSegments([], 10, 2))).toEqual([])
  })

  it('preserves sample order across chunk boundaries', () => {
    const segments = Array.from(
      createOfflineDecodeSegments(
        [new Float32Array([1, 2, 3]), new Float32Array([4, 5]), new Float32Array([6])],
        2,
        2
      )
    )

    expect(segments.map((segment) => segment.length)).toEqual([4, 2])
    expect(flatten(segments)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('caps each segment at the configured duration', () => {
    const segments = Array.from(
      createOfflineDecodeSegments([new Float32Array([1, 2, 3, 4, 5])], 2, 1)
    )

    expect(segments.map((segment) => segment.length)).toEqual([2, 2, 1])
  })

  it('detects audio beyond the local offline limit', () => {
    const sampleRate = 16_000
    const limitSamples = getOfflineAudioLimitSamples(sampleRate)

    expect(limitSamples).toBe(sampleRate * LOCAL_OFFLINE_MAX_AUDIO_SECONDS)
    expect(offlineAudioExceedsLimit(limitSamples, sampleRate)).toBe(false)
    expect(offlineAudioExceedsLimit(limitSamples + 1, sampleRate)).toBe(true)
  })
})
