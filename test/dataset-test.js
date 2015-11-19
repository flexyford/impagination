import Dataset from '../src/dataset';

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { Server, PageRequest } from './test-server';


describe("Dataset", function() {
  describe("instantiating a new dataset", function() {
    it("cannot be instantiated without pageSize", function() {
      var err = "";
      try { new Dataset(); } catch(e) { err = e; }
      expect(err).to.match(/without pageSize/);
    });
    it("cannot be instantiated without fetch()", function () {
      var err = "";
      try { new Dataset({pageSize: 1}); } catch(e) { err = e; }
      expect(err).to.match(/without fetch/);
    });
    it("cannot be instantiated with unloadHorizon less than loadHorizon", function () {
      var err = "";
      try { new Dataset({pageSize: 1, fetch: ()=>{}, loadHorizon: 5, unloadHorizon: 1}); } catch(e) { err = e; }
      expect(err).to.match(/unloadHorizon less than loadHorizon/);
    });

    describe("with default constructor values", function() {
      beforeEach(function() {
        this.server = new Server();
        this.requests = this.server.requests;
        this.dataset = new Dataset({
          pageSize: 10,
          fetch: (pageOffset, pageSize, stats)=> {
            return this.server.request(pageOffset, pageSize, stats);
          }
        });
      });
      it("has default constructor values", function() {
        expect(this.dataset._fetch).to.be.instanceOf(Function);
        expect(this.dataset._pageSize).to.equal(10);
        expect(this.dataset._unfetch).to.be.instanceOf(Function);
        expect(this.dataset._observe).to.be.instanceOf(Function);
      });

      it("initializes the state", function() {
        expect(this.dataset.state.isPending).to.be.false;
        expect(this.dataset.state.isResolved).to.be.false;
        expect(this.dataset.state.isRejected).to.be.false;
        expect(this.dataset.state.isSettled).to.be.false;
      });

      it("initializes the state attributes", function() {
        expect(this.dataset.state).to.be.instanceOf(Object);
        expect(this.dataset.state.length).to.equal(0);
        expect(this.dataset.state.loadHorizon).to.equal(10);
        expect(this.dataset.state.unloadHorizon).to.equal(Infinity);
      });

      it("does not fetch a page", function() {
        expect(this.server.requests.length).to.equal(0);
      });

      it("does not have any records", function() {
        let record = this.dataset.state.get(0);
        expect(record).to.equal(null);
      });

      describe("fetching a page", function() {
        beforeEach(function() {
          this.dataset.setReadOffset(0);
        });
        it("fetches a page of records", function() {
          expect(this.server.requests.length).to.equal(1);
          expect(this.server.requests[0]).to.be.instanceOf(PageRequest);
          expect(this.dataset.state.length).to.equal(10);
        });
        it("returns a pending state", function() {
          expect(this.dataset.state.isPending).to.be.true;
        });
        it("fetches a set of empty Pending records", function() {
          let record = this.dataset.state.get(0);
          expect(record.index).to.equal(0);
          expect(record.isRequested).to.be.true;
          expect(record.isPending).to.be.true;
          expect(record.isResolved).to.be.false;
          expect(record.isRejected).to.be.false;
          expect(record.content).to.equal(null);
          expect(record.page.offset).to.equal(0);
        });
      });
    });
  });

  describe("immutable states", function() {
    beforeEach(function() {
      this.server = new Server();
      this.requests = this.server.requests;
      this.recordsPerPage = 10;

      this.options = {
        pageSize: this.recordsPerPage,
        fetch: (pageOffset, pageSize, stats)=> {
          return this.server.request(pageOffset, pageSize, stats);
        },
        observe: (state) => {
          this.state = state;
        }
      };
      this.dataset = new Dataset(this.options);
      this.dataset.setReadOffset(0);
      this.initialState = this.state;
    });
    describe("resolving all fetch request", function() {
      beforeEach(function() {
        return this.server.resolveAll();
      });
      it("transitions to a new Resolved state", function() {
        expect(this.state).not.to.equal(this.initialState);
        expect(this.state.isResolved).to.be.true;
      });
      it("resolves records", function () {
        expect(this.state.length).to.equal(10);
        var record = this.state.get(0);
        expect(record.isResolved).to.be.true;
        expect(record.content.name).to.equal("Record 0");
      });
    });

    describe("resolving a fetch request", function() {
      beforeEach(function(done) {
        let records = Array.from(Array(10)).map((_, i)=> {
          return {name: `Record ${i}`};
        });
        let request = this.requests[0];
        let finish = ()=> done();
        return request.resolve(records).then(finish).catch(finish);
      });
      it("transitions to a new Resolved state", function() {
        expect(this.state).not.to.equal(this.initialState);
        expect(this.state.isResolved).to.be.true;
      });
      it("resolves records", function () {
        expect(this.state.length).to.equal(10);
        var record = this.state.get(0);
        expect(record.isResolved).to.be.true;
        expect(record.content.name).to.equal("Record 0");
      });
    });

    describe("rejecting a fetch request", function() {
      beforeEach(function(done) {
        var request = this.server.requests[0];
        let finish = ()=> done();
        return request.reject("404").then(finish).catch(finish);
      });
      it("transitions to a new Rejected state", function() {
        expect(this.state).not.to.equal(this.initialState);
        expect(this.state.isRejected).to.be.true;
      });
      it("rejects records", function() {
        var record = this.state.get(0);
        expect(record.isRejected).to.be.true;
        expect(record.error).to.equal("404");
      });
    });

    describe("changing the readOffset", function() {
      beforeEach(function() {
        this.dataset.setReadOffset(1);
      });
      it("transitions to a new state", function() {
        expect(this.state).not.to.equal(this.initialState);
      });
      it("loads an additional page", function() {
        expect(this.state.length).to.equal(20);
      });
    });

    describe("not changing the readOffset", function() {
      beforeEach(function() {
        this.dataset.setReadOffset(0);
      });
      it("does not transition to a new state", function() {
        expect(this.state).to.equal(this.initialState);
      });
    });
  });

  describe("loading records", function() {
    beforeEach(function() {
      this.recordAtPage = function(pageIndex) {
        if(pageIndex < this.state.pages.length) {
          return this.state.get(pageIndex * this.recordsPerPage);
        } else {
          return undefined;
        }
      };
      this.totalPages = 10;
      this.recordsPerPage = 10;
      this.server = new Server();

      this.options = {
        pageSize: this.recordsPerPage,
        fetch: (pageOffset, pageSize, stats) => {
          return this.server.request(pageOffset, pageSize, stats);
        },
        unfetch: (records, pageOffset)=> {
          return this.server.remove(records, pageOffset);
        },
        observe: (state) => {
          this.state = state;
        }
      };
    });

    describe("setting readOffset to zero", function () {
      beforeEach(function() {
        this.initialReadOffset = 0;
      });
      describe("with less than one page loadHorizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 5;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
        });
        it("requests one page of records", function() {
          expect(this.state.length).to.equal(10);
        });
      });
      describe("with less than two pages loadHorizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 15;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
        });
        it("requests two pages of records", function() {
          expect(this.state.length).to.equal(20);
        });
        describe("resolving all requests", function() {
          beforeEach(function() {
            return this.server.resolveAll();
          });
          it("has two resolved pages", function() {
            expect(this.recordAtPage(0).isResolved).to.be.true;
            expect(this.recordAtPage(1).isResolved).to.be.true;
            expect(this.recordAtPage(2)).to.be.empty;
          });
        });
        describe("rejecting all requests", function() {
          beforeEach(function(done) {
            this.server.requests.forEach((request) => request.reject());
            let finish = ()=> done();
            return Promise.all(this.server.requests).then(finish).catch(finish);
          });
          it("has two rejected pages", function() {
            expect(this.recordAtPage(0).isRejected).to.be.true;
            expect(this.recordAtPage(1).isRejected).to.be.true;
            expect(this.recordAtPage(2)).to.be.empty;
          });
        });
        describe("incrementing the readOffset to the next page", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(10);
            return this.server.resolveAll();
          });
          it("has three resolved pages", function() {
            expect(this.recordAtPage(0).isResolved).to.be.true;
            expect(this.recordAtPage(1).isResolved).to.be.true;
            expect(this.recordAtPage(2).isResolved).to.be.true;
          });
        });
        describe("decrementing the readOffset below 0", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(-5);
            return this.server.resolveAll();
          });
          it("sets the readOffset to 0", function () {
            expect(this.state.readOffset).to.equal(0);
          });
        });
      });
    });

    describe("setting readOffset to a large offset", function() {
      beforeEach(function() {
        this.initialReadOffset = 50;
      });
      describe("with less than one page loadHorizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 5;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
        });
        it("initializes six pages of records", function() {
          expect(this.state.length).to.equal(60);
        });
        it("has two pending pages", function() {
          expect(this.recordAtPage(3).isRequested).to.be.false;
          expect(this.recordAtPage(4).isPending).to.be.true;
          expect(this.recordAtPage(5).isPending).to.be.true;
          expect(this.recordAtPage(6)).to.be.empty;
        });
      });
      describe("with less than two page loadHorizon and unloadHorizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 15;
          this.options.unloadHorizon = 15;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
        });
        it("initializes seven pages of records", function() {
          expect(this.state.length).to.equal(70);
        });
        it("has four pending pages", function() {
          expect(this.recordAtPage(2).isRequested).to.be.false;
          expect(this.recordAtPage(3).isPending).to.be.true;
          expect(this.recordAtPage(4).isPending).to.be.true;
          expect(this.recordAtPage(5).isPending).to.be.true;
          expect(this.recordAtPage(6).isPending).to.be.true;
          expect(this.recordAtPage(7)).to.be.empty;
        });
        describe("incrementing the read offset to the next page before resolving any pages", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(60);
          });
          it("unloads a page", function() {
            expect(this.recordAtPage(3).isRequested).to.be.false;
          });
          it("has four pending pages", function() {
            expect(this.recordAtPage(4).isPending).to.be.true;
            expect(this.recordAtPage(5).isPending).to.be.true;
            expect(this.recordAtPage(6).isPending).to.be.true;
            expect(this.recordAtPage(7).isPending).to.be.true;
            expect(this.recordAtPage(8)).to.be.empty;
          });
        });

        describe("resolving all requests", function() {
          beforeEach(function() {
            return this.server.resolveAll();
          });
          it("has four resolved pages", function() {
            expect(this.recordAtPage(2).isRequested).to.be.false;
            expect(this.recordAtPage(3).isResolved).to.be.true;
            expect(this.recordAtPage(4).isResolved).to.be.true;
            expect(this.recordAtPage(5).isResolved).to.be.true;
            expect(this.recordAtPage(6).isResolved).to.be.true;
          });
          describe("incrementing the readOffset to the next page", function() {
            beforeEach(function() {
              this.prevRequest = this.server.requests[3];
              this.dataset.setReadOffset(60);
              return this.server.resolveAll();
            });
            it("unloads a page", function() {
              expect(this.recordAtPage(3).isRequested).to.be.false;
            });
            it("unfetches the unloaded page", function() {
              var unfetchedRequest = this.server.requests[3];
              expect(unfetchedRequest).to.be.empty;
              expect(this.prevRequest).to.not.be.empty;
            });
            it("has four resolved pages", function() {
              expect(this.recordAtPage(4).isResolved).to.be.true;
              expect(this.recordAtPage(5).isResolved).to.be.true;
              expect(this.recordAtPage(6).isResolved).to.be.true;
              expect(this.recordAtPage(7).isResolved).to.be.true;
              expect(this.recordAtPage(8)).to.be.empty;
            });
          });
          describe("decrementing the readOffset to the prev page", function() {
            beforeEach(function() {
              this.dataset.setReadOffset(40);
              return this.server.resolveAll();
            });
            it("unloads a page", function() {
              expect(this.recordAtPage(6).isRequested).to.be.false;
            });

            it("has four resolved pages", function() {
              expect(this.recordAtPage(2).isResolved).to.be.true;
              expect(this.recordAtPage(3).isResolved).to.be.true;
              expect(this.recordAtPage(4).isResolved).to.be.true;
              expect(this.recordAtPage(5).isResolved).to.be.true;
            });
          });
        });
      });
    });

    describe("Statistics ", function() {
      beforeEach(function() {
        this.server = new Server();
        this.numFetchedPages = function() {
          return this.server.requests.reduce(function(num, request) {
            return (request instanceof PageRequest) ? num + 1 : num;
          }, 0);
        };
      });

      describe("when fetch() returns totalPages", function() {
        beforeEach(function() {
          this.totalPages = 10;
          this.options = {
            pageSize: 10,
            fetch: (pageOffset, pageSize, stats) => {
              stats.totalPages = 10;
              return this.server.request(pageOffset, pageSize, stats);
            },
            unfetch: (records, pageOffset)=> {
              return this.server.remove(records, pageOffset);
            },
            observe: (state) => {
              this.state = state;
            }
          };
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(0);
        });

        it("makes one request", function() {
          expect(this.numFetchedPages()).to.equal(1);
        });

        describe("resolving the request with totalPages stats", function() {
          beforeEach(function() {
            return this.server.resolveAll();
          });

          it("sets total pages", function() {
            expect(this.state.stats.totalPages).to.equal(10);
            expect(this.state.length).to.equal(100);
          });

          describe("Setting readOffset out of bounds", function() {
            beforeEach(function() {
              this.prevRequestCount = this.server.requests.length;
            });
            describe("where the minimum loadHorizon is less than the dataset length", function() {
              beforeEach(function() {
                let minLoadHorizon = this.state.length - 1;
                this.dataset.setReadOffset(minLoadHorizon + this.state.loadHorizon);
              });
              it("makes one additional request", function() {
                expect(this.numFetchedPages()).to.equal(this.prevRequestCount + 1);
              });
              it("requests the last page", function() {
                expect(this.recordAtPage(9).isRequested).to.be.true;
              });
              it("does not have a record at the readOffset", function() {
                let record = this.dataset.state.get(100);
                expect(record).to.equal(null);
              });
              it("is in a pending state", function() {
                expect(this.state.isPending).to.be.true;
              });
            });
            describe("where the minimum loadHorizon is greater than or equal to the dataset length", function() {
              beforeEach(function() {
                let minLoadHorizon = this.state.length;
                this.dataset.setReadOffset(minLoadHorizon + this.state.loadHorizon);
              });

              it("does not make any additional request", function() {
                expect(this.numFetchedPages()).to.equal(this.prevRequestCount);
                expect(this.state.length).to.equal(100);
              });
              it("sets the readOffset at the out of bounds index", function() {
                expect(this.state.readOffset).to.equal(110);
              });
              it("is not in a pending state", function() {
                expect(this.state.isPending).to.be.false;
              });
            });
          });
        });

        describe("rejecting the request with totalPages stats", function() {
          beforeEach(function(done) {
            let finish = ()=> done();
            return this.server.requests[0].reject().then(finish).catch(finish);
          });

          it("sets the total pages", function() {
            expect(this.state.stats.totalPages).to.equal(10);
            expect(this.state.length).to.equal(100);
          });
        });
      });
    });
  });
});
