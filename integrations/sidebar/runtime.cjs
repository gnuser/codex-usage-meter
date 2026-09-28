'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const names = ['injected-ui.js', 'project-colors.js', 'thread-tokens-ui.js', 'cdp.js'];
const source = fs.readFileSync(path.join(__dirname, 'popover.js'), 'utf8') + '\n' + names.map(name => fs.readFileSync(path.join(__dirname, 'vendor', name), 'utf8')).join('\n');
// Only vendored, reviewed source is compiled; no downloaded or page-supplied code.
module.exports = vm.runInThisContext('(function(){' + source + '\nreturn {RendererInjector, CdpSession, isMainWindow};})()', { filename: 'sidebar-components.cjs' });
