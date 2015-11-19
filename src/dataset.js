import Page from './page';
import Record from './record';

class State {
  constructor() {
    this.isRequested = false;
    this.isPending = false;
    this.isResolved = false;
    this.isRejected = false;
    this.isSettled = false;
    this.pages = [];
    this.stats = {
      totalPages: undefined
    };
    this.length = 0;
  }

  update(change) {
    let next = new State();
    next.isPending = this.isPending;
    next.isResolved = this.isResolved;
    next.isRejected = this.isRejected;
    next.isSettled = this.isSettled;
    next.length = this.length;
    next.pageSize = this.pageSize;
    next.loadHorizon = this.loadHorizon;
    next.unloadHorizon = this.unloadHorizon;
    next.readOffset = this.readOffset;
    next.pages = this.pages.slice();
    next.stats.totalPages = this.stats.totalPages;
    change.call(this, next);
    next.pages = Object.freeze(next.pages);
    return next;
  }

  get(index) {
    let pageOffset = Math.floor(index / this.pageSize);
    let recordOffset = index % this.pageSize;
    let page = this.pages[pageOffset];
    if (page) {
        return page.records[recordOffset];
    } else {
      return new Record();
    }
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
    this._unfetch = options.unfetch || function() {};
    this._observe = options.observe || function() {};
    this.state = new State();
    this.state.pageSize = this._pageSize;
    this.state.loadHorizon = options.loadHorizon || this._pageSize;
    this.state.unloadHorizon = options.unloadHorizon || Infinity;

    if (this.state.unloadHorizon < this.state.loadHorizon) {
      throw new Error('created Dataset with unloadHorizon less than loadHorizon');
    }
  }

  setReadOffset(readOffset) {
    if (this.state.readOffset === readOffset) { return; }
    readOffset = (readOffset >= 0) ? readOffset : 0;
    let state = this.state.update((next)=> {
      next.readOffset = readOffset;
      var pages = next.pages;

      let minLoadPage = Math.floor((readOffset  - next.loadHorizon) / next.pageSize);
      let maxLoadPage = Math.ceil((readOffset  + next.loadHorizon) / next.pageSize);
      let minUnloadPage = Math.floor((readOffset - next.unloadHorizon) / next.pageSize);
      let maxUnloadPage = Math.ceil((readOffset  + next.unloadHorizon) / next.pageSize);

      var minLoadHorizon = Math.max(minLoadPage, 0);
      var maxLoadHorizon = Math.min(next.stats.totalPages || Infinity, maxLoadPage);
      var minUnloadHorizon = Math.max(minUnloadPage, 0);
      var maxUnloadHorizon = Math.min(next.stats.totalPages || Infinity, maxUnloadPage, pages.length);

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

      this._adjustTotalRecords(next);

      // Request and Fetch Records within the `loadHorizons`
      for (i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
        let page = this._touchPage(pages, i);

        if (!page.isRequested) {
          pages[i] = page.request();
          this._fetchPage(pages[i]);
        }
      }

      if (readOffset >= next.length) {
        console.warn(`Warning: Requested records at readOffset ${readOffset}. Maximum readOffset: ${next.length - 1}`);
      }
      this._setStateStatus(next);
    });
    this._observe(this.state = state);
  }

  /* Unloads a page at the given index and returns the unloaded page */
  _unloadPage(pages, i) {
    let page = this._touchPage(pages, i);
    if (page.isRequested) {
      this._unfetch.call(this, page.data, page.offset);
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

  _adjustTotalPages(pages, stats) {
    if(stats.totalPages > pages.length) {
      // touch pages
      for (let i = pages.length; i < stats.totalPages; i += 1) {
        this._touchPage(pages, i);
      }
    } else if(stats.totalPages < pages.length) {
      // remove pages
      pages.splice(stats.totalPages, pages.length);
    }

  }

  _adjustTotalRecords(state) {
    state.length = state.pages.reduce(function(length, page) {
      return length + page.data.length;
    }, 0);
  }

  _setStateStatus(state) {
    let record = state.get(state.readOffset);
    state.isRequested = record.page.isRequested;
    state.isPending = record.page.isPending;
    state.isResolved = record.page.isResolved;
    state.isRejected = record.page.isRejected;
    state.isSettled = record.page.isSettled;
  }

  _fetchPage(page) {
    let offset = page.offset;
    let pageSize = this.state.pageSize;
    let stats = {totalPages: this.state.totalPages };
    return this._fetch.call(this, offset, pageSize, stats).then((records = []) => {
      let state = this.state.update((next)=> {
        next.stats = stats;
        if(page !== next.pages[offset]) { return; }
        next.pages[offset] = page.resolve(records);
        this._adjustTotalPages(next.pages, stats);
        this._adjustTotalRecords(next);
        this._setStateStatus(next);
      });
      this._observe(this.state = state);
    }).catch((error = {}) => {
      let state = this.state.update((next)=> {
        next.stats = stats;
        if(page !== next.pages[offset]) { return; }
        next.pages[offset] = page.reject(error);
        this._adjustTotalPages(next.pages, stats);
        this._adjustTotalRecords(next);
        this._setStateStatus(next);
      });
      this._observe(this.state = state);
    });
  }
}
