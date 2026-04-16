# d1-tags

[![Coverage Status](https://coveralls.io/repos/github/WebReflection/d1-tags/badge.svg?branch=main)](https://coveralls.io/github/WebReflection/d1-tags?branch=main)

Tagged-template helpers for [Cloudflare D1](https://developers.cloudflare.com/d1/): write SQL as template literals, bind values safely, and reuse prepared statements without boilerplate.

```js
import d1Tags from 'd1-tags';

export default {
  async fetch(request, env) {
    const { run } = d1Tags(env.DB);

    const company = 'Around the Horn';
    const result = await run`
      SELECT * FROM Customers
      WHERE CompanyName = ${company}
    `;

    return Response.json(result);
  },
};
```

## Install

```bash
npm install d1-tags
```

Peer expectation: a D1 binding (`D1Database`) from your Worker / Pages environment (for example `env.DB` from Wrangler).

## Why use this?

- **Tagged templates** — interpolations become bound parameters (`?`), not string concatenation, for `run`, `first`, `raw`, and `batch` (same idea as `sql`…`` in other stacks). **`map`** turns an array of row objects into column arrays for **`batch`**.
- **Prepared statement cache** — each distinct template string array is prepared **once** per `D1Database` instance (cached in a `WeakMap`, keyed by the frozen template object from the tag).
- **Per-DB API object** — call `d1Tags(env.DB)` once; the returned helpers are reused for that same binding.
- **TypeScript** — typings ship under `types/`; `package.json` `"types"` and `"exports"` point at them.

## API

Call **`d1Tags(db)`** once with your D1 binding. You get an object with:

| Method | Maps to | Notes |
|--------|---------|--------|
| **`run`** | `prepare(…).bind(…).run()` | Full `D1Result` for the statement. |
| **`first`** | `prepare(…).bind(…).first()` | Default row object, or curried column name (see below). |
| **`raw`** | `prepare(…).bind(…).raw(…)` | Tabular rows; optional curried `raw` options (see below). |
| **`batch`** | `db.batch([ … ])` | One prepared statement; each `?` is a **column** of bind values across rows (see below). |
| **`map`** | — | Turns `T[]` into per-property column arrays for use with **`batch`**. |
| **`exec`** | `db.exec(string)` | Builds SQL by concatenating template parts and values — **not** parameterized. |
| **`escape`** | — | SQLite string literal helper: wraps in `'…'` and doubles embedded `'`. Meant for **`exec`**, not for bound tags. |

### `run`, `first`, `raw`

Interpolations must match the number of `?` placeholders implied by the template (the library enforces this with a small guard).

```js
const { run, first, raw } = d1Tags(env.DB);

await run`UPDATE Customers SET CompanyName = ${name} WHERE CustomerId = ${id}`;

// One row or null (object shape from D1’s default `first()` overload)
await first`SELECT * FROM Customers WHERE CustomerId = ${id}`;

// Curried: forward arguments to `stmt.first(...)` — e.g. a single column name
await first('CompanyName')`SELECT CompanyName FROM Customers WHERE CustomerId = ${id}`;

// Raw rows (array of arrays by default)
const rows = await raw`SELECT CustomerId, CompanyName FROM Customers LIMIT ${n}`;

// Curried: D1’s `raw({ columnNames: true })` — names row, then data rows
const withNames = await raw({ columnNames: true })`
  SELECT CustomerId, CompanyName FROM Customers LIMIT ${n}
`;
```

### `batch`

You pass **one** SQL shape (with `?` placeholders) and **one interpolation per placeholder**. The twist is that batching is **column-oriented**: each interpolation is an **array of values for that column**, with one element per row. At row index `i`, the bound tuple is the `i`th element from each column array (same idea as zipping columns into rows).

The arity guard still requires `placeholders === interpolations` (frozen template, same as `run` / `first`). Every column array must have the **same length**; otherwise you get `SyntaxError: Invalid batch`.

Example: three rows and three columns — three `?` placeholders and three column arrays (ids, companies, names):

```js
const { batch } = d1Tags(env.DB);

const results = await batch`
  INSERT INTO Customers (CustomerId, CompanyName, ContactName)
  VALUES (${[1, 2, 3]}, ${['A', 'B', 'C']}, ${['Alice', 'Bob', 'Carol']})
`;
```

That produces three bound statements (one per row), each `prepare(…).bind(…)` sharing the same prepared SQL.

### `map`

When your data is an **array of row objects**, use **`map(rows)`** to get column arrays without hand-writing `[row0.a, row1.a, …]` for every field. The helper returns a `Proxy`: property access runs `rows.map((row) => row[prop])`, so each key becomes one array you can pass as a single `${…}` column to **`batch`**.

```js
const { batch, map } = d1Tags(env.DB);

const customers = map([
  { id: 1, name: 'Alice', company: 'A' },
  { id: 2, name: 'Bob', company: 'B' },
  { id: 3, name: 'Carol', company: 'C' },
]);

await batch`
  INSERT INTO Customers (CustomerId, CompanyName, ContactName)
  VALUES (${customers.id}, ${customers.company}, ${customers.name})
`;
```

In TypeScript, `MappedList<T>` (exported from `d1-tags/types`) describes that column view: for each key `K` of `T`, you get `T[K][]`.

### `exec` and `escape`

`exec` builds a string and calls `db.exec`. Values are interpolated with `String(value)` — **use only for trusted SQL fragments**, or combine with **`escape()`** for manual SQL string literals:

```js
const { exec, escape } = d1Tags(env.DB);

await exec`SELECT * FROM Customers WHERE CompanyName = ${escape(name)}`;
```

For untrusted data, prefer **`run` / `first` / `raw`** (bound parameters) instead of `exec`.

## Caching model

- **`WeakMap<D1Database, api>`** — one API object per binding.
- **`WeakMap<TemplateStringsArray, D1PreparedStatement>`** — one prepared statement per unique tag template (same reference as long as you reuse the same literal site in source).

Templates from tags are frozen arrays; the guard checks frozen + arity so placeholders and interpolations stay aligned.

## TypeScript

```ts
import d1Tags from 'd1-tags';
import type { D1Tags, MappedList } from 'd1-tags/types';

const api: D1Tags = d1Tags(env.DB);

type Row = { id: number; company: string };
declare const rows: readonly Row[];
const columns: MappedList<Row> = api.map(rows);
```

Types live in `types/index.d.ts` (see also `package.json` `"exports"`).

## License

MIT — see [LICENSE](./LICENSE).
