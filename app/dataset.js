import Page from './page';

class State {
  constructor() {
    this.isPending = false;
    this.isResolved = true;
    this.isRejected = false;
    this.isSettled = true;
    this.pages = [];
    this.totalSize = 0;
  }

  update(change) {
    let next = new State();
    next.isPending = this.isPending;
    next.isResolved = this.isResolved;
    next.isRejected = this.isRejected;
    next.isSettled = this.isSettled;
    next.totalSize = this.totalSize;
    next.pages = this.pages.slice();
    return change.call(this, next);
  }

  get records() {
    return this.pages.reduce(function(records, page) {
      return records.concat(page.records);
    }, []);
  }
}

export default class Dataset {

  constructor(options = {}) {
    if (!options.pageSize) {
      throw new Error('created Dataset without pageSize');
    }
    if (!options.fetch) {
      throw new Error('created Dataset without fetch()');
    }

    this._pageSize = options.pageSize;
    this._fetch = options.fetch;
    this._observe = options.observe || function() {};
    this._loadHorizon = options.loadHorizon || 1;
    this._unloadHorizon = options.unloadHorizon || Infinity;
    this._initialReadOffset = options.initialReadOffset || 0;
    this.state = new State();
    this._observe(this.state);
    this.setReadOffset(this._initialReadOffset); // Initial Page Fetch
  }

  setReadOffset(offset) {
    if (this._currentReadOffset === offset) { return; }
    this._currentReadOffset = offset;

    this.state = this.state.update((next)=> {
      var pages = next.pages;

      var minLoadHorizon = Math.max(offset - this._loadHorizon, 0);
      var maxLoadHorizon = offset + this._loadHorizon;

      var minUnloadHorizon = Math.max(offset - this._unloadHorizon, 0);
      var maxUnloadHorizon = Math.min(offset + this._unloadHorizon, pages.length);

      // Unload Pages outside the `unloadHorizons`
      for (i = 0; i < minUnloadHorizon; i += 1) {
        this._unloadPage(pages, i);
      }
      for (i = maxUnloadHorizon; i < pages.length; i += 1) {
        this._unloadPage(pages, i);
      }

      // Initialize Unfetched Pages between current Horizons
      let currentMinHorizon = Math.min(minUnloadHorizon, minLoadHorizon);
      let currentMaxHorizon = Math.max(maxUnloadHorizon, maxLoadHorizon);
      for (var i = currentMinHorizon; i < currentMaxHorizon; i += 1) {
        this._touchPage(pages, i);
      }

      // Request and Fetch Records within the `loadHorizons`
      for (i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
        let page = this._touchPage(pages, i);

        if (!page.isRequested) {
          page = page.request();
          pages.splice(i, 1, page);
        }

        if (page.isPending) {
          this._fetchPage(page, i);
        }
      }
      next.pages = pages;
      return next;
    });
    this._observe(this.state);
  }

  /* Unloads a page at the given index and returns the unloaded page */
  _unloadPage(pages, i) {
    let page = this._touchPage(pages, i);
    if (page.isRequested) {
      page = page.unload();
      pages.splice(i, 1, page);
    }
    return page;
  }

  /* Returns the page at the given index
   * If no page exists it generates and returns a new Page instance */
  _touchPage(pages, i) {
    var page = pages[i];
    if(!page) {
      page = new Page(i, this._pageSize);
      pages.splice(i, 1, page);
    }
    return page;
  }

  _getStateStats() {
    return {
      totalPages: this.state.pages.length
    };
  }

  _fetchPage(page, offset) {
    var stats = this._getStateStats();

    return this._fetch.call(this, offset, stats).then((data) => {
      var records = data.records || [];
      stats = data.stats || this._getStateStats();

      // Return if page has changed state since fetch request
      if(page !== this.state.pages[offset]) { return; }

      if(stats.totalPages > this.state.pages.length) {
        // touch pages
        for (let i = this.state.pages.length; i < stats.totalPages; i += 1) {
          this._touchPage(this.state.pages, i);
        }
      } else if(stats.totalPages < this.state.pages.length) {
        // remove pages
        this.state.pages.splice(stats.totalPages, this.state.pages.length);
      }
      this.state.pages[offset] = page.resolve(records);
    });
  }
}
