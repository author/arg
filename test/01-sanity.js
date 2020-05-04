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

  // console.log(new Parser('cfw run -r -hdr "CF-IPCountry=US" -kv "test=something" -kv "a=test" demo.js', {
  //   kv: {
  //     allowMultipleValues: true
  //   },
  //   header: {
  //     alias: 'hdr',
  //     allowMultipleValues: true
  //   }
  // }).data)

  t.end()
})

test('Support custom validation methods', t => {
  const input = 'test -v ok -b notok'
  const cfg = {
    value: {
      alias: 'v',
      validate: vl => vl === 'ok'
    }
  }

  let Args = new Parser(input, cfg)

  t.ok(Args.violations.length === 0, `Expected no violations, recognized ${Args.violations.length}.`)

  cfg.bad = {
    alias: 'b',
    validate: value => value === 'ok'
  }

  Args = new Parser(input, cfg)
  t.ok(Args.violations.length === 1, `Expected 1 violation, recognized ${Args.violations.length}.`)

  Args = new Parser('test --pass abbbbc', {
    pass: {
      validate: /^a.*c$/gi
    }
  })

  t.ok(Args.violations.length === 0, `Expected no violations, recognized ${Args.violations.length}.`)

  t.end()
})
