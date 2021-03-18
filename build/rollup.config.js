const babel = require("rollup-plugin-babel");
const { uglify } = require("rollup-plugin-uglify");

module.exports = (config) => {
  const { input, fileName, name } = config;

  return {
    input: {
      input,
      plugins: [
        babel({
          exclude: "node_modules/**",
        }),
        uglify(),
      ],
    },
    output: {
      file: `lib/${fileName}`,
      format: "umd",
      name: name || "markright",
      globals: {
        markright: "markright",
      },
    },
  };
};
