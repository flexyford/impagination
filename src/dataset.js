import Pages from './pages';
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

  get length() { return 0; }

  init(options) {
    return new Allocated(this, options);
  }
}

class Allocated extends Idle {
  constructor(previous, attrs) {
    Object.assign(this, previous, attrs);
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

    this.unfetch = this.unfetch || function() {};
    this.pages = new Pages({
      pageSize: this.pageSize,
      loadHorizon: this.loadHorizon,
      unloadHorizon: this.unloadHorizon
    });
  }

  // State Properties
  get isIdle() { return false; }

  get records() { return this.pages.records; }
  get length() { return this.records.length; }

  clear() {
    return new Idle();
  }

  setReadOffset(readOffset) {
    let pages = this.pages.setReadOffset(readOffset);
    return new Pending(this, { pages, readOffset });
  }

  unload(readOffset) {
    return new Allocated(this, { readOffset });
  }
}

class Pending extends Allocated {
  constructor(previous, attrs) {
    Object.assign(this, previous, attrs);
    this.pages.requested.forEach((requested) => {
      if (!requested.isPending) {
        this._fetchPage(requested);
      }
    });
    this.length = this.pages.records.length();
  }

  resolve(records, stats, offset){
    let pages = this.pages.resolve(records, stats, offset);
    return new Resolved(this, { pages, stats });
  }

  reject(error, stats, offset) {
    let pages = this.pages.reject(error, stats, offset);
    return new Rejected(this, { pages, stats });
  }

  setReadOffset(readOffset) {
    return super.setReadOffset(readOffset);
  }

  clear() {
    return new Idle();
  }

  unload(readOffset) {
    this.pages.requested.forEach(requested => this._unfetchPage(requested));
    return new Allocated(this, { readOffset });
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

  unload(readOffset) {
    return super.unload(readOffset);
  }
}

class Rejected extends Pending {
  constructor(previous, attrs) {
    super(previous, attrs);
  }

  get isPending() { return false; }
  get isRejected() { return true; }

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
