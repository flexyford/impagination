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

    this.state.update((next)=> {
      var pages = next.pages;

      var maxHorizon = Math.min(offset + this._loadHorizon, this._pageSize);
      var minHorizon = Math.max(offset - this._loadHorizon, 0);
      var loadHorizonRange = maxHorizon - minHorizon;
      for (var i = 0; i < loadHorizonRange; i += 1) {
        pages.length = Math.max(pages.length, i + 1);
        var page = pages[i];
        if (!page || !page.isRequested) {
          pages.splice(i, 1, new Page());
          page = pages[i].request();
          this._fetchPage(page, i);
        }
      }
      return next;
    });
    this._observe(this.state);
  }

  _fetchPage(page, idx) {
    // let stats = {
    //   totalPages: this.state.pages.length
    // };
    // let pageSize = this._pageSize;

    return this._fetch.call(this, idx + this._currentReadOffset).then((records) => {
      this.state.pages[idx] = page.resolve(records);
    });
  }
}
