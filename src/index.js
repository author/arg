import Flag from './flag.js'

// const PARSER = /\s*(?:((?:(?:"(?:\\.|[^"])*")|(?:'[^']*')|(?:\\.)|\S)+)\s*)/gi
const PARSER = /((-+(?<flag>[^\s\"\']+))(\s+((?<value>[\"\'](?<unquoted_value>((\\\"|\\\')|[^\"\'])+)[\"\']|[^-][^\s]+)))?|(([\"\'](?<quoted_arg>((\\\"|\\\')|[^\"\'])+)[\"\']))|(?<arg>[^\s]+))/gi // eslint-disable-line no-useless-escape
const BOOLS = new Set(['true', 'false'])

class Parser {
  #args = []
  #flags = new Map()
  #unknownFlags = new Map()
  #allowUnrecognized = true
  #violations = new Set()
  #ignoreTypes = false
  #aliases = new Set()
  #validFlags = null
  #length = 0

  #cleanFlag = flag => {
    return flag.replace(/^-+/g, '').trim().toLowerCase()
  }

  #flagRef = flag => {
    return (this.getFlag(flag) || this.addFlag(flag))
  }

  constructor (argList = null, cfg = null) {
    if (argList !== null && typeof argList === 'object' && !Array.isArray(argList)) {
      cfg = argList
      argList = null
    }

    if (cfg !== null) {
      this.configure(cfg)
    }

    if (globalThis.hasOwnProperty('argv')) { // eslint-disable-line no-prototype-builtins
      this.parse(process.argv.slice(2))
    } else if (argList !== null) {
      this.parse(argList)
    }
  }

  get length () {
    return this.#length
  }

  get valid () {
    this.#validFlags = true
    this.#violations = new Set()

    this.#flags.forEach((flag, flagname) => {
      if (!this.#aliases.has(flagname)) {
        flag.strictTypes = !this.#ignoreTypes

        if (!flag.valid) {
          this.#validFlags = false
          this.#violations = new Set([...this.#violations, ...flag.violations])
        }

        if (!this.#allowUnrecognized && !flag.recognized) {
          this.#validFlags = false
          this.#violations.add(`"${flagname}" is unrecognized.`)
        }
      }
    })

    if (!this.#allowUnrecognized && this.#unknownFlags.size > 0) {
      this.#validFlags = false
      this.#unknownFlags.forEach(flag => this.#violations.add(`"${flag.name}" is unrecognized.`))
    }

    return this.#validFlags
  }

  get violations () {
    this.#validFlags = this.#validFlags || this.valid // Helps prevent unnecessarily rerunning the validity getter
    return Array.from(this.#violations)
  }

  get unrecognizedFlags () {
    const result = new Set()
    this.#flags.forEach((flag, flagname) => {
      if (!this.#aliases.has(flagname)) {
        if (!flag.recognized) {
          result.add(flag.name)
        }
      }
    })

    this.#unknownFlags.forEach(flag => result.add(flag.name))

    return Array.from(result)
  }

  get recognizedFlags () {
    const result = new Set()
    this.#flags.forEach((flag, flagname) => {
      if (!this.#aliases.has(flagname)) {
        if (flag.recognized) {
          result.add(flagname)
        }
      }
    })

    return Array.from(result)
  }

  get flags () {
    return Array.from(this.#flags.keys()).concat(Array.from(this.#unknownFlags.keys()))
  }

  get data () {
    const data = {}
    const sources = {}

    this.#flags.forEach((flag, name) => {
      if (!this.#aliases.has(name)) {
        data[flag.name] = flag.value
        Object.defineProperty(sources, flag.name, {
          enumerable: true,
          get () {
            return flag
          }
        })
      }
    })

    this.#unknownFlags.forEach((flag, name) => {
      let unknownName = flag.name
      let count = 0
      while (data.hasOwnProperty(unknownName)) { // eslint-disable-line no-prototype-builtins
        count++
        unknownName = `${unknownName}${count}`
      }

      data[unknownName] = true
      Object.defineProperty(sources, unknownName, {
        enumerable: true,
        get () {
          return flag
        }
      })
    })

    Object.defineProperty(data, 'flagSource', {
      enumerable: false,
      writable: false,
      configurable: false,
      value: sources
    })

    return data
  }

  configure (config = {}) {
    for (const [name, cfg] of Object.entries(config)) {
      cfg.name = name
      this.addFlag(cfg).recognized = true
    }
  }

  parse (input) {
    if (!input) {
      return
    }

    // Normalize the input
    // If an array is provided, assume the input has been split into
    // arguments. Otherwise use the parser RegEx pattern to split
    // into arguments.
    input = Array.isArray(input) ? input.join(' ') : input

    // Parse using regular expression
    const args = []
    const flags = []

    // Normalize each flag/value pairing
    Array.from([...input.matchAll(PARSER)]).forEach(parsedArg => {
      let { flag, value, unquoted_value, quoted_arg, arg } = parsedArg.groups

      // If the arg attribute is present, add the
      // value to the arguments placeholder instead
      // of the flags
      if (arg) {
        args.push(arg)
      } else if (quoted_arg) {
        args.push(quoted_arg)
      } else {
        value = unquoted_value || value
        // Flags without values are considered boolean "true"
        value = value !== undefined ? value : true

        // Remove surrounding quotes in string values
        // and convert true/false strings to boolean values.
        if (typeof value === 'string' && BOOLS.has(value.toLowerCase())) {
          value = value.toLowerCase() === 'true'
        }

        flags.push({ flag, value })
      }
    })

    // Make the length available via private variable
    this.#length = flags.length + args.length

    for (const arg of flags) {
      let ref = this.#flagRef(arg.flag)
      if (ref.aliasOf) {
        ref = ref.aliasOf
      }
      ref.value = arg.value
    }

    for (const arg of args) {
      if (!this.exists(arg)) {
        this.addFlag(arg).value = true
      } else {
        // This clause exists in case an alias
        // conflicts with the value of an unrecognized flag.
        const uflag = new Flag(this.#cleanFlag(arg))
        uflag.strictTypes = !this.#ignoreTypes
        // this.#flags.set(this.#cleanFlag(arg), uflag)
        this.#unknownFlags.set(this.#cleanFlag(arg), uflag)
      }
    }

    this.#flags.forEach((flag, name) => {
      if (this.#aliases.has(name)) {
        if (flag.value !== undefined && !flag.aliasOf.multipleValuesAllowed) {
          flag.aliasOf.value = flag.value
        }
      }

      if (typeof flag.value !== flag.type) {
        if (flag.type === 'boolean') {
          const unknownFlag = new Flag(this.#cleanFlag(`unknown${this.#unknownFlags.size + 1}`))
          unknownFlag.strictTypes = false
          unknownFlag.value = flag.value
          if (!this.#unknownFlags.has(unknownName.name)) {
            this.#unknownFlags.set(unknownFlag.name, unknownFlag)
          }

          flag.value = true
        }
      }
    })
  }

  getFlag (flag) {
    const f = this.#flags.get(this.#cleanFlag(flag))
    if (f) {
      return f
    }

    return this.#unknownFlags.get(this.#cleanFlag(flag))
  }

  addFlag (cfg) {
    cfg = typeof cfg === 'object' ? cfg : { name: cfg }

    const clean = this.#cleanFlag(cfg.name)

    if (this.#flags.has(clean)) {
      throw new Error(`"${cfg.name}" flag already exists.`)
    }

    const flag = new Flag(cfg)

    flag.strictTypes = !this.#ignoreTypes

    this.#flags.set(clean, flag)

    if (flag.aliases.length > 0) {
      flag.aliases.forEach(alias => {
        this.#flags.set(this.#cleanFlag(alias), { aliasOf: this.#flags.get(clean) })
        this.#aliases.add(this.#cleanFlag(alias))
      })
    }

    return this.#flags.get(clean)
  }

  exists (flag) {
    return this.#flags.has(this.#cleanFlag(flag)) || this.#unknownFlags.has(this.#cleanFlag(flag))
  }

  typeof (flag) {
    if (!this.exists(flag)) {
      if (this.#unknownFlags.has(this.#cleanFlag(flag))) {
        return 'boolean'
      }

      return 'undefined'
    }

    return this.getFlag(flag).type
  }

  value (flag = null) {
    if (!this.exists(flag)) {
      if (this.#unknownFlags.has(this.#cleanFlag(flag))) {
        return true
      }

      return undefined
    }

    return this.getFlag(flag).value
  }

  getFlagAliases (flag) {
    if (!this.exists(flag)) {
      return new Set()
    }

    return new Set(this.getFlag(flag).aliases)
  }

  require () {
    Array.from(arguments).forEach(arg => {
      if (!this.#aliases.has(arg)) {
        const flag = this.#flagRef(arg)
        flag.required = true
        flag.recognized = true
      }
    })
  }

  recognize () {
    Array.from(arguments).forEach(arg => {
      if (!this.getFlag(arg)) {
        this.addFlag(arg).recognized = true
      }
    })
  }

  disallowUnrecognized () {
    this.#allowUnrecognized = false
  }

  allowUnrecognized () {
    this.#allowUnrecognized = true
  }

  ignoreDataTypes () {
    this.#ignoreTypes = false

    this.#flags.forEach((flag, name) => {
      flag.strictTypes = false
      this.#flags.set(name, flag)
    })
  }

  enforceDataTypes () {
    this.#ignoreTypes = true

    this.#flags.forEach((flag, name) => {
      flag.strictTypes = true
      this.#flags.set(name, flag)
    })
  }

  defaults (obj = {}) {
    for (const [name, value] of Object.entries(obj)) {
      const flag = this.#flagRef(name)
      flag.default = value
      flag.recognized = true
    }
  }

  alias (obj = {}) {
    for (const [flagname, alias] of Object.entries(obj)) {
      const flag = this.#flagRef(flagname)

      if (this.#aliases.has(alias) && flagname.toLowerCase() !== flag.name.toLowerCase()) {
        throw new Error(`The "${alias}" alias is already associated to the "${this.getFlag(alias).name}" flag.`)
      }

      if (!flag.hasAlias(alias)) {
        flag.createAlias.apply(flag, alias)
      }

      flag.recognized = true
    }
  }

  // In case of duplicate flag, ignore all but last flag value
  allowMultipleValues () {
    for (const flag of arguments) {
      this.#flagRef(flag).allowMultipleValues()
    }
  }

  preventMultipleValues () {
    for (const flag of arguments) {
      this.#flagRef(flag).preventMultipleValues()
    }
  }

  // Set enumerable options for a flag
  setOptions () {
    if (arguments.length < 2) {
      throw new Error('setOptions method requires the flag name and at least one value (i.e. minimum 2 arguments).')
    }

    const enums = Array.from(arguments)
    const flag = this.#flagRef(enums.shift())

    flag.recognized = true
    flag.options = enums
  }

  // Set a description for a flag
  describe (flag, desc) {
    this.#flagRef(flag).description = desc
  }

  // Retrieve a description of the flag.
  description (flagname) {
    const flag = this.getFlag(flagname)
    return flag ? flag.description : 'undefined'
  }

  enforceRules () {
    this.#validFlags = this.valid

    if (!this.#validFlags) {
      if (globalThis.hasOwnProperty('process')) { // eslint-disable-line no-prototype-builtins
        console.error('InvalidFlags: Process exited with error.\n * ' + this.violations.join('\n * '))
        return globalThis.process.exit(1)
      } else {
        throw new Error('InvalidFlags: Process exited with error.')
      }
    }

    return this.#validFlags
  }
}

const DefaultArgumentParser = new Parser()

export { DefaultArgumentParser as default, Parser, Flag }
