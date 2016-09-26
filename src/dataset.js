import Store from './lazy-store';
import Record from './record';
import findIndex from './find-index';

export default class Dataset {
  constructor(attrs = {}) {
    this.store = new Store({
      pageSize: Number(attrs.pageSize),
      loadHorizon: Number(attrs.loadHorizon || attrs.pageSize),
      unloadHorizon: Number(attrs.unloadHorizon) || Infinity,
      stats: attrs.stats || { totalPages: undefined }
    });

    this.fetch = attrs.fetch;

    this.observe = attrs.observe || function() {};;
    this.unfetch = attrs.unfetch || function() {};

    if (!this.fetch) {
      throw new Error('created Dataset without fetch()');
    }
  }

  // Public Functions
  setReadOffset(readOffset) {
    readOffset = Number(readOffset);
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
    let pages = new Store(this.store, {
      _pages: undefined,
      readOffset: undefined
    });

    this.observe(pages);
  }

  _fetchPage(fetchable) {
    // TODO: Allow `fetchable` be an array of pages
    this.store = this.store.fetch(fetchable);
    let page = this.store.pending.find(p => p.offset === fetchable.offset);
    let pageSize = this.store.pageSize;
    let stats = this.store.stats;

    this.fetch.call(this, page.offset, pageSize, stats).then((records = []) => {
      this.observe(this.store = this.store.resolve(records, page, stats));
    }).catch((error = {}) => {
      this.observe(this.store = this.store.reject(error, page, stats));
    });
  }

  _unfetchPage(unfetchable) {
    // TODO: Allow `unfetchable` to be an array of pages
    this.store = this.store.unfetch(unfetchable);
    this.unfetch.call(this, page.records, page.offset);
  }
};
