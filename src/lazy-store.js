import Page from './page';

// Unrequested Pages do not show up in Pages Interface
export default class Store {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      _pages: [],
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

  // fetchable
  get unrequested() {
    return this._pages.filter((page) => {
      return !page.isRequested;
    });
  }

  // fetchable
  get unfetchable() {
    return this._unfetchablePages;
  }

  // fetching
  get pending() {
    return this._pages.filter((page) => {
      return page.isPending;
    });
  }

  // fetched
  get resolved() {
    return this._pages.filter((page) => {
      return page.isResolved;
    });
  }

  // fetched
  get rejected() {
    return this._pages.filter((page) => {
      return page.isRejected;
    });
  }

  get requested() {
    return this._pages.filter((page) => {
      return page.isRequested;
    });
  }

  setReadOffset(readOffset) {
    return new Store(this, { readOffset });
  }

  fetch(fetchable = []) {
    if(!Array.isArray(fetchable)) { fetchable = [ fetchable ]; }
    return new Store(this, {
      _pages: this._pages.map(p => fetchable.includes(p) ? p.request() : p)
    });
  }

  unfetch(unfetchable = []) {
    if(!Array.isArray(unfetchable)) { unfetchable = [ unfetchable ]; }
    return new Store(this, {
      _unfetchablePages: this._unfetchablePages.filter(p => !unfetchable.includes(p))
    });
  }

  resolve(records, page, stats) {
    return new Store(this, {
      _pages: this._pages.map(p => p === page ? p.resolve(records) : p),
      stats: stats || this.stats
    });
  }

  reject(error, page, stats) {
    return new Store(this, {
      _pages: this._pages.map(p => p === page ? p.reject(error) : p),
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

    const baseOffset = this._pages[0] && this._pages[0].offset || 0;

    let maxLoadPage = Math.ceil((offset + this.loadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((offset + this.unloadHorizon) / this.pageSize);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this.totalPages);

    return Math.max(this._pages.length + baseOffset, maxLoadHorizon, this.stats.totalPages || 0);
  }

  _calcRecordsLength() {
    return this.resolved.reduce((length, page) => {
      return length - (this.pageSize - page.records.length);
    }, (this.totalPages - this.rejected.length) * this.pageSize);
  }

  _getPage(offset) {
    const firstPage = this._pages[0];
    const lastPage = this._pages[this._pages.length - 1];

    const pageExists = this._pages.length &&
            offset >= firstPage.offset &&
            offset <= lastPage.offset;

    if (pageExists) {
      return this._pages[offset - firstPage.offset];
    } else {
      return new Page(offset, this.pageSize);
    }
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
    let pages = this._pages;
    const lazyOffset = pages[0] && pages[0].offset || 0;

    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0) - lazyOffset;
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage) - lazyOffset;

    let minUnloadPage = Math.floor((this.readOffset - this.unloadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((this.readOffset  + this.unloadHorizon) / this.pageSize);
    let minUnloadHorizon = Math.max(minUnloadPage, 0) - lazyOffset;
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this.totalPages) - lazyOffset;

    let unfetchable = [];
    // Unload Pages outside the upper `unloadHorizons`
    for (let i = this.totalPages - 1; i >= maxUnloadHorizon; i -= 1) {
      let page = pages[i];
      if (page) {
        let [ unloadedPage = {} ] = pages.splice(i, 1);
        if (unloadedPage.isResolved) {
          unfetchable.push(unloadedPage);
        }
      }
    }

    // Unload Unrequested Pages outside the upper `loadHorizons`
    for (let i = maxUnloadHorizon - 1; i >= maxLoadHorizon; i -= 1) {
      let page = pages[i];
      if (page && !page.isSettled) {
        pages.splice(i, 1);
      }
    }

    // Unload Unrequested Pages outside the lower `loadHorizons`
    for (let i = minLoadHorizon - 1; i >= minUnloadHorizon; i -= 1) {
      let page = pages[i];
      if (page && !page.isSettled) {
        pages.splice(i, 1);
      }
    }

    // Unload Pages outside the lower `unloadHorizons`
    for (let i = minUnloadHorizon - 1; i >= 0; i -= 1) {
      let page = pages[i];
      if (page) {
        let [ unloadedPage = {} ] = pages.splice(i, 1);
        if (unloadedPage.isResolved) {
          unfetchable.push(unloadedPage);
        }
      }
    }

    this._unfetchablePages = this._unfetchablePages.concat(unfetchable);
  }

  _requestHorizons() {
    let pages = this._pages;
    const lazyOffset = pages[0] && pages[0].offset || 0;

    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0) - lazyOffset;
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage) - lazyOffset;

    // Request and Fetch Records within the `loadHorizons`
    for (let i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
      if (!pages[i]) {
        const offset = i + lazyOffset;
        let unrequested = new Page(offset, this.pageSize);
        pages.splice(i, 1, unrequested);
      }
    }
  }
}
