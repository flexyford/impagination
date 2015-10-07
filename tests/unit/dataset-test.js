/*global it, xit, describe, beforeEach, afterEach, xdescribe */

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

      describe("initial state", function() {
        it("initializes the state", function() {
          expect(this.dataset.state).to.be.instanceOf(Object);
          expect(this.dataset.state.totalSize).to.equal(0);
        });
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
          expect(page.data.length).to.equal(this.recordsPerPage);
          expect(page.data[0].name).to.equal('Record 0');
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

      describe("with a single page unload horizon", function() {

      });
    });

    describe("start loading from the middle", function() {
      beforeEach(function() {
        this.options.loadHorizon = 1;
        this.options.initialReadOffset = 2;
        this.dataset = new Dataset(this.options);
      });

      it("starts loading from the current offset", function() {
        expect(this.dataset.state.pages.length).to.equal(2);
      });

      it('loads a single page of records', function () {
        var page = this.dataset.state.pages[0];
        expect(page.data.length).to.equal(this.recordsPerPage);
        expect(page.data[0].name).to.equal('Record 20');
      });

    });


    xdescribe("with no fetch function", function() {
      it("emits an observation of the state");
      it("indicates that the dataset is not doing any loading");
    });

    xdescribe("with a fetch function and the default load horizon", function() {
      it("requests the first page only");
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
