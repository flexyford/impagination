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
        expect(this.dataset._observe).to.be.instanceOf(Function);
      });

      it("initializes the state", function() {
        expect(this.dataset.state).to.be.instanceOf(Object);
        expect(this.dataset.state.length).to.equal(0);
        expect(this.dataset.state.loadHorizon).to.equal(10);
        expect(this.dataset.state.unloadHorizon).to.equal(Infinity);
      });

      it("does not request a page fetch", function() {
        expect(this.server.requests.length).to.equal(0);
      });

      describe("requesting a page", function() {
        beforeEach(function() {
          this.dataset.setReadOffset(0);
        });
        it("begins the process of fetching a page", function() {
          expect(this.server.requests.length).to.equal(1);
          expect(this.server.requests[0]).to.be.instanceOf(PageRequest);
          expect(this.dataset.state.length).to.equal(10);
        });
        it("has a set of records", function() {
          let record = this.dataset.state.get(0);
          expect(record).to.be.instanceOf(Object);
          expect(record.isRequested).to.be.true;
          expect(record.index).to.equal(0);
          expect(record.page.offset).to.equal(0);
          expect(record.content).to.be.empty;
        });
      });
    });
  });

  describe("thenables", function() {
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
    describe("resolving a fetched page", function() {
      beforeEach(function() {
        let records = Array.from(Array(10)).map((_, i)=> {
          return {name: `Record ${i}`};
        });
        return this.requests[0].resolve(records);
      });
      it("transitions state", function() {
        expect(this.state).not.to.equal(this.initialState);
      });
      it('loads a single page', function () {
        expect(this.state.pages.length).to.equal(1);
        expect(this.state.pages[0].isResolved).to.be.true;
      });
      it('loads a single page of records', function () {
        var record_0 = this.state.get(0);
        var record_10 = this.state.get(10);
        expect(record_0).to.exist;
        expect(record_10).to.not.exist;
      });
    });

    describe("rejecting a fetch page", function() {
      beforeEach(function(done) {
        let request = this.requests[0];
        request.stats.totalPages = 5;
        request.reject().then(done).catch(done);
      });
      it("transitions state", function() {
        expect(this.state).not.to.equal(this.initialState);
      });
      it("loads the totalPages", function() {
        expect(this.state.pages.length).to.equal(5);
      });
      it("marks the page as rejected", function() {
        var page = this.state.pages[0];
        expect(page.isRejected).to.be.true;
      });
    });

    describe("without totalPages stats", function() {
      beforeEach(function(done) {
        var request = this.server.requests[0];
        return request.reject().then(done).catch(done);
      });
      it("transitions state", function() {
        expect(this.state).not.to.equal(this.initialState);
      });
      it('loads a single page', function () {
        expect(this.state.pages.length).to.equal(1);
      });
      it("marks the page as rejected", function() {
        var page = this.state.pages[0];
        expect(page.isRejected).to.be.true;
      });
    });

    describe("with an error", function() {
      beforeEach(function(done) {
        var request = this.server.requests[0];
        let finish = ()=> done();
        return request.reject("404").then(finish).catch(finish);
      });
      it("has an error message on the page", function() {
        var page = this.state.pages[0];
        expect(page.error).to.equal("404");
      });
    });
  });

  describe("loading pages", function() {
    beforeEach(function() {
      this.totalPages = 5;
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

    describe("setting the loadHorizon", function() {
      beforeEach(function() {
        this.options.loadHorizon = 2;
        this.dataset = new Dataset(this.options);
        this.dataset.setReadOffset(0);
      });
      it("sets the loadHorizon", function () {
        expect(this.dataset.state.loadHorizon).to.equal(2);
      });
    });

    describe("setting the unloadHorizon", function() {
      beforeEach(function () {
        this.options.unloadHorizon = 3;
        this.dataset = new Dataset(this.options);
        this.dataset.setReadOffset(0);
      });
      it("sets the unloadHorizon", function () {
        expect(this.dataset.state.unloadHorizon).to.equal(3);
      });
    });

    describe("loading records", function() {
      describe("with a single page load horizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 1 * this.recordsPerPage;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(0);
        });
        it('loads a single page', function () {
          expect(this.state.pages.length).to.equal(1);
        });

        it('loads a single page of records', function () {
          expect(this.state.length).to.equal(this.recordsPerPage);
        });

        describe("at the same readOffset", function() {
          beforeEach(function() {
            this.prevState = this.state;
            this.dataset.setReadOffset(0);
          });
          it("does not change state", function() {
            expect(this.state).to.equal(this.prevState);
          });
        });

        describe("at an incremented readOffset within the same page", function() {
          beforeEach(function() {
            this.prevState = this.state;
            this.dataset.setReadOffset(1);
          });
          it("does change state", function() {
            expect(this.state).not.to.equal(this.prevState);
          });
          it("loads an additional page", function() {
            expect(this.state.length).to.equal(2 * this.recordsPerPage);
          });
        });
      });

    });

    describe("start loading from the beginning", function() {
      describe("with a single page load horizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 1 * this.recordsPerPage;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(0);
          return this.server.requests[0].resolve();
        });

        it('loads a single page', function () {
          expect(this.state.pages.length).to.equal(1);
        });

        it('loads a single page of records', function () {
          var record_0 = this.state.get(0);
          var record_10 = this.state.get(10);
          expect(record_0).to.exist;
          expect(record_10).to.not.exist;
        });

        describe("loading the next page", function() {
          beforeEach(function() {
            var nextPageOffset = this.recordsPerPage;
            this.dataset.setReadOffset(nextPageOffset);
          });
          it("loads an additional page", function() {
            expect(this.state.pages.length).to.equal(2);
          });
        });
      });
    });

    describe("start loading from the middle", function() {
      describe("with a single page load horizon", function() {
        beforeEach(function() {
          var middlePageOffset = 2 * this.recordsPerPage;
          this.options.loadHorizon = 1 * this.recordsPerPage;
          this.initialReadOffset = middlePageOffset;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
          return this.server.resolveAll();
        });

        it('initializes all pages up to the loadHorizon', function () {
          expect(this.state.pages.length).to.equal(3);
          expect(this.state.length).to.equal(30);
        });

        it('loads page 0 as an unrequested page', function () {
          var unrequestedPage = this.state.pages[0];
          expect(unrequestedPage.isRequested).to.be.false;
        });

        it('loads two resolved pages', function () {
          var resolvedPages = this.state.pages.slice(1,3);
          expect(resolvedPages[0].isResolved).to.be.true;
          expect(resolvedPages[1].isResolved).to.be.true;
        });

        it("has an empty set of records on the first page", function() {
          let record = this.dataset.state.get(0);
          expect(record.isRequested).to.be.false;
          expect(record.index).to.equal(0);
          expect(record.page.offset).to.equal(0);
          expect(record.content).to.be.empty;
        });

        it('loads a single page of records before the offset', function () {
          let index = this.initialReadOffset - this.recordsPerPage;
          var record = this.state.get(index);
          expect(record.isResolved).to.be.true;
          expect(record.index).to.equal(0);
          expect(record.page.offset).to.equal(1);
          expect(record.content.name).to.equal('Record 10');
        });

        it('loads a single page of records at the offset', function () {
          let index = this.initialReadOffset;
          var record = this.state.get(index + 1);
          expect(record).to.exist;
          expect(record.index).to.equal(1);
          expect(record.page.offset).to.equal(2);
          expect(record.content.name).to.equal('Record 21');
        });
      });

      describe("with a two page unload horizon", function() {
        beforeEach(function() {
          var middlePageOffset = 2 * this.recordsPerPage;
          this.options.loadHorizon = 1 * this.recordsPerPage;
          this.options.unloadHorizon = 2 * this.recordsPerPage;
          this.initialReadOffset = middlePageOffset;
          this.dataset = new Dataset(this.options);
          this.dataset.setReadOffset(this.initialReadOffset);
          return this.server.resolveAll();
        });

        it('initializes all pages up to the loadHorizon', function () {
          expect(this.state.pages.length).to.equal(3);
        });

        it("has an empty set of record on the first page", function() {
          var record = this.state.get(0);
          expect(record).to.exist;
          expect(record.index).to.equal(0);
          expect(record.page.offset).to.equal(0);
          expect(record.content).to.be.empty;
        });

        it('loads a single page of records before the offset', function () {
          var beforeOffsetResolvedPages = this.state.pages[1];
          var record = this.state.get(10);
          expect(beforeOffsetResolvedPages.isRequested).to.be.true;
          expect(record.isRequested).to.be.true;
          expect(record.page.offset).to.equal(1);
          expect(record.content).not.to.be.empty;
          expect(record.content.name).to.equal('Record 10');
        });

        it('loads a single page of records after the offset', function () {
          var afterOffsetResolvedPages = this.state.pages[2];
          var record = this.state.get(20);
          expect(afterOffsetResolvedPages.isRequested).to.be.true;
          expect(record.content.name).to.equal('Record 20');
        });

        describe("incrementing the readOffset by the unload horizon", function() {
          beforeEach(function() {
            var incPageOffset = this.initialReadOffset + this.options.unloadHorizon;
            this.dataset.setReadOffset(incPageOffset);
            return this.server.resolveAll();
          });

          it('initializes all pages up to the loadHorizon', function () {
            expect(this.state.pages.length).to.equal(5);
            expect(this.state.length).to.equal(50);
          });

          it("unloads the resolved page before the previous offset", function() {
            var unrequestedPage = this.state.pages[1];
            expect(unrequestedPage.isRequested).to.be.false;
          });

          it("unfetches the unloaded page", function() {
            var unfetchedRequest = this.server.requests[1];
            expect(unfetchedRequest).to.be.empty;
          });

          it("does not unload the page before the offset", function() {
            var loadedPage = this.state.pages[2];
            expect(loadedPage.isRequested).to.be.true;
          });

          it("does not unfetch the requested page", function() {
            var unfetchedRequest = this.server.requests[2];
            expect(unfetchedRequest).to.not.be.empty;
          });

          it('loads a single page of records at the offset', function () {
            var beforeOffsetResolvedPages = this.state.pages[3];
            var record = this.state.get(30);
            expect(beforeOffsetResolvedPages.isRequested).to.be.true;
            expect(record.content.name).to.equal('Record 30');
          });

          it('loads a single page of records after the offset', function () {
            var afterOffsetResolvedPages = this.state.pages[4];
            var record = this.state.get(40);
            expect(afterOffsetResolvedPages.isRequested).to.be.true;
            expect(record.content.name).to.equal('Record 40');
          });
        });

        describe("incrementing the readOffset such that the load horizon extends into an unrequested page", function() {
          beforeEach(function() {
            var incPageOffset = this.initialReadOffset + 1;
            this.dataset.setReadOffset(incPageOffset);
            return this.server.resolveAll();
          });

          it('initializes all pages up to the loadHorizon', function () {
            expect(this.state.pages.length).to.equal(4);
          });

          it('loads a single page of records before the offset', function () {
            var beforeOffsetResolvedPages = this.state.pages[1];
            var record = this.state.get(10);
            expect(beforeOffsetResolvedPages.isRequested).to.be.true;
            expect(record.content.name).to.equal('Record 10');
          });

          it('loads a single page of records at the offset', function () {
            var atOffsetResolvedPages = this.state.pages[2];
            var record = this.state.get(20);
            expect(atOffsetResolvedPages.isRequested).to.be.true;
            expect(record.content.name).to.equal('Record 20');
          });

          it('loads a single page of records after the offset', function () {
            var afterOffsetResolvedPages = this.state.pages[3];
            var record = this.state.get(30);
            expect(afterOffsetResolvedPages.isRequested).to.be.true;
            expect(record.content.name).to.equal('Record 30');
          });
        });

        describe("decrementing the readOffset such that the load horizon extends into an unrequested page", function() {
          beforeEach(function() {
            var incPageOffset = this.initialReadOffset - 1;
            this.dataset.setReadOffset(incPageOffset);
            return this.server.resolveAll();
          });

          it('initializes all pages up to the loadHorizon', function () {
            expect(this.state.pages.length).to.equal(3);
          });

          it('loads a single page of records before the offset', function () {
            var beforeOffsetResolvedPages = this.state.pages[0];
            var record = this.state.get(0);
            expect(beforeOffsetResolvedPages.isRequested).to.be.true;
            expect(record).to.not.be.empty;
          });

          it('loads a single page of records at the offset', function () {
            var atOffsetResolvedPages = this.state.pages[1];
            var record = this.state.get(10);
            expect(atOffsetResolvedPages.isRequested).to.be.true;
            expect(record).to.not.be.empty;
          });

          it('loads a single page of records after the offset', function () {
            var afterOffsetResolvedPages = this.state.pages[2];
            var record = this.state.get(20);
            expect(afterOffsetResolvedPages.isRequested).to.be.true;
            expect(record).to.not.be.empty;
          });
        });

        describe("decrementing the readOffset by the unload horizon", function() {
          beforeEach(function() {
            var decPageOffset = this.initialReadOffset - this.options.unloadHorizon;
            this.dataset.setReadOffset(decPageOffset);
            return this.server.resolveAll();
          });
          it("unloads the page after the previous offset", function() {
            var unrequestedPage = this.state.pages[2];
            expect(unrequestedPage.isRequested).to.be.false;
          });

          it("does not unload the page after the current offset", function() {
            var loadedPage = this.state.pages[1];
            expect(loadedPage.isRequested).to.be.true;
          });

          it('loads a single page of records before the offset', function () {
            var record = this.state.get(0);
            expect(record).to.not.be.empty;
          });

          it('loads a single page of records after the offset', function () {
            var record = this.state.get(10);
            expect(record).to.not.be.empty;
          });
        });
      });

      describe.skip("the end of total pages", function() {
        beforeEach(function() {
          this.options.fetch = (pageOffset, pageSize, stats) => {
            var records,
                _this = this;
            if(pageOffset < _this.totalPages){
              records = this.pages[pageOffset].records;
            } else {
              stats.totalPages = _this.totalPages;
            }
            return new Promise((resolve, reject) => {
              if(pageOffset < _this.totalPages){
                resolve(records);
              } else {
                reject();
              }
            });
          };
        });

        describe("setting the read head at the total page boundary", function() {
          beforeEach(function() {
            var offset = this.totalPages * this.recordsPerPage;
            this.initialReadOffset = offset;
          });

          describe("with a single page load horizon", function() {
            beforeEach(function() {
              this.options.loadHorizon = 1 * this.recordsPerPage;
              this.dataset = new Dataset(this.options);
              this.dataset.setReadOffset(this.initialReadOffset);
            });

            it('initializes only pages up to the total number of pages', function () {
              expect(this.state.pages.length).to.equal(this.totalPages);
            });

            it('loads unrequested pages before the load Horizon', function () {
              var unrequestedPages = this.state.pages.slice(0, this.totalPages - 1);
              unrequestedPages.forEach(function (unrequestedPage) {
                expect(unrequestedPage.isRequested).to.be.false;
              });
            });

            it('loads one resolved page within the loadHorizon', function () {
              var resolvedPages = this.state.pages.slice(this.initialReadOffset - this.options.loadHorizon, this.totalPages);
              resolvedPages.forEach(function (resolvedPage) {
                expect(resolvedPage.isResolved).to.be.true;
              });
            });
          });
        });

        describe("setting the read head one past the total page boundary", function() {
          beforeEach(function() {
            this.initialPageOffset = this.totalPages + 1;
            var offset = this.initialPageOffset * this.recordsPerPage;
            this.initialReadOffset = offset;
          });

          describe("when reject() returns the total number of pages", function() {
            beforeEach(function() {
              this.options.fetch = (pageOffset, pageSize, stats) => {
                var records,
                    _this = this;
                if(pageOffset < _this.totalPages){
                  records = this.pages[pageOffset].records;
                } else {
                  stats.totalPages = _this.totalPages;
                }
                return new Promise((resolve, reject) => {
                  if(pageOffset < _this.totalPages){
                    resolve(records);
                  } else {
                    reject();
                  }
                });
              };
            });

            describe("with a single page load horizon", function() {
              beforeEach(function() {
                this.options.loadHorizon = 1;
                this.dataset = new Dataset(this.options);
                this.dataset.setReadOffset(0);
              });

              it('initializes only pages up to the total number of pages', function () {
                expect(this.state.pages.length).to.equal(this.totalPages);
              });

              it('loads unrequested pages throughout the dataset', function () {
                var pages = this.state.pages;
                var unrequestedPages = this.state.pages.slice(0, pages.length);
                unrequestedPages.forEach(function (unrequestedPage) {
                  expect(unrequestedPage.isRequested).to.be.false;
                });
              });
            });
          });

          describe("when reject() does not return the total number of pages", function() {
            beforeEach(function() {
              this.options.fetch = (pageOffset) => {
                var records,
                    _this = this;
                if(pageOffset < _this.totalPages){
                  records = this.pages[pageOffset].records;
                }
                return new Promise((resolve, reject) => {
                  if(pageOffset < _this.totalPages){
                    resolve(records);
                  } else {
                    reject();
                  }
                });
              };
            });

            describe("with a single page load horizon", function() {
              beforeEach(function() {
                this.options.loadHorizon = 1;
                this.dataset = new Dataset(this.options);
                this.dataset.setReadOffset(0);
              });

              it('initializes pages up to and including the requested offset', function () {
                expect(this.state.pages.length).to.equal(this.initialPageOffset + this.options.loadHorizon);
              });

              it('loads unrequested pages before the load Horizon', function () {
                var unrequestedPages = this.state.pages.slice(0, this.initialPageOffset - this.options.loadHorizon);
                unrequestedPages.forEach(function (unrequestedPage) {
                  expect(unrequestedPage.isRequested).to.be.false;
                });
              });

              it('loads one resolved page within the loadHorizon', function () {
                var resolvedPages = this.state.pages.slice(this.initialReadOffset - this.options.loadHorizon, this.totalPages);
                resolvedPages.forEach(function (resolvedPage) {
                  expect(resolvedPage.isResolved).to.be.true;
                });
              });
            });
          });
        });
      });
    });

    describe.skip("not resolving a fetched page", function() {
      beforeEach(function() {
        this.totalPages = 5;
        this.recordsPerPage = 10;
        this.pages = [];
        this.resolvers = [];

        for(var i = 0; i < this.totalPages; i+=1){
          var records = this.server.createList('record', this.recordsPerPage);
          this.pages.push( this.server.create('page', {records: records}) );
        }

        this.options = {
          pageSize: this.recordsPerPage,
          loadHorizon: 1,
          unloadHorizon: 1,
          fetch: () => {
            return new Promise((resolve) => {
              this.resolvers.push(resolve);
            });
          },
          observe: (state) => { this.state = state; }
        };
        this.dataset = new Dataset(this.options);
        this.dataset.setReadOffset(0);
      });

      it.skip("captures the resolve", function() {
        var resolve = this.resolvers[0];
        expect(resolve.name).to.equal('resolvePromise');
      });

      it.skip("leaves the first page in a pending state", function() {
        var page = this.state.pages[0];
        expect(page.isPending).to.be.true;
      });

      describe("advancing the readOffset past the pending pages unloadHorizon", function() {
        beforeEach(function() {
          var offset = 2 * this.recordsPerPage;
          this.dataset.setReadOffset(offset);
        });

        it("unloads the pending page", function () {
          var page = this.state.pages[0];
          expect(page.isRequested).to.be.false;
          expect(page.isPending).to.be.false;
        });

        describe("resolving all pages", function() {
          beforeEach(function() {
            var data = {
              records: this.server.createList('record', this.recordsPerPage)
            };
            this.resolvers.forEach(function(resolve) {
              resolve(data);
            });
          });

          describe("the pages which did change state since last fetch request", function() {
            beforeEach(function() {
              this.changedStatePage = this.state.pages.slice(0,1);
            });

            it("are not resolved", function () {
              this.changedStatePage.forEach(function (page) {
                expect(page.isResolved).to.be.false;
              });
            });
            it("remain unrequested", function () {
              this.changedStatePage.forEach(function (page) {
                expect(page.isRequested).to.be.false;
              });
            });
          });

          describe("the pages which did not change state since last fetch request", function() {
            beforeEach(function() {
              this.sameStatePages = this.state.pages.slice(1,3);
            });

            it("are resolved pages", function () {
              this.sameStatePages.forEach(function (page) {
                expect(page.isResolved).to.be.true;
              });
            });
          });
        });
      });
    });

    describe.skip("setting totalPages in statistics", function() {
      beforeEach(function() {
        this.totalPages = 5;
        this.recordsPerPage = 10;
        this.pages = [];
        this.resolvers = [];
        this.rejecters = [];

        for(var i = 0; i < this.totalPages; i+=1){
          var records = this.server.createList('record', this.recordsPerPage);
          this.pages.push( this.server.create('page', {records: records}) );
        }

        var initialRecordOffset = this.recordsPerPage;
        this.options = {
          pageSize: this.recordsPerPage,
          loadHorizon: 2,
          fetch: (pageOffset, pageSize, stats) => {
            return new Promise((resolve, reject) => {
              this.resolvers.push({
                resolve: resolve,
                pageOffset: pageOffset,
                stats: stats
              });
              this.rejecters.push({
                reject: reject,
                pageOffset: pageOffset,
                stats: stats
              });
            });
          },
          observe: (state) => { this.state = state; }
        };
        this.dataset = new Dataset(this.options);
        this.dataset.setReadOffset(initialRecordOffset);
      });

      describe("resolving the first page with 10 pages", function() {
        beforeEach(function() {
          var records = this.server.createList('record', this.recordsPerPage);
          var obj = this.resolvers.shift();
          obj.stats.totalPages = 10;
          obj.resolve(records);
        });

        it("initializes the dataset to the specified number of pages", function() {
          expect(this.state.pages.length).to.equal(10);
        });

        describe("increasing the totalPages to 15", function() {
          beforeEach(function() {
            var records = this.server.createList('record', this.recordsPerPage);
            var obj = this.resolvers.shift();
            obj.stats.totalPages = 15;
            obj.resolve(records);
          });

          it("increases the dataset to the specified number of pages", function() {
            expect(this.state.pages.length).to.equal(15);
          });

          describe("decreasing the totalPages", function() {
            beforeEach(function() {
              var records = this.server.createList('record', this.recordsPerPage);
              var obj = this.resolvers.shift();
              obj.stats.totalPages = 5;
              obj.resolve(records);
            });

            it("decreases the dataset to the specified number of pages", function() {
              expect(this.state.pages.length).to.equal(5);
            });
          });
        });
      });
    });
  });
});
