export const OFFLINE_DECODE_CHUNK_SECONDS = 15
export const LOCAL_OFFLINE_MAX_AUDIO_SECONDS = 10 * 60

type SegmentPiece = {
  chunk: Float32Array
  start: number
  end: number
}

export function getOfflineAudioLimitSamples(sampleRate: number): number {
  return Math.floor(sampleRate * LOCAL_OFFLINE_MAX_AUDIO_SECONDS)
}

export function offlineAudioExceedsLimit(totalSamples: number, sampleRate: number): boolean {
  return totalSamples > getOfflineAudioLimitSamples(sampleRate)
}

export function* createOfflineDecodeSegments(
  chunks: readonly Float32Array[],
  sampleRate: number,
  chunkSeconds = OFFLINE_DECODE_CHUNK_SECONDS
): Generator<Float32Array> {
  const maxSegmentSamples = Math.max(1, Math.floor(sampleRate * chunkSeconds))
  let pieces: SegmentPiece[] = []
  let segmentLength = 0

  const flush = function* (): Generator<Float32Array> {
    if (segmentLength === 0) {
      return
    }
    const segment = new Float32Array(segmentLength)
    let offset = 0
    for (const piece of pieces) {
      const part = piece.chunk.subarray(piece.start, piece.end)
      segment.set(part, offset)
      offset += part.length
    }
    yield segment
    pieces = []
    segmentLength = 0
  }

  for (const chunk of chunks) {
    let offset = 0
    while (offset < chunk.length) {
      const remaining = chunk.length - offset
      const available = maxSegmentSamples - segmentLength
      const take = Math.min(remaining, available)
      pieces.push({ chunk, start: offset, end: offset + take })
      segmentLength += take
      offset += take

      if (segmentLength === maxSegmentSamples) {
        yield* flush()
      }
    }
  }

  yield* flush()
}
