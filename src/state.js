import Page from './page';
import PageTree from './page-tree';
import Record from './record';
import cached from './cache-properties';

// Unrequested Pages do not show up in Pages Interface
export default class State {
  constructor(previous = {}, attrs = {}) {
    Object.assign(this, {
      _pages: new PageTree(),
      _unfetchablePages: [],
      pageSize: 0,
      loadHorizon: previous.pageSize || 0,
      unloadHorizon: Infinity,
      readOffset: undefined,
      stats: { totalPages: undefined },
      filter: function() { return true; },
      records: {},
      [Symbol.iterator]: {
        value: function() {
          let index = 0;
          return {
            next: () => {
              let value = this.getRecord(index);
              let done = index++ >= this.length;
              return { value, done };
            }
          };
        }
      }
    }, previous, attrs);

    if (!this.pageSize) {
      throw new Error('created Pages without pageSize');
    }

    if (this.unloadHorizon < this.loadHorizon) {
      throw new Error('created Pages with unloadHorizon less than loadHorizon');
    }

    this._updateHorizons();
    this._pages.updateKeys();
  }

  get pages() {
    return this._pages.betweenBounds({ $gte: 0 });
  }

  get hasUnrequested() { return this.pages.some((p) => !p.isRequested); }
  get hasRequested() { return this.pages.some((p) => p.isRequested); }
  get hasPending() { return this.pages.some((p) => p.isPending); }
  get hasResolved() { return this.pages.some((p) => p.isResolved); }
  get hasRejected() { return this.pages.some((p) => p.isRejected); }
  get hasUnfetchable() { return !!this._unfetchablePages.length; }

  // fetchable
  get unrequested() { return this.pages.filter((p) => !p.isRequested); }
  get requested() { return this.pages.filter((p) => p.isRequested); }
  get pending() { return this.pages.filter((p) => p.isPending); }
  get resolved() { return this.pages.filter((p) => p.isResolved); }
  get rejected() { return this.pages.filter((p) => p.isRejected); }
  get unfetchable() { return this._unfetchablePages; }

  setReadOffset(readOffset) {
    return new State(this, { readOffset });
  }

  fetch(fetchable = []) {
    if (!fetchable.length) { return this; }

    let _pages = new PageTree();

    this.pages.forEach((p) => {
      const page = fetchable.includes(p) ? p.request() : p;
      _pages.insert(page.offset, page);
    });

    _pages.updateKeys();

    return new State(this, { _pages });
  }

  unfetch(unfetchable = []) {
    if (!unfetchable.length) { return this; }
    return new State(this, {
      _unfetchablePages: this._unfetchablePages.filter(p => !unfetchable.includes(p))
    });
  }

  resolve(records, offset, stats) {
    let _pages = new PageTree();

    this.pages.forEach((p) => {
      let page = p.offset === offset ? this._resolvePage(p, records) : p;
      _pages.insert(p.offset, page);
    });

    _pages.updateKeys();

    return new State(this, {
      _pages,
      stats: stats || this.stats
    });
  }

  reject(error, { offset }, stats) {
    let _pages = new PageTree();

    this.pages.forEach((p) => {
      let page = p.isPending && p.offset === offset ? p.reject(error) : p;
      _pages.insert(p.offset, page);
    });

    _pages.updateKeys();

    return new State(this, {
      _pages,
      stats: stats || this.stats
    });
  }

  refilter(filter) {
    let _this = filter ? new State(this, { filter }) : this;

    let _pages = new PageTree();

    this.pages.forEach((p) => {
      let page = _this._resolvePage(p);
      _pages.insert(p.offset, page);
    });

    _pages.updateKeys();

    return new State(_this, { _pages });
  }

  // Mutator Methods

  // splice:
  // Can only mutate records on page containing record at index `start`
  // Returns new state with mutated records
  splice(start, deleteCount, ...items) {
    let _pages = new PageTree();
    if (start >= this.length) { start = this.length - 1; }
    if (start < 0) { start = 0; }
    let record = this.getRecord(start);
    try {
      this.pages.forEach((p) => {
        if (p === record.page) {
          let page, data = p.data.slice();
          data.splice(record.index, deleteCount, ...items);
          page = this._resolvePage(p, data);
          _pages.insert(p.offset, page);
        } else {
          _pages.insert(p.offset, p);
        }
      });

    } catch(err) {
      throw Error(`Impagination could not find resolved page for record at index ${record.index}`);
    }

    return new State(this, { _pages });
  }

  // Accessor Methods
  concat() { return Array.prototype.concat.apply(this, arguments); }
  includes() { return Array.prototype.includes.apply(this, arguments); }
  join() { return Array.prototype.join.apply(this, arguments); }
  slice() { return Array.prototype.slice.apply(this, arguments); }
  toString() { return Array.prototype.toString.apply(this, arguments); }
  toLocaleString() {
    return Array.prototype.toLocaleString.apply(this, arguments);
  }
  indexOf() { return Array.prototype.indexOf.apply(this, arguments); }
  lastIndexOf() { return Array.prototype.lastIndexOf.apply(this, arguments); }


  // Iteration Methods
  forEach() { return Array.prototype.forEach.apply(this, arguments); }
  every() { return Array.prototype.every.apply(this, arguments); }
  some() { return Array.prototype.some.apply(this, arguments); }
  filter() { return Array.prototype.filter.apply(this, arguments);  }
  find() { return Array.prototype.find.apply(this, arguments);  }
  findIndex() { return Array.prototype.findIndex.apply(this, arguments); }
  keys() { return Array.prototype.keys.apply(this, arguments);  }
  map() { return Array.prototype.map.apply(this, arguments); }
  reduce() { return Array.prototype.reduce.apply(this, arguments); }
  reduceRight() { return Array.prototype.reduceRight.apply(this, arguments); }
  values() { return Array.prototype.values.apply(this, arguments); }

