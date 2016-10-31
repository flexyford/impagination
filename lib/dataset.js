'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$assign = require('babel-runtime/core-js/object/assign')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _lazyStore = require('./lazy-store');

var _lazyStore2 = _interopRequireDefault(_lazyStore);

var _record = require('./record');

var _record2 = _interopRequireDefault(_record);

var _findIndex = require('./find-index');

var _findIndex2 = _interopRequireDefault(_findIndex);

var Dataset = (function () {
  function Dataset() {
    var attrs = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Dataset);

    this.store = new _lazyStore2['default']({
      pageSize: Number(attrs.pageSize),
      loadHorizon: Number(attrs.loadHorizon || attrs.pageSize),
      unloadHorizon: Number(attrs.unloadHorizon) || Infinity,
      filter: attrs.filter,
      stats: attrs.stats || { totalPages: undefined }
    });

    this.fetch = attrs.fetch;

    this.observe = attrs.observe || function () {};;
    this.unfetch = attrs.unfetch || function () {};

    if (!this.fetch) {
      throw new Error('created Dataset without fetch()');
    }
  }

  // Public Functions

  _createClass(Dataset, [{
    key: 'setReadOffset',
    value: function setReadOffset(offset) {
      var force = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

      var readOffset = Math.max(Number(offset), 0);
      if (isNaN(readOffset)) {
        throw new Error(offset + ' is not a Number');
      }
      if (readOffset !== this.store.readOffset || force) {
        this.store = this.store.setReadOffset(readOffset);

        this._fetchPages(this.store.unrequested);
        this._unfetchPages(this.store.unfetchable);

        this.observe(this.store);
      }
    }
  }, {
    key: 'refilter',
    value: function refilter(filterCallback) {
      filterCallback = filterCallback || this.store.filter;
      this.store = this.store.refilter(filterCallback);
      this.observe(this.store);
    }

    // Unload all pages, 'unfetch' every unloaded page
  }, {
    key: 'reload',
    value: function reload(readOffset) {
      // Unfetch unfetchable and resolved pages
      this._unfetchPages(this.store.unfetchable.concat(this.store.resolved));

      this.store = new _lazyStore2['default']({
        pageSize: this.store.pageSize,
        loadHorizon: this.store.loadHorizon,
        unloadHorizon: this.store.unloadHorizon,
        stats: this.store.stats
      });

      if (readOffset) {
        this.setReadOffset(readOffset, true);
      } else {
        this.observe(this.store);
      }
    }

    // Destroy all pages, does not `unfetch` any destroyed page
  }, {
    key: 'reset',
    value: function reset(readOffset) {
      this.store = new _lazyStore2['default']({
        pageSize: this.store.pageSize,
        loadHorizon: this.store.loadHorizon,
        unloadHorizon: this.store.unloadHorizon,
        stats: this.store.stats
      });

      if (readOffset) {
        this.setReadOffset(readOffset, true);
      } else {
        this.observe(this.store);
      }
    }
  }, {
    key: 'post',
    value: function post(data, index) {
      index = index || this.store.readOffset;
      try {
        this.store = this.store.splice(index, 0, data);
      } catch (err) {
        console.error('Error: Impagination did not POST ' + data + '. Could not find resolved page for record at index ' + index);
      }
      this.observe(this.store);
    }
  }, {
    key: 'put',
    value: function put(data, index) {
      index = index || this.store.readOffset;
      try {
        var record = this.store.getRecord(index);
        var item = _Object$assign({}, record.page.records[record.index], data);
        this.store = this.store.splice(index, 1, item);
      } catch (err) {
        console.error('Error: Impagination did not PUT ' + data + '. Could not find resolved page for record at index ' + index);
      }
      this.observe(this.store);
    }
  }, {
    key: 'delete',
    value: function _delete(index) {
      index = index || this.store.readOffset;
      try {
        this.store = this.store.splice(index, 1);
      } catch (err) {
        console.error('Error: Impagination did not DELETE record at ' + index + '. Could not find resolved page for record at index ' + index);
      }
      this.observe(this.store);
    }
  }, {
    key: '_fetchPages',
    value: function _fetchPages(fetchable) {
      var _this = this;

      this.store = this.store.fetch(fetchable);

      var stats = this.store.stats;
      fetchable.forEach(function (page) {
        return _this.fetch.call(_this, page.offset, _this.store.pageSize, stats).then(function () {
          var records = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

          return _this.observe(_this.store = _this.store.resolve(records, page.offset, stats));
        })['catch'](function () {
          var error = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

          return _this.observe(_this.store = _this.store.reject(error, page, stats));
        });
      });
    }
  }, {
    key: '_unfetchPages',
    value: function _unfetchPages(unfetchable) {
      var _this2 = this;

      this.store = this.store.unfetch(unfetchable);

      unfetchable.forEach(function (page) {
        _this2.unfetch.call(_this2, page.records, page.offset);
      });
    }
  }]);

  return Dataset;
})();

exports['default'] = Dataset;
;
module.exports = exports['default'];