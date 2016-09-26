import Page from './page';
var AVLTree = require('binary-search-tree').AVLTree;

// Unrequested Pages do not show up in Pages Interface
export default class Store {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      _pages: new AVLTree({unique: true}),
      _unfetchablePages: [],
      length: 0,
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

    // TODO: Is this really a property we need?
    this.totalPages = this._calcPagesLength();

    this._updateHorizons();

    this.length = this._calcRecordsLength();
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
    if(!Array.isArray(fetchable)) { fetchable = [ fetchable ]; }

    let _pages = new AVLTree({ unique: true });

    this.pages.forEach((p) => {
      const page = fetchable.includes(p) ? p.request() : p;
      _pages.insert(page.offset, page);
    });

    return new Store(this, { _pages });
  }

  unfetch(unfetchable = []) {
    if(!Array.isArray(unfetchable)) { unfetchable = [ unfetchable ]; }
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

  // Private API
  _calcPagesLength() {
    let offset = this.readOffset;

    if (offset === null || offset === undefined) return 0;

    const baseOffset = this.pages[0] && this.pages[0].offset || 0;

    let maxLoadPage = Math.ceil((offset + this.loadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((offset + this.unloadHorizon) / this.pageSize);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this.totalPages);

    return Math.max(this.pages.length + baseOffset, maxLoadHorizon, this.stats.totalPages || 0);
  }

  _calcRecordsLength() {
    return this.resolved.reduce((length, page) => {
      return length - (this.pageSize - page.records.length);
    }, (this.totalPages - this.rejected.length) * this.pageSize);
  }

  _pageExists(offset) {
    return !!this._pages.search(offset).length;
  }

  _getPage(offset) {
    let page = this._pages.search(offset)[0];
    return page || new Page(offset, this.pageSize);
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
    const node = this._pages.tree.getMinKeyDescendant();
    const lazyOffset = node.key || 0;

    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    let minUnloadPage = Math.floor((this.readOffset - this.unloadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((this.readOffset  + this.unloadHorizon) / this.pageSize);
    let minUnloadHorizon = Math.max(minUnloadPage, 0);
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this.totalPages);

    let unfetchable = [];
    // Unload Pages outside the upper `unloadHorizons`
    for (let i = this.totalPages - 1; i >= maxUnloadHorizon; i -= 1) {
      let page = this._pages.search(i)[0];
      if (page) {
        this._pages.delete(i);
        if (page.isResolved) {
          unfetchable.push(page);
        }
      }
    }

    // Unload Unrequested Pages outside the upper `loadHorizons`
    for (let i = maxUnloadHorizon - 1; i >= maxLoadHorizon; i -= 1) {
      let page = this._pages.search(i)[0];
      if (page && !page.isSettled) {
        this._pages.delete(i);
      }
    }

    // Unload Unrequested Pages outside the lower `loadHorizons`
    for (let i = minLoadHorizon - 1; i >= minUnloadHorizon; i -= 1) {
      let page = this._pages.search(i)[0];
      if (page && !page.isSettled) {
        this._pages.delete(i);
      }
    }

    // Unload Pages outside the lower `unloadHorizons`
    for (let i = minUnloadHorizon - 1; i >= 0; i -= 1) {
      let page = this._pages.search(i)[0];
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
    const lazyOffset = node.key || 0;

    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0) - lazyOffset;
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    // Request Pages within the `loadHorizons`
    for (let i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
      if (!this._pageExists(i)) {
        this._pages.insert(i, new Page(i, this.pageSize));
      }
    }
  }
};
