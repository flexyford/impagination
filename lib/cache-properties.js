'use strict';

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _Object$getOwnPropertyDescriptors = require('babel-runtime/core-js/object/get-own-property-descriptors')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = cached;
var defineProperty = _Object$defineProperty;
var getOwnPropertyDescriptors = _Object$getOwnPropertyDescriptors;

function cached(constructor) {
  var prototype = constructor.prototype;

  eachProperty(getOwnPropertyDescriptors(prototype), function (key, descriptor) {
    if (descriptor.get) {
      defineProperty(prototype, key, {
        get: function get() {
          var value = descriptor.get.call(this);
          var writeable = descriptor.writeable;
          var enumerable = descriptor.enumerable;

          defineProperty(this, key, { value: value, writeable: writeable, enumerable: enumerable });
          return value;
        }
      });
    }
  });
  return constructor;
}

function eachProperty(object, fn) {
  if (typeof object === 'object') {
    _Object$keys(object).forEach(function (name) {
      fn(name, object[name]);
    });
  }
}
module.exports = exports['default'];