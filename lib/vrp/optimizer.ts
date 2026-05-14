import type { TimeSlot } from '@/lib/types'

export interface VRPJob {
  bookingId: string
  locationIndex: number
  durationMinutes: number
  timeSlot: TimeSlot
}

export interface RouteStop {
  bookingId: string
  sequenceOrder: number
  estimatedStart: string
  estimatedEnd: string
  travelFromPrevMinutes: number
  locationIndex: number
}

const DAY_START = 10 * 60 // 10:00 — earliest slot start

// Time window boundaries in minutes from midnight
const SLOT_WINDOWS: Record<TimeSlot, [number, number]> = {
  S10_12: [10 * 60, 12 * 60],
  S13_15: [13 * 60, 15 * 60],
  S15_17: [15 * 60, 17 * 60],
  S17_19: [17 * 60, 19 * 60],
  S19_21: [19 * 60, 21 * 60],
}

const SLOT_ORDER: Record<TimeSlot, number> = {
  S10_12: 0, S13_15: 1, S15_17: 2, S17_19: 3, S19_21: 4,
}

function slotPenalty(arrivalMinutes: number, slot: TimeSlot): number {
  const [start, end] = SLOT_WINDOWS[slot]
  if (arrivalMinutes >= start && arrivalMinutes < end) return 0
  // Find which slot window the arrival falls into
  const arrivalSlotIdx = Object.values(SLOT_WINDOWS).findIndex(
    ([s, e]) => arrivalMinutes >= s && arrivalMinutes < e,
  )
  const jobSlotIdx = SLOT_ORDER[slot]
  const diff = Math.abs(jobSlotIdx - (arrivalSlotIdx === -1 ? 0 : arrivalSlotIdx))
  return diff === 1 ? 20 : 40
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function optimizeRoute(
  jobs: VRPJob[],
  travelMinutes: number[][],
): RouteStop[] {
  if (jobs.length === 0) return []

  const pending = [...jobs]
  let currentIndex = 0 // depot
  let currentTime = DAY_START
  let sequenceOrder = 1
  const result: RouteStop[] = []

  while (pending.length > 0) {
    let bestIdx = 0
    let bestScore = Infinity

    for (let i = 0; i < pending.length; i++) {
      const travel = travelMinutes[currentIndex][pending[i].locationIndex]
      const arrivalTime = currentTime + travel
      const score = travel + slotPenalty(arrivalTime, pending[i].timeSlot)
      if (score < bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    const job = pending.splice(bestIdx, 1)[0]
    const travel = travelMinutes[currentIndex][job.locationIndex]
    const arrivalTime = currentTime + travel
    const endTime = arrivalTime + job.durationMinutes

    result.push({
      bookingId: job.bookingId,
      sequenceOrder: sequenceOrder++,
      estimatedStart: minutesToTime(arrivalTime),
      estimatedEnd: minutesToTime(endTime),
      travelFromPrevMinutes: travel,
      locationIndex: job.locationIndex,
    })

    currentTime = endTime
    currentIndex = job.locationIndex
  }

  return result
}
