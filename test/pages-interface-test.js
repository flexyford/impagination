import PagesInterface from '../src/pages-interface';

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { Server, PageRequest } from './test-server';

describe("Pages Interface", function() {
  describe("instantiating pages", function() {
    it("cannot be instantiated without pageSize", function() {
      var err = "";
      try { new PagesInterface(); } catch(e) { err = e; }
      expect(err).to.match(/without pageSize/);
    });

    it("cannot be instantiated with unloadHorizon less than loadHorizon", function () {
      var err = "";
      try { new PagesInterface({
        options: {
          pageSize: 1, loadHorizon: 5, unloadHorizon: 1
        }
      }); } catch(e) { err = e; }
      expect(err).to.match(/unloadHorizon less than loadHorizon/);
    });

    describe("with default constructor values", function() {
      beforeEach(function() {
        this.pages = new PagesInterface({
          options: {
            pageSize: 10
          }
        });
      });
      it("has default constructor values", function() {
        expect(this.pages.pageSize).to.equal(10);
        expect(this.pages.loadHorizon).to.equal(10);
        expect(this.pages.unloadHorizon).to.equal(Infinity);
        expect(this.pages.readOffset).to.equal(undefined);
      });

      it("does not request pages", function() {
        expect(this.pages.length).to.equal(0);
        expect(this.pages.requested.length).to.equal(0);
        expect(this.pages.records.length).to.equal(0);
      });

      describe("setting the read offset", function() {
        beforeEach(function() {
          this.pages.setReadOffset(0);
        });

        it("requests a page", function() {
          expect(this.pages.length).to.equal(1);
          expect(this.pages.requested.length).to.equal(1);
          expect(this.pages.records.length).to.equal(10);
        });

        it("fetches a set of empty Pending records", function() {
          const record = this.pages.records.get(0);
          expect(record.index).to.equal(0);
          expect(record.isRequested).to.be.true;
          expect(record.isPending).to.be.true;
          expect(record.isResolved).to.be.false;
          expect(record.isRejected).to.be.false;
          expect(record.content).to.equal(null);
          expect(record.page.offset).to.equal(0);
        });
      });


      describe("advancing the read offset", function() {
        beforeEach(function() {
          this.pages.setReadOffset(35);
        });

        it("requests another page of records", function() {
          expect(this.pages.length).to.equal(5);
          expect(this.pages.requested.length).to.equal(3);
          expect(this.pages.records.length).to.equal(50);
        });
      });
    });

    describe("with an unload horizon", function() {
      beforeEach(function() {
        this.pages = new PagesInterface({
          options: {
            pageSize: 10,
            loadHorizon: 10,
            unloadHorizon: 10
          }
        });
        this.pages.setReadOffset(0);
      });
      it("has default constructor values", function() {
        expect(this.pages.pageSize).to.equal(10);
        expect(this.pages.loadHorizon).to.equal(10);
        expect(this.pages.unloadHorizon).to.equal(10);
        expect(this.pages.readOffset).to.equal(0);
      });

      it("requests pages", function() {
        expect(this.pages.length).to.equal(1);
        expect(this.pages.requested.length).to.equal(1);
        expect(this.pages.records.length).to.equal(10);
      });

      describe("advancing the read offset", function() {
        beforeEach(function() {
          this.pages.setReadOffset(35);
        });

        it("requests more pages of records", function() {
          expect(this.pages.length).to.equal(5);
          expect(this.pages.requested.length).to.equal(3);
          expect(this.pages.records.length).to.equal(50);
        });
      });
    });

    describe("with stats", function() {
      beforeEach(function() {
        this.pages = new PagesInterface({
          options: {
            pageSize: 10,
            stats: { totalPages: 10 }
          }
        });
        this.pages.setReadOffset(0);
      });
      it("has default constructor values", function() {
        expect(this.pages.pageSize).to.equal(10);
        expect(this.pages.stats.totalPages).to.equal(10);
      });

      it("requests pages", function() {
        expect(this.pages.length).to.equal(10);
        expect(this.pages.requested.length).to.equal(1);
        expect(this.pages.records.length).to.equal(100);
      });
    });
    describe("resolving a requested page", function() {
      beforeEach(function() {
        this.server = new Server();
        this.requests = this.server.requests;
        this.pages = new PagesInterface({
          options: {
            pageSize: 10,
            fetch: (pageOffset, pageSize, stats)=> {
              return this.server.request(pageOffset, pageSize, stats);
            }
          }
        });
        this.pages.setReadOffset(0);
        return this.server.resolveAll();
      });
      it("has a resolved page", function() {
        expect(this.pages.length).to.equal(1);
        let page = this.pages.get(0);

        expect(page.isResolved).to.be.true;
        expect(this.pages.resolved.length).to.equal(1);
      });
      it("resolves records", function () {
        expect(this.pages.records.length).to.equal(10);

        let record = this.pages.records.get(0);
        expect(record.isResolved).to.be.true;
        expect(record.content.name).to.equal("Record 0");
      });
    });
  });
});
