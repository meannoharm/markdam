const rollup = require("rollup");
const configFactory = require("./rollup.config");

async function build(option) {
  const bundle = await rollup.rollup(option.input);
  await bundle.write(option.output);
}

(async function () {
  try {
    build(
      configFactory({
        input: "./src/index.js",
        fileName: "./markright.min.js",
      })
    );
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
  }
})();
