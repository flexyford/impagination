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
    if (readOffset !== this.store.readOffset) {
      this.store = this.store.setReadOffset(readOffset);

      this._fetchPages(this.store.unrequested);
      this._unfetchPages(this.store.unfetchable);

      this.observe(this.store);
    }
  }

  // Applies the filter to all possible Resolved Pages
  refilter() {
    this.store = new Store({
      pageSize: this.store.pageSize,
      loadHorizon: this.store.loadHorizon,
      unloadHorizon: this.store.unloadHorizon,
      stats: this.store.stats
    });

    this.observe(this.store);
  }

  // Unload all pages, 'unfetch' every unloaded page
  unload() {
    let readOffset = this.store.readOffset;

    // Unfetch all the pages
    this._unfetchPages(this.store.resolved);

    this.store = new Store({
      pageSize: this.store.pageSize,
      loadHorizon: this.store.loadHorizon,
      unloadHorizon: this.store.unloadHorizon,
      stats: this.store.stats
    }).setReadOffset(readOffset);

    this._fetchPages(this.store.unrequested);
    this._unfetchPages(this.store.unfetchable);

    this.observe(this.store);
  }

  // Destroy all pages, does not `unfetch` any destroyed page
  reset() {
    this.store = new Store({
      pageSize: this.store.pageSize,
      loadHorizon: this.store.loadHorizon,
      unloadHorizon: this.store.unloadHorizon,
      stats: this.store.stats
    });

    this.observe(this.store);
  }

  _fetchPages(fetchable) {
    this.store = this.store.fetch(fetchable);

    let stats = this.store.stats;
    fetchable.forEach((page) => {
      return this.fetch.call(this, page.offset, this.store.pageSize, stats).then((records = []) => {
        return this.observe(this.store = this.store.resolve(records, page.offset, stats));
      }).catch((error = {}) => {
        return this.observe(this.store = this.store.reject(error, page, stats));
      });
    });
  }

  _unfetchPages(unfetchable) {
    this.store = this.store.unfetch(unfetchable);

    unfetchable.forEach((page) => {
      this.unfetch.call(this, page.records, page.offset);
    });
  }
};
