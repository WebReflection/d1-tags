# d1-tags

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

- **Tagged templates** — interpolations become bound parameters (`?`), not string concatenation, for `run`, `first`, `raw`, and `batch` (same idea as `sql`…`` in other stacks).
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
| **`batch`** | `db.batch([ … ])` | One prepared shape; multiple bind tuples (see below). |
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

You pass **one** SQL shape (with `?` placeholders) and **N** interpolations. Each interpolation must be an **array** of bind values for one execution. The guard requires `N ===` number of placeholders, and `DB.batch` receives N bound statements.

Example: three rows, three columns per row, three `?` in the statement:

```js
const { batch } = d1Tags(env.DB);

const results = await batch`
  INSERT INTO Customers (CustomerId, CompanyName, ContactName)
  VALUES (${[1, 'A', 'Alice']}, ${[2, 'B', 'Bob']}, ${[3, 'C', 'Carol']})
`;
```

(Adjust the SQL to your real schema; the important part is **one `?` per column** and **each interpolation is one `unknown[]` row**.)

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
import type { D1Tags, AugmentedFirst } from 'd1-tags/types';

const api: D1Tags = d1Tags(env.DB);
```

Types live in `types/index.d.ts` (see also `package.json` `"exports"`).

## License

MIT — see [LICENSE](./LICENSE).
