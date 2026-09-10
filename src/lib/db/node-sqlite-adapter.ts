/**
 * Prisma driver adapter for Node's built-in `node:sqlite` module.
 *
 * Why this exists: Prisma's official SQLite adapters (better-sqlite3, libsql) depend on
 * native binaries that are not published for Windows on ARM64, so they fall back to a
 * from-source build that needs Python and MSVC. Node 24 ships SQLite inside the runtime,
 * so this file ports Prisma's own better-sqlite3 adapter onto `node:sqlite` one-to-one.
 *
 * Server-only. Never import this from a client component.
 */
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ColumnTypeEnum,
  DriverAdapterError,
  type ArgType,
  type ColumnType,
  type IsolationLevel,
  type MappedError,
  type SqlDriverAdapter,
  type SqlMigrationAwareDriverAdapterFactory,
  type SqlQuery,
  type SqlQueryable,
  type SqlResultSet,
  type Transaction,
  type TransactionOptions,
} from "@prisma/driver-adapter-utils";

export const ADAPTER_NAME = "pith-ink:node-sqlite";

export type TimestampFormat = "iso8601" | "unixepoch-ms";

export type NodeSqliteAdapterOptions = {
  /** `file:./relative/path.db`, `file:/absolute/path.db`, or `:memory:`. */
  url: string;
  /** Busy timeout in milliseconds while another connection holds the write lock. */
  timeout?: number;
  /** Shadow database used by `prisma migrate dev`; defaults to in-memory. */
  shadowDatabaseUrl?: string;
  /** How DateTime values are written. Prisma's SQLite convention is ISO-8601. */
  timestampFormat?: TimestampFormat;
};

type SqlInput = null | number | bigint | string | Uint8Array;

// ---------------------------------------------------------------------------
// Column type mapping (mirrors @prisma/adapter-better-sqlite3)
// ---------------------------------------------------------------------------

function mapDeclType(declType: string | null): ColumnType | null {
  if (declType === null) return null;
  switch (declType.toUpperCase()) {
    case "":
      return null;
    case "DECIMAL":
      return ColumnTypeEnum.Numeric;
    case "FLOAT":
      return ColumnTypeEnum.Float;
    case "DOUBLE":
    case "DOUBLE PRECISION":
    case "NUMERIC":
    case "REAL":
      return ColumnTypeEnum.Double;
    case "TINYINT":
    case "SMALLINT":
    case "MEDIUMINT":
    case "INT":
    case "INTEGER":
    case "SERIAL":
    case "INT2":
      return ColumnTypeEnum.Int32;
    case "BIGINT":
    case "UNSIGNED BIG INT":
    case "INT8":
      return ColumnTypeEnum.Int64;
    case "DATETIME":
    case "TIMESTAMP":
      return ColumnTypeEnum.DateTime;
    case "TIME":
      return ColumnTypeEnum.Time;
    case "DATE":
      return ColumnTypeEnum.Date;
    case "TEXT":
    case "CLOB":
    case "CHARACTER":
    case "VARCHAR":
    case "VARYING CHARACTER":
    case "NCHAR":
    case "NATIVE CHARACTER":
    case "NVARCHAR":
      return ColumnTypeEnum.Text;
    case "BLOB":
      return ColumnTypeEnum.Bytes;
    case "BOOLEAN":
      return ColumnTypeEnum.Boolean;
    case "JSONB":
      return ColumnTypeEnum.Json;
    default:
      return null;
  }
}

function inferColumnType(value: unknown): ColumnType {
  switch (typeof value) {
    case "string":
      return ColumnTypeEnum.Text;
    case "bigint":
      return ColumnTypeEnum.Int64;
    case "boolean":
      return ColumnTypeEnum.Boolean;
    case "number":
      return ColumnTypeEnum.UnknownNumber;
    case "object":
      if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        return ColumnTypeEnum.Bytes;
      }
      break;
  }
  throw new Error(`node-sqlite adapter: unexpected value of type ${typeof value} in result set`);
}

/** Declared types win; untyped columns (expressions, aggregates) are inferred from the first non-null value. */
function getColumnTypes(declaredTypes: Array<string | null>, rows: unknown[][]): ColumnType[] {
  return declaredTypes.map((declared, index) => {
    const mapped = mapDeclType(declared);
    if (mapped !== null) return mapped;
    for (const row of rows) {
      const candidate = row[index];
      if (candidate !== null && candidate !== undefined) return inferColumnType(candidate);
    }
    return ColumnTypeEnum.Int32;
  });
}

function mapRow(row: unknown[], columnTypes: ColumnType[]): unknown[] {
  return row.map((value, index) => {
    const type = columnTypes[index];
    if (
      typeof value === "number" &&
      (type === ColumnTypeEnum.Int32 || type === ColumnTypeEnum.Int64) &&
      !Number.isInteger(value)
    ) {
      return Math.trunc(value);
    }
    if ((typeof value === "number" || typeof value === "bigint") && type === ColumnTypeEnum.DateTime) {
      return new Date(Number(value)).toISOString();
    }
    if (typeof value === "bigint") {
      const asNumber = Number(value);
      return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
    }
    return value;
  });
}

