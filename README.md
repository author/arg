# Argument Parser

There are many CLI argument parsers for Node.js. This differs in the following ways:

1. Uses modern [ES Modules](https://nodejs.org/api/esm.html#esm_ecmascript_modules) with private properties (easy to read).
1. No dependencies.
1. Separation of Concerns.*

After writing countless CLI utilities, it became clear that the majority of most existing libraries contain a ton of code that really isn't necessary 99% of the time. This library is still very powerful, but works very transparently, with a minimal API.

> *This tool aims to be a parser. It parses arguments and enforces any rules the user defines. It also exposes all relevant aspects of the arguments so developers can use the parsed content in any manner. It does not attempt to autogenerate help screens or apply any other non-transparent functionality. WYSIWYG.

## Example

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

// Restrict a flag to a single value (applies when the same flag is passed multiple times).
Args.single('c')

// Do not allow unrecognized flags
Args.disallowUnrecognized() 

// Enforce all of the rules specified above, by exiting with an error when an invalid configuration is identified.
Args.enforceRules()

console.log(Args.data)
```

Using the script above in a `mycli.js` file could be executed as follows:

```sh
mycli -a false -b "some value" -in testfile.txt -c "ignored" -c "accepted"
```

_Output:_
```sh
{
  a: false, 
  b: 'some value', 
  c: 'accepted',
  input: 'testfile.txt'
}
```

## Even Eimpler Syntax

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
    single: true
  },
  input: {
    alias: 'in'
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
import Parser from '@author.io/arg'

let Args = new Parser(myArgs [,cfg])

console.log(Args.data)
```

## API

The source code is pretty easy to figure out, but here's what you can do:

### Properties

- `flags`: An array of the unique flag names passed to the application.
- `data`: A key/value object representing all data passed to the application. If a flag is passed in more than once and duplicates are _not_ suppressed, the value will be an array.
- `length` The total number of arguments passed to the application.
- `valid` A boolean representing whether all of the validation rules passed or not.
- `violations` An array of violations (this is an empty array when everything is valid).

## Configuration Methods

The main methods are used to configure rules.

### configure({...})

This method accepts a configuration, which will automatically invoke all of the appropriate configuration methods using a shorthand syntax.

For example:

```javascript
Args.configure({
  flagname: {
    required: true/false,
    default: value,
    type: string_or_primitive, // example: 'boolean' or Boolean
    alias: string,
    single: true/false
  }, {
    ...
  }
})
```

### require('flag1', 'flag2', ...)

Require the presence of specific flags amongst the arguments. Automatically executes `recognize` for all required flags.

### recognize('flag1', 'flag2', ...)

Register "known" flags. This is useful when you want to prevent unrecognized flags from being passed to the application.

### types({...})

Identify the data type of a flag or series of flags. Automatically executes `recognize` for any flags specified amongst the data types.

### defaults({...})

Identify default values for flags. 

Automatically executes `recognize` for any flags specified amongst the defaults.

### alias({...})

Identify aliases for recognized flags. 

Automatically executes `recognize` for any flags specified amongst the defaults.

### single('flag1', 'flag2', ...)

By default, a flag can be passed in multiple times providing multiple values for the same flag. This method can be used to retrieve only one value (the last one specified). 

Automatically executes `recognize` for any flags specified amongst the defaults.

## Enforcement Methods

Enforcement methods are designed to help toggle rules on/off as needed.

### disallowUnrecognized()

Sets a rule to prevent the presence of any unrecognized flags.

### allowUnrecognized()

Sets a rule to allow the presence of unrecognized flags (this is the default behavior).

### ignoreDataTypes()

This will ignore data type checks, even if the `types` method has been used to enforce data types.

### enforceDataTypes()

This will enforce data type checks. This is the default behavior.

## Helper Methods

The following helper methods are made available for developers who need quick access to flags and enforcement functionality.

### enforceRules()

This method can be used within a process to validate flags and exit with error when validation fails.

### value(flagname)

Retrieve the value of a flag. This accepts flags or aliases. If the specified flag does not exist, a value of `undefined` is returned.

### exists(flagname)

Returns a boolean value indicating the flag exists.
