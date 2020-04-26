import { Parser } from '../index.js'
import test from 'tape'

test('Basic Tests', t => {
  const Args = new Parser()

  t.ok(Args !== undefined, 'Parser is defined.')

  t.end()
})

test('Escaped parameters', t => {
  const Args = new Parser('-r -hdr "CF-IPCountry=US" -kv "test=something" -kv "a=test" demo.js true')
  const data = Args.data

  t.ok(
    data.r === true &&
    data.hdr === 'CF-IPCountry=US' &&
    data['demo.js'] === true &&
    data.true === true
    , 'Parsed complex input'
  )

  t.end()
})
