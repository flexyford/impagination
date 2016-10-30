import Dataset from '../src/dataset';

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { Server, PageRequest } from './test-server';

describe("Dataset", function() {
  describe("initializing a new dataset", function() {
    it("cannot be instantiated without pageSize", function() {
      var err = "";
      try {
        new Dataset();
      } catch(e) { err = e; }
      expect(err).to.match(/without pageSize/);
    });

    it("cannot be instantiated without fetch()", function () {
      var err = "";
      try {
        new Dataset({
          pageSize: 1
        });
      } catch(e) { err = e; }
      expect(err).to.match(/without fetch/);
    });

    it("cannot be instantiated with unloadHorizon less than loadHorizon", function () {
      var err = "";
      try {
        new Dataset({
          pageSize: 1,
          fetch: () => {},
          loadHorizon: 5,
          unloadHorizon: 1
        });
      } catch(e) { err = e; }
      expect(err).to.match(/unloadHorizon less than loadHorizon/);
    });

    it("requires pagesize and fetch function", function() {
      var err = "";
      try {
        new Dataset({
          pageSize: 1,
          fetch: () => {}
        });
      } catch(e) { err = e; }
      expect(err).to.equal('');
    });
  });

  describe("observing pages", function() {
    let dataset, requests, server, store, unfetched;

    let fetch = (pageOffset, pageSize, stats) => {
      return server.request(pageOffset, pageSize, stats);
    };

    let unfetch =  function(records, pageOffset) {
      unfetched.push(pageOffset);
    };

    let observe =  (_pages) => {
      return Object.assign(dataset, { store: _pages });
    };

    beforeEach(function() {
      store = {};
      unfetched = [];

      server = new Server();
      requests = server.requests;

      dataset = new Dataset({
        pageSize: 10,
        fetch, unfetch, observe
      });
    });

    it("creates an observable dataset", function() {
      let records = dataset.store.slice();
      expect(dataset.store.length).to.equal(0);
      expect(records.length).to.equal(0);
    });

    it("does not fetch a page", function() {
      expect(requests.length).to.equal(0);
    });

    describe("setting the read offset", function() {
      beforeEach(function() {
        dataset.setReadOffset(0);
      });

      it("requests pages", function() {
        expect(requests.length).to.equal(1);
      });

      it("sets the length and readOffset on dataset", function() {
        expect(dataset.store.readOffset).to.equal(0);
        expect(dataset.store.length).to.equal(10);
      });

      describe("advancing the read offset", function() {
        beforeEach(function() {
          dataset.setReadOffset(35);
        });

        it("requests additional pages", function() {
          expect(requests.length).to.equal(5);
          expect(dataset.store.length).to.equal(50);
        });
      });

      describe("resolving a page", function() {
        beforeEach(function() {
          let page = dataset.store.requested[0];
          return server.resolve(page.offset);
        });

        it("resolves the page", function() {
          let records = dataset.store.slice();
          expect(dataset.store.resolved.length).to.equal(1);
          expect(dataset.store.length).to.equal(10);
          expect(records.length).to.equal(10);

          let name = records[0].content.name;
          expect(name).to.equal('Record 0');
        });
      });

      describe("rejecting a page", function() {
        beforeEach(function(done) {
          let page = dataset.store.requested[0];
          let finish = ()=> done();
          return server.reject(page.offset).then(finish).catch(finish);
        });

        it("rejects the page", function() {
          expect(dataset.store.rejected.length).to.equal(1);
        });

        it("does not have any records", function() {
          let records = dataset.store.slice();
          expect(dataset.store.length).to.equal(0);
          expect(records.length).to.equal(0);
        });
      });

      describe("decrementing the readOffset below 0", function() {
        beforeEach(function() {
          dataset.setReadOffset(-5);
        });
        it("sets the readOffset to 0", function () {
          expect(dataset.store.readOffset).to.equal(0);
        });
      });
    });

    describe("with less than one page loadHorizon", function() {
      beforeEach(function() {
        dataset = new Dataset({
          pageSize: 10,
          loadHorizon: 5,
          fetch, unfetch, observe
        });
        dataset.setReadOffset(0);
      });

      it("requests one page of records", function() {
        expect(dataset.store.length).to.equal(10);
      });
    });

    describe("with less than two pages loadHorizon", function() {
      beforeEach(function() {
        dataset = new Dataset({
          pageSize: 10,
          loadHorizon: 15,
          fetch, unfetch, observe
        });
        dataset.setReadOffset(0);
      });

      it("requests two pages of records", function() {
        expect(dataset.store.length).to.equal(20);
      });

      describe("resolving all requests", function() {
        beforeEach(function(done) {
          let finish = ()=> done();
          return server.resolveAll().then(finish).catch(finish);
        });
        it("has two resolved pages", function() {
          const record = dataset.store.getRecord(0);
          expect(record.isResolved).to.be.true;
        });
      });

      describe("rejecting all requests", function() {
        beforeEach(function(done) {
          server.requests.forEach((request) => request.reject());
          let finish = ()=> done();
          return Promise.all(server.requests).then(finish).catch(finish);
        });
        it("has two rejected pages", function() {
          expect(dataset.store.rejected.length).to.equal(2);
          expect(dataset.store.length).to.equal(0);
        });
      });
    });

    describe("setting read off to a large offset", function() {
      beforeEach(function() {
        dataset = new Dataset({
          pageSize: 10,
          loadHorizon: 15,
          unloadHorizon: 15,
          fetch, unfetch, observe
        });
        dataset.setReadOffset(50);
      });

      it("has many unrequested and pending pages", function() {
        expect(dataset.store.length).to.equal(70);
        expect(dataset.store.pending.length).to.equal(4);
      });

      describe("resolving all requests", function() {
        beforeEach(function() {
          return server.resolveAll();
        });
        it("has many unrequested and resolved pages", function() {
          expect(dataset.store.length).to.equal(70);
          expect(dataset.store.pending.length).to.equal(0);
          expect(dataset.store.resolved.length).to.equal(4);
        });
      });
    });

    describe("Filtering the Dataset", function() {
      beforeEach(function() {
        let isEvenRecord = ({ name }) => {
          let index = name.match(/Record (\d+)/).pop();
          return index % 2 === 0;
        };
        dataset = new Dataset({
          pageSize: 10,
          loadHorizon: 30,
          fetch, filter: isEvenRecord, unfetch, observe
        });
        dataset.setReadOffset(0);
      });

      it("initialies the total length", function() {
        expect(dataset.store.pending.length).to.equal(3);
        expect(dataset.store.length).to.equal(30);
      });

      describe("resolving all pages", function() {
        beforeEach(function() {
          return server.resolveAll();
        });

        it("filters reolved records", function() {
          expect(dataset.store.resolved.length).to.equal(3);
          expect(dataset.store.length).to.equal(15);

          // TODO: Greedy Fetching?
          // These are the results if fetching eagerly
          // expect(dataset.store.pending.length).to.equal(2);
          // expect(dataset.store.length).to.equal(35);
        });

        describe("POST: creating new record", function() {
          beforeEach(function() {
            return dataset.post({ name: 'Record 1000' });
          });

          it("filters-out the record", function() {
            expect(dataset.store.resolved.length).to.equal(3);
            expect(dataset.store.length).to.equal(16);

            // TODO: Greedy Fetching?
            // These are the results if fetching eagerly
            // expect(dataset.store.pending.length).to.equal(2);
            // expect(dataset.store.length).to.equal(35);
          });
        });

        describe("PATCH: editing existing records", function() {
          beforeEach(function() {
            return dataset.put({ name: 'Record 999' }, 1);
          });

          it("filters-out the record", function() {
            expect(dataset.store.resolved.length).to.equal(3);
            expect(dataset.store.length).to.equal(14);

            // TODO: Greedy Fetching?
            // These are the results if fetching eagerly
            // expect(dataset.store.pending.length).to.equal(2);
            // expect(dataset.store.length).to.equal(34);
          });
        });

        describe("DELETE: removing an existing record", function() {
          beforeEach(function() {
            return dataset.delete(2);
          });

          it("deletes the record", function() {
            expect(dataset.store.resolved.length).to.equal(3);
            expect(dataset.store.length).to.equal(14);

            // TODO: Greedy Fetching?
            // These are the results if fetching eagerly
            // expect(dataset.store.pending.length).to.equal(2);
            // expect(dataset.store.length).to.equal(34);
          });
        });

        describe("applying a new filter", function() {
          beforeEach(function() {
            let isDivBy3Record = ({ name }) => {
              let index = name.match(/Record (\d+)/).pop();
              return index % 3 === 0;
            };
            return dataset.refilter(isDivBy3Record);
          });

          it("re-filters the reolved records", function() {
            expect(dataset.store.resolved.length).to.equal(3);
            expect(dataset.store.length).to.equal(10);

            // TODO: Greedy Fetching?
            // These are the results if fetching eagerly
            // expect(dataset.store.pending.length).to.equal(2);
            // expect(dataset.store.length).to.equal(30);
          });

          it("persists the new filter", function() {
            dataset.refilter();
            expect(dataset.store.length).to.equal(10);

            // TODO: Greedy Fetching?
            // server.resolveAll().then(() => {
            //   expect(dataset.store.resolved.length).to.equal(5);
            //   expect(dataset.store.length).to.equal(16);
            //   expect(dataset.store.pending.length).to.equal(2);
            //   expect(dataset.store.length).to.equal(36);
            // });
          });
        });
      });
    });

    describe("Taking Action on the Dataset", function() {
      beforeEach(function() {
        dataset = new Dataset({
          pageSize: 10,
          loadHorizon: 30,
          fetch, unfetch, observe
        });
        dataset.setReadOffset(50);
        return server.resolveAll();
      });

      it("has resolved pages", function() {
        expect(dataset.store.length).to.equal(80);
        expect(dataset.store.resolved.length).to.equal(6);
      });

      describe("reloading the dataset", function() {
        beforeEach(function() {
          return dataset.reload();
        });

        it("destroys all records", function () {
          expect(dataset.store.length).to.equal(0);
        });

        it("unfetches the resolved pages", function () {
          expect(unfetched.length).to.equal(6);
        });
      });

      describe("reloading the dataset with readOffset", function() {
        beforeEach(function() {
          return dataset.reload(dataset.store.readOffset);
        });

        it("unfetches the resolved pages and fetches new ones", function () {
          expect(unfetched.length).to.equal(6);
          expect(dataset.store.pending.length).to.equal(6);
          expect(dataset.store.length).to.equal(80);
        });
      });

      describe("resetting the dataset", function() {
        beforeEach(function() {
          return dataset.reset();
        });

        it("destroys all records", function () {
          expect(dataset.store.length).to.equal(0);
        });
      });

      describe("resetting the dataset with readOffset", function() {
        beforeEach(function() {
          return dataset.reset(dataset.store.readOffset);
        });

        it("destroys the resolved pages without unfetching", function () {
          expect(unfetched.length).to.equal(0);
          expect(dataset.store.pending.length).to.equal(6);
          expect(dataset.store.length).to.equal(80);
        });
      });
    });

    describe("Statistics ", function() {
      describe("when fetch() returns totalPages", function() {
        beforeEach(function() {
          fetch = (pageOffset, pageSize, stats) => {
            stats.totalPages = 10;
            return server.request(pageOffset, pageSize, stats);
          };
          dataset = new Dataset({
            pageSize: 10,
            fetch, unfetch, observe
          });
          return dataset.setReadOffset(0);
        });

        it("makes one request", function() {
          expect(server.requests.length).to.equal(1);
          expect(dataset.store.requested.length).to.equal(1);
        });

        it("sets total pages", function() {
          expect(dataset.store.stats.totalPages).to.equal(10);
          expect(dataset.store.length).to.equal(100);
        });

        describe("resolving the request with totalPages stats", function() {
          beforeEach(function() {
            return server.resolveAll();
          });

          it("sets total pages", function() {
            expect(dataset.store.stats.totalPages).to.equal(10);
            expect(dataset.store.length).to.equal(100);
            expect(dataset.store.requested.length).to.equal(1);
          });

          describe("Setting readOffset out of bounds", function() {

            describe("where the minimum loadHorizon is less than the dataset length", function() {
              beforeEach(function() {
                let minLoadHorizon = dataset.store.length - 1;
                dataset.setReadOffset(minLoadHorizon + dataset.store.loadHorizon);
              });
              it("makes one additional request", function() {
                expect(dataset.store.requested.length).to.equal(2);
              });
              it("requests the last page", function() {
                expect(dataset.store.getRecord(90).isRequested).to.equal(true);
              });
              it("does not have a record at the readOffset", function() {
                let record = dataset.store.getRecord(100);
                expect(record).to.have.property('content', null);
                expect(record.isRequested).to.equal(false);
              });
            });
            describe("where the minimum loadHorizon is greater than or equal to the dataset length", function() {
              beforeEach(function() {
                let minLoadHorizon = dataset.store.length;
                dataset.setReadOffset(minLoadHorizon + dataset.store.loadHorizon);
              });

              it("does not make any additional request", function() {
                expect(dataset.store.requested.length).to.equal(1);
                expect(dataset.store.length).to.equal(100);
              });
              it("sets the readOffset at the out of bounds index", function() {
                expect(dataset.store.readOffset).to.equal(110);
              });
            });
          });
        });

        describe("rejecting the request with totalPages stats", function() {
          beforeEach(function(done) {
            let page = dataset.store.requested[0];
            let finish = ()=> done();
            return server.reject(page.offset).then(finish).catch(finish);
          });

          it("sets the total pages minus the length of the rjected page", function() {
            expect(dataset.store.stats.totalPages).to.equal(10);
            expect(dataset.store.length).to.equal(90);
          });
        });
      });
    });
  });
});
