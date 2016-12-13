import State from '../src/state';

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { Server, PageRequest, createRecords } from './test-server';

describe("Pages Interface State ", function() {
  function expectPages(state, expected = {}) {
    expected = Object.assign({
      unrequested: 0,
      unfetchable: 0,
      pending: 0,
      resolved: 0,
      rejected: 0
    }, expected);

    let numRequestedPages = expected.pending + expected.resolved + expected.rejected;

    expect(state.requested.length).to.equal(numRequestedPages);
    expect(state.unfetchable.length).to.equal(expected.unfetchable);
    expect(state.unrequested.length).to.equal(expected.unrequested);
    expect(state.pending.length).to.equal(expected.pending);
    expect(state.resolved.length).to.equal(expected.resolved);
    expect(state.rejected.length).to.equal(expected.rejected);
  }

  describe("instantiating pages", function() {
    it("cannot be instantiated without pageSize", function() {
      var err = "";
      try { new State(); } catch(e) { err = e; }
      expect(err).to.match(/without pageSize/);
    });

    it("cannot be instantiated with unloadHorizon less than loadHorizon", function () {
      var err = "";
      try { new State({
        pageSize: 1, loadHorizon: 5, unloadHorizon: 1
      }); } catch(e) { err = e; }
      expect(err).to.match(/unloadHorizon less than loadHorizon/);
    });

    describe("with pageSize", function() {
      let state;
      beforeEach(function() {
        state = new State({ pageSize: 10 });
      });

      it("has default constructor values", function() {
        expect(state.pageSize).to.equal(10);
        expect(state.loadHorizon).to.equal(10);
        expect(state.unloadHorizon).to.equal(Infinity);
        expect(state.readOffset).to.equal(undefined);
      });

      it("does not request pages", function() {
        expectPages(state);
      });

      it("does not have any records", function() {
        expect(state.length).to.equal(0);
      });

      describe("setting the read offset", function() {
        beforeEach(function() {
          state = state.setReadOffset(0);
        });

        it("has unrequested pages", function() {
          expectPages(state, { unrequested: 1 });
        });

        it("has empty unrequested records", function() {
          const readOffset = state.readOffset;
          const record = state[readOffset];

          expect(readOffset).to.equal(0);
          expect(state.length).to.equal(10);

          expect(record.isRequested).to.be.false;
          expect(record.isPending).to.be.false;
          expect(record.isResolved).to.be.false;
          expect(record.isRejected).to.be.false;
          expect(record.content).to.equal(null);
          expect(record.page.offset).to.equal(0);
        });

        describe("advancing the read offset", function() {
          beforeEach(function() {
            state = state.setReadOffset(35);
          });

          it("unloads the previously unrequested page and generates new unrequested pages", function() {
            expectPages(state, { unrequested: 3 });
          });

          it("has more unrequested records", function() {
            const readOffset = state.readOffset;
            const record = state[readOffset];

            expect(readOffset).to.equal(35);
            expect(state.length).to.equal(50);

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
            state = state.fetch(state.unrequested);
          });

          it("requests pages", function() {
            expectPages(state, { pending: 1 });
          });

          it("has pending records", function() {
            const readOffset = state.readOffset;
            const record = state[readOffset];

            expect(readOffset).to.equal(0);
            expect(state.length).to.equal(10);

            expect(record.isRequested).to.be.true;
            expect(record.isPending).to.be.true;
            expect(record.isResolved).to.be.false;
            expect(record.isRejected).to.be.false;
            expect(record.content).to.equal(null);
            expect(record.page.offset).to.equal(0);
          });

          describe("advancing the read offset", function() {
            beforeEach(function() {
              state = state.setReadOffset(35);
            });

            it("unloads the pending page and generates new unrequested pages", function() {
              expectPages(state, { unrequested: 3, pending: 0 });
              expect(state.length).to.equal(50);
            });
          });

          describe("resolving pages", function() {
            beforeEach(function() {
              state.pending.forEach((pendingPage) => {
                let records = createRecords(state.pageSize, pendingPage.offset);
                state = state.resolve(records, pendingPage.offset);
              });
            });

            it("has resolved pages", function() {
              expectPages(state, { resolved: 1 });
              expect(state.length).to.equal(10);
            });

            describe("advancing the read offset", function() {
              beforeEach(function() {
                state = state.setReadOffset(35);
              });

              it("keeps the resolved page and generates new Unrequested pages", function() {
                expectPages(state, { unrequested: 3, resolved: 1 });
                expect(state.length).to.equal(50);
              });
            });
          });

          describe("rejecting pages", function() {
            beforeEach(function() {
              state.pending.forEach((pendingPage) => {
                state = state.reject("404", pendingPage);
              });
            });

            it("does not have any records", function() {
              expectPages(state, { rejected: 1 });
              expect(state.length).to.equal(0);
            });
          });
        });
      });
    });

    describe("with an unload horizon", function() {
      let state;
      beforeEach(function() {
        state = new State({
          pageSize: 10,
          loadHorizon: 10,
          unloadHorizon: 10
        }).setReadOffset(0);
      });

      describe("increasing the read offset", function() {
        beforeEach(function() {
          state = state.setReadOffset(35);
        });

        it("unloads the previously unrequested page and generates new unrequested pages", function() {
          expectPages(state, { unrequested: 3 });
        });
      });

      describe("fetching all unrequested pages", function() {
        beforeEach(function() {
          state = state.fetch(state.unrequested);
        });

        it("requests pages", function() {
          expectPages(state, { pending: 1 });
        });

        describe("advancing the read offset", function() {
          beforeEach(function() {
            state = state.setReadOffset(35);
          });

          it("unloads the pending page and generates new unrequested pages", function() {
            expectPages(state, { unrequested: 3, pending: 0 });
          });
        });

        describe("resolving pages", function() {
          beforeEach(function() {
            state.pending.forEach((pendingPage) => {
              let records = createRecords(state.pageSize, pendingPage.offset);
              state = state.resolve(records, pendingPage.offset);
            });
          });

          it("has resolved pages", function() {
            expectPages(state, { resolved: 1 });
          });

          describe("advancing the read offset", function() {
            beforeEach(function() {
              state = state.setReadOffset(35);
            });

            it("unloads the resolved page and generates new Unrequested pages", function() {
              expectPages(state, { unrequested: 3, unfetchable: 1, resolved: 0 });
            });

            describe("unfetching all unfetchable pages", function() {
              beforeEach(function() {
                state = state.unfetch(state.unfetchable);
              });

              it("unfetches pages", function() {
                expect(state.unfetchable.length).to.equal(0);
              });
            });
          });
        });
      });
    });

    describe("with stats", function() {
      let state;
      beforeEach(function() {
        state = new State({
          pageSize: 10,
          stats: { totalPages: 10 }
        }).setReadOffset(0);
      });

      it("has default constructor values", function() {
        expect(state.stats.totalPages).to.equal(10);
        expect(state.readOffset).to.equal(0);
      });

      it("requests pages", function() {
        expect(state.unrequested.length).to.equal(1);
        expect(state.length).to.equal(100);
      });

      describe("setting the readOffset out of bounds", function() {
        beforeEach(function() {
          state.fetch(state.unrequested);

          state.pending.forEach((pendingPage) => {
            let records = createRecords(state.pageSize, pendingPage.offset);
            state = state.resolve(records, pendingPage.offset);
          });
        });
        describe("where the minimum loadHorizon is less than the dataset length", function() {
          let readOffset;
          beforeEach(function() {

            readOffset = state.length + state.loadHorizon - 1;
            state = state.setReadOffset(readOffset);
          });
          it("has a new unrequested page", function() {
            expect(state.unrequested.length).to.equal(1);
            expect(state.unrequested[0].offset).to.equal(9);
            expect(state.getPage(9).offset).to.equal(9);
          });
          it("does not have a record at the readOffset", function() {
            let record = state.getRecord(readOffset);
            expect(record).to.have.property('content', null);
          });
        });
      });
    });
  });
});
