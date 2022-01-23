# Argument Parser ![Version](https://img.shields.io/github/v/tag/author/arg?label=Latest&style=for-the-badge)

There are many CLI argument parsers for Node.js. This differs in the following ways:

1. Uses modern [ES Modules](https://nodejs.org/api/esm.html#esm_ecmascript_modules) with private properties (easy to read).
1. No dependencies.
1. Separation of Concerns.*
1. Also works in browsers.

After writing countless CLI utilities, it became clear that the majority of most existing libraries contain a ton of code that really isn't necessary 99% of the time. This library is still very powerful, but works very transparently, with a minimal API.

> **This tool is just a parser.** It parses arguments and optionally enforces developer-defined rules. It exposes all relevant aspects of the arguments so developers can use the parsed content in any manner. It does not attempt to autogenerate help screens or apply any other "blackbox" functionality. WYSIWYG.<br/><br/>
**If your tool needs more management/organization features, see the [@author.io/shell](https://github.com/author/shell) micro-framework** _(which is built atop this library)_**.**

> This library is part of the [CLI-First development initiative](https://github.com/coreybutler/clifirst).

## Verbose Example

**Install:** `npm install @author.io/arg`

The following example automatically parses the `process.argv` variable (i.e. flags passed to a Node script) and strips the first two arguments (the executable name (node) and the script name). It then enforces several rules.

```javascript
#!/usr/bin/env node --experimental-modules
import Args from '@author.io/arg'

// Require specific flags
Args.require('a', 'b', 'input')

// Optionally specify flag types
Args.types({
  a: Boolean, // accepts primitives or strings, such as 'boolean'

})

// Optionally specify default values for specific flags
Args.defaults({
  c: 'test'
})

// Optionally alias flags
Args.alias({
  input: 'in'
})

// Optionally specify a list of possible flag values (autocreates the flag if it does not already exist, updates options if it does)
Args.setOptions('name', 'john', 'jane')

// Allow a flag to accept multiple values (applies when the same flag is defined multiple times).
Args.allowMultipleValues('c')

// Do not allow unrecognized flags
Args.disallowUnrecognized() 

// Enforce all of the rules specified above, by exiting with an error when an invalid configuration is identified.
Args.enforceRules()

console.log(Args.data)
```

Using the script above in a `mycli.js` file could be executed as follows:

```sh
./mycli.js -a false -b "some value" -in testfile.txt -c "ignored" -c "accepted" -name jane
```

_Output:_
```json
{
  "a": false, 
  "b": "some value", 
  "c": "accepted",
  "input": "testfile.txt",
  "name": "jane"
}
```

## Simpler Syntax

For brevity, there is also a `configure` method which will automatically do all of the things the first script does, but with minimal code.

```javascript
#!/usr/bin/env node --experimental-modules
import Args from '@author.io/arg'

Args.configure({
  a: {
    required: true,
    type: 'boolean'
  },
  b: {
    required: true
  },
  c: {
    default: 'test',
    allowMultipleValues: true
  },
  input: {
    alias: 'in'
  },
  name: {
    options: ['john', 'jane']
  }
})

// Do not allow unrecognized flags
Args.disallowUnrecognized()

// Enforce all of the rules specified above, by exiting with an error when an invalid configuration is identified.
Args.enforceRules()

console.log(Args.data)
```

It is also possible to parse something other than than the `process.argv` variable. An alternative is to provide an array of arguments.

_Notice the change in the `import` and the optional configuration._

```javascript
#!/usr/bin/env node --experimental-modules
import { Parser } from '@author.io/arg'

let Args = new Parser(myArgs [,cfg])

console.log(Args.data)
```

## API/Usage

The source code is pretty easy to figure out, but here's an overview:

## Configuring Parser Logic

There are two ways to configure the parser. A single `configure()` method can describe everything, or individual methods can be used to dynamically define the parsing logic.

### Using `configure()`

The `configure()` method accepts a shorthand (yet-easily-understood) configuration object.

```javascript
Args.configure({
  flagname: {
    required: true/false,
    default: value,
    type: string_or_primitive, // example: 'boolean' or Boolean
    alias: string,
    allowMultipleValues: true/false,
    options: [...],
    validate: function(){}/RegExp
  }, {
    ...
  }
})
```

_Purpose:_

- `required` - Indicates the flag must be present in the command.
- `default` - A value to use when the flag is not specified.
- `type` - The data type. Supports primitives like `Boolean` or their text (typeof) equivalent (i.e. "`boolean`").
- `alias` - A string representing an alternative name for the flag.
- `aliases` - Support for multiple aliases.
- `allowMultipleValues` - If a flag is specified more than once, capture all values (instead of only the last one specified).
- `options` - An array of valid values for the flag.
- `validate` - This is a function or regular expression that determines whether the value of the flag is valid or not. A function receives the value as the only argument and is expected to return `true` or `false` (where `true` means the value is valid). If a RegExp is provided, the [RegExp.test()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test) method is executed against the flag value. The validate feature is used **in addition** to other validation mechanisms (options, typing, etc).

### Using Individual Methods

The following methods can be used to dynamically construct the parsing logic, or modify existing logic.

#### require('flag1', 'flag2', ...)

Require the presence of specific flags amongst the arguments. Automatically executes `recognize` for all required flags.

#### recognize('flag1', 'flag2', ...)

Register "known" flags. This is useful when you want to prevent unrecognized flags from being passed to the application.

#### types({...})

Identify the data type of a flag or series of flags. Automatically executes `recognize` for any flags specified amongst the data types.

#### defaults({...})

Identify default values for flags. 

Automatically executes `recognize` for any flags specified amongst the defaults.

#### alias({...})

Identify aliases for recognized flags. 

Automatically executes `recognize` for any flags specified amongst the defaults.

#### allowMultipleValues('flag1', 'flag2', ...)

By default, if the same flag is defined multiple times, only the last value is recognized. Setting `allowMultiple` on a flag will capture all values (as an array).

Automatically executes `recognize` for any flags specified amongst the defaults.

#### setOptions('flag', 'optionA', 'optionB')

A list/enumeration of values will be enforced _if_ the flag is set. If a flag contains a value not present in the list, a violation will be recognized.

Automatically executes `recognize` for any flags specified amongst the defaults.

---

## Enforcement Methods

Enforcement methods are designed to help toggle rules on/off as needed.

There is no special method to enforce a flag value to be within a list of valid options (enumerability), _because this is enforced automatically_.

#### disallowUnrecognized()

Sets a rule to prevent the presence of any unrecognized flags.

#### allowUnrecognized()

Sets a rule to allow the presence of unrecognized flags (this is the default behavior).

#### ignoreDataTypes()

This will ignore data type checks, even if the `types` method has been used to enforce data types.

#### enforceDataTypes()

This will enforce data type checks. This is the default behavior.

---

## Helper Methods

The following helper methods are made available for developers who need quick access to flags and enforcement functionality.

#### enforceRules()

This method can be used within a process to validate flags and exit with error when validation fails.

#### value(flagname)

Retrieve the value of a flag. This accepts flags or aliases. If the specified flag does not exist, a value of `undefined` is returned.

#### exists(flagname)

Returns a boolean value indicating the flag exists.

---
## Defining Metadata

The following methods are made available to manage metadata about flags.

#### describe(flagname, description)

Use this message to store a description of the flag. This will throw an error if the flag does not exist.

#### description(flagname)

Retrieve the description of a flag. Returns `null` if no description is found.

---

## Parser Properties

These are readable properties of the parser. For example:

```javascript
import Args from '@author.io/arg'

Args.configure({...})

console.log(Args.flags, Args.data, ...)
```

- `flags`: An array of the unique flag names passed to the application.
- `data`: A key/value object representing all data passed to the application. If a flag is passed in more than once and duplicates are _not_ suppressed, the value will be an array.
- `length` The total number of arguments passed to the application.
- `valid` A boolean representing whether all of the validation rules passed or not.
- `violations` An array of violations (this is an empty array when everything is valid).
