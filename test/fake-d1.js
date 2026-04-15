/**
 * Minimal in-memory D1Database stub for tests: records SQL and bind args, no I/O.
 * Satisfies the surface of {@link import('@cloudflare/workers-types').D1Database} used by `d1-tags`.
 */
export function createFakeD1() {
  /** @type {string[]} */
  const prepareSql = [];
  /** @type {string[]} */
  const execSql = [];
  /** @type {{ sql: string, bindArgs: unknown[] }[][]} */
  const batchRuns = [];
  /** @type {{ sql: string, bindArgs: unknown[] }[]} */
  const runs = [];

  /**
   * @param {string} sql
   */
  function makeStatement(sql) {
    return {
      /**
       * @param {...unknown} args
       */
      bind(...args) {
        const bound = {
          _sql: sql,
          _bindArgs: args,
          /**
           * @param {...unknown} _extra forwarded from curried `first` / `raw` (`...this`)
           */
          first: (..._extra) => Promise.resolve(/** @type {Record<string, unknown> | null} */ (null)),
          /**
           * @param {...unknown} _extra
           */
          raw: (..._extra) => Promise.resolve(/** @type {unknown[][]} */ ([])),
          run: () => {
            runs.push({ sql, bindArgs: args });
            return Promise.resolve({
              success: true,
              meta: {},
              results: [],
            });
          },
        };
        return bound;
      },
    };
  }

  const db = {
    /**
     * @param {string} sql
     */
    prepare(sql) {
      prepareSql.push(sql);
      return makeStatement(sql);
    },
    /**
     * @param {string} sql
     */
    exec(sql) {
      execSql.push(sql);
      return Promise.resolve({
        count: 0,
        duration: 0,
      });
    },
    /**
     * @param {unknown[]} stmts
     */
    batch(stmts) {
      const rowInfo = stmts.map(/** @param {any} s */ s => ({
        sql: s._sql,
        bindArgs: s._bindArgs,
      }));
      batchRuns.push(rowInfo);
      return Promise.resolve(
        stmts.map(() => ({
          success: true,
          meta: {},
          results: [],
        })),
      );
    },
    withSession: () => ({
      prepare: (sql) => db.prepare(sql),
      batch: (stmts) => db.batch(stmts),
      getBookmark: () => null,
    }),
    dump: () => Promise.resolve(new ArrayBuffer(0)),
  };

  return {
    db,
    calls: { prepareSql, execSql, batchRuns, runs },
  };
}
