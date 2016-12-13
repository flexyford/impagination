import Record from './record';

// Array.prototype.fill
function fill(array, value) {
  for (let i = 0; i < array.length; i++) {
    array[i] = value;
  }
  return array;
}

class UnrequestedPage {
  constructor(offset = null, size = 0) {
    this.offset = offset;
    this.size = size;
    this.data = fill(new Array(size), null);
  }

  get isRequested() { return this.isPending || this.isResolved || this.isRejected; }
  get isPending() { return false; }
  get isResolved() { return false; }
  get isRejected() { return false; }
  get isSettled() { return !this.isPending && (this.isResolved || this.isRejected); }

  get records(){
    if (!this._records) {
      let records = this.data
        .map((content, index) => {
          return new Record(this, content, index);
        });

      if (this.isResolved) {
        this._records = records.filter((record, index, arr) => {
          return this.filterCallback(record.content, index, arr);
        });
      } else {
        this._records = records;
      }
    }

    return this._records;
  }

  request() {
    return new PendingPage(this);
  }

  unload() {
    return this;
  }
}

class PendingPage extends UnrequestedPage {
  constructor(unrequested) {
    super(unrequested.offset, unrequested.size);
  }

  get isPending() { return true; }

  resolve(records, filterCallback) {
    return new ResolvedPage(this, records, filterCallback);
  }

  reject(error) {
    return new RejectedPage(this, error);
  }

  request() {
    return this;
  }

  unload() {
    return new UnrequestedPage(this.offset, this.size);
  }
}

class ResolvedPage extends PendingPage {
  constructor(pending, data, filterCallback) {
    super(pending);
    this.filterCallback = filterCallback || function() {return true;};
    this.data = data;
  }
  get isPending() { return false; }
  get isResolved() { return true; }
  get isSettled() { return true; }
}

class RejectedPage extends PendingPage {
  constructor(pending, error) {
    super(pending);
    this.error = error;
  }

  get isPending() { return false; }
  get isRejected() { return true; }
  get isSettled() { return true; }
}

export default UnrequestedPage;
