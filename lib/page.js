'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _record = require('./record');

var _record2 = _interopRequireDefault(_record);

// Array.prototype.fill
function fill(array, value) {
  for (var i = 0; i < array.length; i++) {
    array[i] = value;
  }
  return array;
}

var UnrequestedPage = (function () {
  function UnrequestedPage() {
    var offset = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
    var size = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

    _classCallCheck(this, UnrequestedPage);

    this.offset = offset;
    this.size = size;
    this.data = fill(new Array(size), null);
  }

  _createClass(UnrequestedPage, [{
    key: 'request',
    value: function request() {
      return new PendingPage(this);
    }
  }, {
    key: 'unload',
    value: function unload() {
      return this;
    }
  }, {
    key: 'isRequested',
    get: function get() {
      return this.isPending || this.isResolved || this.isRejected;
    }
  }, {
    key: 'isPending',
    get: function get() {
      return false;
    }
  }, {
    key: 'isResolved',
    get: function get() {
      return false;
    }
  }, {
    key: 'isRejected',
    get: function get() {
      return false;
    }
  }, {
    key: 'isSettled',
    get: function get() {
      return !this.isPending && (this.isResolved || this.isRejected);
    }
  }, {
    key: 'records',
    get: function get() {
      var _this = this;

      if (!this._records) {
        var records = this.data.map(function (content, index) {
          return new _record2['default'](_this, content, index);
        });

        if (this.isResolved) {
          this._records = records.filter(function (record, index, arr) {
            return _this.filterCallback(record.content, index, arr);
          });
        } else {
          this._records = records;
        }
      }

      return this._records;
    }
  }]);

  return UnrequestedPage;
})();

var PendingPage = (function (_UnrequestedPage) {
  _inherits(PendingPage, _UnrequestedPage);

  function PendingPage(unrequested) {
    _classCallCheck(this, PendingPage);

    _get(Object.getPrototypeOf(PendingPage.prototype), 'constructor', this).call(this, unrequested.offset, unrequested.size);
  }

  _createClass(PendingPage, [{
    key: 'resolve',
    value: function resolve(records, filterCallback) {
      return new ResolvedPage(this, records, filterCallback);
    }
  }, {
    key: 'reject',
    value: function reject(error) {
      return new RejectedPage(this, error);
    }
  }, {
    key: 'request',
    value: function request() {
      return this;
    }
  }, {
    key: 'unload',
    value: function unload() {
      return new UnrequestedPage(this.offset, this.size);
    }
  }, {
    key: 'isPending',
    get: function get() {
      return true;
    }
  }]);

  return PendingPage;
})(UnrequestedPage);

var ResolvedPage = (function (_PendingPage) {
  _inherits(ResolvedPage, _PendingPage);

  function ResolvedPage(pending, data, filterCallback) {
    _classCallCheck(this, ResolvedPage);

    _get(Object.getPrototypeOf(ResolvedPage.prototype), 'constructor', this).call(this, pending);
    this.filterCallback = filterCallback || function () {
      return true;
    };
    this.data = data;
  }

  _createClass(ResolvedPage, [{
    key: 'isPending',
    get: function get() {
      return false;
    }
  }, {
    key: 'isResolved',
    get: function get() {
      return true;
    }
  }, {
    key: 'isSettled',
    get: function get() {
      return true;
    }
  }]);

  return ResolvedPage;
})(PendingPage);

var RejectedPage = (function (_PendingPage2) {
  _inherits(RejectedPage, _PendingPage2);

  function RejectedPage(pending, error) {
    _classCallCheck(this, RejectedPage);

    _get(Object.getPrototypeOf(RejectedPage.prototype), 'constructor', this).call(this, pending);
    this.error = error;
  }

  _createClass(RejectedPage, [{
    key: 'isPending',
    get: function get() {
      return false;
    }
  }, {
    key: 'isRejected',
    get: function get() {
      return true;
    }
  }, {
    key: 'isSettled',
    get: function get() {
      return true;
    }
  }]);

  return RejectedPage;
})(PendingPage);

exports['default'] = UnrequestedPage;
module.exports = exports['default'];