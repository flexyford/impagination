import { Pages } from './pages-interface';
import Record from './record';
import findIndex from './find-index';

class Idle {
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
      observe: (pages) => {
        let dataset = new Active(this, { pages });
        this.observe(dataset);
      }
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
    if(readOffset === this.readOffset) return this;

    let pages = this.pages.setReadOffset(readOffset);

    return new Active(this, { pages, readOffset });
  }

  unload() {
    return new Active(this, { pages: undefined }, {readOffset: undefined});
  }
}

export default class Observable {
  constructor(attrs = {}) {
    this.observe = attrs.observe || function() {};


    let pages = new Pages({
      observe: (next)=> {
        this.current = new this.current.constructor(this, { pages: next });
        this.observe(this.current);
      }
    });

    let options = Object.assign({}, attrs.options, {
      observe: (next) => {
        this.observe(next, this.current);
        this.current = next;
      }
    });

    this.current = attrs.current || new Idle(options, { pages: pages.current});

    let stateMethods = ['clear', 'init', 'setReadOffset', 'unload'];

    // Assign Immutable State Methods
    Object.assign(this, stateMethods.reduce((methods, method)=> {
      let observable = this;
      return Object.assign(methods, {
        [method]: function(args) {
          return observable.send(method, args);
        }
      });
    }, {}));
  }

  slice() { return this.current.slice(...arguments); }
  filter() { return this.current.filter(...arguments); }

  get isIdle() { return this.current.isIdle; }
  get isAllocated() { return this.current.isAllocated; }
  get isPending() { return this.current.isPending; }
  get isResolved() { return this.current.isResolved; }
  get isRejected() { return this.current.isRejected; }
  get isSettled()  { return this.current.isSettled; }

  get pageSize() {
    return this.current.pageSize;
  }

  get pages() {
    return this.current.pages;
  }

  get loadHorizon() {
    return this.current.loadHorizon;
  }

  get unloadHorizon() {
    return this.current.unloadHorizon;
  }

  get readOffset() {
    return this.current.readOffset;
  }

  get stats() {
    return this.current.stats;
  }

  get length() { return this.current.length; }

  get records() { return this.current.records; }

  send(method, ...args) {
    let next = this.current[method].apply(this.current, args);
    this.observe(next, this.current);
    this.current = next;
  }
};
