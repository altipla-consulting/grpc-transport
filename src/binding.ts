/* eslint-disable no-constant-condition */

const EOF = '~EOF~'

class Parser {
  private pos = 0

  constructor(private input: string) {}

  next(): string {
    if (this.pos >= this.input.length) {
      return EOF
    }
    return this.input[this.pos++]
  }

  backup(): void {
    this.pos--
  }

  parseTemplate(): Binding {
    if (this.next() != '/') {
      throw new Error('binding URL should start with a slash')
    }
    
    return {
      segments: this.parseSegments(),
      verb: this.parseVerb(),
    }
  }

  private parseSegments(): Segment[] {
    let segments: Segment[] = []
    segments.push(this.parseSegment())

    while (true) {
      let r = this.next()
      switch (r) {
        case '/':
          segments.push(this.parseSegment())
          continue

        case ':':
        case '}':
          this.backup()
          return segments

        case EOF:
          return segments

        default:
          throw new Error(`unexpected ${r} in segments`)
      }
    }
  }

  private parseSegment(): Segment {
    let content = ''
    while (true) {
      let r = this.next()
      switch (r) {
        case EOF:
          if (!content.length) {
            throw new Error(`unexpected EOF in segment`)
          }
          return { content }

        case '{':
          return { content, variable: this.parseVariable() }

        case ':':
        case '/':
        case '}':
          this.backup()
          if (!content.length) {
            throw new Error(`unexpected ${r} in segment`)
          }
          return { content }

        default:
          content += r
      }
    }
  }

  private parseVariable(): Variable {
    let v: Variable = {
      name: '',
    }
    while (true) {
      let r = this.next()
      switch (r) {
        case '}':
          if (!v.name.length) {
            throw new Error(`empty variable name`)
          }
          return v

        case '=':
          v.parts = this.parseSegments().map(segment => {
            if (!segment.content.length) {
              throw new Error(`unexpected empty segment`)
            }
            return segment.content
          })
          break

        case EOF:
          throw new Error(`unexpected EOF in variable ${v.name}`)

        default:
          v.name += r
      }
    }
  }

  private parseVerb(): string {
    let r = this.next()
    switch (r) {
      case ':':
        break

      case EOF:
        return ''

      default:
        throw new Error(`unexpected ${r} in verb`)
    }

    let verb = ''
    while (true) {
      let r = this.next()
      if (r === EOF) {
        if (!verb.length) {
          throw new Error(`empty verb`)
        }
        return verb
      }
      verb += r
    }
  }
}

interface Binding {
  segments: Segment[]
  verb: string
}

interface Segment {
  content: string
  variable?: Variable
}

interface Variable {
  name: string
  parts?: string[]
}

export function buildURL(template: string, params: { [key: string]: string }): string {
  let parser = new Parser(template)
  let binding = parser.parseTemplate()

  let parts = binding.segments.map(segment => {
    if (segment.variable) {
      if (!params[segment.variable.name]) {
        throw new Error(`input parameter ${segment.variable.name} is required`)
      }

      let value = params[segment.variable.name]
      delete params[segment.variable.name]
      return value
    }
    return segment.content
  })
  let verb = binding.verb ? `:${binding.verb}` : ''
  return '/' + parts.join('/') + verb
}
