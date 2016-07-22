import Page from './page';

// Unrequested Pages do not show up in Pages Interface
export default class Pages {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      _pages: previous._pages || [],
      readOffset: previous.readOffset || 0,
      pageSize: previous.pageSize || 0,
      loadHorizon: previous.loadHorizon || previous.pageSize || 0,
      unloadHorizon: previous.unloadHorizon || Infinity,
      stats: previous.stats || { totalPages: undefined },
      length: previous.length || 0,

      // Consider a Records-Interface in the future
      // Right now is too early to abstract into class
      records: previous.records || {
        get: this._getRecord.bind(this)
      }
    }, attrs);

    if (!this.pageSize) {
      throw new Error('created Pages without pageSize');
    }

    if (this.unloadHorizon < this.loadHorizon) {
      throw new Error('created Pages with unloadHorizon less than loadHorizon');
    }

    this._pages = this._updateHorizons();

    this.length = this._calcLength();
    this.records = Object.assign(this.records, {
      length: this._calcRecordsLength()
    });
  }

  get requested() {
    return this._pages;
  }

  get resolved() {
    return this.requested.filter((page) => {
      return page.isResolved;
    });
  }

  indexOf(page = {}) {
    if(page.offset) {
      return page.offset - this._pages[0].offset;
    } else {
      return -1;
    }
  }

  setReadOffset(readOffset) {
    return new Pages(this, { readOffset });
  }

  resolve(records, stats, offset) {
    let page = this.get(offset);
    let resolvedPage = page.resolve(records);
    let _pages = this._pages.slice().splice(page.offset, 1, resolvedPage);
    return new Pages(this, { _pages });
  }

  reject(error, stats, offset) {
    let page = this.get(offset);
    let rejectedPage = page.reject(error);
    let _pages = this._pages.slice().splice(page.offset, 1, rejectedPage);
    return new Pages(this, { _pages });
  }

  // Private API
  _calcLength() {
    const baseOffset = this._pages[0] && this._pages[0].offset || 0;

    let offset = this.readOffset;
    let maxLoadPage = Math.ceil((offset + this.loadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((offset + this.unloadHorizon) / this.pageSize);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this.length);

    return Math.max(this._pages.length + baseOffset, maxLoadHorizon, this.stats.totalPages || 0);
  }

  _calcRecordsLength() {
    let recordsLength = this.length * this.pageSize;
    this.resolved.forEach((page) => {
      recordsLength -= this.pageSize - page.records.length;
    });
    return recordsLength;
  }

  _pageOffset(page = {}) {
    return page && page.offset;
  }

  get(pageOffset) {
    const baseOffset = this._pages[0] && this._pages[0].offset || 0;
    const firstPageOffset = this._pages[0] && this._pages[0].offset;
    const lastPageOffset = this._pages[this._pages.length - 1] && this._pages[this._pages.length - 1].offset;

    if(pageOffset >= firstPageOffset && pageOffset <= lastPageOffset) {
      console.log('returns an existing page');
      console.log('pageOffset baseOffset', pageOffset, baseOffset);
      return this._pages[pageOffset - baseOffset];
    } else {
      return new Page(pageOffset, this.pageSize);
    }
  }

  _getRecord(index) {
    if(index >= this.records.length) return null;

    const pageIndex = Math.floor(index / this.pageSize);
    const firstResolvedPage = this.resolved && this.resolved[0];

    if (!firstResolvedPage || pageIndex < firstResolvedPage.offset) {
      const currentPage = this.get(pageIndex);
      const recordIndex = index % this.pageSize;

      return currentPage.records[recordIndex];
    } else {
      let currentPage = firstResolvedPage;
      let recordIndex = index - (currentPage.offset * this.pageSize);

      console.log(currentPage);

      while(recordIndex >= currentPage.records.length) {
        recordIndex -= currentPage.records.length;
        currentPage = this.get(currentPage.offset + 1);
        console.log(currentPage);
      }

      return currentPage.records[recordIndex];
    }
  }

  _updateHorizons() {
    return this._requestHorizons(this._unloadHorizons());
  }

  _unloadHorizons(pages) {
    let unloadedPages = pages && pages.slice() || this._pages.slice();
    const baseOffset = unloadedPages[0] && unloadedPages[0].offset || 0;

    let minUnloadPage = Math.floor((this.readOffset - this.unloadHorizon) / this.pageSize) - baseOffset;
    let maxUnloadPage = Math.ceil((this.readOffset  + this.unloadHorizon) / this.pageSize) - baseOffset;
    let minUnloadHorizon = Math.max(minUnloadPage, 0) - baseOffset;
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this._pages.length) - baseOffset;

    // Unload Pages outside the upper `unloadHorizons`
    for (let i = unloadedPages.length - 1; i >= maxUnloadHorizon; i -= 1) {
      let page = unloadedPages[i];
      if (page.isRequested) {
        unloadedPages.splice(page.offset, 1);
      }
    }

    // Unload Pages outside the lower `unloadHorizons`
    for (let i = minUnloadHorizon - 1; i >= 0; i -= 1) {
      let page = unloadedPages[i];
      if (page && page.isRequested) {
        unloadedPages.splice(page.offset, 1);
      }
    }

    return unloadedPages;
  }

  _requestHorizons(pages) {
    let requestedPages = pages && pages.slice() || this._pages.slice();
    const baseOffset = requestedPages[0] && requestedPages[0].offset || 0;

    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    // Request and Fetch Records within the `loadHorizons`
    for (let i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
      let page = requestedPages[i] || new Page(i + baseOffset, this.pageSize);
      if (!page.isRequested) {
        let requestedPage = page.request();
        requestedPages.splice(page.offset, 1, requestedPage);
      }
    }

    return requestedPages;
  }
}
