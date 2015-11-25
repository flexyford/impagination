'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$freeze = require('babel-runtime/core-js/object/freeze')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _page = require('./page');

var _page2 = _interopRequireDefault(_page);

var _record = require('./record');

var _record2 = _interopRequireDefault(_record);

var State = (function () {
  function State() {
    _classCallCheck(this, State);

    this.isPending = false;
    this.isRejected = false;
    this.isResolved = false;
    this.pages = [];
    this.stats = {
      totalPages: undefined
    };
    this.length = 0;
  }

  _createClass(State, [{
    key: 'update',
    value: function update(change) {
      var next = new State();
      next.isPending = this.isPending;
      next.isResolved = this.isResolved;
      next.isRejected = this.isRejected;
      next.length = this.length;
      next.pageSize = this.pageSize;
      next.loadHorizon = this.loadHorizon;
      next.unloadHorizon = this.unloadHorizon;
      next.readOffset = this.readOffset;
      next.pages = this.pages.slice();
      next.stats.totalPages = this.stats.totalPages;
      change.call(this, next);
      next.pages = _Object$freeze(next.pages);
      return next;
    }
  }, {
    key: 'get',
    value: function get(index) {
      var pageOffset = Math.floor(index / this.pageSize);
      var recordOffset = index % this.pageSize;
      var page = this.pages[pageOffset];
      if (page) {
        return page.records[recordOffset];
      } else {
        return null;
      }
    }
  }, {
    key: 'isSettled',
    get: function get() {
      return !this.isPending && (this.isRejected || this.isResolved);
    }
  }]);

  return State;
})();

var Dataset = (function () {
  function Dataset() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Dataset);

    if (!options.pageSize) {
      throw new Error('created Dataset without pageSize');
    }
    if (!options.fetch) {
      throw new Error('created Dataset without fetch()');
    }

    this._pageSize = options.pageSize;
    this._fetch = options.fetch;
    this._unfetch = options.unfetch || function () {};
    this._observe = options.observe || function () {};
    this.state = new State();
    this.state.pageSize = this._pageSize;
    this.state.loadHorizon = options.loadHorizon || this._pageSize;
    this.state.unloadHorizon = options.unloadHorizon || Infinity;

    if (this.state.unloadHorizon < this.state.loadHorizon) {
      throw new Error('created Dataset with unloadHorizon less than loadHorizon');
    }
  }

  _createClass(Dataset, [{
    key: 'setReadOffset',
    value: function setReadOffset(readOffset) {
      var _this = this;

      if (this.state.readOffset === readOffset) {
        return;
      }
      readOffset = readOffset >= 0 ? readOffset : 0;
      var state = this.state.update(function (next) {
        next.readOffset = readOffset;
        var pages = next.pages;

        var minLoadPage = Math.floor((readOffset - next.loadHorizon) / next.pageSize);
        var maxLoadPage = Math.ceil((readOffset + next.loadHorizon) / next.pageSize);
        var minUnloadPage = Math.floor((readOffset - next.unloadHorizon) / next.pageSize);
        var maxUnloadPage = Math.ceil((readOffset + next.unloadHorizon) / next.pageSize);

        var minLoadHorizon = Math.max(minLoadPage, 0);
        var maxLoadHorizon = Math.min(next.stats.totalPages || Infinity, maxLoadPage);
        var minUnloadHorizon = Math.max(minUnloadPage, 0);
        var maxUnloadHorizon = Math.min(next.stats.totalPages || Infinity, maxUnloadPage, pages.length);

        // Unload Pages outside the `unloadHorizons`
        for (i = 0; i < minUnloadHorizon; i += 1) {
          _this._unloadPage(pages, i);
        }
        for (i = maxUnloadHorizon; i < pages.length; i += 1) {
          _this._unloadPage(pages, i);
        }

        // Initialize Unfetched Pages between current Horizons
        var currentMinHorizon = Math.min(minUnloadHorizon, minLoadHorizon);
        var currentMaxHorizon = Math.max(maxUnloadHorizon, maxLoadHorizon);
        for (var i = currentMinHorizon; i < currentMaxHorizon; i += 1) {
          _this._touchPage(pages, i);
        }

        _this._adjustTotalRecords(next);

        // Request and Fetch Records within the `loadHorizons`
        for (i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
          var page = _this._touchPage(pages, i);

          if (!page.isRequested) {
            pages[i] = page.request();
            _this._fetchPage(pages[i]);
          }
        }

        if (readOffset >= next.length) {
          console.warn('Warning: Requested records at readOffset ' + readOffset + '. Maximum readOffset: ' + (next.length - 1));
        }
        _this._setStateStatus(next);
      });
      this._observe(this.state = state);
    }

    /* Unloads a page at the given index and returns the unloaded page */
  }, {
    key: '_unloadPage',
    value: function _unloadPage(pages, i) {
      var page = this._touchPage(pages, i);
      if (page.isRequested) {
        this._unfetch.call(this, page.data, page.offset);
        page = page.unload();
        pages.splice(i, 1, page);
      }
      return page;
    }

    /* Returns the page at the given index
     * If no page exists it generates and returns a new Page instance */
  }, {
    key: '_touchPage',
    value: function _touchPage(pages, i) {
      var page = pages[i];
      if (!page) {
        page = new _page2['default'](i, this._pageSize);
        pages.splice(i, 1, page);
      }
      return page;
    }
  }, {
    key: '_adjustTotalPages',
    value: function _adjustTotalPages(pages, stats) {
      if (stats.totalPages > pages.length) {
        // touch pages
        for (var i = pages.length; i < stats.totalPages; i += 1) {
          this._touchPage(pages, i);
        }
      } else if (stats.totalPages < pages.length) {
        // remove pages
        pages.splice(stats.totalPages, pages.length);
      }
    }
  }, {
    key: '_adjustTotalRecords',
    value: function _adjustTotalRecords(state) {
      state.length = state.pages.reduce(function (length, page) {
        return length + page.data.length;
      }, 0);
    }
  }, {
    key: '_setStateStatus',
    value: function _setStateStatus(state) {
      state.isPending = false;
      state.isRejected = false;
      state.isResolved = false;
      for (var i = 0; i < state.pages.length; i++) {
        var page = state.pages[i];
        state.isPending = state.isPending || page.isPending;
        state.isRejected = state.isRejected || page.isRejected;
        state.isResolved = !(state.isPending && state.isRejected) && page.isResolved;
      }
    }
  }, {
    key: '_fetchPage',
    value: function _fetchPage(page) {
      var _this2 = this;

      var offset = page.offset;
      var pageSize = this.state.pageSize;
      var stats = { totalPages: this.state.totalPages };
      return this._fetch.call(this, offset, pageSize, stats).then(function () {
        var records = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

        var state = _this2.state.update(function (next) {
          next.stats = stats;
          if (page !== next.pages[offset]) {
            return;
          }
          next.pages[offset] = page.resolve(records);
          _this2._adjustTotalPages(next.pages, stats);
          _this2._adjustTotalRecords(next);
          _this2._setStateStatus(next);
        });
        _this2._observe(_this2.state = state);
      })['catch'](function () {
        var error = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        var state = _this2.state.update(function (next) {
          next.stats = stats;
          if (page !== next.pages[offset]) {
            return;
          }
          next.pages[offset] = page.reject(error);
          _this2._adjustTotalPages(next.pages, stats);
          _this2._adjustTotalRecords(next);
          _this2._setStateStatus(next);
        });
        _this2._observe(_this2.state = state);
      });
    }
  }]);

  return Dataset;
})();

exports['default'] = Dataset;
module.exports = exports['default'];