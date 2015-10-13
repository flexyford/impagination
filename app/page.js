class UnrequestedPage {
  constructor(offset, size) {
    this.offset = offset;
    this.size = size || 0;
  }


  get isRequested() { return (this.isSettled || this.isPending); }
  get isPending() { return false; }
  get isResolved() { return false; }
  get isRejected() { return false; }
  get isSettled() { return false; }

  get records() {
    return new Array(this.size).fill({});
  }

  request() {
    return new PendingPage(this);
  }
}

class PendingPage extends UnrequestedPage {
  constructor(unrequested) {
    super(unrequested.offset, unrequested.size);
  }

  get isPending() { return true; }

  resolve(records) {
    return new ResolvedPage(this, records);
  }

  reject(error) {
    return new RejectedPage(this, error);
  }

  request() {
    return this;
  }
}

class ResolvedPage extends PendingPage {
  constructor(pending, data) {
    super(pending);
    this.data = data;
  }
  get isPending() { return false; }
  get isResolved() { return true; }
  get isSettled() { return true; }
  get records() {
    return this.data;
  }
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
