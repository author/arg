export default class Flag {
  #name
  #rawName
  #description
  #default = null
  #alias = new Set()
  #required = false
  #type = String
  #allowMultipleValues = false
  #strictTypes = true
  #enum = new Set()
  #value = null
  #violations = new Set()
  #recognized = false
  #validator = null

  constructor (cfg = {}) {
    if (typeof cfg === 'string') {
      cfg = { name: cfg }
    }

    if (!cfg.name) {
      throw new Error('Flag name is required.')
    }

    this.#rawName = cfg.name
    this.#name = cfg.name // .replace(/^-+/gi, '').trim()

    if (cfg.hasOwnProperty('description')) { // eslint-disable-line no-prototype-builtins
      this.#description = cfg.description
    }

    if (cfg.hasOwnProperty('default')) { // eslint-disable-line no-prototype-builtins
      this.#default = cfg.default
    }

    if (cfg.hasOwnProperty('alias')) { // eslint-disable-line no-prototype-builtins
      this.createAlias(cfg.alias)
    }

    if (cfg.hasOwnProperty('aliases')) { // eslint-disable-line no-prototype-builtins
      this.createAlias(cfg.aliases)
    }

    if (cfg.hasOwnProperty('required')) { // eslint-disable-line no-prototype-builtins
      this.#required = cfg.required
    }

    if (cfg.hasOwnProperty('type')) { // eslint-disable-line no-prototype-builtins
      this.type = cfg.type
    } else if (cfg.hasOwnProperty('default')) { // eslint-disable-line no-prototype-builtins
      if (this.#default) {
        this.type = typeof this.#default
      }
    }

    if (cfg.hasOwnProperty('allowMultipleValues')) { // eslint-disable-line no-prototype-builtins
      this.#allowMultipleValues = cfg.allowMultipleValues
    }

    if (cfg.hasOwnProperty('strictTypes')) { // eslint-disable-line no-prototype-builtins
      this.#strictTypes = cfg.strictTypes
    }

    if (cfg.hasOwnProperty('options')) { // eslint-disable-line no-prototype-builtins
      this.options = cfg.options
    }

    if (cfg.hasOwnProperty('validate')) { // eslint-disable-line no-prototype-builtins
      if (!(cfg.validate instanceof RegExp || typeof cfg.validate === 'function')) {
        throw new Error(`The "validate" configuration attribute for ${this.#rawName} is invalid. Only RegExp and functions are supported (received ${typeof cfg.validate})`)
      }

      this.#validator = cfg.validate
    }
  }

  get inputName () {
    return this.#rawName
  }

  get recognized () {
    return this.#recognized
  }

  set recognized (value) {
    this.#recognized = value
  }

  get required () {
    return this.#required
  }

  set required (value) {
    this.#required = value
  }

  get valid () {
    const value = this.value
    this.#violations = new Set()

    if (this.#required) {
      if (this.#allowMultipleValues ? this.value.length === 0 : this.value === null) {
        this.#violations = new Set([`"${this.#name}" is required.`])
        return false
      }
    }

    if (this.#enum.size > 0) {
      if (this.#allowMultipleValues) {
        const invalid = value.filter(item => !this.#enum.has(item))

        if (invalid.length > 0) {
          invalid.forEach(v => this.#violations.add(`"${v}" is invalid. Expected one of: ${Array.from(this.#enum).join(', ')}`))
          return false
        }
      } else if (!this.#enum.has(value)) {
        this.#violations.add(`"${value}" is invalid. Expected one of: ${Array.from(this.#enum).join(', ')}`)
        return false
      }
    }

    if (this.#strictTypes) {
      const type = this.type

      if (type !== 'any' && type !== '*' && this.recognized) {
        if (this.#allowMultipleValues) {
          const invalidTypes = value.filter(item => typeof item !== type) // eslint-disable-line valid-typeof

          if (invalidTypes.length > 0) {
            invalidTypes.forEach(v => this.#violations.add(`"${this.name}" (${v}) should be a ${type}, not ${typeof v}.`))
            return false
          }
        } else if (value !== null && typeof value !== type) { // eslint-disable-line valid-typeof
          this.#violations.add(`"${this.name}" should be a ${type}, not ${typeof value}.`)
          return false
        }
      }
    }

    if (this.#validator !== null) {
      if (typeof this.#validator === 'function') {
        if (!this.#validator(value)) {
          this.#violations.add(`"${value}" is invalid (failed custom validation).`)
          return false
        }
      } else {
        if (typeof value !== 'string' && this.#validator instanceof RegExp) {
          this.#violations.add(`"${value}" is invalid (failed custom validation).`)
          return false
        }

        if (!this.#validator.test(value)) {
          this.#violations.add(`"${value}" is invalid (failed custom validation).`)
          return false
        }
      }
    }

    return true
  }

  get violations () {
    if (this.valid) {
      return []
    }

    return Array.from(this.#violations)
  }

  get type () {
    return this.#type.name.split(/\s+/)[0].toLowerCase()
  }

  set type (value) {
    if (typeof value === 'string') {
      switch (value.trim().toLowerCase()) {
        case 'number':
        case 'integer':
        case 'float':
        case 'double':
          this.#type = Number
          break
        case 'bigint':
          this.#type = BigInt // eslint-disable-line no-undef
          break
        case 'boolean':
          this.#type = Boolean
          break
        default:
          this.#type = String
      }
    } else {
      this.#type = value
    }
  }

  get strictTypes () {
    return this.#strictTypes
  }

  set strictTypes (value) {
    if (typeof value !== 'boolean') {
      throw new Error('strictTypes must be a boolean value.')
    }

    this.#strictTypes = value
  }

  get name () {
    return this.#name
  }

  set name (value) {
    this.#name = value.trim()
  }

  get description () {
    return this.#name
  }

  set description (value) {
    this.#description = value.trim()
  }

  get value () {
    if (this.#allowMultipleValues && (this.#value === null)) {
      if (this.#default === null) {
        return []
      }

      if (!Array.isArray(this.#default)) {
        return [this.#default]
      }
    }

    return this.#value || this.#default
  }

  set value (value) {
    if (this.#allowMultipleValues) {
      if (Array.isArray(value)) {
        this.#value = value
        return
      }

      this.#value = this.#value || []
      this.#value.push(value)
    } else {
      this.#value = value
    }
  }

  get options () {
    return Array.from(this.#enum)
  }

  set options (value) {
    if (typeof value === 'string') {
      value = value.split(',').map(option => option.trim())
    }

    this.#enum = new Set(value)
  }

  get aliases () {
    return Array.from(this.#alias)
  }

  get multipleValuesAllowed () {
    return this.#allowMultipleValues
  }

  hasAlias (alias) {
    return this.#alias.has(alias)
  }

  createAlias () {
    for (let alias of arguments) {
      // Convert set to array
      if (alias instanceof Set) {
        alias = Array.from(alias)
      }

      if (Array.isArray(alias)) {
        this.createAlias(...alias)
      } else if (typeof alias === 'string') {
        this.#alias.add(alias.replace(/^-+/gi, ''))
      } else {
        throw new Error(`Cannot create an alias for a ${typeof alias} element. Please specify a string instead.`)
      }
    }
  }

  allowMultipleValues () {
    if (!this.#allowMultipleValues) {
      if (this.#value !== null) {
        this.#value = [this.#value]
      }

      if (this.#default !== null) {
        this.#default = [this.#default]
      }

      this.#allowMultipleValues = true
    }
  }

  preventMultipleValues () {
    if (this.#allowMultipleValues) {
      if (this.#value !== null) {
        this.#value = this.#value.pop()
      }

      if (this.#default !== null) {
        this.#default = this.#default.pop()
      }

      this.#allowMultipleValues = false
    }
  }
}
