import Store from './lazy-store';
import Record from './record';
import findIndex from './find-index';

export default class Dataset {
  constructor(attrs = {}) {
    this.store = new Store({
      pageSize: Number(attrs.pageSize) || this.pageSize,
      loadHorizon: Number(attrs.loadHorizon || attrs.pageSize) || this.loadHorizon,
      unloadHorizon: Number(attrs.unloadHorizon) || this.unloadHorizon || Infinity,
      stats: attrs.stats || this.stats || { totalPages: undefined }
    });

    this.fetch = attrs.fetch;

    this.observe = attrs.observe || function() {};;
    this.unfetch = attrs.unfetch || function() {};

    if (!this.fetch) {
      throw new Error('created Dataset without fetch()');
    }
  }

  // Public Functions
  setReadOffset(offset) {
    const readOffset =  Math.max(Number(offset), 0);
    if (isNaN(readOffset)) {
      throw new Error(`${offset} is not a Number`);
    }
    if (readOffset !== this.readOffset) {
      this.store = this.store.setReadOffset(readOffset);
      this.store.unrequested.forEach(p => this._fetchPage(p));
      this.store.unfetchable.forEach(p => this._unfetchPage(p));
      this.observe(this.store);
    }
  }

  // Applies the filter to all possible Resolved Pages
  refilter() {
    this.store = new Store(this.store, {
      _pages: undefined,
      readOffset: undefined
    });

    this.observe(this.store);
  }

  // Unload all pages, 'unfetch' every unloaded page
  unload() {
    this.store = new Store(this.store, {
      _pages: undefined,
      readOffset: undefined
    });

    this.observe(this.store);
  }

  // Destroy all pages, does not `unfetch` any destroyed page
  reset() {
    this.store = new Store(this.store, {
      _pages: undefined,
      readOffset: undefined
    });

    this.observe(this.store);
  }

  _fetchPage(fetchable) {
    // TODO: Allow `fetchable` be an array of pages
    let stats = this.store.stats;
    this.observe(this.store = this.store.fetch(fetchable));

    return this.fetch.call(this, fetchable.offset, this.store.pageSize, stats).then((records = []) => {
      return this.observe(this.store = this.store.resolve(records, fetchable.offset, stats));
    }).catch((error = {}) => {
      return this.observe(this.store = this.store.reject(error, fetchable, stats));
    });
  }

  _unfetchPage(unfetchable) {
    // TODO: Allow `unfetchable` to be an array of pages
    this.observe(this.store = this.store.unfetch(unfetchable));
    this.unfetch.call(this, unfetchable.records, unfetchable.offset);
  }
};
