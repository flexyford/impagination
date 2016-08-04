import Page from './page';

// Unrequested Pages do not show up in Pages Interface
export default class Pages {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      _pages: [],
      length: 0,
      pageSize: 0,
      loadHorizon: previous.pageSize || 0,
      unloadHorizon: Infinity,
      readOffset: undefined,
      stats: { totalPages: undefined },

      // Consider a Records-Interface in the future
      // Right now is too early to abstract into class
      records: {}
    }, previous, attrs);

    if (!this.pageSize) {
      throw new Error('created Pages without pageSize');
    }

    if (this.unloadHorizon < this.loadHorizon) {
      throw new Error('created Pages with unloadHorizon less than loadHorizon');
    }

    this._pages = this._updateHorizons();

    this.length = this._calcLength();
    this.records = Object.assign(this.records, {
      get: this.getRecord.bind(this),
      length: this._calcRecordsLength()
    });
  }

  get pending() {
    return this._pages.filter((page) => {
      return page.isPending;
    });
  }

  get requested() {
    return this._pages.filter((page) => {
      return page.isRequested;
    });
  }

  get resolved() {
    return this._pages.filter((page) => {
      return page.isResolved;
    });
  }

  get rejected() {
    return this._pages.filter((page) => {
      return page.isRejected;
    });
  }

  setReadOffset(readOffset) {
    return new Pages(this, { readOffset });
  }

  resolve(records, stats, offset) {
    let _pages = this._pages.slice();
    let page = this.get(offset);
    let resolvedPage = page.resolve(records);

    _pages.splice(page.offset, 1, resolvedPage);

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
    let offset = this.readOffset;

    if (offset === null || offset === undefined) return 0;

    const baseOffset = this._pages[0] && this._pages[0].offset || 0;

    let maxLoadPage = Math.ceil((offset + this.loadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((offset + this.unloadHorizon) / this.pageSize);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this.length);

    return Math.max(this._pages.length + baseOffset, maxLoadHorizon, this.stats.totalPages || 0);
  }

  _calcRecordsLength() {
    return this.resolved.reduce((length, page) => {
      return length - (this.pageSize - page.records.length);
    }, this.length * this.pageSize);
  }

  get(pageOffset) {
    const firstRequestedPage = this.requested[0];
    const lastRequestedPage = this.requested[this.requested.length - 1];

    const pageIsRequested = this.requested.length &&
            pageOffset >= firstRequestedPage.offset &&
            pageOffset <= lastRequestedPage.offset;

    if (pageIsRequested) {
      return this.requested[pageOffset - firstRequestedPage.offset];
    } else {
      return new Page(pageOffset, this.pageSize);
    }
  }

  getRecord(index) {
    if(index >= this.records.length) return null;

    const pageIndex = Math.floor(index / this.pageSize);
    const firstResolvedPage = this.resolved && this.resolved[0];

    const recordIsUnresolved = !firstResolvedPage || pageIndex < firstResolvedPage.offset;

    if (recordIsUnresolved) {
      const currentPage = this.get(pageIndex);
      const recordIndex = index % this.pageSize;

      return currentPage.records[recordIndex];
    } else {
      let currentPage = firstResolvedPage;
      let recordIndex = index - (currentPage.offset * this.pageSize);

      while(recordIndex >= currentPage.records.length) {
        recordIndex -= currentPage.records.length;
        currentPage = this.get(currentPage.offset + 1);
      }


      return currentPage.records[recordIndex];
    }
  }

  _updateHorizons() {
    return this._requestHorizons(this._unloadHorizons());
  }

  _unloadHorizons(pages) {
    pages = pages && pages.slice() || this.requested.slice();
    const baseOffset = pages[0] && pages[0].offset || 0;

    let minUnloadPage = Math.floor((this.readOffset - this.unloadHorizon) / this.pageSize) - baseOffset;
    let maxUnloadPage = Math.ceil((this.readOffset  + this.unloadHorizon) / this.pageSize) - baseOffset;
    let minUnloadHorizon = Math.max(minUnloadPage, 0) - baseOffset;
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this._pages.length) - baseOffset;

    // Unload Pages outside the upper `unloadHorizons`
    for (let i = pages.length - 1; i >= maxUnloadHorizon; i -= 1) {
      let page = pages[i];
      if (page.isRequested) {
        pages.splice(page.offset, 1);
      }
    }

    // Unload Pages outside the lower `unloadHorizons`
    for (let i = minUnloadHorizon - 1; i >= 0; i -= 1) {
      let page = pages[i];
      if (page && page.isRequested) {
        pages.splice(page.offset, 1);
        // this.unfetch(page);
      }
    }

    return pages;
  }

  _requestHorizons(pages) {
    pages = pages && pages.slice() || this.requested.slice();
    const baseOffset = pages[0] && pages[0].offset || 0;

    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    // Request and Fetch Records within the `loadHorizons`
    for (let i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
      let page = pages[i] || new Page(i + baseOffset, this.pageSize);
      if (!page.isRequested) {
        const requested = page.request();

        if (this.fetch) this._fetchPage(requested);

        pages.splice(page.offset, 1, requested);
      }
    }

    return pages;
  }

  _fetchPage(page) {
    let offset = page.offset;
    let pageSize = this.pageSize;
    let stats = {totalPages: this.stats.totalPages };

    this.fetch.call(this, offset, pageSize, stats).then((records = []) => {
      // TODO: Figure out a way to return if the dataset
      // has been cleared, out-of-sync, etc.
      // The check below does not work . . .
      // if (page !== this.pages.get(offset)) return this.pages;
      return this.resolve(records, stats, offset);
    }).catch((error = {}) => {
      if (page !== this.pages.get(offset)) return this;
      return this.pages.reject(error, stats, offset);
    }).then((pages) => {
      // TODO: Implement observe on pages
      this.observe(pages);
    });
  }
}
