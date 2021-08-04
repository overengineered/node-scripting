# Functions that simplify node utility scripts

The design goal of this package is to make simple things simple. Making hard things possible is not one of the goals.

# API

## main

Usage:

```JavaScript
main(module, async () => {
  // ... Script code
});
```

Script code will be executed when running module directly, but will not be executed
when importing module. As a bonus it's easy to use `await` in the script code.
*Future:* parsing args and passing them into callback.

## print

Basically `console.log` with small improvements: returns first argument as a result (making debugging easier, e.g.
`run(print(getCommand()), print(getOptions()))`). Also, when called with one argument, uses `99` for `util.inspect`
depth instead of the default.

## exec

Essentially promisified `exec` from `'child_process'`, but with significant differences:
* takes one string or array of strings as first argument and no second argument
* returns concatenation stderr and stdout encoded to `utf8`
* when first argument is array, commands are executed sequentially and result is array
* new lines are stripped from command text

## exec.io

Essentially `execSync` from `'child_process'`, but with some differences:
* takes one string or array of strings as first argument and no second argument
* stdio is only in `'inherit'` mode
* prints command before execution
* always returns `undefined`

## fetch

Reexport from `'node-fetch'`.

## fs

Reexport from `'fs-extra'`.

## env.text

Reads from value from environment, undefined returned as empty string.

## env.bool

Reads from value from environment converting it to boolean.

## env.int

Reads from value from environment converting it to number.
