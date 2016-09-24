import Pages from './pages-interface';
import Record from './record';
import findIndex from './find-index';

export default class Dataset {
  constructor(attrs = {}) {
    this.pages = new Pages({
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

    this.observe(this.pages);
  }

  // Public Functions
  setReadOffset(readOffset) {
    readOffset = Number(readOffset);
    if (readOffset !== this.readOffset) {
      this.pages = this.pages.setReadOffset(readOffset);
      this.pages.unrequested.forEach(p => this._fetchPage(p));
      this.pages.unfetchable.forEach(p => this._unfetchPage(p));
      this.observe(this.pages);
    }
  }

  // Applies the filter to all possible Resolved Pages
  refilter() {
    let pages = new Pages(this.pages, {
      _pages: undefined,
      readOffset: undefined
    });

    this.observe(pages);
  }

  // Unload all pages, 'unfetch' every unloaded page
  unload() {
    let pages = new Pages(this.pages, {
      _pages: undefined,
      readOffset: undefined
    });

    this.observe(pages);
  }

  // Destroy all pages, does not `unfetch` any destroyed page
  reset() {
    let pages = new Pages(this.pages, {
      _pages: undefined,
      readOffset: undefined
    });

    this.observe(pages);
  }

  // Private Function
  _fetchPage(fetchable) {
    // TODO: Allow `fetchable` be an array of pages
    this.pages = this.pages.fetch(fetchable);
    let page = this.pages.pending.find(p => p.offset === fetchable.offset);
    let pageSize = this.pages.pageSize;
    let stats = this.pages.stats;

    this.fetch.call(this, page.offset, pageSize, stats).then((records = []) => {
      this.observe(this.pages = this.pages.resolve(records, page, stats));
    }).catch((error = {}) => {
      this.observe(this.pages = this.pages.reject(error, page, stats));
    });
  }

  // Private Function
  _unfetchPage(unfetchable) {
    // TODO: Allow `unfetchable` to be an array of pages
    this.pages = this.pages.unfetch(unfetchable);
    this.unfetch.call(this, page.records, page.offset);
  }
};
