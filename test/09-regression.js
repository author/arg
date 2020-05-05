import { Parser } from '../index.js'
import test from 'tape'

test('Boolean Regression Test', t => {
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
