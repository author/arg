import Flag from "./flag.js"

const PARSER = /\s*(?:((?:(?:"(?:\\.|[^"])*")|(?:'[^']*')|(?:\\.)|\S)+)\s*)/gi

class Parser {
  #args = []
  #flags = new Map()
  #unknownFlags = new Map()
  #allowUnrecognized = true
  #violations = new Set()
  #ignoreTypes = false
  #aliases = new Set()
  #validFlags = null

  #cleanFlag = flag => {
    return flag.replace(/^\-+/, '').trim().toLowerCase()
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

    if (globalThis.hasOwnProperty('argv')) {
      this.parse(process.argv.slice(2))
    } else if (argList !== null) {
      this.parse(argList)
    }
  }

  get length() {
    return this.#args.length
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

  get violations() {
    this.#validFlags = this.#validFlags || this.valid // Helps prevent unnecessarily rerunning the validity getter
    return Array.from(this.#violations)
  }

  get unrecognizedFlags () {
    let result = new Set()
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
    let result = new Set()
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
    let data = {}
    let sources = {}
    
    this.#flags.forEach((flag, name) => {
      if (!this.#aliases.has(name)) {
        data[flag.name] = flag.value
        Object.defineProperty(sources, flag.name, {
          enumerable: true,
          get() {
            return flag
          }
        })
      }
    })

    this.#unknownFlags.forEach((flag, name) => {
      let unknownName = flag.name
      let count = 0
      while (data.hasOwnProperty(unknownName)) {
        count++
        unknownName = `${unknownName}${count}`
      }

      data[unknownName] = true
      Object.defineProperty(sources, unknownName, {
        enumerable: true,
        get() {
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
    for (let [name, cfg] of Object.entries(config)) {
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
    // argumnets. Otherwise use the parser RegEx pattern to split
    // into arguments.
    this.#args = Array.isArray(input) ? input : input.match(PARSER).map(i => {
      i = i.trim()
      const match = i.match(/((^"(.*)"$)|(^'(.*)'$))/i)
      return match !== null ? match[3] : i
    })

    let skipNext = false
    let skipped = []
    let unrecognized = []
    const bools = new Set(['true', 'false'])
    
    this.#args.forEach((arg, i, args) => {
      if (!skipNext || arg.startsWith('-')) {
        if (arg.startsWith('-')) {
          skipNext = true
          
          const flag = this.#flagRef(arg)

          if (this.#args[i + 1] !== undefined) {
            if (!this.#args[i + 1].startsWith('-')) {
              let value = this.#args[i + 1]
              let isBoolean = false

              if (flag.type === 'boolean') {
                isBoolean = true

                if (this.#args[i + 1] !== undefined) {               
                  if (!bools.has(value.toLowerCase())) {
                    skipNext = false
                    flag.value = true
                  } else {
                    if (value.trim().toLowerCase() === 'true') {
                      flag.value = true
                    } else if (value.trim().toLowerCase() === 'false') {
                      flag.value = false
                    }
                  }
                }
              }

              // Handle everything else.
              if (!isBoolean) {
                flag.value = value
              }
            } else {
              flag.value = true
            }
          } else {
            flag.value = true
          }
        } else if (!this.exists(arg)) {
          this.addFlag(arg).value = true
        } else if (!arg.startsWith('-')) {
          // This clause exists in case an alias
          // conflicts with the value of an unrecognized flag.
          let uflag = new Flag(this.#cleanFlag(arg))
          uflag.strictTypes = !this.#ignoreTypes
          // this.#flags.set(this.#cleanFlag(arg), uflag)
          this.#unknownFlags.set(this.#cleanFlag(arg), uflag)
        }
      } else {
        skipped.push([arg, args[i - 1]])
        skipNext = false
      }
    })

    // Handle orphan input items
    skipped.forEach(flag => {
      const value = flag[0]
      const priorFlagValue = flag[1]

      if (priorFlagValue === null || priorFlagValue === undefined) {
        this.addFlag(value)
      } else {
        let priorFlag = this.getFlag(priorFlagValue)
        if (priorFlag.hasOwnProperty('aliasOf')) {
          priorFlag = priorFlag.aliasOf
          priorFlag.value = value
        }
        
        if (!(priorFlag && (priorFlag.recognized || priorFlagValue.startsWith('-')))) {
          this.addFlag(value)
        }
      }
    })

    this.#flags.forEach((flag, name) => {
      if (this.#aliases.has(name)) {
        if (flag.value !== undefined && !flag.aliasOf.multipleValuesAllowed) {
          flag.aliasOf.value = flag.value
        }
      }
    })
  }

  getFlag (flag) {
    let f = this.#flags.get(this.#cleanFlag(flag))
    if (f) {
      return f
    }

    return this.#unknownFlags.get(this.#cleanFlag(flag))
  }

  addFlag(cfg) {
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
    Array.from(arguments).map(arg => {
      if (!this.#aliases.has(arg)) {
        const flag = this.#flagRef(arg)
        flag.required = true
        flag.recognized = true
      }
    })
  }

  recognize () {
    Array.from(arguments).map(arg => (this.getFlag(arg) || this.addFlag(arg)).recognized = true)
  }

  disallowUnrecognized() {
    this.#allowUnrecognized = false
  }

  allowUnrecognized() {
    this.#allowUnrecognized = true
  }

  ignoreDataTypes() {
    this.#ignoreTypes = false
    
    this.#flags.forEach((flag, name) => {
      flag.strictTypes = false
      this.#flags.set(name, flag)
    })
  }

  enforceDataTypes() {
    this.#ignoreTypes = true

    this.#flags.forEach((flag, name) => {
      flag.strictTypes = true
      this.#flags.set(name, flag)
    })
  }

  defaults (obj = {}) {
    for (let [name, value] of Object.entries(obj)) {
      const flag = this.#flagRef(name)
      flag.default = value
      flag.recognized = true
    }
  }

  alias (obj = {}) {
    for (let [flagname, alias] of Object.entries(obj)) {
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

  preventMultipleValues() {
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
      if (globalThis.hasOwnProperty('process')) {
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
