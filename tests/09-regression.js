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
  t.expect(true, d.more, 'Recognized boolean flag.')
  t.expect(true, d.t, 'Treat unrecognized flags separtely from boolean flag. Expected a flag called "t" to exist. Recognized: ' + d.hasOwnProperty('t'))
  t.end()
})

test('Spaces in flag values', t => {
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

test('Multi-value flags', t => {
  const input = 'test -f a.js -f b.js'
  const cfg = {
    file: {
      alias: 'f',
      allowMultipleValues: true
    }
  }
  const { data } = new Parser(input, cfg)

  t.expect(2, data.file.length, 'Extract multiple values')
  t.end()
})

test('Multi-value quoted and unquoted arguments', t => {
  const input = 'me@domain.com "John Doe" empty -name \'Jill Doe\''
  const cfg = {
    name: { alias: 'n' }
  }
  const { data } = new Parser(input, cfg)

  t.expect('Jill Doe', data.name, 'recognized single quoted flag')
  t.ok(data['me@domain.com'], 'recognized unquoted string with special characters')
  t.ok(data['John Doe'], 'recognized double quoted argument with space in the value')
  t.ok(data.empty, 'recognized unquoted argument')

  t.end()
})

test('Boolean flags followed by unnamed string argument', t => {
  const input = '-rt deno@1.7.5 -dm --verbose ./tests/*-*.js'
  const cfg = {
    runtime: {
      alias: 'rt',
      description: 'The runtime to build for. This does not do anything by default, but will provide an environment variable called RUNTIME to the internal build process (which can be overridden).',
      options: ['node', 'browser', 'deno'],
      default: 'node'
    },
    debugmodule: {
      alias: 'dm',
      description: 'Generate a debugging module containing sourcemaps',
      type: 'boolean'
    },
    verbose: {
      description: 'Add verbose logging. This usually displays the command used to launch the container.',
      type: 'boolean'
    },
  }
  const { data } = new Parser(input, cfg)

  t.expect('deno@1.7.5', data.runtime, 'recognized string flag')
  t.expect(true, data.debugmodule, 'recognized first boolean flag')
  t.expect(true, data.verbose, 'recognized second boolean flag')
  t.expect('./tests/*-*.js', data.unknown1, 'recognized unnamed string argument')

  t.end()
})
