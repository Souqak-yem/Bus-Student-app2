import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTransferTargetBusIds } from '../src/services/operationService.js'

test('transfer target list includes empty active buses in the operation', () => {
  const busIds = buildTransferTargetBusIds({
    currentBusId: 'bus-1',
    assignmentBusIds: ['bus-2'],
    activeBusIds: ['bus-3', 'bus-1'],
  })

  assert.deepEqual(busIds, ['bus-2', 'bus-3'])
})
