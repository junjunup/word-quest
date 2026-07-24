import fs from 'node:fs'
import path from 'node:path'

const root = process.argv[2]
if (!root) {
  console.error('Usage: node validate-csharp-structure.mjs <directory>')
  process.exit(64)
}

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return filesUnder(full)
    return entry.name.endsWith('.cs') ? [full] : []
  })
}

function validate(file) {
  const source = fs.readFileSync(file, 'utf8')
  const stack = []
  const pairs = { ')': '(', ']': '[', '}': '{' }
  let state = 'code'

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]
    const next = source[index + 1]

    if (state === 'line-comment') {
      if (current === '\n') state = 'code'
      continue
    }
    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        state = 'code'
        index += 1
      }
      continue
    }
    if (state === 'string') {
      if (current === '\\') index += 1
      else if (current === '"') state = 'code'
      continue
    }
    if (state === 'verbatim-string') {
      if (current === '"' && next === '"') index += 1
      else if (current === '"') state = 'code'
      continue
    }
    if (state === 'character') {
      if (current === '\\') index += 1
      else if (current === "'") state = 'code'
      continue
    }

    if (current === '/' && next === '/') {
      state = 'line-comment'
      index += 1
    } else if (current === '/' && next === '*') {
      state = 'block-comment'
      index += 1
    } else if (
      current === '@' && next === '"' ||
      current === '$' && next === '@' && source[index + 2] === '"' ||
      current === '@' && next === '$' && source[index + 2] === '"'
    ) {
      state = 'verbatim-string'
      index += source[index + 2] === '"' ? 2 : 1
    } else if (current === '$' && next === '"') {
      state = 'string'
      index += 1
    } else if (current === '"') {
      state = 'string'
    } else if (current === "'") {
      state = 'character'
    } else if ('([{'.includes(current)) {
      stack.push(current)
    } else if (')]}'.includes(current)) {
      const expected = pairs[current]
      const actual = stack.pop()
      if (actual !== expected) {
        throw new Error(
          `${file}: mismatched ${current}; expected close for ${actual ?? 'nothing'}`,
        )
      }
    }
  }

  if (state === 'block-comment' || state === 'string' || state === 'character') {
    throw new Error(`${file}: unterminated ${state}`)
  }
  if (stack.length > 0) {
    throw new Error(`${file}: unclosed ${stack.at(-1)}`)
  }
}

for (const file of filesUnder(root)) validate(file)
console.log('C# structural validation PASS')
