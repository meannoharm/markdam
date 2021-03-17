import MarkdownHelpers from "../markdown_helpers";
import DialectHelpers from "./dialect_helpers";
import Gruber from "./gruber";
import Markdown from "../parser";
var Maruku = DialectHelpers.subclassDialect(Gruber), extract_attr = MarkdownHelpers.extract_attr, forEach = MarkdownHelpers.forEach;
Maruku.processMetaHash = function processMetaHash(meta_string) {
  var meta = split_meta_hash(meta_string), attr = {};
  for (var i = 0; i < meta.length; ++i) {
    if ((/^#/).test(meta[i])) attr.id = meta[i].substring(1); else if ((/^\./).test(meta[i])) {
      if (attr["class"]) attr["class"] = attr["class"] + meta[i].replace(/./, " "); else attr["class"] = meta[i].substring(1);
    } else if ((/\=/).test(meta[i])) {
      var s = meta[i].split(/\=/);
      attr[s[0]] = s[1];
    }
  }
  return attr;
};
function split_meta_hash(meta_string) {
  var meta = meta_string.split(""), parts = [""], in_quotes = false;
  while (meta.length) {
    var letter = meta.shift();
    switch (letter) {
      case " ":
        if (in_quotes) parts[parts.length - 1] += letter; else parts.push("");
        break;
      case "'":
      case "\"":
        in_quotes = !in_quotes;
        break;
      case "\\":
        letter = meta.shift();
      default:
        parts[parts.length - 1] += letter;
        break;
    }
  }
  return parts;
}
Maruku.block.document_meta = function document_meta(block) {
  if (block.lineNumber > 1) return undefined;
  if (!block.match(/^(?:\w+:.*\n)*\w+:.*$/)) return undefined;
  if (!extract_attr(this.tree)) this.tree.splice(1, 0, {});
  var pairs = block.split(/\n/);
  for (var p in pairs) {
    var m = pairs[p].match(/(\w+):\s*(.*)$/), key = m[1].toLowerCase(), value = m[2];
    this.tree[1][key] = value;
  }
  return [];
};
Maruku.block.block_meta = function block_meta(block) {
  var m = block.match(/(^|\n) {0,3}\{:\s*((?:\\\}|[^\}])*)\s*\}$/);
  if (!m) return undefined;
  var attr = this.dialect.processMetaHash(m[2]), hash;
  if (m[1] === "") {
    var node = this.tree[this.tree.length - 1];
    hash = extract_attr(node);
    if (typeof node === "string") return undefined;
    if (!hash) {
      hash = {};
      node.splice(1, 0, hash);
    }
    for (var a in attr) hash[a] = attr[a];
    return [];
  }
  var b = block.replace(/\n.*$/, ""), result = this.processBlock(b, []);
  hash = extract_attr(result[0]);
  if (!hash) {
    hash = {};
    result[0].splice(1, 0, hash);
  }
  for (var a in attr) hash[a] = attr[a];
  return result;
};
Maruku.block.definition_list = function definition_list(block, next) {
  var tight = /^((?:[^\s:].*\n)+):\s+([\s\S]+)$/, list = ["dl"], i, m;
  if (m = block.match(tight)) {
    var blocks = [block];
    while (next.length && tight.exec(next[0])) blocks.push(next.shift());
    for (var b = 0; b < blocks.length; ++b) {
      var m = blocks[b].match(tight), terms = m[1].replace(/\n$/, "").split(/\n/), defns = m[2].split(/\n:\s+/);
      for (i = 0; i < terms.length; ++i) list.push(["dt", terms[i]]);
      for (i = 0; i < defns.length; ++i) {
        list.push(["dd"].concat(this.processInline(defns[i].replace(/(\n)\s+/, "$1"))));
      }
    }
  } else {
    return undefined;
  }
  return [list];
};
Maruku.block.table = function table(block) {
  var _split_on_unescaped = function (s, ch) {
    ch = ch || "\\s";
    if (ch.match(/^[\\|\[\]{}?*.+^$]$/)) ch = "\\" + ch;
    var res = [], r = new RegExp("^((?:\\\\.|[^\\\\" + ch + "])*)" + ch + "(.*)"), m;
    while (m = s.match(r)) {
      res.push(m[1]);
      s = m[2];
    }
    res.push(s);
    return res;
  };
  var leading_pipe = /^ {0,3}\|(.+)\n {0,3}\|\s*([\-:]+[\-| :]*)\n((?:\s*\|.*(?:\n|$))*)(?=\n|$)/, no_leading_pipe = /^ {0,3}(\S(?:\\.|[^\\|])*\|.*)\n {0,3}([\-:]+\s*\|[\-| :]*)\n((?:(?:\\.|[^\\|])*\|.*(?:\n|$))*)(?=\n|$)/, i, m;
  if (m = block.match(leading_pipe)) {
    m[3] = m[3].replace(/^\s*\|/gm, "");
  } else if (!(m = block.match(no_leading_pipe))) {
    return undefined;
  }
  var table = ["table", ["thead", ["tr"]], ["tbody"]];
  m[2] = m[2].replace(/\|\s*$/, "").split("|");
  var html_attrs = [];
  forEach(m[2], function (s) {
    if (s.match(/^\s*-+:\s*$/)) html_attrs.push({
      align: "right"
    }); else if (s.match(/^\s*:-+\s*$/)) html_attrs.push({
      align: "left"
    }); else if (s.match(/^\s*:-+:\s*$/)) html_attrs.push({
      align: "center"
    }); else html_attrs.push({});
  });
  m[1] = _split_on_unescaped(m[1].replace(/\|\s*$/, ""), "|");
  for (i = 0; i < m[1].length; i++) {
    table[1][1].push(["th", html_attrs[i] || ({})].concat(this.processInline(m[1][i].trim())));
  }
  forEach(m[3].replace(/\|\s*$/mg, "").split("\n"), function (row) {
    var html_row = ["tr"];
    row = _split_on_unescaped(row, "|");
    for (i = 0; i < row.length; i++) html_row.push(["td", html_attrs[i] || ({})].concat(this.processInline(row[i].trim())));
    table[2].push(html_row);
  }, this);
  return [table];
};
Maruku.inline["{:"] = function inline_meta(text, matches, out) {
  if (!out.length) return [2, "{:"];
  var before = out[out.length - 1];
  if (typeof before === "string") return [2, "{:"];
  var m = text.match(/^\{:\s*((?:\\\}|[^\}])*)\s*\}/);
  if (!m) return [2, "{:"];
  var meta = this.dialect.processMetaHash(m[1]), attr = extract_attr(before);
  if (!attr) {
    attr = {};
    before.splice(1, 0, attr);
  }
  for (var k in meta) attr[k] = meta[k];
  return [m[0].length, ""];
};
Markdown.dialects.Maruku = Maruku;
Markdown.dialects.Maruku.inline.__escape__ = /^\\[\\`\*_{}\[\]()#\+.!\-|:]/;
Markdown.buildBlockOrder(Markdown.dialects.Maruku.block);
Markdown.buildInlinePatterns(Markdown.dialects.Maruku.inline);
export default Maruku;
