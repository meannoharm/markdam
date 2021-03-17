var DialectHelpers = {};
DialectHelpers.inline_until_char = function (text, want) {
  var consumed = 0, nodes = [];
  while (true) {
    if (text.charAt(consumed) === want) {
      consumed++;
      return [consumed, nodes];
    }
    if (consumed >= text.length) {
      return [consumed, null, nodes];
    }
    var res = this.dialect.inline.__oneElement__.call(this, text.substr(consumed));
    consumed += res[0];
    nodes.push.apply(nodes, res.slice(1));
  }
};
DialectHelpers.subclassDialect = function (d) {
  function Block() {}
  Block.prototype = d.block;
  function Inline() {}
  Inline.prototype = d.inline;
  return {
    block: new Block(),
    inline: new Inline()
  };
};
export default DialectHelpers;
