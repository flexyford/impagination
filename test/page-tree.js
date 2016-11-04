import PageTree from '../src/page-tree';
import Page from '../src/page';

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

describe("Page Tree", function() {
  let pageTree;
  beforeEach(function() {
    pageTree = new PageTree();
  });

  describe("instantiating page tree", function() {
    it("exists", function() {
      expect(!!pageTree).to.equal(true);
    });
  });

  describe("inserting pages", function() {
    let pages;
    beforeEach(function() {
      pages = [
        new Page(1, 10),
        new Page(2, 17),
        new Page(3, 8)
      ];

      let index = 0;
      pages = pages.map((page) => {
        let records = page.data.map(() => index++);
        return page.request().resolve(records);
      });

      pages.forEach((page) => {
        pageTree.insert(page.offset, page);
      });
    });

    it("adds pages to our tree", function() {
      expect(pageTree.getNumberOfKeys()).to.equal(pages.length);
      expect(pageTree.betweenBounds({ $gte: 0 })).to.deep.equal(pages);
    });

    it("search by pages by default", function() {
      expect(pageTree.search(0)).to.deep.equal({
        key: 0, data: undefined
      });
      expect(pageTree.search(1)).to.deep.equal({
        key: { page: 1, size: 10 }, data: pages[0]
      });
      expect(pageTree.search(2)).to.deep.equal({
        key: { page: 2, size: 17 }, data: pages[1]
      });
      expect(pageTree.search(3)).to.deep.equal({
        key: { page: 3, size: 8 }, data: pages[2]
      });
    });

    it("can explicitly search by pages", function() {
      expect(pageTree.searchPage(0)).to.deep.equal({
        key: { page: 0 }, data: undefined
      });
      expect(pageTree.searchPage(1)).to.deep.equal({
        key: { page: 1, size: 10 }, data: pages[0]
      });
      expect(pageTree.searchPage(2)).to.deep.equal({
        key: { page: 2, size: 17 }, data: pages[1]
      });
      expect(pageTree.searchPage(3)).to.deep.equal({
        key: { page: 3, size: 8 }, data: pages[2]
      });
    });


    describe("updating the record indeces", function() {
      beforeEach(function() {
        pageTree.updateKeys();
      });

      it("can search records by record index", function() {
        let record = pageTree.searchRecord(0);
        expect(record).to.equal(null);

        record = pageTree.searchRecord(10);
        expect(record).to.have.property('content', 0);

        record = pageTree.searchRecord(44);
        expect(record).to.have.property('content', 34);

        record = pageTree.searchRecord(99);
        expect(record).to.equal(null);
      });

      it("can search pages by record index", function() {
        let page = pageTree.searchPageByRecord(0);
        expect(page.key).to.have.property('record', 0);
        expect(page.data).to.deep.equal(undefined);

        page = pageTree.searchPageByRecord(9);
        expect(page.key).to.have.property('record', 9);
        expect(page.data).to.deep.equal(undefined);

        page = pageTree.searchPageByRecord(10);
        expect(page.key).to.have.property('record', 10);
        expect(page.key).to.have.property('size', 10);
        expect(page.data).to.deep.equal(pages[0]);

        page = pageTree.searchPageByRecord(19);
        expect(page.key).to.have.property('record', 10);
        expect(page.key).to.have.property('size', 10);
        expect(page.data).to.deep.equal(pages[0]);

        page = pageTree.searchPageByRecord(20);
        expect(page.key).to.have.property('record', 20);
        expect(page.key).to.have.property('size', 17);
        expect(page.data).to.deep.equal(pages[1]);

        page = pageTree.searchPageByRecord(36);
        expect(page.key).to.have.property('record', 20);
        expect(page.key).to.have.property('size', 17);
        expect(page.data).to.deep.equal(pages[1]);

        page = pageTree.searchPageByRecord(37);
        expect(page.key).to.have.property('record', 37);
        expect(page.key).to.have.property('size', 8);
        expect(page.data).to.deep.equal(pages[2]);

        page = pageTree.searchPageByRecord(44);
        expect(page.key).to.have.property('record', 37);
        expect(page.key).to.have.property('size', 8);
        expect(page.data).to.deep.equal(pages[2]);

        page = pageTree.searchPageByRecord(45);
        expect(page.key).to.have.property('record', 45);
        expect(page.data).to.deep.equal(undefined);

        page = pageTree.searchPageByRecord(99);
        expect(page.key).to.have.property('record', 99);
        expect(page.data).to.deep.equal(undefined);
      });
    });
  });
});
