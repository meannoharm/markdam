import Markdown from "./core";
import MarkdownHelpers from "./markdown_helpers";
var extract_attr = MarkdownHelpers.extract_attr;
Markdown.renderJsonML = function (jsonml, options) {
  options = options || ({});
  options.root = options.root || false;
  jsonml = JSON.parse(JSON.stringify(jsonml));
  var content = [];
  if (options.root) {
    content.push(render_tree(jsonml));
  } else {
    jsonml.shift();
    if (jsonml.length && typeof jsonml[0] === "object" && !(jsonml[0] instanceof Array)) jsonml.shift();
    while (jsonml.length) content.push(render_tree(jsonml.shift()));
  }
  return content.join("\n\n");
};
Markdown.toHTMLTree = function toHTMLTree(input, dialect, options) {
  if (typeof input === "string") input = this.parse(input, dialect);
  var attrs = extract_attr(input), refs = {};
  if (attrs && attrs.references) refs = attrs.references;
  var html = convert_tree_to_html(input, refs, options);
  merge_text_nodes(html);
  return html;
};
Markdown.toHTML = function toHTML(source, dialect, options) {
  var input = this.toHTMLTree(source, dialect, options);
  return this.renderJsonML(input);
};
function escapeHTML(text) {
  if (text && text.length > 0) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  } else {
    return "";
  }
}
function render_tree(jsonml) {
  if (typeof jsonml === "string") return escapeHTML(jsonml);
  var tag = jsonml.shift(), attributes = {}, content = [];
  if (jsonml.length && typeof jsonml[0] === "object" && !(jsonml[0] instanceof Array)) attributes = jsonml.shift();
  while (jsonml.length) content.push(render_tree(jsonml.shift()));
  var tag_attrs = "";
  if (typeof attributes.src !== "undefined") {
    tag_attrs += " src=\"" + escapeHTML(attributes.src) + "\"";
    delete attributes.src;
  }
  for (var a in attributes) {
    var escaped = escapeHTML(attributes[a]);
    if (escaped && escaped.length) {
      tag_attrs += " " + a + "=\"" + escaped + "\"";
    }
  }
  if (tag === "img" || tag === "br" || tag === "hr") return "<" + tag + tag_attrs + "/>"; else return "<" + tag + tag_attrs + ">" + content.join("") + "</" + tag + ">";
}
function convert_tree_to_html(tree, references, options) {
  var i;
  options = options || ({});
  var jsonml = tree.slice(0);
  if (typeof options.preprocessTreeNode === "function") jsonml = options.preprocessTreeNode(jsonml, references);
  var attrs = extract_attr(jsonml);
  if (attrs) {
    jsonml[1] = {};
    for (i in attrs) {
      jsonml[1][i] = attrs[i];
    }
    attrs = jsonml[1];
  }
  if (typeof jsonml === "string") return jsonml;
  switch (jsonml[0]) {
    case "header":
      jsonml[0] = "h" + jsonml[1].level;
      delete jsonml[1].level;
      break;
    case "bulletlist":
      jsonml[0] = "ul";
      break;
    case "numberlist":
      jsonml[0] = "ol";
      break;
    case "listitem":
      jsonml[0] = "li";
      break;
    case "para":
      jsonml[0] = "p";
      break;
    case "markdown":
      jsonml[0] = "html";
      if (attrs) delete attrs.references;
      break;
    case "code_block":
      jsonml[0] = "pre";
      i = attrs ? 2 : 1;
      var code = ["code"];
      code.push.apply(code, jsonml.splice(i, jsonml.length - i));
      jsonml[i] = code;
      break;
    case "inlinecode":
      jsonml[0] = "code";
      break;
    case "img":
      jsonml[1].src = jsonml[1].href;
      delete jsonml[1].href;
      break;
    case "linebreak":
      jsonml[0] = "br";
      break;
    case "link":
      jsonml[0] = "a";
      break;
    case "link_ref":
      jsonml[0] = "a";
      var ref = references[attrs.ref];
      if (ref) {
        delete attrs.ref;
        attrs.href = ref.href;
        if (ref.title) attrs.title = ref.title;
        delete attrs.original;
      } else {
        return attrs.original;
      }
      break;
    case "img_ref":
      jsonml[0] = "img";
      var ref = references[attrs.ref];
      if (ref) {
        delete attrs.ref;
        attrs.src = ref.href;
        if (ref.title) attrs.title = ref.title;
        delete attrs.original;
      } else {
        return attrs.original;
      }
      break;
  }
  i = 1;
  if (attrs) {
    for (var key in jsonml[1]) {
      i = 2;
      break;
    }
    if (i === 1) jsonml.splice(i, 1);
  }
  for (; i < jsonml.length; ++i) {
    jsonml[i] = convert_tree_to_html(jsonml[i], references, options);
  }
  return jsonml;
}
function merge_text_nodes(jsonml) {
  var i = extract_attr(jsonml) ? 2 : 1;
  while (i < jsonml.length) {
    if (typeof jsonml[i] === "string") {
      if (i + 1 < jsonml.length && typeof jsonml[i + 1] === "string") {
        jsonml[i] += jsonml.splice(i + 1, 1)[0];
      } else {
        ++i;
      }
    } else {
      merge_text_nodes(jsonml[i]);
      ++i;
    }
  }
}
export default Markdown;
