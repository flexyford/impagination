import Store from './lazy-store';
import Record from './record';
import findIndex from './find-index';

export default class Dataset {
  constructor(attrs = {}) {
    this.store = new Store({
      pageSize: Number(attrs.pageSize),
      loadHorizon: Number(attrs.loadHorizon || attrs.pageSize),
      unloadHorizon: Number(attrs.unloadHorizon) || Infinity,
      filter: attrs.filter,
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
  setReadOffset(offset, force=false) {
    const readOffset =  Math.max(Number(offset), 0);
    if (isNaN(readOffset)) {
      throw new Error(`${offset} is not a Number`);
    }
    if (readOffset !== this.store.readOffset || force) {
      this.store = this.store.setReadOffset(readOffset);

      this._fetchPages(this.store.unrequested);
      this._unfetchPages(this.store.unfetchable);

      this.observe(this.store);
    }
  }

  // Unload all pages, 'unfetch' every unloaded page
  reload(readOffset) {
    // Unfetch unfetchable and resolved pages
    this._unfetchPages(this.store.unfetchable.concat(this.store.resolved));

    this.store = new Store({
      pageSize: this.store.pageSize,
      loadHorizon: this.store.loadHorizon,
      unloadHorizon: this.store.unloadHorizon,
      stats: this.store.stats
    });

    if (readOffset) {
      this.setReadOffset(readOffset, true);
    } else {
      this.observe(this.store);
    }
  }

  // Destroy all pages, does not `unfetch` any destroyed page
  reset(readOffset) {
    this.store = new Store({
      pageSize: this.store.pageSize,
      loadHorizon: this.store.loadHorizon,
      unloadHorizon: this.store.unloadHorizon,
      stats: this.store.stats
    });

    if (readOffset) {
      this.setReadOffset(readOffset, true);
    } else {
      this.observe(this.store);
    }
  }

  post(data, index) {
    index = index || this.store.readOffset;
    try {
      let record = this.store.getRecord(index);
      let unfilteredData = record.page.unfilteredData;
      record.page.unfilteredData = unfilteredData.reduce((_data, content) => {
        return (record.content === content) ?
          _data.concat(data, content) : _data.concat(content);
      }, []);
    } catch(err) {
      console.error(`Error: Impagination did not POST ${data}. Could not find resolved page for record at index ${index}`);
    }
    this.refilter();
  }

  put(data, index) {
    index = index || this.store.readOffset;
    try {
      let record = this.store.getRecord(index);
      Object.assign(record.page.data[record.index], data);
    } catch(err) {
      console.error(`Error: Impagination did not PUT ${data}. Could not find resolved page for record at index ${index}`);
    }
    this.refilter();
  }

  delete(index) {
    index = index || this.store.readOffset;
    try {
      let record = this.store.getRecord(index);
      let unfilteredData = record.page.unfilteredData;
      record.page.unfilteredData = unfilteredData.reduce((_data, content) => {
        return (record.content !== content) ?
          _data.concat(content) : _data;
      }, []);
    } catch(err) {
      console.error(`Error: Impagination did not PUT ${data}. Could not find resolved page for record at index ${index}`);
    }
    this.refilter();
  }

  refilter(filter) {
    filter = filter || this.store.filter;
    this.store = this.store.filterPages(filter);

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
