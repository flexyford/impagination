'use strict';

var _get = require('babel-runtime/helpers/get')['default'];

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$assign = require('babel-runtime/core-js/object/assign')['default'];

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _binarySearchTree = require('binary-search-tree');

// Unrequested Pages do not show up in Pages Interface

var PageTree = (function (_AVLTree) {
  _inherits(PageTree, _AVLTree);

  function PageTree() {
    _classCallCheck(this, PageTree);

    _get(Object.getPrototypeOf(PageTree.prototype), 'constructor', this).call(this, {
      compareKeys: function compareKeys(a, b) {
        var key = undefined;
        if (a.hasOwnProperty('record') && b.hasOwnProperty('record')) {
          key = 'record';
          if (a[key] >= b[key] && a[key] < b[key] + b.size) {
            return 0;
          }
        } else {
          key = 'page';
          a = a.hasOwnProperty('page') ? a : { page: a };
          b = b.hasOwnProperty('page') ? b : { page: b };
        }

        if (a[key] === b[key]) {
          return 0;
        }
        if (a[key] < b[key]) {
          return -1;
        }
        if (a[key] > b[key]) {
          return 1;
        }

        var err = new Error("Couldn't compare elements");
        throw _Object$assign(err, { a: a, b: b });
      },
      unique: true
    });
  }

  _createClass(PageTree, [{
    key: 'updateKeys',
    value: function updateKeys(forEachCallback) {
      var _this = this;

      this.executeOnEveryNode(function (node) {
        var data = node.data;
        var key = node.key;
        var left = node.left;

        if (!data.length) {
          return;
        }

        var recordIndex = undefined,
            page = data[0];

        if (!_this.prevNode) {
          recordIndex = page.size * page.offset;
        } else {
          var prevNode = _this.prevNode;
          var prevPage = prevNode.data[0];
          recordIndex = prevNode.key.record + prevPage.records.length;

          var missingPages = page.offset - prevPage.offset - 1;
          if (missingPages > 0) {
            recordIndex += page.size * missingPages;
          }
        }

        _Object$assign(node.key, { record: recordIndex });
        _this.prevNode = node;
      });
      delete this.prevNode;
    }
  }]);

  return PageTree;
})(_binarySearchTree.AVLTree);

exports['default'] = PageTree;
;

PageTree.prototype.searchPage = function (offset) {
  return _binarySearchTree.AVLTree.prototype.search.call(this, { page: offset });
};

PageTree.prototype.searchPageByRecord = function (index) {
  return _binarySearchTree.AVLTree.prototype.search.call(this, {
    swap_a_b: undefined,
    record: index
  });
};

PageTree.prototype.searchRecord = function (index) {
  var _searchPageByRecord = this.searchPageByRecord(index);

  var key = _searchPageByRecord.key;
  var data = _searchPageByRecord.data;

  // Record does not exist
  if (!data) {
    return null;
  }

  return data.records[index - key.record];
};

_binarySearchTree.BinarySearchTree.prototype.search = function (key) {
  var empty = { key: key, data: undefined };
  if (!this.hasOwnProperty('key')) {
    return empty;
  }

  try {
    if (this.compareKeys(key, this.key) === 0) {
      var data = this.data;
      var _key = this.key;

      return { data: data[0], key: _key };
    }

    if (this.compareKeys(key, this.key) < 0) {
      if (this.left) {
        return this.left.search(key);
      } else {
        return empty;
      }
    } else {
      if (this.right) {
        return this.right.search(key);
      } else {
        return empty;
      }
    }
  } catch (err) {
    return empty;
  }
};

PageTree.prototype.insert = (function () {
  var insert = _binarySearchTree.AVLTree.prototype.insert;
  return function (key, page) {
    return insert.call(this, { page: key, size: page.records.length }, page);
  };
})();
module.exports = exports['default'];