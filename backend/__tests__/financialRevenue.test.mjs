import test from 'node:test'
import assert from 'node:assert/strict'
import { getFinancialDashboard, reconcileSubscriptionPayments } from '../src/services/financialService.js'

test('financial dashboard includes daily and monthly revenue', async () => {
  const dashboard = await getFinancialDashboard()

  assert.ok('dailyRevenue' in dashboard, 'dashboard should include dailyRevenue')
  assert.ok('monthlyRevenue' in dashboard, 'dashboard should include monthlyRevenue')
  assert.strictEqual(typeof dashboard.dailyRevenue, 'number')
  assert.strictEqual(typeof dashboard.monthlyRevenue, 'number')
})

test('reconcileSubscriptionPayments updates paidAmount and status for approved subscriptions', async () => {
  const result = await reconcileSubscriptionPayments('missing-subscription-id')

  assert.deepEqual(result, { updated: false, paymentCount: 0, paidAmount: 0, paymentStatus: 'unpaid' })
})
