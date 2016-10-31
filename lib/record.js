'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _page = require('./page');

var _page2 = _interopRequireDefault(_page);

var Record = (function () {
  function Record() {
    var page = arguments.length <= 0 || arguments[0] === undefined ? new _page2['default']() : arguments[0];
    var content = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];
    var index = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

    _classCallCheck(this, Record);

    this.page = page;
    this.content = content;
    this.index = index;
    if (page.error) {
      this.error = page.error;
    }
  }

  _createClass(Record, [{
    key: 'isRequested',
    get: function get() {
      return this.page.isRequested;
    }
  }, {
    key: 'isSettled',
    get: function get() {
      return this.page.isSettled;
    }
  }, {
    key: 'isPending',
    get: function get() {
      return this.page.isPending;
    }
  }, {
    key: 'isResolved',
    get: function get() {
      return this.page.isResolved;
    }
  }, {
    key: 'isRejected',
    get: function get() {
      return this.page.isRejected;
    }
  }]);

  return Record;
})();

exports['default'] = Record;
module.exports = exports['default'];