import Page from './page';
import Record from './record';
import findIndex from './find-index';

export default class Idle {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      pages: [],
      length: 0,
      stats: { totalPages: undefined }
    }, previous, attrs);
  }

  // State Properties
  get isIdle() { return true; }
  get isCreated() { return !this.isIdle; }
  get isPending() { return false; }
  get isResolved() { return false; }
  get isRejected() { return false; }
  get isSettled()  { return !this.isPending && (this.isRejected || this.isResolved); }

  // Lazy Array Properties
  get slice() { return []; }
  get filter() { return []; }

  init(options) {
    return new Created(this, options);
  }
}

class Created extends Idle {
  constructor(previous, attrs) {
    super(previous, attrs);
  }

  // State Properties
  get isIdle() { return false; }

  // TODO: Test what happens when end is negative
  get slice(start, end) {
    if (typeof start !== "number") { start = 0; }
    if (typeof end !== "number") { end = this.length; }

    let length = end - start;
    if (length < 0) { return []; }

    let sliced = [];
    let startPageOffset = Math.floor(start / this.pageSize);
    let endPageOffset = Math.floor((end - 1) / this.pageSize + 1);

    for (let i = startPageOffset; i < endPageOffset; i++) {
      let startIndex = (i === startPageOffset) ?
            start % this.pageSize : 0;
      let endIndex = (i === endPageOffset) ?
            (end - 1) % this.pageSize + 1 : this.pageSize;
      let page = this.pages[i];
      if (page) {
        let records = page.records.slice(startIndex, endIndex);
        sliced = sliced.concat(records);
      }
    }

    return sliced;
  }

  // TODO: Test what happens when deleteCount is negative
  // Alright `splice` is hard. It might have to come later
  splice(start) {
    let items = Array.prototype.slice.call(arguments, 1);
    let deleteCount = this.length - start;
    if (typeof items[0] === "number") { deleteCount = items.unshift(); }

    let removed = this.slice(start, start + deleteCount);
    // TODO: Modify pages here
    // this.pages = this.slice(0, start).
    //   concat(items).
    //   concat(this.slice(start + deleteCount + 1, this.length));
    return removed;
  }

  setReadOffset(readOffset) {
    return new Pending(this, {readOffset});
  }

  /**
   * Impagination Does Not support Array Iterators at the moment
   * For Large Datasets this can get expensive
   * TODO: Consider using a Weak Map?
   * filter() {}
   */
  _setDefaults() {
    if (!this.pageSize) {
      throw new Error('created Dataset without pageSize');
    }
    if (!this.fetch) {
      throw new Error('created Dataset without fetch()');
    }

    this.pageSize = Number(this.pageSize);
    this.loadHorizon = Number(this.loadHorizon || this.pageSize);
    this.unloadHorizon = Number(this.unloadHorizon) || Infinity;

    if (this.unloadHorizon < this.loadHorizon) {
      throw new Error('created Dataset with unloadHorizon less than loadHorizon');
    }
    this.pages = new Pages();
    this.unfetch = this.unfetch || function() {};
    this.pages =  this._allocatePages(this);
    this.length = this._getTotalRecords(this.pages);
  }

  _allocatePages() {
    let maxLoadPage = Math.ceil((this.loadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((this.unloadHorizon) / this.pageSize);

    var maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);
    var maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this.pages.length);

    // Initialize Pages up to Max Horizon
    let currentMaxHorizon = Math.max(maxUnloadHorizon, maxLoadHorizon);
    return this._buildPages(0, currentMaxHorizon, this.pages);
  }

  _buildPages(start, end, pages) {
    pages = pages.slice();
    for (var i = start; i < end; i += 1) {
      this.touchPage(pages, i);
    }
    return pages;
  }

  /* Returns the page at the given index
   * Mutates `pages` array
   * If no page exists it generates and returns a new Page instance
   */
  _touchPage(pages, i) {
    var page = pages[i];
    if(!page) {
      page = new Page(i, this.pageSize);
      pages.splice(i, 1, page);
    }
    return page;
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

  _getTotalRecords(pages) {
    return pages.reduce((length, page) => {
      return length + page.data.length;
    }, 0);
  }

}

class Pending extends Allocated {
  constructor(previous, attrs) {
    super(previous, attrs);
  }

  resolve(records, stats, offset){
    let unresolved = this.pages.slice()[offset];
    let resolved = unresolved.resolve(records);

    let pages = this.pages.slice().splice(offset, 1, resolved);
    return new Resolved(this, { pages, stats });
  }

