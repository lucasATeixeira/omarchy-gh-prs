'use strict'

// Loads a QML `.pragma library` file as a Node module, so tests run the file the shell loads.

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const PRAGMA = /^\s*\.pragma\s+library\s*$/m

function loadQmlLibrary (relativePath) {
  const full = path.resolve(__dirname, '..', relativePath)
  const source = fs.readFileSync(full, 'utf8').replace(PRAGMA, '')
  const module_ = { exports: {} }
  vm.runInThisContext('(function (module) {' + source + '\n})', { filename: full })(module_)
  return module_.exports
}

module.exports = { loadQmlLibrary }
