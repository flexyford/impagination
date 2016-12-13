import Page from './page';

class Record {
  constructor(page = new Page(), content = null, index = null) {
    this.page = page;
    this.content = content;
    this.index = index;
    if(page.error) {
      this.error = page.error;
    }
  }
  get isRequested() { return this.page.isRequested; }
  get isSettled() { return this.page.isSettled; }
  get isPending() { return this.page.isPending; }
  get isResolved() { return this.page.isResolved; }
  get isRejected() { return this.page.isRejected; }
}

export default Record;
