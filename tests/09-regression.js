import { Parser } from '@author.io/arg'
import test from 'tappedout'

test('Boolean Defaults Regression Test', t => {
  const input = '-r --environment development index.js'
  const cfg = {
    port: {
      alias: 'p',
      type: 'number',
      required: true,
      default: 8787,
      description: 'Port'
    },
    cache: {
      alias: 'c',
      description: 'Enable the cache',
      type: Boolean,
      default: true
    },
    reload: {
      alias: 'r',
      type: Boolean,
      description: 'Automatically reload when files change.'
    },
    environment: {
      description: 'The Wrangler environment to load.'
    },
    toml: {
      alias: 'f',
      description: 'Path to the wrangler.toml configuration file.',
      default: './'
    }
  }

  const Args = new Parser(input, cfg)
  const d = Args.data

  t.ok(d.reload === true, 'Recognized boolean flags by alias.')
  t.ok(d.cache === true, 'Recognize boolean defaults when they are not specified in the input.')
  t.end()
})

// This test assures that non-boolean flags positioned
// immediately after a boolean flag are treated separately.
test('Non-Boolean Regression Test', t => {
  const input = '--more t'
  const cfg = {
    test: {
      alias: 't',
      allowMultipleValues: true,
      description: 'test of multiples.'
    },
    more: {
      alias: 'm',
      description: 'more stuff',
      type: Boolean
    }
  }

  const Args = new Parser(input, cfg)
  const d = Args.data
  t.ok(d.more === true, 'Recognized boolean flag.')
  t.ok(d.t === true, 'Treat unrecognized flags separtely from boolean flag. Expected a flag called "t" to exist. Recognized: ' + d.hasOwnProperty('t'))
  t.end()
})

test('Flag values with spaces', t => {
  const input = 'test -c "my connection"'
  const cfg = {
    connection: {
      alias: 'c'
    }
  }
  const { data } = new Parser(input, cfg)

  t.expect('my connection', data.connection, 'Extract escaped values with spaces')
  t.end()
})