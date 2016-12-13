# Impagination

[![npm version](https://badge.fury.io/js/impagination.svg)](https://badge.fury.io/js/impagination)
[![Build Status](https://travis-ci.org/flexyford/impagination.svg)](https://travis-ci.org/flexyford/impagination)

Put the *fun* back in lazy, asynchronous, paged, datasets.

Impagination is a lazy data layer for your paged records. All you provide Impagination is the logic to fetch a single page, plus how many records you want it to pre-fetch ahead of you.

Impagination is built using an event-driven immutable style, so it is
ideal for use with UI frameworks like Ember, Angular, or React. That
said, it has zero dependencies apart from JavaScript, so it can be
used from node as well.

## Upgrading

If you are `Impagination` to the `1.0` release. Consider checking out the [Migration Guide](https://github.com/flexyford/impagination/MIGRATION.md)

## Usage

To get started, create a dataset. There are only two required parameters
`fetch`, and `pageSize`:

```javascript
import Dataset from 'impagination';

let dataset = new Dataset({
  pageSize: 5, // num records per page
  loadHorizon: 10, // window of records to keep (default: pageSize)
  fetch: function(pageOffset, pageSize, stats) { // How to `fetch` a page
    stats.totalPages = 4;
    // Returns a `thenable` which resolves with page's `records`
    return $.ajax({ method, url });
  },
  unfetch: function(records, pageOffset) {} // invoked whenever a page is unloaded
  filter: function(element, index, array) {} // filters `records` whenever a page resolves
  observe: function(nextState) { // invoked whenever a new `state` is generated
    dataset.state = nextState;
  }
});
```

Calling `new Dataset()` will emit a `state` immediately. However this `state` will be empty.

```javascript
dataset.state.length //=> 0;

let record = dataset.state.getRecord(0); // Empty Record
record.isRequested //=> false
record.isPending //=> false
record.isResolved //=> false
record.content //=> null
```

To start fetching pages and build the `state`, we need to start reading from an offset. To do this, we will update the dataset's `readOffset`.

```javascript
dataset.setReadOffset(0);
```

With a `pageSize` of 5, this will immediately call fetch twice (for records 0-4, and 5-9),
and emit a new state indicating that these records are in flight.

```javascript
dataset.setReadOffset(0);
dataset.state.length //=> 10;

// Records 0-9 are Pending Records
let record = dataset.state.getRecord(0);
record.isRequested //=> true
record.isPending //=> true
record.isResolved //=> false
record.content //=> null
```

### Load Horizon

How did it know which records to fetch? The answer is in the
`loadHorizon` parameter that we passed into the constructor.
We set the `loadHorizon` to 10. This tells the dataset,
that it should keep all records within 10 of the
current read offset loaded. That's why it fetched the first two
pages.

I hope this ASCII Dataset adds some clarity:

```javascript
dataset = new Dataset(...).setReadOffset(0); // builds the dataset below
```
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
             │         │         │
             p0        p1        length = 10
```
```
ASCII  Legend:
`xx` - unrequested record
`*`  - pending record
`n`  - record inex
`◇`  - page boundary
```

#### Resolving Asynchrnous Pages
Once the asynchronous `fetch` for a page resolves, the
dataset will emit a new `state` with the updated resolved records.

Continuing our previous example, we assume the the request on page `0` resolves and the
request on page `1` is not yet resolved. That state will still contain the resolved records as well the pending records.

```javascript
dataset.state.length //=> 20;

// Assumes the page `0` resolves and page `1` is pending
let record = state.getRecord(0);
record.page.offset = 0;
record.isPending //=> false
record.isResolved //=> true
record.content //=> { name: 'Record 3' }

record = state.get(5)
record.page.offset = 1;
record.isPending //=> true
record.isResolved //=> false
record.content //=> null
```

Another interesting thing that happened here is that the length of the
dataset has also changed.

```javascript
dataset.state.length //=> 20 (stats.totalPages: 4, pageSize: 5)
```

That's because the `stats` parameter that is passed into our example
fetch function tells our dataset there are `5` total pages in our dataset.
This value allows the fetch function to optionally
specify the total extent of the dataset if that information is
available. This can be useful when rendering native scrollbars or
other UI elements that indicate the overall length of a list. If
`stats` are never updated, then the dataset will just expand
indefinitely. Now our state looks like this:

```
            Read
           Offset
              ┃
              ┃
<──────────Load Horizon──────────>
              ┃
              ▼
              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ─ ─ ─ ─ ─ ─ ─ ── ─ ┐
               0 1 2 3 4 * * * * * xx xx xx xx xx xx xx xx xx xx│
              ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─  ◇ ─ ─ ─ ─ ─ ─  ┘
              │         │         │              │              │
             p0        p1        p2             p3              length = 20

```

We have records 0-4, whilst records 5-9 are in flight, and records
10-20 have yet to be requested.

```javascript
//from the last ◇ page (p3)
record = state.getRecord(17);
record.isRequested //=> false
record.isPending //=> false
record.content //> null
```

### Dataset API
There are a number of public `impagination` functions which we provide as actions to update the dataset.

#### Updating the Dataset
| Actions       | Parameters     | Description   |
| ------------- |:--------------:|:--------------|
| refilter      | [filterCallback] | Reapplies the filter for all resolved pages. If `filterCallback` is provided, applies and sets the new filter.
| reset        | [offset]          | Unfetches all pages and clears the `state`. If `offset` is provided, fetches records starting at `offset`.
| setReadOffset | [offset]         | Sets the `readOffset` and fetches records resuming at `offset`

#### Updating the State
| Actions| Parameters  | Defaults        |Description   |
| ------ |:-----------:|:--------------|:--------------|
| post   | data, index | index = 0 | Inserts `data` into `state` at `index`.
| put    | data, index | index = state.readOffset | Merges `data` into record at `index`.
| delete | index       | index= state.readOffset  | Deletes `data` from `state` at `index`.


#### setReadOffset Example
Let's say the we change our viewport to item 2 in our UI. We want to tell impagination to move the read head to offset 2 with a call to `dataset.setReadOffset(2)`. This will immediately emit a new `state` that looks like this:

```
                 Read
                Offset
                   ┃
                   ┃
     <──────────Load Horizon──────────>
                   ┃
                   ▼
              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ─ ─ ─ ─ ─ ─ ── ─ ┐
               0 1 2 3 4 * * * * *  * * * * *   xx xx xx xx xx│
              ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─  ◇ ─ ─ ─ ─ ─ ─  ┘
              │         │         │            │              │
             p0        p1        p2            p3             length = 20
```

You'll notice that the page at offset p2 has now been requested because
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
              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ─ ─ ─ ─  ── ─ ── ─ ┐
               0 1 2 3 4 * * * * * 10 11 12 13 14 xx xx xx xx xx│
              ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─  ◇ ─ ─ ─ ─ ─ ─  ┘
              │         │         │              │              │
             p0        p1        p2             p3              length = 20
```

In this way, impagination is resilient to the order of network
requests because the records are "always available" and in their
proper order,  albeit in their unrequested, pending, or resolved
states.

```javascript
//records on p2 are now available
record = state.getRecord(10);
record.isResolved //=> true
record.content //=> 10

//records on p1 are still pending
record = state.getRecord(5);
record.isResolved //=> false
record.isPending //=> true
record.content //=> null
```


#### Filtering Records
We fetch records using an immutable style, but we often require filtering by mutable values in our dataset. To enable filtering, pass a filter `callback` to `impagination` as you would to `Array.prototype.filter()`. The filters are applied as soon as a page is resolved. To filter a page at other times in your application see [`refilter`](#dataset-api).

Here we filter by records whose content contains an even number
```javascript
let dataset = new Dataset({ ...
  // filter() function which returns only _even_ records
  filter: function(content) { return content % 2 === 0 }
});
```

```
                 Read
                Offset
                   ┃
                   ┃
     <──────────Load Horizon──────────>
                   ┃
                   ▼
              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ─ ─ ─ ─  ── ─ ── ─ ┐
               0   2   4 * * * * * ** ** ** ** ** xx xx xx xx xx│
              ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ◇ ─ ─ ─ ─ ─ ─  ◇ ─ ─ ─ ─ ─ ─  ┘
              │         │         │              │              │
             p0        p1        p2             p3              length = 18
```

```javascript
// Finding even numbered records
record = state.getRecord(1);
record.isResolved //=> true
record.page.offset //=> 0
record.content //=> 2
state.length //=> 18 (stats.totalPages: 4, pageSize: 5, rejected records by filter: 2)

//records on p1 are still pending
record = state.getRecord(3); // The record at index 3 now exists on p1
record.isResolved //=> false
record.isPending //=> true
record.page.offset //=> 1
record.content //=> null
```

### Impagination and Immutability

In the mutable style of reactivity, you listen to events that report
what changed about a datastructure, and then you're left to realize
the implications of that change in your internal data structures (such
as changing a record from `isPending` to `isResolved`). By contrast,
Impagination uses an immutable style.

In Impagination, each event __is__ the fully formed datastructure *in
its entirety*. This eliminates all guesswork and ambiguity from what
the implications are so that you, the developer, have to do less work
to maintain consistency.

What this means in practice is that each of the states observed by
the `observe` function are unique structures that are considered
immutable. Each one stands alone and will continue to function
properly even if you discard references to all other states and the
dataset object itself. Furthermore, altering them will have no effect
on neither prior nor subsequent states.

You may be asking, is it not wasteful to recreate an *entire* potentially
infinite data structure with every state transition? The answer is
that each state is lazy and stores as little information as it needs
to provide its API. The `state` contains lazy array interfaces for `pages` and `records`.
