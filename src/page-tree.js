import { AVLTree } from 'binary-search-tree';
import { BinarySearchTree } from 'binary-search-tree';

// Unrequested Pages do not show up in Pages Interface
export default class PageTree extends AVLTree {
  constructor() {
    super({
      compareKeys: function(a, b) {
        let key;
        if (a.hasOwnProperty('record') && b.hasOwnProperty('record')) {
          key = 'record';
          if (a[key] >= b[key] && a[key] < b[key] + b.size) {return 0;}
        } else {
          key = 'page';
          a = a.hasOwnProperty('page') ? a : { page: a };
          b = b.hasOwnProperty('page') ? b : { page: b };
        }

        if (a[key] === b[key]) { return 0; }
        if (a[key] <   b[key]) { return -1; }
        if (a[key] >   b[key]) { return 1; }

        let err = new Error("Couldn't compare elements");
        throw Object.assign(err, {a, b});
      },
      unique: true
    });
  }

  updateKeys(forEachCallback) {
    this.executeOnEveryNode((node) => {

      let { data, key, left } = node;

      if(!data.length) { return; }

      let recordIndex, page = data[0];

      if (!this.prevNode) {
        recordIndex = page.size * page.offset;
      } else {
        let prevNode = this.prevNode;
        let prevPage = prevNode.data[0];
        recordIndex = prevNode.key.record + prevPage.records.length;

        let missingPages = page.offset - prevPage.offset - 1;
        if (missingPages > 0) {
          recordIndex += page.size * missingPages;
        }
      }

      Object.assign(node.key, {record: recordIndex});
      this.prevNode = node;
    });
    delete this.prevNode;
  }
};

PageTree.prototype.searchPage = function(offset) {
  return AVLTree.prototype.search.call(this, { page: offset });
};

PageTree.prototype.searchPageByRecord = function(index) {
  return AVLTree.prototype.search.call(this, {
    swap_a_b: undefined,
    record: index
  });
};

PageTree.prototype.searchRecord = function(index) {
  let { key, data } = this.searchPageByRecord(index);

  // Record does not exist
  if (!data) { return null; }

  return data.records[index - key.record];
};

BinarySearchTree.prototype.search = function (key) {
  const empty = {key, data: undefined};
  if (!this.hasOwnProperty('key')) { return empty; }

  try {
    if (this.compareKeys(key, this.key) === 0) {
      let { data, key } = this;
      return { data: data[0], key };
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
  } catch(err) {
    return empty;
  }
};

PageTree.prototype.insert = (function() {
  var insert = AVLTree.prototype.insert;
  return function(key, page) {
    return insert.call(this, { page: key, size: page.records.length }, page);
  };
})();
