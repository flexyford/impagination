import State from './state';
import Record from './record';
import findIndex from './find-index';

export default class Dataset {
  constructor(attrs = {}) {
    this.state = new State({
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
  setReadOffset(offset) {
    const readOffset =  Math.max(Number(offset), 0);
    if (isNaN(readOffset)) {
      throw new Error(`${offset} is not a Number`);
    }
    if (readOffset !== this.state.readOffset) {
      this.state = this.state.setReadOffset(readOffset);

      this._fetchPages(this.state.unrequested);
      this._unfetchPages(this.state.unfetchable);

      this.observe(this.state);
    }
  }

  refilter(filterCallback) {
    filterCallback = filterCallback || this.state.filter;
    this.state = this.state.refilter(filterCallback);
    this.observe(this.state);
  }

  // 'unfetch' every unfetchable and resolved pages
  reset(readOffset) {
    this._unfetchPages(this.state.unfetchable.concat(this.state.resolved));

    this.state = new State({
      pageSize: this.state.pageSize,
      loadHorizon: this.state.loadHorizon,
      unloadHorizon: this.state.unloadHorizon,
      stats: this.state.stats,
      readOffset: undefined
    });

    if (readOffset !== this.state.readOffset) {
      this.setReadOffset(readOffset);
    } else {
      this.observe(this.state);
    }
  }

  post(data, index = 0) {
    try {
      this.state = this.state.splice(index, 0, data);
    } catch(err) {
      console.error(`Error: Impagination did not POST ${data}. Could not find resolved page for record at index ${index}`);
    }
    this.observe(this.state);
  }

  put(data, index) {
    index = index || this.state.readOffset;
    try {
      let record = this.state.getRecord(index);
      let item = Object.assign({}, record.page.records[record.index], data);
      this.state = this.state.splice(index, 1, item);
    } catch(err) {
      console.error(`Error: Impagination did not PUT ${data}. Could not find resolved page for record at index ${index}`);
    }
    this.observe(this.state);
  }

  delete(index) {
    index = index || this.state.readOffset;
    try {
      this.state = this.state.splice(index, 1);
    } catch(err) {
      console.error(`Error: Impagination did not DELETE record at ${index}. Could not find resolved page for record at index ${index}`);
    }
    this.observe(this.state);
  }

  _fetchPages(fetchable) {
    let stats = this.state.stats;
    fetchable.forEach((page) => {
      return this.fetch.call(this, page.offset, this.state.pageSize, stats).then((records = []) => {
        return this.observe(this.state = this.state.resolve(records, page.offset, stats));
      }).catch((error = {}) => {
        return this.observe(this.state = this.state.reject(error, page, stats));
      });
    });

    this.state = this.state.fetch(fetchable);
  }

  _unfetchPages(unfetchable) {
    this.state = this.state.unfetch(unfetchable);

    unfetchable.forEach((page) => {
      this.unfetch.call(this, page.records, page.offset);
    });
  }
};
