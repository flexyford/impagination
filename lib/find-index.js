'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = findIndex;

function findIndex(array, callback, thisArg) {
  var args = Array.prototype.slice.call(arguments, 1);
  return findIndexPolyfill.apply(array, args);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
function findIndexPolyfill(predicate) {
  if (this === null) {
    throw new TypeError('Array.prototype.findIndex called on null or undefined');
  }
  if (typeof predicate !== 'function') {
    throw new TypeError('predicate must be a function');
  }
  var list = Object(this);
  var length = list.length >>> 0;
  var thisArg = arguments[1];
  var value;

  for (var i = 0; i < length; i++) {
    value = list[i];
    if (predicate.call(thisArg, value, i, list)) {
      return i;
    }
  }
  return -1;
}
module.exports = exports['default'];