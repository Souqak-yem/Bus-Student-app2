import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEmergencyBusList } from '../src/services/emergencyService.js'

test('emergency bus list includes empty active buses in operation', () => {
  const buses = buildEmergencyBusList({
    assignments: [
      {
        id: 'a1',
        busId: 'bus-2',
        studentId: 's1',
        student: { name: 'Student A' },
        sortOrder: 1,
        status: 'scheduled',
        bus: { id: 'bus-2', busNumber: '22', capacity: 30, driver: { id: 'd1', name: 'Driver 2', phone: '123' } },
      },
    ],
    activeBuses: [
      { busId: 'bus-1', status: 'AVAILABLE' },
      { busId: 'bus-2', status: 'AVAILABLE' },
    ],
    busRecords: [
      { busId: 'bus-1', busNumber: '11', capacity: 30, driver: { id: 'd0', name: 'Driver 1', phone: '111' } },
      { busId: 'bus-2', busNumber: '22', capacity: 30, driver: { id: 'd2', name: 'Driver 2', phone: '123' } },
    ],
  })

  assert.equal(buses.length, 2)
  assert.ok(buses.some(b => b.busId === 'bus-1' && b.studentCount === 0), 'empty active bus should be included')
  assert.ok(buses.some(b => b.busId === 'bus-2' && b.studentCount === 1), 'bus with students should remain included')
})

test('emergency bus list seeds empty active buses from activeBus records even without bus table rows', () => {
  const buses = buildEmergencyBusList({
    assignments: [],
    activeBuses: [
      {
        busId: 'bus-22',
        status: 'AVAILABLE',
        bus: {
          id: 'bus-22',
          busNumber: '22',
          capacity: 15,
          driver: { id: 'd22', name: 'Driver 22', phone: '1234' },
        },
      },
    ],
    busRecords: [],
  })

  assert.equal(buses.length, 1)
  assert.equal(buses[0].busId, 'bus-22')
  assert.equal(buses[0].busNumber, '22')
  assert.equal(buses[0].studentCount, 0)
  assert.equal(buses[0].remainingCapacity, 15)
})
