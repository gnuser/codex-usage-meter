'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');

class MeterService {
  constructor(python) {
    this.python = python;
    this.child = null;
    this.url = null;
    this.starting = null;
    this.stopping = null;
    this.reads = new AbortController();
  }

  start() {
    if (this.stopping) return this.stopping.then(() => this.start());
    if (this.url) return Promise.resolve();
    if (!this.starting) {
      this.starting = this.launch().finally(() => { this.starting = null; });
    }
    return this.starting;
  }

  async launch() {
    this.reads = new AbortController();
    const child = spawn(this.python, ['-u', path.resolve(__dirname, '../../meter.py'), 'serve'], {
      stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
    });
    this.child = child;
    try {
      const url = await new Promise((resolve, reject) => {
        let data = '', settled = false;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          child.stdout.removeListener('data', read);
          error ? reject(error) : resolve(value);
        };
        const read = chunk => {
          data += chunk;
          if (data.length > 8192) return finish(new Error('Invalid service response'));
          if (!data.includes('\n')) return;
          try {
            const url = new URL(data.split('\n')[0]);
            const key = new URLSearchParams(url.hash.slice(1)).get('key');
            if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || !key) {
              throw new Error('Invalid address');
            }
            finish(null, url);
          } catch { finish(new Error('Invalid service address')); }
        };
        const timer = setTimeout(() => finish(new Error('Meter startup timed out')), 10000);
        child.stdout.on('data', read);
        child.once('error', () => finish(new Error('Python service unavailable')));
        child.once('exit', () => {
          if (this.child === child) { this.url = null; this.child = null; this.reads.abort(); }
          finish(new Error('Meter service stopped'));
        });
      });
      if (this.child !== child) throw new Error('Meter startup cancelled');
      this.url = url;
    } catch (error) {
      if (this.child === child) await this.stop();
      throw error;
    }
  }

  async read(route, timeout = 10000) {
    if (!this.url) throw new Error('Meter not running');
    if (!route.startsWith('/api/') || route.includes('\\')) throw new Error('Invalid meter route');
    const key = new URLSearchParams(this.url.hash.slice(1)).get('key');
    const response = await fetch(new URL(route, this.url.origin), {
      headers: { Authorization: 'Bearer ' + key },
      signal: AbortSignal.any([this.reads.signal, AbortSignal.timeout(timeout)]),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Meter read failed');
    return response.json();
  }

  stop() {
    this.reads.abort();
    const child = this.child;
    this.child = null;
    this.url = null;
    if (this.stopping) return this.stopping;
    if (!child || child.exitCode !== null || child.signalCode !== null || !child.pid) return Promise.resolve();
    this.stopping = new Promise(resolve => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.kill();
    }).finally(() => { this.stopping = null; });
    return this.stopping;
  }
}
module.exports = { MeterService };
