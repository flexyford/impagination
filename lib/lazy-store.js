'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _defineProperty = require('babel-runtime/helpers/define-property')['default'];

var _Object$assign2 = require('babel-runtime/core-js/object/assign')['default'];

var _Symbol$iterator = require('babel-runtime/core-js/symbol/iterator')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _page = require('./page');

var _page2 = _interopRequireDefault(_page);

var _pageTree = require('./page-tree');

var _pageTree2 = _interopRequireDefault(_pageTree);

var _record = require('./record');

var _record2 = _interopRequireDefault(_record);

var _cacheProperties = require('./cache-properties');

var _cacheProperties2 = _interopRequireDefault(_cacheProperties);

// Unrequested Pages do not show up in Pages Interface

var Store = (function () {
  function Store() {
    var previous = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
    var attrs = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    _classCallCheck(this, Store);

    _Object$assign2(this, _defineProperty({
      _pages: new _pageTree2['default'](),
      _unfetchablePages: [],
      pageSize: 0,
      loadHorizon: previous.pageSize || 0,
      unloadHorizon: Infinity,
      readOffset: undefined,
      stats: { totalPages: undefined },
      filter: function filter() {
        return true;
      },
      records: {}
    }, _Symbol$iterator, {
      value: function value() {
        var _this2 = this;

        var index = 0;
        return {
          next: function next() {
            var value = _this2.getRecord(index);
            var done = index++ >= _this2.length;
            return { value: value, done: done };
          }
        };
      }
    }), previous, attrs);

    if (!this.pageSize) {
      throw new Error('created Pages without pageSize');
    }

    if (this.unloadHorizon < this.loadHorizon) {
      throw new Error('created Pages with unloadHorizon less than loadHorizon');
    }

    this._updateHorizons();
  }

  _createClass(Store, [{
    key: 'setReadOffset',
    value: function setReadOffset(readOffset) {
      return new Store(this, { readOffset: readOffset });
    }
  }, {
    key: 'fetch',
    value: function fetch() {
      var fetchable = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

      if (!fetchable.length) {
        return this;
      }

      var _pages = new _pageTree2['default']();

      this.pages.forEach(function (p) {
        var page = fetchable.includes(p) ? p.request() : p;
        _pages.insert(page.offset, page);
      });

      this._pages.update();

      return new Store(this, { _pages: _pages });
    }
  }, {
    key: 'unfetch',
    value: function unfetch() {
      var unfetchable = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

      if (!unfetchable.length) {
        return this;
      }
      return new Store(this, {
        _unfetchablePages: this._unfetchablePages.filter(function (p) {
          return !unfetchable.includes(p);
        })
      });
    }
  }, {
    key: 'resolve',
    value: function resolve(records, offset, stats) {
      var _this3 = this;

      var _pages = new _pageTree2['default']();

      this.pages.forEach(function (p) {
        var page = p.offset === offset ? _this3._resolvePage(p, records) : p;
        _pages.insert(p.offset, page);
      });

      this._pages.update();

      return new Store(this, {
        _pages: _pages,
        stats: stats || this.stats
      });
    }
  }, {
    key: 'reject',
    value: function reject(error, _ref, stats) {
      var offset = _ref.offset;

      var _pages = new _pageTree2['default']();

      this.pages.forEach(function (p) {
        var page = p.isPending && p.offset === offset ? p.reject(error) : p;
        _pages.insert(p.offset, page);
      });

      this._pages.update();

      return new Store(this, {
        _pages: _pages,
        stats: stats || this.stats
      });
    }
  }, {
    key: 'refilter',
    value: function refilter(filter) {
      var _this = filter ? new Store(this, { filter: filter }) : this;

      var _pages = new _pageTree2['default']();

      this.pages.forEach(function (p) {
        var page = _this._resolvePage(p);
        _pages.insert(p.offset, page);
      });

      _this._pages.update();

      return new Store(_this, { _pages: _pages });
    }

    // Mutator Methods

    // splice:
    // Can only mutate records on page containing record at index `start`
    // Returns new store with mutated records
  }, {
    key: 'splice',
    value: function splice(start, deleteCount) {
      try {
        var _record$page$data;

        var record = this.getRecord(start);

        for (var _len = arguments.length, items = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
          items[_key - 2] = arguments[_key];
        }

        (_record$page$data = record.page.data).splice.apply(_record$page$data, [record.index, deleteCount].concat(items));
      } catch (err) {
        throw Error('Impagination could not find resolved page for record at index ' + index);
      }
      return this.refilter();
    }

    // Accessor Methods
  }, {
    key: 'concat',
    value: function concat() {
      return Array.prototype.concat.apply(this, arguments);
    }
  }, {
    key: 'includes',
    value: function includes() {
      return Array.prototype.includes.apply(this, arguments);
    }
  }, {
    key: 'join',
    value: function join() {
      return Array.prototype.join.apply(this, arguments);
    }
  }, {
    key: 'slice',
    value: function slice() {
      return Array.prototype.slice.apply(this, arguments);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return Array.prototype.toString.apply(this, arguments);
    }
  }, {
    key: 'toLocaleString',
    value: function toLocaleString() {
      return Array.prototype.toLocaleString.apply(this, arguments);
    }
  }, {
    key: 'indexOf',
    value: function indexOf() {
      return Array.prototype.indexOf.apply(this, arguments);
    }
  }, {
    key: 'lastIndexOf',
    value: function lastIndexOf() {
      return Array.prototype.lastIndexOf.apply(this, arguments);
    }

    // Iteration Methods
  }, {
    key: 'forEach',
    value: function forEach() {
      return Array.prototype.forEach.apply(this, arguments);
    }
  }, {
    key: 'every',
    value: function every() {
      return Array.prototype.every.apply(this, arguments);
    }
  }, {
    key: 'some',
    value: function some() {
      return Array.prototype.some.apply(this, arguments);
    }
  }, {
    key: 'filter',
    value: function filter() {
      return Array.prototype.filter.apply(this, arguments);
    }
  }, {
    key: 'find',
    value: function find() {
      return Array.prototype.find.apply(this, arguments);
    }
  }, {
    key: 'findIndex',
    value: function findIndex() {
      return Array.prototype.findIndex.apply(this, arguments);
    }
  }, {
    key: 'keys',
    value: function keys() {
      return Array.prototype.keys.apply(this, arguments);
    }
  }, {
    key: 'map',
    value: function map() {
      return Array.prototype.map.apply(this, arguments);
    }
  }, {
    key: 'reduce',
    value: function reduce() {
      return Array.prototype.reduce.apply(this, arguments);
    }
  }, {
    key: 'reduceRight',
    value: function reduceRight() {
      return Array.prototype.reduceRight.apply(this, arguments);
    }
  }, {
    key: 'values',
    value: function values() {
      return Array.prototype.values.apply(this, arguments);
    }
  }, {
    key: '_findPage',

    // Private API
    value: function _findPage(offset) {
      return this._pages.searchPage(offset).data;
    }
  }, {
    key: 'getPage',
    value: function getPage(offset) {
      return this._findPage(offset) || new _page2['default'](offset, this.pageSize);
    }
  }, {
    key: '_findRecord',
    value: function _findRecord(index) {
      return this._pages.searchRecord(index);
    }
  }, {
    key: 'getRecord',
    value: function getRecord(index) {
      return this._findRecord(index) || new _record2['default']();
    }
  }, {
    key: '_resolvePage',
    value: function _resolvePage(page, records) {
      if (page.isPending) {
        return page.resolve(records, this.filter);
      } else if (page.isResolved) {
        return page.resolve(page.data, this.filter);
      }
      return page;
    }
  }, {
    key: '_updateHorizons',
    value: function _updateHorizons() {
      var _this4 = this;

      this._unloadHorizons();
      this._requestHorizons();

      this._pages.update();

      var node = this._pages.tree.getMinKeyDescendant();
      var offset = node.key && node.key.page || 0;
      var minPage = this.getPage(offset);

      var index = minPage.offset * this.pageSize;

      // Add index keys so we can say access values by array[index]
      this.pages.forEach(function (p) {
        var _loop = function (i) {
          var offset = index++;
          _Object$defineProperty(_this4, offset, { get: function get() {
              return this.getRecord(offset);
            } });
        };

        for (var i = 0; i < p.records.length; i++) {
          _loop(i);
        }
      });
    }
  }, {
    key: '_unloadHorizons',
    value: function _unloadHorizons() {
      var maxPageOffset = this._pages.tree.getMaxKeyDescendant().key || 0;

      var _getLoadHorizons2 = this._getLoadHorizons();

      var minLoadHorizon = _getLoadHorizons2.minLoadHorizon;
      var maxLoadHorizon = _getLoadHorizons2.maxLoadHorizon;

      var _getUnloadHorizons2 = this._getUnloadHorizons();

      var minUnloadHorizon = _getUnloadHorizons2.minUnloadHorizon;
      var maxUnloadHorizon = _getUnloadHorizons2.maxUnloadHorizon;

      var unfetchable = [];
      // Unload Pages outside the upper `unloadHorizons`
      for (var i = maxPageOffset; i >= maxUnloadHorizon; i -= 1) {
        var page = this._findPage(i);
        if (page) {
          this._pages['delete'](i);
          if (page.isResolved) {
            unfetchable.push(page);
          }
        }
      }

      // Unload Unrequested Pages outside the upper `loadHorizons`
      for (var i = maxUnloadHorizon - 1; i >= maxLoadHorizon; i -= 1) {
        var page = this._findPage(i);
        if (page && !page.isSettled) {
          this._pages['delete'](i);
        }
      }

      // Unload Unrequested Pages outside the lower `loadHorizons`
      for (var i = minLoadHorizon - 1; i >= minUnloadHorizon; i -= 1) {
        var page = this._findPage(i);
        if (page && !page.isSettled) {
          this._pages['delete'](i);
        }
      }

      // Unload Pages outside the lower `unloadHorizons`
      for (var i = minUnloadHorizon - 1; i >= 0; i -= 1) {
        var page = this._findPage(i);
        if (page) {
          this._pages['delete'](i);
          if (page.isResolved) {
            unfetchable.push(page);
          }
        }
      }

      this._unfetchablePages = this._unfetchablePages.concat(unfetchable);
    }
  }, {
    key: '_requestHorizons',
    value: function _requestHorizons() {
      var _getLoadHorizons3 = this._getLoadHorizons();

      var minLoadHorizon = _getLoadHorizons3.minLoadHorizon;
      var maxLoadHorizon = _getLoadHorizons3.maxLoadHorizon;

      // Request Pages within the `loadHorizons`
      for (var i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
        if (!this._findPage(i)) {
          this._pages.insert(i, new _page2['default'](i, this.pageSize));
        }
      }
    }
  }, {
    key: '_getLoadHorizons',
    value: function _getLoadHorizons() {
      var record = this.getRecord(this.readOffset);
      var readOffset = this.readOffset;

      if (record.isResolved) {
        readOffset = record.page.offset * this.pageSize + record.index;
      }

      var min = readOffset - this.loadHorizon;
      var max = readOffset + this.loadHorizon;

      var minLoadPage = Math.floor(min / this.pageSize);
      var maxLoadPage = Math.ceil(max / this.pageSize);

      var minLoadHorizon = Math.max(minLoadPage, 0);
      var maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

      return { minLoadHorizon: minLoadHorizon, maxLoadHorizon: maxLoadHorizon };
    }
  }, {
    key: '_getUnloadHorizons',
    value: function _getUnloadHorizons() {
      var record = this.getRecord(this.readOffset);
      var readOffset = this.readOffset;
      if (record.isResolved) {
        readOffset = record.page.offset * this.pageSize + record.index;
      }

      var min = readOffset - this.unloadHorizon;
      var max = readOffset + this.unloadHorizon;

      var minUnloadPage = Math.floor(min / this.pageSize);
      var maxUnloadPage = Math.ceil(max / this.pageSize);

      var maxPageOffset = this._pages.tree.getMaxKeyDescendant().key || 0;

      var minUnloadHorizon = Math.max(minUnloadPage, 0);
      var maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, maxPageOffset + 1);

      return { minUnloadHorizon: minUnloadHorizon, maxUnloadHorizon: maxUnloadHorizon };
    }
  }, {
    key: 'pages',
    get: function get() {
      return this._pages.betweenBounds({ $gte: 0 });
    }

    // fetchable
  }, {
    key: 'unrequested',
    get: function get() {
      return this.pages.filter(function (page) {
        return !page.isRequested;
      });
    }

    // fetchable
  }, {
    key: 'unfetchable',
    get: function get() {
      return this._unfetchablePages;
    }

    // fetching
  }, {
    key: 'pending',
    get: function get() {
      return this.pages.filter(function (page) {
        return page.isPending;
      });
    }

    // fetched
  }, {
    key: 'resolved',
    get: function get() {
      return this.pages.filter(function (page) {
        return page.isResolved;
      });
    }

    // fetched
  }, {
    key: 'rejected',
    get: function get() {
      return this.pages.filter(function (page) {
        return page.isRejected;
      });
    }

    // requested
  }, {
    key: 'requested',
    get: function get() {
      return this.pages.filter(function (page) {
        return page.isRequested;
      });
    }
  }, {
    key: 'length',
    get: function get() {
      var _this5 = this;

      var node = this._pages.tree.getMaxKeyDescendant();
      var offset = node.key && node.key.page;
      var virtualTotalPages = offset + 1 || 0;

      var total = Math.max(virtualTotalPages, this.stats.totalPages || 0);

      // Resolved record could be filtered
      return this.resolved.reduce(function (length, page) {
        return length - (_this5.pageSize - page.records.length);
      }, (total - this.rejected.length) * this.pageSize);
    }
  }]);

  return Store;
})();

exports['default'] = Store;
;

(0, _cacheProperties2['default'])(Store);
module.exports = exports['default'];