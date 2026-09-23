const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
let mutate, resize, pending;
const sent = [];
const cards = { id: "sessionCards", scrollHeight: 150 };
const footer = { getBoundingClientRect: () => ({ height: 20 }) };
const main = { children: [cards, footer] };
const context = {
  document: { querySelector: () => main },
  window: {
    webkit: {
      messageHandlers: { usageControl: { postMessage: (m) => sent.push(m) } },
    },
    addEventListener: () => {},
  },
  getComputedStyle: () => ({
    paddingTop: "3",
    paddingBottom: "3",
    marginTop: "0",
    marginBottom: "0",
  }),
  MutationObserver: class {
    constructor(fn) {
      mutate = fn;
    }
    observe() {}
  },
  ResizeObserver: class {
    constructor(fn) {
      resize = fn;
    }
    observe() {}
  },
  requestAnimationFrame: (fn) => {
    pending = fn;
  },
};
vm.runInNewContext(fs.readFileSync("web/panel-size.js", "utf8"), context);
pending();
assert.equal(sent.at(-1).height, "176");
cards.scrollHeight = 350;
mutate();
pending();
assert.equal(sent.at(-1).height, "376");
cards.scrollHeight = 50;
mutate();
pending();
assert.equal(sent.at(-1).height, "76");
resize();
pending();
assert.equal(
  sent.length,
  3,
  "viewport feedback must not repeat the same request",
);
console.log("Panel height grows, shrinks, and deduplicates viewport feedback");
