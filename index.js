class Parser {
  #args = []
  #data = new Map()
  #flags = new Set()
  #defaults = new Map()
  #alias = new Map()
  #required = new Set()
  #known = new Set()
  #allowUnrecognized = true
  #violations = new Set()
  #types = new Map()
  #ignoreTypes = false
  #singleValue = new Set()
  #descriptions = new Map()
  #enums = new Map()

  #setFlag = (flag, value) => {
    flag = this.#getFlag(flag)

    if (this.#data.has(flag)) {
      this.#data.set(flag, [...this.#data.get(flag), value])
    } else {
      this.#data.set(flag, value)
    }
  }

  #cleanFlag = flag => {
    return flag.replace(/^\-+/, '').trim().toLowerCase()
  }

  #getFlag = flag => {
    flag = this.#cleanFlag(flag)

    if (this.#alias.has(flag)) {
      flag = this.#alias.get(flag)
    }

    return flag
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
      this.#args = process.argv.slice(2)
    } else {
      this.#args = argList || []
    }

    let skipNext = false
    
    this.#args.forEach((arg, i, args) => {
      if (!skipNext || arg.startsWith('-')) {
        let flag = this.#cleanFlag(arg)

        if (arg.startsWith('-')) {
          skipNext = true

          this.#flags.add(flag)

          if (this.#args[i + 1] !== undefined) {
            if (!this.#args[i + 1].startsWith('-')) {
              let value = this.#args[i + 1]
              let isBoolean = false

              const argtype = this.#types.get(this.#getFlag(arg))
              if (argtype && (argtype === 'boolean' || argtype.name.split(' ')[0].trim().toLowerCase() === 'boolean')) {
                isBoolean = true
                if (this.#args[i + 1] !== undefined) {
                  if (!new Set(['true', 'false']).has(value.toLowerCase())) {
                    skipNext = false
                    this.#data.set(flag, true)
                  } else {
                    if (value.trim().toLowerCase() === 'true') {
                      this.#data.set(flag, true)
                    } else if (value.trim().toLowerCase() === 'false') {
                      this.#data.set(flag, false)
                    }
                    
                  }
                }
              }

              // Handle everything else.
              if (!isBoolean) {
                this.#setFlag(flag, value)
              }
            } else {
              this.#data.set(flag, true)
            }
          } else {
            this.#data.set(flag, true)
          }
        } else {
          this.#flags.add(flag)
          this.#data.set(flag, true)
        }
      } else {
        skipNext = false
      }
    })
  }

  get flags () {
    return Array.from(this.#flags)
  }

  get data () {
    let data = {}

    this.#flags.forEach(flag => {
      flag = this.#getFlag(flag)
      data[flag] = this.value(flag)
    })

    if (this.#defaults.size > 0) {
      this.#defaults.forEach((value, flag) => {
        flag = this.#getFlag(flag)
        data[flag] = this.value(flag) || value
      })
    }

    return data
  }

  typeof (flag) {
    const argtype = this.#types.get(this.#getFlag(flag))
    if (!argtype) {
      return 'string'
    }

    if (typeof argtype === 'string') {
      return argtype
    }

    return argtype.name.split(' ')[0].trim().toLowerCase()
  }

  value (flag = null) {
    flag = this.#getFlag(flag)

    if (!flag) {
      return undefined
    }

    let value = this.#data.get(flag) || this.#defaults.get(flag)
    if (typeof value === 'boolean' && !this.#flags.has(flag)) {
      for (let alias of this.getFlagAliases(flag)) {
        if (this.#flags.has(alias)) {
          value = true
          break
        }
      }
    }

    if (this.#singleValue.has(flag) && Array.isArray(value)) {
      return value.shift()
    }

    return value
  }

  getFlagAliases (flag) {
    flag = this.#getFlag(flag)
      
    let results = []
    
    for (let [aliases, name] of this.#alias) {
      if (name.trim().toLowerCase() === flag) {
        results = results.concat(aliases)
      }
    }
    
    return new Set(results)
  }

  exists (flag = null) {
    if (flag === null) {
      return false
    }

    flag = this.#getFlag(flag)

    return this.#flags.has(flag)
  }

  require () {
    let args = Array.from(arguments).map(arg => this.#getFlag(arg))
    this.#required = new Set([...this.#required, ...args])
    this.recognize(...arguments)
  }

  recognize () {
    let args = Array.from(arguments).map(arg => this.#getFlag(arg))
    this.#known = new Set([...this.#known, ...args])
  }

  disallowUnrecognized() {
    this.#allowUnrecognized = false
  }

  allowUnrecognized() {
    this.#allowUnrecognized = true
  }

  types (obj = {}) {
    let flaglist = new Set()

    Object.keys(obj).forEach(key => {
      let flag = this.#getFlag(key)
      let type = obj[key]

      if (typeof type === 'string') {
        switch (type.trim().toLowerCase()) {
          case 'number':
          case 'integer':
          case 'float':
            type = Number
            break
          case 'bigint':
            type = BigInt
            break
          case 'boolean':
            type = Boolean
            break
          default:
            type = String
        }
      }

      flaglist.add(flag)
      this.#types.set(flag, type)
    })

    if (flaglist.size > 0) {
      this.recognize.apply(this, Array.from(flaglist))
    }
  }

  ignoreDataTypes() {
    this.#ignoreTypes = false
  }

  enforceDataTypes() {
    this.#ignoreTypes = true
  }

  defaults (obj = {}) {
    let keys = Object.keys(obj)
    keys.forEach(flag => this.#defaults.set(this.#getFlag(flag), obj[flag]))
    this.recognize.apply(this, keys)
  }

  alias (obj = {}) {
    Object.keys(obj).forEach(key => {
      let flag = this.#cleanFlag(key)
      let aliases = obj[key]
      if (!Array.isArray(aliases)) {
        aliases = [aliases]
      }

      aliases.forEach(alias => {
        alias = this.#cleanFlag(alias)

        this.#alias.set(alias, flag)

        if (this.#required.has(alias)) {
          this.#required.add(flag)
          this.#required.delete(alias)
        }

        if (this.#defaults.has(alias)) {
          this.#defaults.add(flag)
          this.#defaults.delete(alias)
        }

        if (this.#flags.has(alias)) {
          this.#flags.add(flag)
          this.#flags.delete(alias)
        }

        if (this.#singleValue.has(alias)) {
          this.#singleValue.add(flag)
          this.#singleValue.delete(alias)
        }

        if (this.#data.has(alias)) {
          this.#data.set(flag, this.#data.get(alias))
          this.#data.delete(alias)
        }
      })
    })

    if (this.#alias.size > 0) {
      this.recognize.apply(this, Array.from(this.#alias.values()))
    }
  }

  // In case of duplicate flag, ignore all but last flag value
  single () {
    if (arguments.length === 0) {
      this.#singleValue = new Set([...this.#singleValue, ...this.#flags])
    } else {
      for (let flag of arguments) {
        this.#singleValue.add(this.#getFlag(flag))
      }
    }
  }

  // Set enumerable options for a flag
  setOptions () {
    if (arguments.length < 2) {
      return
    }

    const enums = Array.from(arguments)
    const flag = this.#getFlag(enums.shift())

    if (!this.#flags.has(flag)) {
      this.#flags.add(flag)
      this.recognize(flag)
    }

    this.#enums.set(flag, new Set(enums))
  }

  // Set a description for a flag
  describe (flag, desc) {
    this.#descriptions.set(this.#getFlag(flag), desc)
  }

  // Retrieve a description of the flag.
  description (flag) {
    return this.#descriptions.get(this.#getFlag(flag))
  }

  configure (cfg = null) {
    if (cfg) {
      let data = {
        defaults: {},
        alias: {},
        required: new Set(),
        types: {},
        single: new Set(),
        descriptions: new Map(),
        options: []
      }

      Object.keys(cfg).forEach(flag => {
        let obj = cfg[flag]
        if (obj.hasOwnProperty('default')) {
          data.defaults[flag] = obj.default
        }
        if (obj.hasOwnProperty('alias')) {
          obj.aliases = Array.isArray(obj.alias) ? obj.alias : [obj.alias]
        }
        if (obj.hasOwnProperty('aliases') && Array.isArray(obj.aliases)) {
          data.alias[flag] = data.alias[flag] || []
          data.alias[flag] = data.alias[flag].concat(obj.aliases)
        }

        // Deduplicate aliases
        if (data.alias.hasOwnProperty(flag)) {
          data.alias[flag] = Array.from(new Set(data.alias[flag]))
        }
        if (obj.hasOwnProperty('required') && obj.required) {
          data.required.add(flag)
        }
        if (obj.hasOwnProperty('type')) {
          data.types[flag] = obj.type
        }
        if (obj.hasOwnProperty('single')) {
          data.single.add(flag)
        }
        if (obj.hasOwnProperty('description')) {
          data.descriptions.set(flag, obj.description)
        }
        if (obj.hasOwnProperty('options') || obj.hasOwnProperty('enum')) {
          data.options = obj.hasOwnProperty('options') || obj.hasOwnProperty('enum')
        }
      })

      this.defaults(data.defaults)
      this.alias(data.alias)
      this.types(data.types)
      
      if (data.required.size > 0) {
        this.require.apply(this, Array.from(data.required))
      }

      if (data.single.size > 0) {
        this.single.apply(this, Array.from(data.single))
      }

      if (data.options.length > 0) {
        this.setOptions(flag, data.options)
      }

      data.descriptions.forEach((value, key) => this.describe(key, value))
    }
  }

  get length () {
    return this.#args.length
  }

  get valid () {
    let valid = true
    
    this.#violations = new Set()
    
    if (this.#required.size > 0) {
      for (let arg of this.#required) {
        let flag = this.#getFlag(arg)

        if (!this.exists(flag)) {
          this.#violations.add(`"${flag}" is a required flag.`)
          valid = false
        }
      }
    }

    if (!this.#allowUnrecognized) {
      if (this.length > 0) {
        if (this.#known.size === 0) {
          this.#flags.forEach(flag => this.#violations.add(`"${flag}" is unrecognized.`))
          valid = false
        } else {
          for (let arg of this.#flags) {
            let flag = this.#getFlag(arg)
            
            if (!this.#known.has(flag)) {
              this.#violations.add(`"${arg}" is unrecognized.`)
              valid = false
            }
          }
        }   
      }
    }

    if (!this.#ignoreTypes && this.#types.size > 0 && this.length > 0) {
      for (let flag of this.#flags) {
        flag = this.#getFlag(flag)

        if (this.#types.has(flag)) {
          let type = this.#types.get(flag)
          let value = this.value(flag)

          if (typeof value !== type.valueOf().name.toLowerCase()) {
            this.#violations.add(`The value provided by the "${flag}" flag is not a ${type.valueOf().name} ("${value}" is a ${typeof value}).`)
            valid = false
          }
        }
      }
    }

    if (this.#enums.size > 0) {
      for (let flag of this.#flags) {
        flag = this.#getFlag(flag)

        if (this.#enums.has(flag)) {
          if (!this.#enums.get(flag).has(this.value(flag))) {
            this.#violations.add(`The value provided by the ${flag} (${this.value(flag)}) is not a valid option. Valid options include: ${Array.from(this.#enums.get(flag).join(', '))}.`)
            valid = false
          }
        }
      }
    }

    return valid
  }

  get violations () {
    let valid = this.valid
    return Array.from(this.#violations)
  }

  get unrecognizedFlags () {
    let result = new Set()
    this.#flags.forEach(flag => !this.#known.has(this.#getFlag(flag)) && result.add(flag))
    return Array.from(result)
  }

  enforceRules () {
    let valid = this.valid

    if (!valid) {
      console.log(Array.from(this.#violations).join('\n'))
      if (globalThis.hasOwnProperty('process')) {
        return globalThis.process.exit(1)
      } else {
        throw new Error('Process exited with error.')
      }
    }

    return valid
  }
}

const DefaultArgumentParser = new Parser()

export { DefaultArgumentParser as default, Parser }