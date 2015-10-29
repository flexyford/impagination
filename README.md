# Impagination

Put the *fun* back in asynchronous, paged, datasets.

Whatever your use-case: infinite scrolling lists, a carousel browser,
or even a classic page-by-page result list, Impagination frees you to
focus on what you want to do with your data, not the micro-logistics
of when to fetch it. All you provide Impagination is the logic to
fetch a single page, plus how many pages you want it to pre-fetch
ahead of you, and it will figure out the rest.

Impagination is built using an event-driven immutable style, so it is
ideal for use with UI frameworks like Ember, Angular, or React. That
said, it has zero dependencies apart from JavaScript, so it can be
used from node as well.

## Usage

To get started, create a dataset. There are only two required parameters
`fetch`, and `observe`:

```javascript
import { Dataset } from 'impagination';

let state = null;

let dataset = new Dataset({
  // how many records should we "keep ahead" (default = pageSize)?
  loadHorizon: 10,
  // fetch in pages of 5 (default 10)
  pageSize: 5,
  // this fake fetch function returns a page of random numbers
  fetch: function(pageOffset, pageSize, stats) {
    stats.totalPages = 5;
    return new Promise(function(resolve) {
      resolve(return new Array(pageSize).fill(0).map(function()) {
        return Math.random();
      });
    });
  },
  //this function is invoked whenever a new state is generated.
  observe: function(nextState) {
    state = nextState;
  }
});
```

This will emit a state immediately, however this state will not have
anything in it, but That's because we haven't told the dataset where we
want to start reading from.

```javascript
state.length //=> 0;
state.get(0) //=> null;
```

To tell where to start reading, you update the dataset's "read
offset". This indicates where you're interested in accessing records:

```javascript
dataset.setReadOffset(0);
```

Now, a new state will be emitted indicating
