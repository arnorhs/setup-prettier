# Setup and run prettier --check with any plugin

**Prettier Check** is a github action that provides a way to
setup and run `prettier --check` on your code, using your defined prettier version
and dependencies without custom hacks.

## Why?

I run prettier --check in our CI but I use non-official prettier plugins. This means I can't use
[actions/prettier-action](https://github.com/marketplace/actions/prettier-action) to check the
code, because that seems to only support bundled prettier plugins (ie. `@prettier/plugin-*`)

So what I was doing was just running prettier directly after installing before the rest of the
code actions. But I like to run prettier as a separate job, but when doing that you need to
basically install everything, and re-use any caches etc and it just requires a bunch of setup
and hassle.

So this is an attempt at basically setting up only prettier and the related plugins in a relatively
light-weight fashion.

## Usage

To use this action in your github workflows:

### 1. Simple usage

```yml
name: CI
on: push

jobs:
  check_formatting:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Run prettier action
        uses: arnorhs/prettier-check@v1.0.3
```

### 2. Only changed files in a pull request

```yml
name: CI
on: pull_request

jobs:
  check_formatting:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          # without this, the git history will not have the main branch
          fetch-depth: 0
      - name: Run prettier action
        uses: arnorhs/prettier-check@v1.0.3
```

## Limitations and opinions

This action only supports checking prettier for formatting, not running it and committing.

It does not have any configuration / inputs yet.

As of now, this action is _pretty_ opinionated:

- This action doesn't format and commit the code.
- It assumes you haven't installed npm packages yet in node_modules - it will node_modules
  after running, so if you've already done an `npm install`, you shouldn't really be using
  this action anyways.
- If run in a `pull_request` action, it only checks changed files compared to the base
  branch (`GITHUB_BASE_REF`)
- Assumes your repo has a root `package.json`
- Assumes you have your prettier plugins in the root `package.json`
- Doesn't have any options, and doesn't allow you to customize the prettier invocation.

## TODO:

Make it work on other platforms