  get length() {
    let node = this._pages.tree.getMaxKeyDescendant();
    let offset = node.key && node.key.page;
    let virtualTotalPages = offset + 1 || 0;

    let total = Math.max(virtualTotalPages, this.stats.totalPages || 0);

    // Resolved record could be filtered
    return this.resolved.reduce((length, page) => {
      return length - (this.pageSize - page.records.length);
    }, (total - this.rejected.length) * this.pageSize);
  }

  // Private API
  _findPage(offset) {
    return this._pages.searchPage(offset).data;
  }

  getPage(offset) {
    return this._findPage(offset) || new Page(offset, this.pageSize);
  }

  _findRecord(index) {
    return this._pages.searchRecord(index);
  }

  getRecord(index) {
    return this._findRecord(index) || new Record();
  }

  _resolvePage(page, records) {
    records = records || page.data;
    if(records) {
      return page.resolve(records, this.filter);
    } else {
      return page;
    }
  }

  _virtualReadOffset() {
    let record = this.getRecord(this.readOffset);
    let readOffset = this.readOffset;

    if(record.isResolved) {
      readOffset = (record.page.offset * this.pageSize + record.index);
    }

    return readOffset;
  }

  _updateHorizons() {
    this._unloadHorizons();
    this._requestHorizons();
    this._addIndeces();
  }

  _addIndeces() {
    let node = this._pages.tree.getMinKeyDescendant();
    let offset = node.key && node.key.page || 0;
    let index = offset * this.pageSize;

    // Add index keys so we can say access values by array[index]
    this.pages.forEach((p) => {
      for(let i = 0; i < p.records.length; i++) {
        let offset = index++;
        Object.defineProperty(this, offset, {
          enumerable: true,
          get: function () {
            return this.getRecord(offset);
          }
        });
      }
    });
  }

  _unloadHorizons() {
    let maxNode = this._pages.tree.getMaxKeyDescendant();
    let maxPageOffset = maxNode.key && maxNode.key.page || 0;

    let { minLoadHorizon, maxLoadHorizon } = this._getLoadHorizons();
    let { minUnloadHorizon, maxUnloadHorizon } = this._getUnloadHorizons();

    let unfetchable = [];
    // Unload Pages outside the upper `unloadHorizons`
    for (let i = maxPageOffset; i >= maxUnloadHorizon; i -= 1) {
      let page = this._findPage(i);
      if (page) {
        this._pages.delete(i);
        if (page.isResolved) {
          unfetchable.push(page);
        }
      }
    }

    // Unload Unrequested Pages outside the upper `loadHorizons`
    for (let i = maxUnloadHorizon - 1; i >= maxLoadHorizon; i -= 1) {
      let page = this._findPage(i);
      if (page && !page.isSettled) {
        this._pages.delete(i);
      }
    }

    // Unload Unrequested Pages outside the lower `loadHorizons`
    for (let i = minLoadHorizon - 1; i >= minUnloadHorizon; i -= 1) {
      let page = this._findPage(i);
      if (page && !page.isSettled) {
        this._pages.delete(i);
      }
    }

    // Unload Pages outside the lower `unloadHorizons`
    for (let i = minUnloadHorizon - 1; i >= 0; i -= 1) {
      let page = this._findPage(i);
      if (page) {
        this._pages.delete(i);
        if (page.isResolved) {
          unfetchable.push(page);
        }
      }
    }

    this._unfetchablePages = this._unfetchablePages.concat(unfetchable);
  }

  _requestHorizons() {
    let { minLoadHorizon, maxLoadHorizon } = this._getLoadHorizons();

    // Request Pages within the `loadHorizons`
    for (let i = minLoadHorizon; i < maxLoadHorizon; i += 1) {
      if (!this._findPage(i)) {
        this._pages.insert(i, new Page(i, this.pageSize));
      }
    }
  }

  _getLoadHorizons() {
    let readOffset = this._virtualReadOffset();

    let min = readOffset - this.loadHorizon;
    let max = readOffset  + this.loadHorizon;

    let minLoadPage = Math.floor(min / this.pageSize);
    let maxLoadPage = Math.ceil(max / this.pageSize);

    let minLoadHorizon = Math.max(minLoadPage, 0);
    let maxLoadHorizon = Math.min(this.stats.totalPages || Infinity, maxLoadPage);

    return { minLoadHorizon, maxLoadHorizon };
  }

  _getUnloadHorizons() {
    let readOffset = this._virtualReadOffset();

    let min = readOffset - this.unloadHorizon;
    let max = readOffset  + this.unloadHorizon;

    let minUnloadPage = Math.floor(min / this.pageSize);
    let maxUnloadPage = Math.ceil(max / this.pageSize);

    let maxNode = this._pages.tree.getMaxKeyDescendant();
    let maxPageOffset = maxNode.key && maxNode.key.page || 0;

    let minUnloadHorizon = Math.max(minUnloadPage, 0);
    let maxUnloadHorizon = Math.min(this.stats.totalPages || Infinity, maxUnloadPage, maxPageOffset + 1);

    return { minUnloadHorizon, maxUnloadHorizon };
  }
};

cached(State);
