import Store from '../src/lazy-store';

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { Server, PageRequest, createRecords } from './test-server';

describe("Pages Interface Store ", function() {
  function expectPages(store, expected = {}) {
    expected = Object.assign({
      unrequested: 0,
      unfetchable: 0,
      pending: 0,
      resolved: 0,
      rejected: 0
    }, expected);

    let numRequestedPages = expected.pending + expected.resolved + expected.rejected;

    expect(store.requested.length).to.equal(numRequestedPages);
    expect(store.unfetchable.length).to.equal(expected.unfetchable);
    expect(store.unrequested.length).to.equal(expected.unrequested);
    expect(store.pending.length).to.equal(expected.pending);
    expect(store.resolved.length).to.equal(expected.resolved);
    expect(store.rejected.length).to.equal(expected.rejected);
  }

  describe("instantiating pages", function() {
    it("cannot be instantiated without pageSize", function() {
      var err = "";
      try { new Store(); } catch(e) { err = e; }
      expect(err).to.match(/without pageSize/);
    });

    it("cannot be instantiated with unloadHorizon less than loadHorizon", function () {
      var err = "";
      try { new Store({
        pageSize: 1, loadHorizon: 5, unloadHorizon: 1
      }); } catch(e) { err = e; }
      expect(err).to.match(/unloadHorizon less than loadHorizon/);
    });

    describe("with pageSize", function() {
      let store;
      beforeEach(function() {
        store = new Store({ pageSize: 10 });
      });

      it("has default constructor values", function() {
        expect(store.pageSize).to.equal(10);
        expect(store.loadHorizon).to.equal(10);
        expect(store.unloadHorizon).to.equal(Infinity);
        expect(store.readOffset).to.equal(undefined);
      });

      it("does not request pages", function() {
        expectPages(store);
      });

      it("does not have any records", function() {
        expect(store.length).to.equal(0);
      });

      describe("setting the read offset", function() {
        beforeEach(function() {
          store = store.setReadOffset(0);
        });

        it("has unrequested pages", function() {
          expectPages(store, { unrequested: 1 });
        });

        it("has empty unrequested records", function() {
          const readOffset = store.readOffset;
          const record = store[readOffset];

          expect(readOffset).to.equal(0);
          expect(store.length).to.equal(10);

          expect(record.isRequested).to.be.false;
          expect(record.isPending).to.be.false;
          expect(record.isResolved).to.be.false;
          expect(record.isRejected).to.be.false;
          expect(record.content).to.equal(null);
          expect(record.page.offset).to.equal(0);
        });

        describe("advancing the read offset", function() {
          beforeEach(function() {
            store = store.setReadOffset(35);
          });

          it("unloads the previously unrequested page and generates new unrequested pages", function() {
            expectPages(store, { unrequested: 3 });
          });

          it("has more unrequested records", function() {
            const readOffset = store.readOffset;
            const record = store[readOffset];

            expect(readOffset).to.equal(35);
            expect(store.length).to.equal(50);

            expect(record.isRequested).to.be.false;
            expect(record.isPending).to.be.false;
            expect(record.isResolved).to.be.false;
            expect(record.isRejected).to.be.false;
            expect(record.content).to.equal(null);
            expect(record.page.offset).to.equal(3);
          });
        });

        describe("fetching all unrequested pages", function() {
          beforeEach(function() {
            store = store.fetch(store.unrequested);
          });

          it("requests pages", function() {
            expectPages(store, { pending: 1 });
          });

          it("has pending records", function() {
            const readOffset = store.readOffset;
            const record = store[readOffset];

            expect(readOffset).to.equal(0);
            expect(store.length).to.equal(10);

            expect(record.isRequested).to.be.true;
            expect(record.isPending).to.be.true;
            expect(record.isResolved).to.be.false;
            expect(record.isRejected).to.be.false;
            expect(record.content).to.equal(null);
            expect(record.page.offset).to.equal(0);
          });

          describe("advancing the read offset", function() {
            beforeEach(function() {
              store = store.setReadOffset(35);
            });

            it("unloads the pending page and generates new unrequested pages", function() {
              expectPages(store, { unrequested: 3, pending: 0 });
              expect(store.length).to.equal(50);
            });
          });

          describe("resolving pages", function() {
            beforeEach(function() {
              store.pending.forEach((pendingPage) => {
                let records = createRecords(store.pageSize, pendingPage.offset);
                store = store.resolve(records, pendingPage.offset);
              });
            });

            it("has resolved pages", function() {
              expectPages(store, { resolved: 1 });
              expect(store.length).to.equal(10);
            });

            describe("advancing the read offset", function() {
              beforeEach(function() {
                store = store.setReadOffset(35);
              });

              it("keeps the resolved page and generates new Unrequested pages", function() {
                expectPages(store, { unrequested: 3, resolved: 1 });
                expect(store.length).to.equal(50);
              });
            });
          });

          describe("rejecting pages", function() {
            beforeEach(function() {
              store.pending.forEach((pendingPage) => {
                store = store.reject("404", pendingPage);
              });
            });

            it("does not have any records", function() {
              expectPages(store, { rejected: 1 });
              expect(store.length).to.equal(0);
            });
          });
        });
      });
    });

    describe("with an unload horizon", function() {
      let store;
      beforeEach(function() {
        store = new Store({
          pageSize: 10,
          loadHorizon: 10,
          unloadHorizon: 10
        }).setReadOffset(0);
      });

      describe("advancing the read offset", function() {
        beforeEach(function() {
          store = store.setReadOffset(35);
        });

        it("unloads the previously unrequested page and generates new unrequested pages", function() {
          expectPages(store, { unrequested: 3 });
        });
      });

      describe("fetching all unrequested pages", function() {
        beforeEach(function() {
          store = store.fetch(store.unrequested);
        });

        it("requests pages", function() {
          expectPages(store, { pending: 1 });
        });

        describe("advancing the read offset", function() {
          beforeEach(function() {
            store = store.setReadOffset(35);
          });

          it("unloads the pending page and generates new unrequested pages", function() {
            expectPages(store, { unrequested: 3, pending: 0 });
          });
        });

        describe("resolving pages", function() {
          beforeEach(function() {
            store.pending.forEach((pendingPage) => {
              let records = createRecords(store.pageSize, pendingPage.offset);
              store = store.resolve(records, pendingPage.offset);
            });
          });

          it("has resolved pages", function() {
            expectPages(store, { resolved: 1 });
          });

          describe("advancing the read offset", function() {
            beforeEach(function() {
              store = store.setReadOffset(35);
            });

            it("unloads the resolved page and generates new Unrequested pages", function() {
              expectPages(store, { unrequested: 3, unfetchable: 1, resolved: 0 });
            });

            describe("unfetching all unfetchable pages", function() {
              beforeEach(function() {
                store = store.unfetch(store.unfetchable);
              });

              it("unfetches pages", function() {
                expect(store.unfetchable.length).to.equal(0);
              });
            });

          });
        });
      });
    });

    describe("with stats", function() {
      let store;
      beforeEach(function() {
        store = new Store({
          pageSize: 10,
          stats: { totalPages: 10 }
        }).setReadOffset(0);
      });

      it("has default constructor values", function() {
        expect(store.stats.totalPages).to.equal(10);
        expect(store.readOffset).to.equal(0);
      });

      it("requests pages", function() {
        expect(store.unrequested.length).to.equal(1);
        expect(store.length).to.equal(100);
      });

      describe("setting the readOffset out of bounds", function() {
        beforeEach(function() {
          store.fetch(store.unrequested);

          store.pending.forEach((pendingPage) => {
            let records = createRecords(store.pageSize, pendingPage.offset);
            store = store.resolve(records, pendingPage.offset);
          });
        });
        describe("where the minimum loadHorizon is less than the dataset length", function() {
          let readOffset;
          beforeEach(function() {

            readOffset = store.length + store.loadHorizon - 1;
            store = store.setReadOffset(readOffset);
          });
          it("has a new unrequested page", function() {
            expect(store.unrequested.length).to.equal(1);
            expect(store.unrequested[0].offset).to.equal(9);
            expect(store.getPage(9).offset).to.equal(9);
          });
          it("does not have a record at the readOffset", function() {
            let record = store.getRecord(readOffset);
            expect(record).to.have.property('content', null);
          });
        });
      });
    });
  });
});
