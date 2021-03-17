var Markdown = function (dialect) {
  switch (typeof dialect) {
    case "undefined":
      this.dialect = Markdown.dialects.Gruber;
      break;
    case "object":
      this.dialect = dialect;
      break;
    default:
      if ((dialect in Markdown.dialects)) this.dialect = Markdown.dialects[dialect]; else throw new Error("Unknown Markdown dialect '" + String(dialect) + "'");
      break;
  }
  this.em_state = [];
  this.strong_state = [];
  this.debug_indent = "";
};
Markdown.dialects = {};
export default Markdown;
