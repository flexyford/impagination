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
          pageSize: 1,
          fetch: function(pageOffset, pageSize){
            return new Ember.RSVP.Promise((resolve) => {
              var records = new Array(pageSize).fill(pageOffset + 1);
              resolve(records, pageOffset);
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
          var records = this.pages[pageOffset].records;
          return new Ember.RSVP.Promise((resolve) => {
            resolve(records);
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
          expect(this.dataset.state.pages).to.be.instanceOf(Array);
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
          expect(beforeOffsetResolvedPages.records.length).to.equal(this.recordsPerPage);
          expect(beforeOffsetResolvedPages.records[0].name).to.equal('Record 10');
        });

        it('loads a single page of records after the offset', function () {
          var afterOffsetResolvedPages = this.dataset.state.pages[2];
          expect(afterOffsetResolvedPages.records.length).to.equal(this.recordsPerPage);
          expect(afterOffsetResolvedPages.records[0].name).to.equal('Record 20');
        });

        describe("loading the next page", function() {
          beforeEach(function() {
            this.dataset.setReadOffset(3);
          });
          it("does not unload the second page", function() {
            var unrequestedPage = this.dataset.state.pages[0];
            expect(unrequestedPage.isRequested).to.be.false;
            var loadedPage = this.dataset.state.pages[1];
            expect(loadedPage.isRequested).to.be.true;
          });

          it('loads a single page of records before the offset', function () {
            var beforeOffsetResolvedPages = this.dataset.state.pages[2];
            expect(beforeOffsetResolvedPages.records.length).to.equal(this.recordsPerPage);
            expect(beforeOffsetResolvedPages.records[0].name).to.equal('Record 20');
          });

          it('loads a single page of records after the offset', function () {
            var afterOffsetResolvedPages = this.dataset.state.pages[3];
            expect(afterOffsetResolvedPages.records.length).to.equal(this.recordsPerPage);
            expect(afterOffsetResolvedPages.records[0].name).to.equal('Record 30');
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
