# Migration Guide

## Upgrading 0.x.x -> 1.0.x

The `get` function is no longer supported starting at the `1.0.0` release. Considering accessing array indeces by `state[index]` or `state.getRecord(index)`. The table below provides additional information for the latest API

If you want to upgrade to version >= 1.0.0is the migration guide:

#### Updating the Dataset
| Functions       | Description   |
| --------------- |:--------------|
| state[index]          | Returns the Record Object at `index`
| state.getRecord(index)| Returns the Record Object at `index`
| state.getPage(offset) | Returns the Page Object at page number `offset`
