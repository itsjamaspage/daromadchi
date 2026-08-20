/**
 * Local stand-in for Uzum's API, used to exercise the payout probe's parser and
 * POST classifier without a round-trip. Deliberately includes the two shapes
 * that decide the outcome: a finance status enum WIDER than the four we send,
 * and both a read-shaped and a mutation-shaped POST on payout paths.
 *
 *   node scripts/probe-uzum-payout-surface.fixture.mjs &
 *   UZUM_PROBE_BASE=http://127.0.0.1:5599 DATABASE_URL=… npx tsx scripts/probe-uzum-payout-surface.ts
 */
import { createServer } from 'node:http'

const spec = {
  openapi: '3.0.1',
  paths: {
    '/v1/shops': { get: { operationId: 'getShops' } },
    '/v1/product/shop/{shopId}': { get: { operationId: 'getProducts' } },
    '/v1/finance/orders': {
      get: {
        operationId: 'getFinanceOrders',
        parameters: [
          { name: 'shopIds', in: 'query', required: true, schema: { type: 'array', items: { type: 'integer' } } },
          // WIDER than the four we send — this is the drift the check hunts for.
          { name: 'statuses', in: 'query', schema: { type: 'array', items: {
            type: 'string',
            enum: ['TO_WITHDRAW', 'PROCESSING', 'CANCELED', 'PARTIALLY_CANCELLED', 'WITHDRAWN'],
          } } },
        ],
        responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/FinanceOrders' } } } } },
      },
    },
    '/v1/finance/expenses': { get: { operationId: 'getExpenses' } },
    // Read-shaped POST — should surface as an allowlist candidate.
    '/v1/finance/payments': {
      post: { operationId: 'getPaymentsList', summary: 'List payments for a period',
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { page: { type: 'integer' } } } } } } },
    },
    // Mutation-shaped POST — must NEVER surface as a candidate.
    '/v1/finance/payouts': {
      post: { operationId: 'createPayoutRequest', summary: 'Create a payout request' },
    },
    // In spec, GET only.
    '/v1/finance/operations': { get: { operationId: 'getOperations' } },
  },
  components: {
    schemas: {
      FinanceOrders: { type: 'object', properties: {
        orderItems: { type: 'array', items: { $ref: '#/components/schemas/FinanceOrderItem' } },
        totalElements: { type: 'integer' },
      } },
      FinanceOrderItem: { type: 'object', properties: {
        id: { type: 'integer' }, orderId: { type: 'integer' },
        status: { type: 'string', enum: ['TO_WITHDRAW', 'PROCESSING', 'CANCELED', 'PARTIALLY_CANCELLED', 'WITHDRAWN'] },
        withdrawnProfit: { type: 'number' }, sellerProfit: { type: 'number' },
        // A field we do not map today — the probe should make it visible.
        payoutBatchId: { type: 'string' },
      } },
    },
  },
}

const expenses = { payload: { data: { expenses: [
  { id: 1, type: 'OUTCOME', title: 'Вывод средств', amount: 50300, date: 1755100000000, status: 'COMPLETED' },
  { id: 2, type: 'OUTCOME', title: 'Реклама', amount: 12000, date: 1755000000000, status: 'COMPLETED' },
] } } }

createServer((req, res) => {
  const path = req.url.split('?')[0]
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (path.endsWith('/swagger/api-docs') || path.endsWith('/swagger/v3/api-docs')) return send(200, spec)
  if (path === '/v1/finance/expenses') return send(200, expenses)
  // Everything else answers the way Uzum denies a role — JSON envelope, so the
  // probe's origin check correctly attributes it to Uzum and not the network.
  return send(403, { errors: [{ code: 'RBAC', message: 'RBAC: access denied' }], payload: null, timestamp: Date.now() })
}).listen(5599, '127.0.0.1', () => console.error('fixture on :5599'))
