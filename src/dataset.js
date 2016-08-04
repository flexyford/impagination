import Pages from './pages-interface';
import Record from './record';
import findIndex from './find-index';

export default class Idle {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      pages: null,
      stats: { totalPages: undefined }
    }, previous, attrs);
  }

  // State Properties
  get isIdle() { return true; }
  get isAllocated() { return !this.isIdle; }
  get isPending() { return false; }
  get isResolved() { return false; }
  get isRejected() { return false; }
  get isSettled()  { return !this.isPending && (this.isRejected || this.isResolved); }

  // Lazy Array Properties
  get slice() { return []; }
  get filter() { return []; }

  get records() { return []; }
  get length() { return 0; }

  clear() {
    return this;
  }

  init(options) {
    return new Active(this, options);
  }
}

class Active extends Idle {
  constructor(previous, attrs) {
    super(previous, attrs);
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

    this.pages = this.pages || new Pages({
      pageSize: this.pageSize,
      loadHorizon: this.loadHorizon,
      unloadHorizon: this.unloadHorizon,
      fetch: this.fetch,
      observe: function(pages) {
        this.observe( new Active(this, { pages }) );
      }.bind(this)
    });
  }

  // State Properties
  get isIdle() { return false; }
  get isPending() { return this.pages.pending.length > 0; }
  get isResolved() { return !this.isPending && this.pages.resolved.length > 0; }
  get isRejected() { return !this.isPending && this.pages.rejected.length > 0; }
  get isSettled()  { return !this.isPending && (this.isRejected || this.isResolved); }

  get records() { return this.pages.records; }
  get length() { return this.records.length; }

  clear() {
    return new Idle();
  }

  setReadOffset(readOffset) {
    let pages = this.pages.setReadOffset(readOffset);

    return new Active(this, { pages, readOffset });
  }

  unload() {
    return new Active(this, { pages: undefined }, {readOffset: undefined});
  }
}