function mapArg(arg: unknown, argType: ArgType, options: NodeSqliteAdapterOptions): SqlInput {
  if (arg === null || arg === undefined) return null;

  if (typeof arg === "string") {
    switch (argType.scalarType) {
      case "int":
        return Number.parseInt(arg, 10);
      case "float":
      case "decimal":
        return Number.parseFloat(arg);
      case "bigint":
        return BigInt(arg);
      case "bytes":
        return Buffer.from(arg, "base64");
      case "datetime":
        arg = new Date(arg);
        break;
    }
  }

  if (typeof arg === "boolean") return arg ? 1 : 0;

  if (arg instanceof Date) {
    switch (options.timestampFormat ?? "iso8601") {
      case "unixepoch-ms":
        return arg.getTime();
      case "iso8601":
        return arg.toISOString().replace("Z", "+00:00");
    }
  }

  if (typeof arg === "number" || typeof arg === "bigint" || typeof arg === "string") return arg;
  if (arg instanceof Uint8Array) return arg;
  if (arg instanceof ArrayBuffer) return new Uint8Array(arg);
  if (typeof arg === "object") return JSON.stringify(arg);
  return String(arg);
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

type SqliteError = Error & { code: string; errcode: number; errstr: string };

const SQLITE_BUSY = 5;
const PRIMARY_ERROR_CODE_MASK = 0xff;
const SQLITE_CONSTRAINT_FOREIGNKEY = 787;
const SQLITE_CONSTRAINT_NOTNULL = 1299;
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555;
const SQLITE_CONSTRAINT_TRIGGER = 1811;
const SQLITE_CONSTRAINT_UNIQUE = 2067;

function isSqliteError(error: unknown): error is SqliteError {
  return (
    error instanceof Error &&
    (error as Partial<SqliteError>).code === "ERR_SQLITE_ERROR" &&
    typeof (error as Partial<SqliteError>).errcode === "number"
  );
}

function fieldsFromMessage(message: string): string[] | undefined {
  return message
    .split("constraint failed: ")
    .at(1)
    ?.split(", ")
    .map((field) => field.split(".").pop() ?? field);
}

function mapSqliteError(error: SqliteError): MappedError {
  const { errcode, message } = error;
  switch (errcode) {
    case SQLITE_CONSTRAINT_UNIQUE:
    case SQLITE_CONSTRAINT_PRIMARYKEY: {
      const columns = message.split("constraint failed: ").at(1)?.split(", ");
      const fields = fieldsFromMessage(message);
      const table = columns?.at(0)?.split(".").slice(0, -1).join(".") || undefined;
      return {
        kind: "UniqueConstraintViolation",
        constraint: fields !== undefined ? { fields } : undefined,
        table,
      };
    }
    case SQLITE_CONSTRAINT_NOTNULL: {
      const fields = fieldsFromMessage(message);
      return {
        kind: "NullConstraintViolation",
        constraint: fields !== undefined ? { fields } : undefined,
      };
    }
    case SQLITE_CONSTRAINT_FOREIGNKEY:
    case SQLITE_CONSTRAINT_TRIGGER:
      return { kind: "ForeignKeyConstraintViolation", constraint: { foreignKey: {} } };
  }

  if ((errcode & PRIMARY_ERROR_CODE_MASK) === SQLITE_BUSY) {
    return { kind: "SocketTimeout" };
  }
  if (message.startsWith("no such table")) {
    return { kind: "TableDoesNotExist", table: message.split(": ").at(1) };
  }
  if (message.startsWith("no such column")) {
    return { kind: "ColumnNotFound", column: message.split(": ").at(1) };
  }
  if (message.includes("has no column named ")) {
    return { kind: "ColumnNotFound", column: message.split("has no column named ").at(1) };
  }
  return { kind: "sqlite", extendedCode: errcode, message };
}

function toDriverError(error: unknown): unknown {
  if (!isSqliteError(error)) return error;
  return new DriverAdapterError({
    originalCode: String(error.errcode),
    originalMessage: error.message,
    ...mapSqliteError(error),
  });
}

// ---------------------------------------------------------------------------
// A minimal promise mutex so only one transaction runs on the connection at a time.
// ---------------------------------------------------------------------------

class Mutex {
  #queue: Promise<void> = Promise.resolve();

  acquire(): Promise<() => void> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const acquired = this.#queue.then(() => release);
    this.#queue = this.#queue.then(() => gate);
    return acquired;
  }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

class NodeSqliteQueryable implements SqlQueryable {
  readonly provider = "sqlite" as const;
  readonly adapterName = ADAPTER_NAME;

  constructor(
    protected readonly db: DatabaseSync,
    protected readonly adapterOptions: NodeSqliteAdapterOptions,
  ) {}

  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const { columnNames, declaredTypes, rows } = this.performIO(query);
    const columnTypes = getColumnTypes(declaredTypes, rows);
    return {
      columnNames,
      columnTypes,
      rows: rows.map((row) => mapRow(row, columnTypes)),
    };
  }

  async executeRaw(query: SqlQuery): Promise<number> {
    return this.executeIO(query);
  }

  protected bindArgs(query: SqlQuery): SqlInput[] {
    return query.args.map((arg, index) => mapArg(arg, query.argTypes[index], this.adapterOptions));
  }

  private executeIO(query: SqlQuery): number {
    try {
      const statement = this.db.prepare(query.sql);
      const result = statement.run(...this.bindArgs(query));
      return Number(result.changes);
    } catch (error) {
      throw toDriverError(error);
    }
  }

  private performIO(query: SqlQuery): {
    columnNames: string[];
    declaredTypes: Array<string | null>;
    rows: unknown[][];
  } {
    try {
      const statement = this.db.prepare(query.sql);
      const columns = statement.columns();
      const args = this.bindArgs(query);

      // A statement without result columns (INSERT/UPDATE without RETURNING, PRAGMA setters, ...)
      if (columns.length === 0) {
        statement.run(...args);
        return { columnNames: [], declaredTypes: [], rows: [] };
      }

      statement.setReadBigInts(true); // never lose precision on 64-bit integers
      statement.setReturnArrays(true); // rows as positional arrays, like better-sqlite3 raw mode
      const rows = statement.all(...args) as unknown as unknown[][];
      return {
        columnNames: columns.map((column) => column.name),
        declaredTypes: columns.map((column) => column.type),
        rows,
      };
    } catch (error) {
      throw toDriverError(error);
    }
  }
}

