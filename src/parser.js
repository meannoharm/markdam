import MarkdownHelpers from "./markdown_helpers";
import Markdown from "./core";
var mk_block = Markdown.mk_block = MarkdownHelpers.mk_block, isArray = MarkdownHelpers.isArray;
Markdown.parse = function (source, dialect) {
  var md = new Markdown(dialect);
  return md.toTree(source);
};
function count_lines(str) {
  return str.split("\n").length - 1;
}
Markdown.prototype.split_blocks = function splitBlocks(input) {
  input = input.replace(/\r\n?/g, "\n");
  var re = /([\s\S]+?)($|\n#|\n(?:\s*\n|$)+)/g, blocks = [], m;
  var line_no = 1;
  if ((m = (/^(\s*\n)/).exec(input)) !== null) {
    line_no += count_lines(m[0]);
    re.lastIndex = m[0].length;
  }
  while ((m = re.exec(input)) !== null) {
    if (m[2] === "\n#") {
      m[2] = "\n";
      re.lastIndex--;
    }
    blocks.push(mk_block(m[1], m[2], line_no));
    line_no += count_lines(m[0]);
  }
  return blocks;
};
Markdown.prototype.processBlock = function processBlock(block, next) {
  var cbs = this.dialect.block, ord = cbs.__order__;
  if (("__call__" in cbs)) return cbs.__call__.call(this, block, next);
  for (var i = 0; i < ord.length; i++) {
    var res = cbs[ord[i]].call(this, block, next);
    if (res) {
      if (!isArray(res) || res.length > 0 && !isArray(res[0]) && typeof res[0] !== "string") {
        this.debug(ord[i], "didn't return proper JsonML");
      }
      return res;
    }
  }
  return [];
};
Markdown.prototype.processInline = function processInline(block) {
  return this.dialect.inline.__call__.call(this, String(block));
};
Markdown.prototype.toTree = function toTree(source, custom_root) {
  var blocks = source instanceof Array ? source : this.split_blocks(source);
  var old_tree = this.tree;
  try {
    this.tree = custom_root || this.tree || ["markdown"];
    blocks_loop: while (blocks.length) {
      var b = this.processBlock(blocks.shift(), blocks);
      if (!b.length) continue blocks_loop;
      this.tree.push.apply(this.tree, b);
    }
    return this.tree;
  } finally {
    if (custom_root) this.tree = old_tree;
  }
};
Markdown.prototype.debug = function () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(this.debug_indent);
  if (typeof print !== "undefined") print.apply(print, args);
  if (typeof console !== "undefined" && typeof console.log !== "undefined") console.log.apply(null, args);
};
Markdown.prototype.loop_re_over_block = function (re, block, cb) {
  var m, b = block.valueOf();
  while (b.length && (m = re.exec(b)) !== null) {
    b = b.substr(m[0].length);
    cb.call(this, m);
  }
  return b;
};
Markdown.buildBlockOrder = function (d) {
  var ord = [];
  for (var i in d) {
    if (i === "__order__" || i === "__call__") continue;
    ord.push(i);
  }
  d.__order__ = ord;
};
Markdown.buildInlinePatterns = function (d) {
  var patterns = [];
  for (var i in d) {
    if (i.match(/^__.*__$/)) continue;
    var l = i.replace(/([\\.*+?^$|()\[\]{}])/g, "\\$1").replace(/\n/, "\\n");
    patterns.push(i.length === 1 ? l : "(?:" + l + ")");
  }
  patterns = patterns.join("|");
  d.__patterns__ = patterns;
  var fn = d.__call__;
  d.__call__ = function (text, pattern) {
    if (pattern !== undefined) return fn.call(this, text, pattern); else return fn.call(this, text, patterns);
  };
};
export default Markdown;
