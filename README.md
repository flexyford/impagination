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
  // how many records should we "keep ahead"? (default = pageSize)
  loadHorizon: 10,
  // fetch in pages of 5 (default 10)
  pageSize: 5,
  // this fake fetch function returns a page where the "records" *are*
  // the offsets
  fetch: function(pageOffset, pageSize, stats) {
    stats.totalPages = 5;
    return new Promise(function(resolve) {
      resolve(return new Array(pageSize).fill(0).map(function(zero, i)) {
        return pageOffset * pageSize + i;
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
offset". It's the only "imperative" API that impagination exposes, and
it indicates where you're interested in accessing records. Let's start
at the beginning.

```javascript
dataset.setReadOffset(0);
```

Immediately, this will call fetch twice (for records 0-4, and 5-9),
and emit a new state indicating that these records are in flight.

```javascript
state.length //=> 10
let record = state.get(7)
record.isPending //=> true
record.isResolved //=> false
record.content //=> null
```

### Load Horizon

How did it know which records to fetch? The answer is in the
`loadHorizon` parameter that we passed into the constructor. This
tells the dataset, that it should keep all records within 10 of the
current read offset loaded. That's why it fetched the first two
pages. Now logicially, our dataset looks like this:

> Note: `*` indicates that the record is pending.


```
           Read
          Offset
             ┃
             ┃
<──────────Load Horizon──────────>
             ┃
             ▼
             ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
              * * * * * * * * * *
             ◇ ─ ─ ─ ─ ◇─ ─ ─ ─  ┘
             │         │
             p0        p1
```

At some point, the request for the first page resolves. At that point,
the dataset will emit a new state with the resolved records. That
state will still contain the pending records as well as the freshly
loaded.


```javascript
//get a record off the first page
record = state.get(3);
record.isResolved //=> true
record.content //=> 3

//get a record off the second page
record = state.get(7)
record.isPending //=> true
```

Another interesting thing that happened here is that the length of the
dataset has also changed.

```javascript
state.length //=> 30
```

This has to do with the `stats` parameter that is passed into the
fetch function. This value allows the fetch function to optionally
specify the total extent of the dataset if that information is
available. This can be useful when rendering native scrollbars or
other UI elements that indicate the overall length of a list. If
`stats` are never updated, then the dataset will just expand
indefinitely. Now our state looks like this:

> Note `x` indicates that the record is not yet requested

```
            Read
           Offset
              ┃
              ┃
<──────────Load Horizon──────────>
              ┃
              ▼
              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
               0 1 2 3 4 * * * * * xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx│
              ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─ ─◇─ ─ ─ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─ ─
              │         │         │              │              │
             p0        p1        p2             p3             p4

```

We have records 0-4, whilst records 5-9 are in flight, and records
10-25 have yet to be requested.

```javascript
//from the last page (p4)
record = state.get(23);
record.isRequested //=> false
record.isPending //=> false
record.content //> null
```

Let's say we want to move the read head to offset 2 with a call to
`dataset.setReadOffset(2)`. This will immediately emit a new state that
looks like this:

```
                 Read
                Offset
                   ┃
                   ┃
     <──────────Load Horizon──────────>
                   ┃
                   ▼
              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
               0 1 2 3 4 * * * * * ** ** ** ** ** xx xx xx xx xx xx xx xx xx xx│
              ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─ ─◇─ ─ ─ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─ ─
              │         │         │              │              │
             p0        p1        p2             p3             p4
```

You'll notice that the page at offset 2 has now been requested because
it contains records that fall within the load horizon. The page at
`p1` is still pending, but now `p2` is as well. What happens if the
request for `p2` resolves *before* the request for `p1`? In that case,
the dataset emits this state:

```
                 Read
                Offset
                   ┃
                   ┃
     <──────────Load Horizon──────────>
                   ┃
                   ▼
              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
               0 1 2 3 4 * * * * * 10 11 12 13 14 xx xx xx xx xx xx xx xx xx xx│
              ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─ ─◇─ ─ ─ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─ ─
              │         │         │              │              │
             p0        p1        p2             p3             p4
```

In this way, impagination is resilient to the order of network
requests because the records are "always available" and in their
proper order,  albeit in their unrequested, pending, or resolved
states.

```javascript
//records on p2 are now available
record = state.get(10);
record.isResolved //=> true
record.content //=> 10

//records on p1 are still pending
record = state.get(7);
record.isResolved //=> false
record.isPending //=> true
record.content //=> null
```
