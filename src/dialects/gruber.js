import MarkdownHelpers from "../markdown_helpers";
import DialectHelpers from "./dialect_helpers";
import Markdown from "../parser";
var forEach = MarkdownHelpers.forEach, extract_attr = MarkdownHelpers.extract_attr, mk_block = MarkdownHelpers.mk_block, isEmpty = MarkdownHelpers.isEmpty, inline_until_char = DialectHelpers.inline_until_char;
var urlRegexp = (/(?:(?:https?|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?/i).source;
var Gruber = {
  block: {
    atxHeader: function atxHeader(block, next) {
      var m = block.match(/^(#{1,6})\s*(.*?)\s*#*\s*(?:\n|$)/);
      if (!m) return undefined;
      var header = ["header", {
        level: m[1].length
      }];
      Array.prototype.push.apply(header, this.processInline(m[2]));
      if (m[0].length < block.length) next.unshift(mk_block(block.substr(m[0].length), block.trailing, block.lineNumber + 2));
      return [header];
    },
    setextHeader: function setextHeader(block, next) {
      var m = block.match(/^(.*)\n([-=])\2\2+(?:\n|$)/);
      if (!m) return undefined;
      var level = m[2] === "=" ? 1 : 2, header = ["header", {
        level: level
      }].concat(this.processInline(m[1]));
      if (m[0].length < block.length) next.unshift(mk_block(block.substr(m[0].length), block.trailing, block.lineNumber + 2));
      return [header];
    },
    code: function code(block, next) {
      var ret = [], re = /^(?: {0,3}\t| {4})(.*)\n?/;
      if (!block.match(re)) return undefined;
      block_search: do {
        var b = this.loop_re_over_block(re, block.valueOf(), function (m) {
          ret.push(m[1]);
        });
        if (b.length) {
          next.unshift(mk_block(b, block.trailing));
          break block_search;
        } else if (next.length) {
          if (!next[0].match(re)) break block_search;
          ret.push(block.trailing.replace(/[^\n]/g, "").substring(2));
          block = next.shift();
        } else {
          break block_search;
        }
      } while (true);
      return [["code_block", ret.join("\n")]];
    },
    horizRule: function horizRule(block, next) {
      var m = block.match(/^(?:([\s\S]*?)\n)?[ \t]*([-_*])(?:[ \t]*\2){2,}[ \t]*(?:\n([\s\S]*))?$/);
      if (!m) return undefined;
      var jsonml = [["hr"]];
      if (m[1]) {
        var contained = mk_block(m[1], "", block.lineNumber);
        jsonml.unshift.apply(jsonml, this.toTree(contained, []));
      }
      if (m[3]) next.unshift(mk_block(m[3], block.trailing, block.lineNumber + 1));
      return jsonml;
    },
    lists: (function () {
      var any_list = "[*+-]|\\d+\\.", bullet_list = /[*+-]/, is_list_re = new RegExp("^( {0,3})(" + any_list + ")[ \t]+"), indent_re = "(?: {0,3}\\t| {4})";
      function regex_for_depth(depth) {
        return new RegExp("(?:^(" + indent_re + "{0," + depth + "} {0,3})(" + any_list + ")\\s+)|" + "(^" + indent_re + "{0," + (depth - 1) + "}[ ]{0,4})");
      }
      function expand_tab(input) {
        return input.replace(/ {0,3}\t/g, "    ");
      }
      function add(li, loose, inline, nl) {
        if (loose) {
          li.push(["para"].concat(inline));
          return;
        }
        var add_to = li[li.length - 1] instanceof Array && li[li.length - 1][0] === "para" ? li[li.length - 1] : li;
        if (nl && li.length > 1) inline.unshift(nl);
        for (var i = 0; i < inline.length; i++) {
          var what = inline[i], is_str = typeof what === "string";
          if (is_str && add_to.length > 1 && typeof add_to[add_to.length - 1] === "string") add_to[add_to.length - 1] += what; else add_to.push(what);
        }
      }
      function get_contained_blocks(depth, blocks) {
        var re = new RegExp("^(" + indent_re + "{" + depth + "}.*?\\n?)*$"), replace = new RegExp("^" + indent_re + "{" + depth + "}", "gm"), ret = [];
        while (blocks.length > 0) {
          if (re.exec(blocks[0])) {
            var b = blocks.shift(), x = b.replace(replace, "");
            ret.push(mk_block(x, b.trailing, b.lineNumber));
          } else break;
        }
        return ret;
      }
      function paragraphify(s, i, stack) {
        var list = s.list;
        var last_li = list[list.length - 1];
        if (last_li[1] instanceof Array && last_li[1][0] === "para") return;
        if (i + 1 === stack.length) {
          last_li.push(["para"].concat(last_li.splice(1, last_li.length - 1)));
        } else {
          var sublist = last_li.pop();
          last_li.push(["para"].concat(last_li.splice(1, last_li.length - 1)), sublist);
        }
      }
      return function (block, next) {
        var m = block.match(is_list_re);
        if (!m) return undefined;
        function make_list(m) {
          var list = bullet_list.exec(m[2]) ? ["bulletlist"] : ["numberlist"];
          stack.push({
            list: list,
            indent: m[1]
          });
          return list;
        }
        var stack = [], list = make_list(m), last_li, loose = false, ret = [stack[0].list], i;
        loose_search: while (true) {
          var lines = block.split(/(?=\n)/);
          var li_accumulate = "", nl = "";
          tight_search: for (var line_no = 0; line_no < lines.length; line_no++) {
            nl = "";
            var l = lines[line_no].replace(/^\n/, function (n) {
              nl = n;
              return "";
            });
            var line_re = regex_for_depth(stack.length);
            m = l.match(line_re);
            if (m[1] !== undefined) {
              if (li_accumulate.length) {
                add(last_li, loose, this.processInline(li_accumulate), nl);
                loose = false;
                li_accumulate = "";
              }
              m[1] = expand_tab(m[1]);
              var wanted_depth = Math.floor(m[1].length / 4) + 1;
              if (wanted_depth > stack.length) {
                list = make_list(m);
                last_li.push(list);
                last_li = list[1] = ["listitem"];
              } else {
                var found = false;
                for (i = 0; i < stack.length; i++) {
                  if (stack[i].indent !== m[1]) continue;
                  list = stack[i].list;
                  stack.splice(i + 1, stack.length - (i + 1));
                  found = true;
                  break;
                }
                if (!found) {
                  wanted_depth++;
                  if (wanted_depth <= stack.length) {
                    stack.splice(wanted_depth, stack.length - wanted_depth);
                    list = stack[wanted_depth - 1].list;
                  } else {
                    list = make_list(m);
                    last_li.push(list);
                  }
                }
                last_li = ["listitem"];
                list.push(last_li);
              }
              nl = "";
            }
            if (l.length > m[0].length) li_accumulate += nl + l.substr(m[0].length);
          }
          if (li_accumulate.length) {
            var contents = this.processBlock(li_accumulate, []), firstBlock = contents[0];
            if (firstBlock) {
              firstBlock.shift();
              contents.splice.apply(contents, [0, 1].concat(firstBlock));
              add(last_li, loose, contents, nl);
              if (last_li[last_li.length - 1] === "\n") {
                last_li.pop();
              }
              loose = false;
              li_accumulate = "";
            }
          }
          var contained = get_contained_blocks(stack.length, next);
          if (contained.length > 0) {
            forEach(stack, paragraphify, this);
            last_li.push.apply(last_li, this.toTree(contained, []));
          }
          var next_block = next[0] && next[0].valueOf() || "";
          if (next_block.match(is_list_re) || next_block.match(/^ /)) {
            block = next.shift();
            var hr = this.dialect.block.horizRule.call(this, block, next);
            if (hr) {
              ret.push.apply(ret, hr);
              break;
            }
            if (stack[stack.length - 1].indent === block.match(/^\s*/)[0]) {
              forEach(stack, paragraphify, this);
            }
            loose = true;
            continue loose_search;
          }
          break;
        }
        return ret;
      };
    })(),
    blockquote: function blockquote(block, next) {
      var m = (/(^|\n) +(\>[\s\S]*)/).exec(block);
      if (m && m[2] && m[2].length) {
        var blockContents = block.replace(/(^|\n) +\>/, "$1>");
        next.unshift(blockContents);
        return [];
      }
      if (!block.match(/^>/m)) return undefined;
      var jsonml = [];
      if (block[0] !== ">") {
        var lines = block.split(/\n/), prev = [], line_no = block.lineNumber;
        while (lines.length && lines[0][0] !== ">") {
          prev.push(lines.shift());
          line_no++;
        }
        var abutting = mk_block(prev.join("\n"), "\n", block.lineNumber);
        jsonml.push.apply(jsonml, this.processBlock(abutting, []));
        block = mk_block(lines.join("\n"), block.trailing, line_no);
      }
      while (next.length && next[0][0] === ">") {
        var b = next.shift();
        block = mk_block(block + block.trailing + b, b.trailing, block.lineNumber);
      }
      var input = block.replace(/^> ?/gm, ""), old_tree = this.tree, processedBlock = this.toTree(input, ["blockquote"]), attr = extract_attr(processedBlock);
      if (attr && attr.references) {
        delete attr.references;
        if (isEmpty(attr)) processedBlock.splice(1, 1);
      }
      jsonml.push(processedBlock);
      return jsonml;
    },
    referenceDefn: function referenceDefn(block, next) {
      var re = /^\s*\[([^\[\]]+)\]:\s*(\S+)(?:\s+(?:(['"])(.*)\3|\((.*?)\)))?\n?/;
      if (!block.match(re)) return undefined;
      var attrs = create_attrs.call(this);
      var b = this.loop_re_over_block(re, block, function (m) {
        create_reference(attrs, m);
      });
      if (b.length) next.unshift(mk_block(b, block.trailing));
      return [];
    },
    para: function para(block) {
      return [["para"].concat(this.processInline(block))];
    }
  },
  inline: {
    __oneElement__: function oneElement(text, patterns_or_re, previous_nodes) {
      var m, res;
      patterns_or_re = patterns_or_re || this.dialect.inline.__patterns__;
      var re = new RegExp("([\\s\\S]*?)(" + (patterns_or_re.source || patterns_or_re) + ")");
      m = re.exec(text);
      if (!m) {
        return [text.length, text];
      } else if (m[1]) {
        return [m[1].length, m[1]];
      }
      var res;
      if ((m[2] in this.dialect.inline)) {
        res = this.dialect.inline[m[2]].call(this, text.substr(m.index), m, previous_nodes || []);
      }
      res = res || [m[2].length, m[2]];
      return res;
    },
    __call__: function inline(text, patterns) {
      var out = [], res;
      function add(x) {
        if (typeof x === "string" && typeof out[out.length - 1] === "string") out[out.length - 1] += x; else out.push(x);
      }
      while (text.length > 0) {
        res = this.dialect.inline.__oneElement__.call(this, text, patterns, out);
        text = text.substr(res.shift());
        forEach(res, add);
      }
      return out;
    },
    "]": function () {},
    "}": function () {},
    __escape__: /^\\[\\`\*_{}<>\[\]()#\+.!\-]/,
    "\\": function escaped(text) {
      if (this.dialect.inline.__escape__.exec(text)) return [2, text.charAt(1)]; else return [1, "\\"];
    },
    "![": function image(text) {
      if (text.indexOf("(") >= 0 && text.indexOf(")") === -1) {
        return;
      }
      var m = text.match(new RegExp("^!\\[(.*?)][ \\t]*\\((" + urlRegexp + ")\\)([ \\t])*([\"'].*[\"'])?")) || text.match(/^!\[(.*?)\][ \t]*\([ \t]*([^")]*?)(?:[ \t]+(["'])(.*?)\3)?[ \t]*\)/);
      if (m) {
        if (m[2] && m[2][0] === "<" && m[2][m[2].length - 1] === ">") m[2] = m[2].substring(1, m[2].length - 1);
        m[2] = this.dialect.inline.__call__.call(this, m[2], /\\/)[0];
        var attrs = {
          alt: m[1],
          href: m[2] || ""
        };
        if (m[4] !== undefined) attrs.title = m[4];
        return [m[0].length, ["img", attrs]];
      }
      m = text.match(/^!\[(.*?)\][ \t]*\[(.*?)\]/);
      if (m) {
        return [m[0].length, ["img_ref", {
          alt: m[1],
          ref: m[2].toLowerCase(),
          original: m[0]
        }]];
      }
      return [2, "!["];
    },
    "[": function link(text) {
      var open = 1;
      for (var i = 0; i < text.length; i++) {
        var c = text.charAt(i);
        if (c === "[") {
          open++;
        }
        if (c === "]") {
          open--;
        }
        if (open > 3) {
          return [1, "["];
        }
      }
      var orig = String(text);
      var res = inline_until_char.call(this, text.substr(1), "]");
      if (!res[1]) {
        return [res[0] + 1, text.charAt(0)].concat(res[2]);
      }
      if (res[0] === 1) {
        return [2, "[]"];
      }
      var consumed = 1 + res[0], children = res[1], link, attrs;
      text = text.substr(consumed);
      var m = text.match(/^\s*\([ \t]*([^"']*)(?:[ \t]+(["'])(.*?)\2)?[ \t]*\)/);
      if (m) {
        var url = m[1].replace(/\s+$/, "");
        consumed += m[0].length;
        if (url && url[0] === "<" && url[url.length - 1] === ">") url = url.substring(1, url.length - 1);
        if (!m[3]) {
          var open_parens = 1;
          for (var len = 0; len < url.length; len++) {
            switch (url[len]) {
              case "(":
                open_parens++;
                break;
              case ")":
                if (--open_parens === 0) {
                  consumed -= url.length - len;
                  url = url.substring(0, len);
                }
                break;
            }
          }
        }
        url = this.dialect.inline.__call__.call(this, url, /\\/)[0];
        attrs = {
          href: url || ""
        };
        if (m[3] !== undefined) attrs.title = m[3];
        link = ["link", attrs].concat(children);
        return [consumed, link];
      }
      m = text.match(new RegExp("^\\((" + urlRegexp + ")\\)"));
      if (m && m[1]) {
        consumed += m[0].length;
        link = ["link", {
          href: m[1]
        }].concat(children);
        return [consumed, link];
      }
      m = text.match(/^\s*\[(.*?)\]/);
      if (m) {
        consumed += m[0].length;
        attrs = {
          ref: (m[1] || String(children)).toLowerCase(),
          original: orig.substr(0, consumed)
        };
        if (children && children.length > 0) {
          link = ["link_ref", attrs].concat(children);
          return [consumed, link];
        }
      }
      m = orig.match(/^\s*\[(.*?)\]:\s*(\S+)(?:\s+(?:(['"])(.*?)\3|\((.*?)\)))?\n?/);
      if (m) {
        var attrs = create_attrs.call(this);
        create_reference(attrs, m);
        return [m[0].length];
      }
      if (children.length === 1 && typeof children[0] === "string") {
        var normalized = children[0].toLowerCase().replace(/\s+/, " ");
        attrs = {
          ref: normalized,
          original: orig.substr(0, consumed)
        };
        link = ["link_ref", attrs, children[0]];
        return [consumed, link];
      }
      return [1, "["];
    },
    "<": function autoLink(text) {
      var m;
      if ((m = text.match(/^<(?:((https?|ftp|mailto):[^>]+)|(.*?@.*?\.[a-zA-Z]+))>/)) !== null) {
        if (m[3]) return [m[0].length, ["link", {
          href: "mailto:" + m[3]
        }, m[3]]]; else if (m[2] === "mailto") return [m[0].length, ["link", {
          href: m[1]
        }, m[1].substr(("mailto:").length)]]; else return [m[0].length, ["link", {
          href: m[1]
        }, m[1]]];
      }
      return [1, "<"];
    },
    "`": function inlineCode(text) {
      var m = text.match(/(`+)(([\s\S]*?)\1)/);
      if (m && m[2]) return [m[1].length + m[2].length, ["inlinecode", m[3]]]; else {
        return [1, "`"];
      }
    },
    "  \n": function lineBreak() {
      return [3, ["linebreak"]];
    }
  }
};
function strong_em(tag, md) {
  var state_slot = tag + "_state", other_slot = tag === "strong" ? "em_state" : "strong_state";
  function CloseTag(len) {
    this.len_after = len;
    this.name = "close_" + md;
  }
  return function (text) {
    if (this[state_slot][0] === md) {
      this[state_slot].shift();
      return [text.length, new CloseTag(text.length - md.length)];
    } else {
      var other = this[other_slot].slice(), state = this[state_slot].slice();
      this[state_slot].unshift(md);
      var res = this.processInline(text.substr(md.length));
      var last = res[res.length - 1];
      var check = this[state_slot].shift();
      if (last instanceof CloseTag) {
        res.pop();
        var consumed = text.length - last.len_after;
        return [consumed, [tag].concat(res)];
      } else {
        this[other_slot] = other;
        this[state_slot] = state;
        return [md.length, md];
      }
    }
  };
}
function create_attrs() {
  if (!extract_attr(this.tree)) {
    this.tree.splice(1, 0, {});
  }
  var attrs = extract_attr(this.tree);
  if (attrs.references === undefined) {
    attrs.references = {};
  }
  return attrs;
}
function create_reference(attrs, m) {
  if (m[2] && m[2][0] === "<" && m[2][m[2].length - 1] === ">") m[2] = m[2].substring(1, m[2].length - 1);
  var ref = attrs.references[m[1].toLowerCase()] = {
    href: m[2]
  };
  if (m[4] !== undefined) ref.title = m[4]; else if (m[5] !== undefined) ref.title = m[5];
}
Gruber.inline["**"] = strong_em("strong", "**");
Gruber.inline["__"] = strong_em("strong", "__");
Gruber.inline["*"] = strong_em("em", "*");
Gruber.inline["_"] = strong_em("em", "_");
Markdown.dialects.Gruber = Gruber;
Markdown.buildBlockOrder(Markdown.dialects.Gruber.block);
Markdown.buildInlinePatterns(Markdown.dialects.Gruber.inline);
export default Gruber;
