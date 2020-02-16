import Flag from "./flag.js"

class Parser {
  #args = []
  #flags = {}
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

    for (const [flagname, flag] of Object.entries(this.#flags)) {
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
    }

    return this.#validFlags
  }

  get violations() {
    this.#validFlags = this.#validFlags || this.valid // Helps prevent unnecessarily rerunning the validity getter
    return Array.from(this.#violations)
  }

  get unrecognizedFlags () {
    let result = new Set()
    for (const [flagname, flag] of Object.entries(this.#flags)) {
      if (!this.#aliases.has(flagname)) {
        if (!flag.recognized) {
          result.add(flagname)
        }
      }
    }

    return Array.from(result)
  }

  get recognizedFlags () {
    let result = new Set()
    for (const [flagname, flag] of Object.entries(this.#flags)) {
      if (!this.#aliases.has(flagname)) {
        if (flag.recognized) {
          result.add(flagname)
        }
      }
    }

    return Array.from(result)
  }
  
  get flags () {
    return Object.keys(this.#flags)
  }

  get data () {
    let data = {}
    let sources = {}

    for (const [name, flag] of Object.entries(this.#flags)) {
      if (!this.#aliases.has(name)) {
        data[flag.name] = flag.value
        Object.defineProperty(sources, flag.name, {
          enumerable: true,
          get() {
            return flag
          }
        })
      }
    }

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

    let skipNext = false
    let skipped = []
    this.#args = (Array.isArray(input) ? input : [input])
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
                  if (!new Set(['true', 'false']).has(value.toLowerCase())) {
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
        } else if(!this.exists(arg)) {
          this.addFlag(arg).value = true
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
        const priorFlag = this.getFlag(priorFlagValue)
        if (priorFlag && (priorFlag.recognized || priorFlag.inputName.startsWith('-'))) {
          priorFlag.value = value
        } else {
          this.addFlag(value)
        }
      }
    })
  }

  getFlag (flag) {
    return this.#flags[this.#cleanFlag(flag)]
  }

  addFlag(cfg) {
    cfg = typeof cfg === 'object' ? cfg : { name: cfg }

    const clean = this.#cleanFlag(cfg.name)

    if (this.#flags.hasOwnProperty(clean)) {
      throw new Error(`"${cfg.name}" flag already exists.`)
    }

    const flag = new Flag(cfg)

    flag.strictTypes = !this.#ignoreTypes

    this.#flags[clean] = flag

    if (flag.aliases.length > 0) {
      flag.aliases.forEach(alias => {
        Object.defineProperty(this.#flags, this.#cleanFlag(alias), { enumerable: true, get: () => this.#flags[clean] })
        this.#aliases.add(this.#cleanFlag(alias))
      })
    }

    return this.#flags[clean]
  }

  exists (flag) {
    return this.#flags.hasOwnProperty(this.#cleanFlag(flag))
  }

  typeof (flag) {
    if (!this.exists(flag)) {
      return 'undefined'
    }

    return this.getFlag(flag).type
  }

  value (flag = null) {
    if (!this.exists(flag)) {
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
    
    for (let [name, flag] of Object.entries(this.#flags)) {
      flag.strictTypes = false
    }
  }

  enforceDataTypes() {
    this.#ignoreTypes = true

    for (let [name, flag] of Object.entries(this.#flags)) {
      flag.strictTypes = true
    }
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
      console.log(Array.from(this.#violations).join('\n'))
      if (globalThis.hasOwnProperty('process')) {
        return globalThis.process.exit(1)
      } else {
        throw new Error('Process exited with error.')
      }
    }

    return this.#validFlags
  }
}

const DefaultArgumentParser = new Parser()

export { DefaultArgumentParser as default, Parser, Flag }