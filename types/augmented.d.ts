import type { D1ExecResult, D1Result } from '@cloudflare/workers-types';

/**
 * Row object from `stmt.first()` when called with **no** column name
 * (`D1PreparedStatement.first<T = Record<string, unknown>>(): Promise<T | null>`).
 */
export type D1FirstRow = Record<string, unknown> | null;

/**
 * Curried `first(bound)\`...\`` forwards `...bound` into `stmt.first(...bound)`.
 * If `bound` is a column name (`string`), that overload is `first<T = unknown>(colName): Promise<T | null>` — a **scalar**, not a row object.
 * Widen to `unknown | null` so both row and scalar paths are sound.
 */
export type D1FirstCurried = unknown | null;

/**
 * Rows from `stmt.raw()` when `columnNames` is omitted or false.
 * `raw<T = unknown[]>(...): Promise<T[]>` with default `T` is `unknown[]`, so `T[]` is `unknown[][]`.
 */
export type D1RawRows = unknown[][];

/**
 * From `stmt.raw({ columnNames: true })`: `Promise<[string[], ...T[]]>` with `T = unknown[]`.
 */
export type D1RawRowsWithNames = [string[], ...unknown[][]];

/**
 * `first` after `augmented('first')`: tagged template, or curried `fn(bound)` then tag.
 */
export interface AugmentedFirst {
  (template: TemplateStringsArray, ...fields: unknown[]): Promise<D1FirstRow>;
  (bound: unknown): (
    template: TemplateStringsArray,
    ...fields: unknown[]
  ) => Promise<D1FirstCurried>;
}

/**
 * `raw` after `augmented('raw')`: tagged template, or curried `fn(options)` then tag.
 */
export interface AugmentedRaw {
  (template: TemplateStringsArray, ...fields: unknown[]): Promise<D1RawRows>;
  (options: { columnNames: true }): (
    template: TemplateStringsArray,
    ...fields: unknown[]
  ) => Promise<D1RawRowsWithNames>;
  (options?: { columnNames?: false }): (
    template: TemplateStringsArray,
    ...fields: unknown[]
  ) => Promise<D1RawRows>;
}

/** Narrowing factory: `augmented('first')` vs `augmented('raw')`. */
export interface AugmentedFactory {
  (name: 'first'): AugmentedFirst;
  (name: 'raw'): AugmentedRaw;
}

/**
 * Column-oriented view of row objects returned by {@link D1Tags.map}.
 * Each key of `T` maps to an array of that property’s values across rows (same length and order as the input list).
 */
export type MappedList<T extends Record<string, unknown>> = {
  readonly [K in keyof T]: T[K][];
};

/** Object returned from the default export `d1Tags(env.DB)`. */
export interface D1Tags {
  /**
   * Column-oriented batching: each template interpolation is one **column** — an array of values, one entry per row.
   * The implementation zips columns by index: row `i` is bound as `fields.map((col) => col[i])` (see `batched` in the implementation).
   * All column arrays must have the same length. `guard` requires one interpolation per `?` placeholder.
   * Pair with {@link D1Tags.map} to derive column arrays from an array of row objects.
   */
  batch: (
    template: TemplateStringsArray,
    ...fields: unknown[][]
  ) => Promise<D1Result<unknown>[]>;
  escape: (field: unknown) => string;
  exec: (
    template: TemplateStringsArray,
    ...fields: unknown[]
  ) => Promise<D1ExecResult>;
  /**
   * Given an array of row objects, returns a `Proxy` that exposes each property as a column array
   * (`rows.map((row) => row[key])`), suitable for spreading into {@link D1Tags.batch}.
   */
  map: <T extends Record<string, unknown>>(list: readonly T[]) => MappedList<T>;
  first: AugmentedFirst;
  raw: AugmentedRaw;
  run: (
    template: TemplateStringsArray,
    ...fields: unknown[]
  ) => Promise<D1Result<Record<string, unknown>>>;
}
