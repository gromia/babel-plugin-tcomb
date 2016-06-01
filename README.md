[tcomb](https://github.com/gcanti/tcomb) is a library for Node.js and the browser which allows you to check the types of JavaScript values at runtime with a simple and concise syntax. It's great for Domain Driven Design and for adding safety to your internal code.

babel-plugin-tcomb is a babel plugin for runtime type checking using tcomb. You can annotate a function (arguments and return type) with tcomb types.

# Babel versions

- ^5.0.0 -> babel-plugin-tcomb ^0.1.0
- ^6.0.0 -> babel-plugin-tcomb ^0.2.0

# How it works

```js
import t from 'tcomb';

function foo(x: t.Number, y: t.String): t.String {
  return x + y;
}
```

compiles to:

```js
function foo(x: t.Number, y: t.String): t.String {

  // check the arguments
  t.assert(t.is(x, t.Number), 'Invalid argument x (expected a ' + t.getTypeName(t.Number) + ')');
  t.assert(t.is(y, t.String.is), 'Invalid argument y (expected a ' + t.getTypeName(t.String) + ')');

  // exec the original function
  const ret = function (x, y) {
    return x + y;
  }(x, y);

  // check the return type
  t.assert(t.is(ret, t.String), 'Invalid argument ret (expected a ' + t.getTypeName(t.String) + ')');
  return ret;
}
```

Now the `foo` function is type-checked, this means...

```js
foo(1, 'a'); // => ok
foo(1, 2); // => ...will throws "[tcomb] Invalid value 2 supplied to String"
```

# Setup

First, install via npm.

```sh
npm install --save-dev babel-plugin-tcomb
```

Then, in your babel configuration (usually in your .babelrc file), add (at least) the following plugins:

```json
{
  "plugins" : ["syntax-flow", "tcomb", "transform-flow-strip-types"]
}
```

# Features

**default values**

```js
function foo(x: t.Number, y = 1: t.Number) {
  return x + y;
}

// compiles to
function foo(x: t.Number, y = 1: t.Number) {
  t.assert(t.Number.is(x), ...);
  t.assert(t.Number.is(y), ...);

  return x + y;
}
```

Alternative syntax:

```js
function foo(x: t.Number, y: t.Number = 1) {
  return x + y;
}

// compiles to
function foo(x: t.Number, y = 1) {
  t.assert(t.Number.is(x), ...);
  t.assert(t.Number.is(y), ...);

  return x + y;
}
```

**structural typing**

```js
function getFullName(person: {name: t.String, surname: t.String}) {
  return `${name} ${surname}`;
}
```

**`struct` combinator**

```js
const Person = t.struct({
  name: t.String
});

function foo(person: Person) {
  return person.name;
}
```

**`refinement` combinator**

```js
const Integer = t.refinement(t.Number, (n) => n % 1 === 0);

function foo(x: Integer) {
  return x;
}
```

**`maybe` combinator**

```js
function foo(x: ?t.String) {
  return x;
}
```

**`list` combinator**

```js
function foo(x: Array<t.String>) {
  return x;
}
```

**`tuple` combinator**

```js
function foo(x: [t.String, t.Number]) {
  return x;
}
```

**`union` combinator**

```js
function foo(x: t.String | t.Number) {
  return x;
}
```

**`dict` combinator**

```js
function foo(x: {[key: t.String]: t.Number}) {
  return x;
}
```

**`intersection` combinator**

```js
function foo(x: t.Number & t.String) {
  return x;
}
```

**Arrow functions**

```js
const f = (x: t.String) => x;
```

**Classes**

```js
class A {
  foo(x: t.String): t.String {
    return x;
  }
}
```
