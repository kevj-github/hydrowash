/**
 * @jest-environment node
 */
import { optimizeRoute } from '../optimizer'
import type { VRPJob } from '../optimizer'

describe('optimizeRoute', () => {
  it('returns empty array when no jobs', () => {
    expect(optimizeRoute([], [[0]])).toHaveLength(0)
  })

  it('sequences a single job correctly', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 60, timeSlot: 'S10_12' },
    ]
    const result = optimizeRoute(jobs, [[0, 10], [10, 0]])
    expect(result).toHaveLength(1)
    expect(result[0].bookingId).toBe('b1')
    expect(result[0].sequenceOrder).toBe(1)
  })

  it('calculates start time as day-start + travel from depot', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 60, timeSlot: 'S10_12' },
    ]
    const result = optimizeRoute(jobs, [[0, 30], [30, 0]])
    // DAY_START = 10:00 (600 min) + 30 min travel = 10:30
    expect(result[0].estimatedStart).toBe('10:30')
  })

  it('calculates end time as start + duration', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 90, timeSlot: 'S10_12' },
    ]
    const result = optimizeRoute(jobs, [[0, 10], [10, 0]])
    // start 10:10, end 11:40
    expect(result[0].estimatedStart).toBe('10:10')
    expect(result[0].estimatedEnd).toBe('11:40')
  })

  it('sequences two jobs by nearest neighbour', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 30, timeSlot: 'S10_12' },
      { bookingId: 'b2', locationIndex: 2, durationMinutes: 30, timeSlot: 'S10_12' },
    ]
    // depot→b1=5, depot→b2=30, b1→b2=10
    const matrix = [
      [0, 5, 30],
      [5, 0, 10],
      [30, 10, 0],
    ]
    const result = optimizeRoute(jobs, matrix)
    expect(result[0].bookingId).toBe('b1')
    expect(result[1].bookingId).toBe('b2')
    expect(result[0].sequenceOrder).toBe(1)
    expect(result[1].sequenceOrder).toBe(2)
  })

  it('second job start time accounts for first job duration + travel', () => {
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 60, timeSlot: 'S10_12' },
      { bookingId: 'b2', locationIndex: 2, durationMinutes: 30, timeSlot: 'S13_15' },
    ]
    // depot→b1: 10 min, b1→b2: 15 min
    const matrix = [[0, 10, 99], [10, 0, 15], [99, 15, 0]]
    const result = optimizeRoute(jobs, matrix)
    // b1 starts 10:10, ends 11:10; b2 starts 11:25
    expect(result[1].estimatedStart).toBe('11:25')
  })

  it('applies soft preference penalty — prefers in-window job when travel is equal', () => {
    // At 10:00 + 10 min travel = 10:10, which is in S10_12 window.
    // b1 prefers S10_12 (no penalty), b2 prefers S19_21 (+40 penalty).
    // Both have equal travel from depot (10 min).
    const jobs: VRPJob[] = [
      { bookingId: 'b1', locationIndex: 1, durationMinutes: 30, timeSlot: 'S10_12' },
      { bookingId: 'b2', locationIndex: 2, durationMinutes: 30, timeSlot: 'S19_21' },
    ]
    const matrix = [
      [0, 10, 10],
      [10, 0, 5],
      [10, 5, 0],
    ]
    const result = optimizeRoute(jobs, matrix)
    expect(result[0].bookingId).toBe('b1')
  })
})
