/* global describe,it */
const path   = require('path')
const fs     = require('fs')
const assert = require('assert')
const babel  = require('babel-core')
const plugin = require('../src/index').default

function trim(str) {
  return str.replace(/^\s+|\s+$/, '')
}

const skipTests = {
  '.DS_Store': 1,
  'assert': 1
}

const fixturesDir = path.join(__dirname, 'fixtures')

describe('_assert helper', () => {
  it('should not emit function assertions', () => {
    const source = `function foo(x: number) {}`
    const expected = `function foo(x: number) {}`
    const actual = babel.transform(
      source, {
        babelrc: false,
        plugins: [
          'syntax-flow',
          plugin
        ]
      }
    ).code
    assert.equal(actual, expected)
  })

})

xdescribe('$Refinement type', () => {

  it('should error when a $Refinement interface is defined by the user', () => {
    const source = `
    interface $Refinement {}
    `

    assert.throws(() => {
      babel.transform(
        source, {
          babelrc: false,
          plugins: [
            'syntax-flow',
            plugin
          ]
        }
      )
    }, err => {
      if ((err instanceof Error) &&
        /\$Refinement is a reserved interface name for babel-plugin-tcomb/.test(err.message) ) {
        return true
      }
    })
  })

  it('should error when a $Refinement type is defined by the user', () => {
    const source = `
    type $Refinement = any;
    `

    assert.throws(() => {
      babel.transform(
        source, {
          babelrc: false,
          plugins: [
            'syntax-flow',
            plugin
          ]
        }
      )
    }, err => {
      if ((err instanceof Error) &&
        /\$Refinement is a reserved interface name for babel-plugin-tcomb/.test(err.message) ) {
        return true
      }
    })
  })

})

xdescribe('$Reify type', () => {

  it('should error when a $Reify interface is defined by the user', () => {
    const source = `
    interface $Reify {}
    `

    assert.throws(() => {
      babel.transform(
        source, {
          babelrc: false,
          plugins: [
            'syntax-flow',
            plugin
          ]
        }
      )
    }, err => {
      if ((err instanceof Error) &&
        /\$Reify is a reserved interface name for babel-plugin-tcomb/.test(err.message) ) {
        return true
      }
    })
  })

  it('should error when a $Reify type is defined by the user', () => {
    const source = `
    type $Reify = any;
    `

    assert.throws(() => {
      babel.transform(
        source, {
          babelrc: false,
          plugins: [
            'syntax-flow',
            plugin
          ]
        }
      )
    }, err => {
      if ((err instanceof Error) &&
        /\$Reify is a reserved interface name for babel-plugin-tcomb/.test(err.message) ) {
        return true
      }
    })
  })

})

describe('globals option', () => {

  it('does not compile globals', () => {
    const source = `
    const MyComponent2: ReactClass<Props> = MyComponent;
    `

    const actual = babel.transform(
      source, {
        babelrc: false,
        plugins: [
          'syntax-flow',
          [plugin, {
            skipHelpers: true,
            globals: [
              {
                'ReactClass': true
              }
            ]
          }]
        ]
      }
    ).code
    const expected = `const MyComponent2: ReactClass<Props> = MyComponent;`
    assert.equal(trim(actual), trim(expected))
  })

})

describe('emit asserts for: ', () => {
  fs.readdirSync(fixturesDir).map((caseName) => {
    if ((caseName in skipTests)) {
      return
    }
    if (!(caseName in { 'destructuring': 1 })) {
      // return
    }
    it(`should ${caseName.split('-').join(' ')}`, () => {
      const fixtureDir = path.join(fixturesDir, caseName)
      const actual = babel.transformFileSync(
        path.join(fixtureDir, 'actual.js'), {
          babelrc: false,
          plugins: [
            'syntax-async-functions',
            'syntax-flow',
            plugin,
            'transform-flow-strip-types',
            'transform-object-rest-spread'
          ]
        }
      ).code
      const expected = fs.readFileSync(path.join(fixtureDir, 'expected.js')).toString()

      assert.equal(trim(actual), trim(expected))
    })
  })
})
