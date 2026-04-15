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

/** Object returned from the default export `d1Tags(env.DB)`. */
export interface D1Tags {
  /**
   * Each `fields[i]` is passed to `stmt.bind(...fields[i])` (must be an `unknown[]` at runtime).
   * `guard` requires `fields.length === template.length - 1`.
   */
  batch: (
    template: TemplateStringsArray,
    ...fields: unknown[]
  ) => Promise<D1Result<unknown>[]>;
  escape: (field: unknown) => string;
  exec: (
    template: TemplateStringsArray,
    ...fields: unknown[]
  ) => Promise<D1ExecResult>;
  first: AugmentedFirst;
  raw: AugmentedRaw;
  run: (
    template: TemplateStringsArray,
    ...fields: unknown[]
  ) => Promise<D1Result<Record<string, unknown>>>;
}
