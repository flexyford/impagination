// This file cannot be written with ECMAScript 2015 because it has to load
// the Babel require hook to enable ECMAScript 2015 features!
require("babel/register")({
  optional: "runtime"
});

require('binary-search-tree');

// The tests, however, can and should be written with ECMAScript 2015.

require("./dataset-test.js");
require("./state-test.js");
require("./page-tree.js");
