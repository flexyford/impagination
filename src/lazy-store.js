import Page from './page';
import cached from './cache-properties';
var AVLTree = require('binary-search-tree').AVLTree;

// Unrequested Pages do not show up in Pages Interface
export default class Store {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      _pages: new AVLTree({unique: true}),
      _unfetchablePages: [],
      pageSize: 0,
      loadHorizon: previous.pageSize || 0,
      unloadHorizon: Infinity,
      readOffset: undefined,
      stats: { totalPages: undefined },
      records: {}
    }, previous, attrs);

    if (!this.pageSize) {
      throw new Error('created Pages without pageSize');
    }

    if (this.unloadHorizon < this.loadHorizon) {
      throw new Error('created Pages with unloadHorizon less than loadHorizon');
    }

    this._updateHorizons();
  }

  get pages() {
    return this._pages.betweenBounds({ $gte: 0 });
  }

  // fetchable
  get unrequested() {
    return this.pages.filter((page) => {
      return !page.isRequested;
    });
  }

  // fetchable
  get unfetchable() {
    return this._unfetchablePages;
  }

  // fetching
  get pending() {
    return this.pages.filter((page) => {
      return page.isPending;
    });
  }

  // fetched
  get resolved() {
    return this.pages.filter((page) => {
      return page.isResolved;
    });
  }

  // fetched
  get rejected() {
    return this.pages.filter((page) => {
      return page.isRejected;
    });
  }

  get requested() {
    return this.pages.filter((page) => {
      return page.isRequested;
    });
  }

  setReadOffset(readOffset) {
    return new Store(this, { readOffset });
  }

  fetch(fetchable = []) {
    let _pages = new AVLTree({ unique: true });

    this.pages.forEach((p) => {
      const page = fetchable.includes(p) ? p.request() : p;
      _pages.insert(page.offset, page);
    });

    return new Store(this, { _pages });
  }

  unfetch(unfetchable = []) {
    return new Store(this, {
      _unfetchablePages: this._unfetchablePages.filter(p => !unfetchable.includes(p))
    });
  }

  resolve(records, offset, stats) {
    let _pages = new AVLTree({ unique: true });

    this.pages.forEach((p) => {
      _pages.insert(p.offset, (p.offset === offset) ? p.resolve(records) : p);
    });

    return new Store(this, {
      _pages,
      stats: stats || this.stats
    });
  }

  reject(error, { offset }, stats) {
    let _pages = new AVLTree({ unique: true });

    this.pages.forEach((p) => {
      _pages.insert(p.offset, (p.offset === offset) ? p.reject(error) : p);
    });

    return new Store(this, {
      _pages,
      stats: stats || this.stats
    });
  }

  slice(begin, end) {
    begin = (typeof begin == 'number') ? begin : 0;
    end = (typeof end == 'number') ? end : this.length;

    // Handle negative value for "begin"
    let start = (begin >= 0) ? begin : Math.max(0, this.length + begin);

    // Handle negative value for "end"
    let upTo = (end >= 0) ? Math.min(end, this.length) : this.length + end;

    // Actual expected size of the slice
    let size = upTo - start;

    let records = [];
    if (size > 0) {
      records = new Array(size);
      for (let i = 0; i < size; i++) {
        records[i] = this._getRecord(start + i);
      }
    }

    return records;
  }

  get length() {
    let lastPageOffset = this._pages.tree.getMaxKeyDescendant().key;
    let virtualTotalPages = lastPageOffset + 1 || 0;
    let total = Math.max(virtualTotalPages, this.stats.totalPages || 0);

    return this.resolved.reduce((length, page) => {
      return length - (this.pageSize - page.records.length);
    }, (total - this.rejected.length) * this.pageSize);
  }

  // Private API
  _findPage(offset) {
    return this._pages.search(offset)[0];
  }

  _getPage(offset) {
    return this._findPage(offset) || new Page(offset, this.pageSize);
  }

  _getRecord(index) {
    if(index >= this.length) return null;

    const pageIndex = Math.floor(index / this.pageSize);
    const firstResolvedPage = this.resolved && this.resolved[0];

    const recordIsUnresolved = !firstResolvedPage || pageIndex < firstResolvedPage.offset;

    let currentPage, recordIndex;

    if (recordIsUnresolved) {
      currentPage = this._getPage(pageIndex);
      recordIndex = index % this.pageSize;
    } else {
      currentPage = firstResolvedPage;
      recordIndex = index - (currentPage.offset * this.pageSize);

      // TODO: This while loops assumes filtering exists
      while(recordIndex >= currentPage.records.length) {
        recordIndex -= currentPage.records.length;
        currentPage = this._getPage(currentPage.offset + 1);
      }
    }

    return currentPage.records[recordIndex];
  }

  _updateHorizons() {
    this._unloadHorizons();
    this._requestHorizons();
  }

  _unloadHorizons() {
    let maxPageOffset = this._pages.tree.getMaxKeyDescendant().key || 0;

    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    let minUnloadPage = Math.floor((this.readOffset - this.unloadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((this.readOffset  + this.unloadHorizon) / this.pageSize);
    let minUnloadHorizon = Math.max(minUnloadPage, 0);
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, maxPageOffset + 1);

    let unfetchable = [];
    // Unload Pages outside the upper `unloadHorizons`
    for (let i = maxPageOffset; i >= maxUnloadHorizon; i -= 1) {
      let page = this._findPage(i);
      if (page) {
        this._pages.delete(i);
        if (page.isResolved) {
          unfetchable.push(page);
        }
      }
    }

    // Unload Unrequested Pages outside the upper `loadHorizons`
    for (let i = maxUnloadHorizon - 1; i >= maxLoadHorizon; i -= 1) {
      let page = this._findPage(i);
      if (page && !page.isSettled) {
        this._pages.delete(i);
      }
    }

    // Unload Unrequested Pages outside the lower `loadHorizons`
    for (let i = minLoadHorizon - 1; i >= minUnloadHorizon; i -= 1) {
      let page = this._findPage(i);
      if (page && !page.isSettled) {
        this._pages.delete(i);
      }
    }

    // Unload Pages outside the lower `unloadHorizons`
    for (let i = minUnloadHorizon - 1; i >= 0; i -= 1) {
      let page = this._findPage(i);
      if (page) {
        this._pages.delete(i);
        if (page.isResolved) {
          unfetchable.push(page);
        }
      }
    }

    this._unfetchablePages = this._unfetchablePages.concat(unfetchable);
  }

  _requestHorizons() {
    const node = this._pages.tree.getMinKeyDescendant();
    const baseOffset = node.key || 0;

    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0) - baseOffset;
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    // Request Pages within the `loadHorizons`
    for (let i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
      if (!this._findPage(i)) {
        this._pages.insert(i, new Page(i, this.pageSize));
      }
    }
  }
};

cached(Store);