  reject(error, stats, offset) {
    let unresolved = this.pages.slice()[offset];
    let rejected = unresolved.reject(error);

    let pages = this.pages.slice().splice(offset, 1, rejected);
    return new Resolved(this, { pages, stats });
  }

  setReadOffset(readOffset) {
    super.setReadOffset(readOffset);
  }

  clear() {
    return new Idle();
  }

  unload(readOffset) {
    return new Unloaded(this, { readOffset });
  }

  _setDefaults() {
    this.readOffset = this.readOffset || 0;
    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minUnloadPage = Math.floor((this.readOffset - this.unloadHorizon) / this.pageSize);
    let maxUnloadPage = Math.ceil((this.readOffset  + this.unloadHorizon) / this.pageSize);

    var minLoadHorizon = Math.max(minLoadPage, 0);
    var maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);
    var minUnloadHorizon = Math.max(minUnloadPage, 0);
    var maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, this.pages.length);

    let unrequested =  this._allocatePages(minLoadHorizon, maxLoadHorizon, minUnloadHorizon, maxUnloadHorizon);
    this.pages = this._fetchPages(unrequested);
    this.length = this._getTotalRecords(this.pages);
  }

  _allocatePages(minLoadHorizon, maxLoadHorizon, minUnloadHorizon, maxUnloadHorizon, pages) {
    pages = pages || this.pages.slice();

    // Unload Pages outside the `unloadHorizons`
    for (var i = 0; i < minUnloadHorizon; i += 1) {
      this._unloadPage(pages, i);
    }
    for (i = maxUnloadHorizon; i < pages.length; i += 1) {
      this._unloadPage(pages, i);
    }

    // Initialize Unfetched Pages between current Horizons
    let currentMinHorizon = Math.min(minUnloadHorizon, minLoadHorizon);
    let currentMaxHorizon = Math.max(maxUnloadHorizon, maxLoadHorizon);
    for (i = currentMinHorizon; i < currentMaxHorizon; i += 1) {
      this._touchPage(pages, i);
    }
  }

  _fetchPages(pages) {
    pages = pages || this.pages.slice();
    let minLoadPage = Math.floor((this.readOffset  - this.loadHorizon) / this.pageSize);
    let maxLoadPage = Math.ceil((this.readOffset  + this.loadHorizon) / this.pageSize);
    let minLoadHorizon = Math.max(minLoadPage, 0);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    // Request and Fetch Records within the `loadHorizons`
    for (i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
      let page = pages[i];

      if (!page.isRequested) {
        pages[i] = page.request();
        this._fetchPage(pages[i]);
      }
    }

    if (readOffset >= next.length) {
      console.warn(`Warning: Requested records at readOffset ${readOffset}. Maximum readOffset: ${next.length - 1}`);
    }

    return pages;
  }

  _fetchPage(page) {
    let offset = page.offset;
    let pageSize = this.pageSize;
    let stats = {totalPages: this.stats.totalPages };
    return this.fetch.call(this, offset, pageSize, stats).then((records = []) => {
      if(page !== this.pages[offset]) { return; }
      this.resolve(records, stats, offset);
    }).catch((error = {}) => {
      if(page !== this.pages[offset]) { return; }
      this.reject(error, stats, offset);
    });
  }
}

class Unloaded extends Created {
  constructor(previous, attrs) {
    attrs.readOffset = attrs.readOffset || 0;
    super(previous, attrs);
  }

  _setDefaults() {
    this.pages =  this._unloadPages();
    this.length = this._getTotalRecords(this.pages);
  }

  _unloadPages() {
    let pages = this.pages.slice();
    for (var i = 0; i < pages.length; i += 1) {
      this._unloadPage(pages, i);
    }
    return pages;
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
}

class Resolved extends Pending {
  constructor(previous, attrs) {
    super(previous, attrs);
  }

  get isPending() { return false; }
  get isResolved() { return true; }

  setReadOffset(readOffset) {
    return super.setReadOffset(readOffset);
  }

  clear() {
    return super.clear();
  }

  _setDefaults() {}
}

class Rejected extends Pending {
  constructor(previous, attrs) {
    super(previous, attrs);
  }

  get isPending() { return false; }
  get isRejected() { return true; }

  _setDefaults() {}

  setReadOffset(readOffset) {
    return super.setReadOffset(readOffset);
  }

  clear() {
    return super.clear();
  }

  unload(readOffset) {
    return super.unload(readOffset);
  }
}
