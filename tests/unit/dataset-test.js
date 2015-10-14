/*global it, xit, describe, beforeEach, afterEach, xdescribe */
/*jshint -W030 */ // Expected an assignment or function call and instead saw an expression

import Dataset from 'dataset/dataset';

import Ember from 'ember';
import { it } from 'ember-mocha';
import { describe } from 'mocha';
import { expect } from 'chai';
import Server from 'ember-cli-mirage/server';
import Factory from 'ember-cli-mirage/factory';

describe("Dataset", function() {
  beforeEach(function () {
    // Create Ember-Cli Server and Factories
    this.server = new Server({environment: 'test'});
    server.loadFactories({
      record: Factory.extend({
        name(i) { return `Record ${i}`; }
      }),
      page: Factory.extend({
        name(i) { return `Page ${i}`; },
        records: []
      })
    });
  });
  afterEach(function() {
    this.server.shutdown();
  });

  it("exists", function() {
    expect(Dataset).to.be.instanceOf(Object);
  });

  xit('works with asynchronous tests using promises', function() {
    return new Ember.RSVP.Promise(function(resolve) {
      setTimeout(function() {
        expect(true).to.equal(true);
        resolve();
      }, 10);
    });
  });

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

    describe("default constructor values", function() {
      beforeEach(function() {
        this.dataset = new Dataset({
          pageSize: 10,
          fetch: function(pageOffset){
            var data = {
              records: new Array(10).fill(pageOffset + 1)
            };
            return new Ember.RSVP.Promise((resolve) => {
              resolve(data);
            });
          }
        });
      });

      it("has default constructor values", function() {
        expect(this.dataset._fetch).to.be.instanceOf(Function);
        expect(this.dataset._observe).to.be.instanceOf(Function);
        expect(this.dataset._loadHorizon).to.equal(1);
        expect(this.dataset._unloadHorizon).to.equal(Infinity);
      });

      it("initializes the state", function() {
        expect(this.dataset.state).to.be.instanceOf(Object);
        expect(this.dataset.state.totalSize).to.equal(0);
      });
    });
  });

  describe("thenables", function () {
    beforeEach(function() {
      this.recordsPerPage = 10;
      this.resolvers = [];
      this.rejecters = [];

      this.options = {
        pageSize: this.recordsPerPage,
        fetch: () => {
          return new Ember.RSVP.Promise((resolve, reject) => {
            this.resolvers.push(resolve);
            this.rejecters.push(reject);
          });
        }
      };
      this.dataset = new Dataset(this.options);
    });

    it("captures the resolve", function() {
      var resolve = this.resolvers[0];
      expect(resolve.name).to.equal('resolvePromise');
    });

    it("captures the reject", function() {
      var resolve = this.rejecters[0];
      expect(resolve.name).to.equal('rejectPromise');
    });

    describe("resolving a fetched page", function() {
      beforeEach(function() {
        var data = {
          records: this.server.createList('record', this.recordsPerPage)
        };
        this.resolvers.forEach(function(resolve) {
          resolve(data);
        });
      });
      it('loads a single page', function () {
        expect(this.dataset.state.pages.length).to.equal(1);
      });
      it('loads a single page of records', function () {
        var page = this.dataset.state.pages[0];
        expect(page.records.length).to.equal(this.recordsPerPage);
        expect(page.records[0].name).to.equal('Record 0');
      });
    });

    describe("rejecting a fetched page", function() {
      beforeEach(function() {
        this.rejecters.forEach(function(reject) {
          reject();
        });
      });
      it("does not load a single page", function() {
        expect(this.dataset.state.pages.length).to.equal(0);
      });
    });
  });

  describe("loading pages", function() {
    beforeEach(function() {
      this.totalPages = 5;
      this.recordsPerPage = 10;
      this.pages = [];

      for(var i = 0; i < this.totalPages; i+=1){
        var records = this.server.createList('record', this.recordsPerPage);
        this.pages.push( this.server.create('page', {records: records}) );
      }

      this.options = {
        pageSize: this.recordsPerPage,
        fetch: (pageOffset) => {
          var data = {
            records: this.pages[pageOffset].records
          };
          return new Ember.RSVP.Promise((resolve) => {
            resolve(data);
          });
        }
      };
    });

    describe("setting the loadHorizon", function() {
      beforeEach(function() {
        this.options.loadHorizon = 2;
        this.dataset = new Dataset(this.options);
      });
      it("sets the loadHorizon", function () {
        expect(this.dataset._loadHorizon).to.equal(2);
      });
    });

    describe("setting the unloadHorizon", function() {
      beforeEach(function () {
        this.options.unloadHorizon = 3;
        this.dataset = new Dataset(this.options);
      });
      it("sets the unloadHorizon", function () {
        expect(this.dataset._unloadHorizon).to.equal(3);
      });
    });

    describe("start loading from the beginning", function() {
      describe("with a single page load horizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 1;
          this.dataset = new Dataset(this.options);
        });

        it('loads a single page', function () {
          expect(this.dataset.state.pages.length).to.equal(1);
        });

        it('loads a single page of records', function () {
          var page = this.dataset.state.pages[0];
          expect(page.records).to.be.instanceOf(Array);
          expect(page.records.length).to.equal(this.recordsPerPage);
          expect(page.records[0].name).to.equal('Record 0');
        });

        describe("loading the next page", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(1);
          });
          it("loads an additional page", function() {
            expect(this.dataset.state.pages.length).to.equal(2);
          });
        });
      });
    });

    describe("start loading from the middle", function() {
      describe("with a single page load horizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 1;
          this.options.initialReadOffset = 2;
          this.dataset = new Dataset(this.options);
        });

        it('initializes all pages up to the loadHorizon', function () {
          expect(this.dataset.state.pages.length).to.equal(3);
        });

        it('loads page 0 as an unrequested page', function () {
          var unrequestedPage = this.dataset.state.pages[0];
          expect(unrequestedPage.isRequested).to.be.false;
        });

        it('loads two resolved pages', function () {
          var resolvedPages = this.dataset.state.pages.slice(1,3);
          expect(resolvedPages[0].isResolved).to.be.true;
          expect(resolvedPages[1].isResolved).to.be.true;
        });

        it("has an empty set of records on the first page", function() {
          var unrequestedPage = this.dataset.state.pages[0];
          expect(unrequestedPage.records.length).to.equal(10);
          expect(unrequestedPage.records[0]).to.be.empty;
        });

        it('loads a single page of records before the offset', function () {
          var beforeOffsetResolvedPages = this.dataset.state.pages[1];
          expect(beforeOffsetResolvedPages.records.length).to.equal(this.recordsPerPage);
          expect(beforeOffsetResolvedPages.records[0].name).to.equal('Record 10');
        });

        it('loads a single page of records after the offset', function () {
          var afterOffsetResolvedPages = this.dataset.state.pages[2];
          expect(afterOffsetResolvedPages.records.length).to.equal(this.recordsPerPage);
          expect(afterOffsetResolvedPages.records[0].name).to.equal('Record 20');
        });
      });

      describe("with a single page unload horizon", function() {
        beforeEach(function() {
          this.options.loadHorizon = 1;
          this.options.unloadHorizon = 2;
          this.options.initialReadOffset = 2;
          this.dataset = new Dataset(this.options);
        });

        it("does not have data defined on the first page", function() {
          var unrequestedPage = this.dataset.state.pages[0];
          expect(unrequestedPage.records.length).to.equal(10);
          expect(unrequestedPage.records[0]).to.be.empty;
        });

        it('loads a single page of records before the offset', function () {
          var beforeOffsetResolvedPages = this.dataset.state.pages[1];
          expect(beforeOffsetResolvedPages.isRequested).to.be.true;
          expect(beforeOffsetResolvedPages.records[0].name).to.equal('Record 10');
        });

        it('loads a single page of records after the offset', function () {
          var afterOffsetResolvedPages = this.dataset.state.pages[2];
          expect(afterOffsetResolvedPages.isRequested).to.be.true;
          expect(afterOffsetResolvedPages.records[0].name).to.equal('Record 20');
        });

        describe("incrementing the readOffset", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(4);
          });

          it("unloads the page before the previous offset", function() {
            var unrequestedPage = this.dataset.state.pages[1];
            expect(unrequestedPage.isRequested).to.be.false;
          });

          it("does not unload the page before the current offset", function() {
            var loadedPage = this.dataset.state.pages[2];
            expect(loadedPage.isRequested).to.be.true;
          });

          it('loads a single page of records before the offset', function () {
            var beforeOffsetResolvedPages = this.dataset.state.pages[3];
            expect(beforeOffsetResolvedPages.isRequested).to.be.true;
            expect(beforeOffsetResolvedPages.records[0].name).to.equal('Record 30');
          });

          it('loads a single page of records after the offset', function () {
            var afterOffsetResolvedPages = this.dataset.state.pages[4];
            expect(afterOffsetResolvedPages.isRequested).to.be.true;
            expect(afterOffsetResolvedPages.records[0].name).to.equal('Record 40');
          });
        });
        describe("decrementing the readOffset", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(0);
          });
          it("unloads the page after the previous offset", function() {
            var unrequestedPage = this.dataset.state.pages[2];
            expect(unrequestedPage.isRequested).to.be.false;
          });

          it("does not unload the page after the current offset", function() {
            var loadedPage = this.dataset.state.pages[1];
            expect(loadedPage.isRequested).to.be.true;
          });

          it('loads a single page of records before the offset', function () {
            var beforeOffsetResolvedPages = this.dataset.state.pages[0];
            expect(beforeOffsetResolvedPages.records.length).to.equal(this.recordsPerPage);
            expect(beforeOffsetResolvedPages.records[0].name).to.equal('Record 0');
          });

          it('loads a single page of records after the offset', function () {
            var afterOffsetResolvedPages = this.dataset.state.pages[1];
            expect(afterOffsetResolvedPages.records.length).to.equal(this.recordsPerPage);
            expect(afterOffsetResolvedPages.records[0].name).to.equal('Record 10');
          });
        });
      });
    });

    describe("not resolving a fetched page", function() {
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
            return new Ember.RSVP.Promise((resolve) => {
              this.resolvers.push(resolve);
            });
          }
        };
        this.dataset = new Dataset(this.options);
      });

      xit("captures the resolve", function() {
        var resolve = this.resolvers[0];
        expect(resolve.name).to.equal('resolvePromise');
      });

      it("leaves the first page in a pending state", function() {
        var page = this.dataset.state.pages[0];
        expect(page.isPending).to.be.true;
      });

      describe("advancing the readOffset past the pending pages unloadHorizon", function() {
        beforeEach(function() {
          this.dataset.setReadOffset(2);
        });

        it("unloads the pending page", function () {
          var page = this.dataset.state.pages[0];
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
              this.changedStatePage = this.dataset.state.pages.slice(0,1);
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
              this.sameStatePages = this.dataset.state.pages.slice(1,3);
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

    describe("setting totalPages in statistics", function() {
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
          initialReadOffset: 1,
          loadHorizon: 2,
          fetch: () => {
            return new Ember.RSVP.Promise((resolve) => {
              this.resolvers.push(resolve);
            });
          }
        };
        this.dataset = new Dataset(this.options);
      });

      describe("resolving the first page", function() {
        beforeEach(function() {
          var data = {
            records: this.server.createList('record', this.recordsPerPage),
            stats: {
              totalPages: 10
            }
          };
          var resolve = this.resolvers.shift();
          resolve(data);
        });

        it("initializes the dataset to the specified number of pages", function() {
          expect(this.dataset.state.pages.length).to.equal(10);
        });

        describe("increasing the totalPages", function() {
          beforeEach(function() {
            var data = {
              records: this.server.createList('record', this.recordsPerPage),
              stats: {
                totalPages: 15
              }
            };
            var resolve = this.resolvers.shift();
            resolve(data);
          });

          it("increases the dataset to the specified number of pages", function() {
            expect(this.dataset.state.pages.length).to.equal(15);
          });

          describe("decreasing the totalPages", function() {
            beforeEach(function() {
              var data = {
                records: this.server.createList('record', this.recordsPerPage),
                stats: {
                  totalPages: 5
                }
              };
              var resolve = this.resolvers.shift();
              resolve(data);
            });

            it("decreases the dataset to the specified number of pages", function() {
              expect(this.dataset.state.pages.length).to.equal(5);
            });
          });
        });
      });
    });

    xdescribe("with no fetch function", function() {
      it("emits an observation of the state");
      it("indicates that the dataset is not doing any loading");
    });

    xdescribe("with a fetch function and the default load horizon", function() {
      it("requests the first page");
      it("now has a requested page");
      it("indicates that the dataset is now loading");
      it("indicates that the first page is loading");
      describe("when the first page resolves", function() {
        it("integrates the statistics");
        it("reflects the total number of records");
        it("reflects the total number of pages");
        it("indicates that the dataset is no longer loading");
        it("indicates that the page is no longer loading");
        it("contains empty objects for the items that have not even been requested");
        it("contains unequested pages for the pages that have not been requested");
      });
    });

    afterEach(function() {
      delete this.dataset;
      delete this.model;
      delete this.fetches;
    });
  });
});
