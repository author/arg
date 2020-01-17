import { Parser } from '../index.js'
import test from 'tape'

test('Basic Tests', t => {
  const Args = new Parser()

  t.ok(Args !== undefined, 'Parser is defined.')

  t.end()
})
