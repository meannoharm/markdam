import util from "util";

const MarkdownHelpers = {};
function mk_block_toSource() {
  return `Markdown.mk_block( ${uneval(this.toString())}, ${uneval(
    this.trailing
  )}, ${uneval(this.lineNumber)} )`;
}
function mk_block_inspect() {
  const util = require("util");
  return `Markdown.mk_block( ${util.inspect(this.toString())}, ${util.inspect(
    this.trailing
  )}, ${util.inspect(this.lineNumber)} )`;
}
MarkdownHelpers.mk_block = function (block, trail, line) {
  if (arguments.length === 1) trail = "\n\n";
  const s = new String(block);
  s.trailing = trail;
  s.inspect = mk_block_inspect;
  s.toSource = mk_block_toSource;
  if (line !== undefined) s.lineNumber = line;
  return s;
};
const isArray = (MarkdownHelpers.isArray =
  Array.isArray ||
  function (obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  });
if (Array.prototype.forEach) {
  MarkdownHelpers.forEach = function forEach(arr, cb, thisp) {
    return arr.forEach(cb, thisp);
  };
} else {
  MarkdownHelpers.forEach = function forEach(arr, cb, thisp) {
    for (let i = 0; i < arr.length; i++) cb.call(thisp || arr, arr[i], i, arr);
  };
}
MarkdownHelpers.isEmpty = function isEmpty(obj) {
  for (const key in obj) {
    if (hasOwnProperty.call(obj, key)) return false;
  }
  return true;
};
MarkdownHelpers.extract_attr = function extract_attr(jsonml) {
  return isArray(jsonml) &&
    jsonml.length > 1 &&
    typeof jsonml[1] === "object" &&
    !isArray(jsonml[1])
    ? jsonml[1]
    : undefined;
};
export default MarkdownHelpers;
