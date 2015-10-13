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

      // Initialize Empty Pages
      for (var i = minUnloadHorizon; i < maxLoadHorizon; i += 1) {
        let page = pages[i];
        if(!page) {
          pages.splice(i, 1, new Page(i, this._pageSize));
        }
      }

      // Unload Pages
      for (i = 0; i < minUnloadHorizon; i += 1) {
        this._unloadPage(pages, i);
      }
      for (i = maxUnloadHorizon; i < pages.length; i += 1) {
        this._unloadPage(pages, i);
      }

      // Request and Fetch Records
      for (i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
        let page = pages[i];
        if (!page.isRequested) {
          page = page.request();
        }
        if (page.isPending) {
          this._fetchPage(page, i);
        }
      }
      return next;
    });
    this._observe(this.state);
  }

  _unloadPage(pages, i) {
    let page = pages[i];
    if(!page) {
      page = new Page(i, this._pageSize);
    } else {
      page = page.unload();
    }
    pages.splice(i, 1, page);
  }

  _fetchPage(page, offset) {
    let stats = {
      totalPages: this.state.pages.length
    };
    // let pageSize = this._pageSize;

    return this._fetch.call(this, offset, stats).then((records) => {
      this.state.pages[offset] = page.resolve(records);
    });
  }
}
