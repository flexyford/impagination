import Page from './page';
import PageTree from './page-tree';
import cached from './cache-properties';

// Unrequested Pages do not show up in Pages Interface
export default class Store {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      _pages: new PageTree(),
      _unfetchablePages: [],
      pageSize: 0,
      loadHorizon: previous.pageSize || 0,
      unloadHorizon: Infinity,
      readOffset: undefined,
      stats: { totalPages: undefined },
      records: {},
      [Symbol.iterator]: {
        value: function() {
          let index = 0;
          return {
            next: () => {
              let value = this._getRecord(index);
              let done = index++ >= this.length;
              return { value, done };
            }
          };
        }
      }
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

  // requested
  get requested() {
    return this.pages.filter((page) => {
      return page.isRequested;
    });
  }

  setReadOffset(readOffset) {
    return new Store(this, { readOffset });
  }

  fetch(fetchable = []) {
    if (!fetchable.length) { return this; }

    let _pages = new PageTree();

    this.pages.forEach((p) => {
      const page = fetchable.includes(p) ? p.request() : p;
      _pages.insert(page.offset, page);
    });

    this._pages.update();

    return new Store(this, { _pages });
  }

  unfetch(unfetchable = []) {
    if (!unfetchable.length) { return this; }
    return new Store(this, {
      _unfetchablePages: this._unfetchablePages.filter(p => !unfetchable.includes(p))
    });
  }

  resolve(records, offset, stats) {
    let _pages = new PageTree();

    this.pages.forEach((p) => {
      let page = p.isPending && p.offset === offset ? p.resolve(records) : p;
      _pages.insert(p.offset, page);
    });

    this._pages.update();

    return new Store(this, {
      _pages,
      stats: stats || this.stats
    });
  }

  reject(error, { offset }, stats) {
    let _pages = new PageTree();

    this.pages.forEach((p) => {
      let page = p.isPending && p.offset === offset ? p.reject(error) : p;
      _pages.insert(p.offset, page);
    });

    this._pages.update();

    return new Store(this, {
      _pages,
      stats: stats || this.stats
    });
  }

  slice() {
    return Array.prototype.slice.apply(this, arguments);
  }

  filter() {
    return Array.prototype.filter.apply(this, arguments);
  }

  map() {
    return Array.prototype.map.apply(this, arguments);
  }

  reduce() {
    return Array.prototype.reduce.apply(this, arguments);
  }

  get length() {
    let node = this._pages.tree.getMaxKeyDescendant();
    let offset = node.key && node.key.page;
    let virtualTotalPages = offset + 1 || 0;

    let total = Math.max(virtualTotalPages, this.stats.totalPages || 0);

    return (total - this.rejected.length) * this.pageSize;
  }

  // Private API
  _findPage(offset) {
    return this._pages.searchPage(offset).data;
  }

  _getPage(offset) {
    return this._findPage(offset) || new Page(offset, this.pageSize);
  }

  _getRecord(index) {
    return this._pages.searchRecord(index);
  }

  _updateHorizons() {
    this._unloadHorizons();
    this._requestHorizons();

    this._pages.update();

    let node = this._pages.tree.getMinKeyDescendant();
    let offset = node.key && node.key.page || 0;
    let minPage = this._getPage(offset);

    let index = minPage.offset * this.pageSize;

    // Add index keys so we can say access values by array[index]
    this.pages.forEach((p) => {
      for(let i = 0; i < p.records.length; i++) {
        let offset = index++;
        Object.defineProperty(this, offset, { get: function () {
          return this._getRecord(offset);
        }});
      }
    });

    // Here is where we can compute each page's starting actual index

  }

  _unloadHorizons() {
    let maxPageOffset = this._pages.tree.getMaxKeyDescendant().key || 0;

    let { minLoadHorizon, maxLoadHorizon } = this.getLoadHorizons();
    let { minUnloadHorizon, maxUnloadHorizon } = this.getUnloadHorizons();

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
    let { minLoadHorizon, maxLoadHorizon } = this.getLoadHorizons();

    // Request Pages within the `loadHorizons`
    for (let i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
      if (!this._findPage(i)) {
        this._pages.insert(i, new Page(i, this.pageSize));
      }
    }
  }

  getLoadHorizons() {
    let min = this.readOffset - this.loadHorizon;
    let max = this.readOffset  + this.loadHorizon;

    let minLoadPage = Math.floor(min / this.pageSize);
    let maxLoadPage = Math.ceil(max / this.pageSize);

    let minLoadHorizon = Math.max(minLoadPage, 0);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    return { minLoadHorizon, maxLoadHorizon };
  }

  getUnloadHorizons() {
    let min = this.readOffset - this.unloadHorizon;
    let max = this.readOffset  + this.unloadHorizon;

    let minUnloadPage = Math.floor(min / this.pageSize);
    let maxUnloadPage = Math.ceil(max / this.pageSize);

    let maxPageOffset = this._pages.tree.getMaxKeyDescendant().key || 0;

    let minUnloadHorizon = Math.max(minUnloadPage, 0);
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, maxPageOffset + 1);

    return { minUnloadHorizon, maxUnloadHorizon };
  }
};

cached(Store);