class NodeSqliteTransaction extends NodeSqliteQueryable implements Transaction {
  readonly options: TransactionOptions = { usePhantomQuery: false };
  readonly #release: () => void;

  constructor(db: DatabaseSync, adapterOptions: NodeSqliteAdapterOptions, release: () => void) {
    super(db, adapterOptions);
    this.#release = release;
  }

  // Prisma sends the actual COMMIT / ROLLBACK statements itself (usePhantomQuery: false);
  // these hooks only hand the connection back.
  async commit(): Promise<void> {
    this.#release();
  }

  async rollback(): Promise<void> {
    this.#release();
  }

  async createSavepoint(name: string): Promise<void> {
    await this.executeRaw({ sql: `SAVEPOINT ${name}`, args: [], argTypes: [] });
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    await this.executeRaw({ sql: `ROLLBACK TO ${name}`, args: [], argTypes: [] });
  }

  async releaseSavepoint(name: string): Promise<void> {
    await this.executeRaw({ sql: `RELEASE SAVEPOINT ${name}`, args: [], argTypes: [] });
  }
}

class NodeSqliteAdapter extends NodeSqliteQueryable implements SqlDriverAdapter {
  readonly #mutex = new Mutex();

  async executeScript(script: string): Promise<void> {
    try {
      this.db.exec(script);
    } catch (error) {
      throw toDriverError(error);
    }
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    if (isolationLevel && isolationLevel !== "SERIALIZABLE") {
      throw new DriverAdapterError({ kind: "InvalidIsolationLevel", level: isolationLevel });
    }
    const release = await this.#mutex.acquire();
    try {
      this.db.exec("BEGIN");
    } catch (error) {
      release();
      throw toDriverError(error);
    }
    return new NodeSqliteTransaction(this.db, this.adapterOptions, release);
  }

  async dispose(): Promise<void> {
    this.db.close();
  }
}

/** Turns `file:./x.db` / `file:/abs/x.db` into a filesystem path; leaves `:memory:` alone. */
export function resolveSqliteLocation(url: string): string {
  if (url === ":memory:" || url === "file::memory:") return ":memory:";
  const withoutScheme = url.replace(/^file:/, "");
  const withoutQuery = withoutScheme.split("?")[0];
  return path.resolve(process.cwd(), withoutQuery);
}

function openDatabase(url: string, options: NodeSqliteAdapterOptions): DatabaseSync {
  return new DatabaseSync(resolveSqliteLocation(url), {
    timeout: options.timeout ?? 5000,
    enableForeignKeyConstraints: true,
  });
}

/**
 * Factory handed to `new PrismaClient({ adapter })`.
 */
export class PrismaNodeSqlite implements SqlMigrationAwareDriverAdapterFactory {
  readonly provider = "sqlite" as const;
  readonly adapterName = ADAPTER_NAME;

  constructor(private readonly options: NodeSqliteAdapterOptions) {}

  async connect(): Promise<SqlDriverAdapter> {
    return new NodeSqliteAdapter(openDatabase(this.options.url, this.options), this.options);
  }

  async connectToShadowDb(): Promise<SqlDriverAdapter> {
    const url = this.options.shadowDatabaseUrl ?? ":memory:";
    return new NodeSqliteAdapter(openDatabase(url, this.options), this.options);
  }
}
