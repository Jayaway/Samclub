import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'campus.sqlite'));

// 启用 WAL 模式和外键约束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    payment_qr TEXT DEFAULT '',
    dorm_building TEXT DEFAULT '',
    credit_score INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS group_buys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creator_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    deadline DATETIME NOT NULL,
    status TEXT DEFAULT '进行中',
    delivery_mode TEXT DEFAULT '',
    pickup_location TEXT DEFAULT '',
    payment_remark TEXT DEFAULT '',
    total_amount REAL DEFAULT 0,
    delivered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_buy_id INTEGER NOT NULL,
    product_type TEXT DEFAULT 'fixed',
    name TEXT NOT NULL,
    original_price REAL NOT NULL,
    total_quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    needs_cold_chain INTEGER DEFAULT 0,
    unit_price REAL NOT NULL,
    allow_split INTEGER DEFAULT 0,
    split_unit TEXT DEFAULT '',
    split_quantity INTEGER DEFAULT 0,
    split_price_per_unit REAL DEFAULT 0,
    split_remaining_quantity INTEGER,
    self_retain_quantity INTEGER DEFAULT 0,
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_buy_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    purchase_type TEXT DEFAULT 'whole',
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS cost_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_buy_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    base_amount REAL DEFAULT 0,
    share_fee REAL DEFAULT 0,
    leader_discount REAL DEFAULT 0,
    final_amount REAL DEFAULT 0,
    paid_status TEXT DEFAULT '未付',
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_buy_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    proof_image TEXT DEFAULT '',
    confirm_time DATETIME,
    status TEXT DEFAULT '待确认',
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_buy_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS platform_revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_buy_id INTEGER NOT NULL UNIQUE,
    diff_cents INTEGER NOT NULL DEFAULT 0,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id)
  );

  CREATE TABLE IF NOT EXISTS alipay_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    out_trade_no TEXT UNIQUE NOT NULL,
    group_buy_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'WAIT_BUYER_PAY',
    trade_no TEXT DEFAULT '',
    buyer_logon_id TEXT DEFAULT '',
    notify_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// 迁移：添加新字段（对已有表安全执行）
const migrations = [
  "ALTER TABLE products ADD COLUMN allow_split INTEGER DEFAULT 0",
  "ALTER TABLE products ADD COLUMN split_unit TEXT DEFAULT ''",
  "ALTER TABLE products ADD COLUMN split_quantity INTEGER DEFAULT 0",
  "ALTER TABLE products ADD COLUMN split_price_per_unit REAL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''",
  "ALTER TABLE products ADD COLUMN needs_cold_chain INTEGER DEFAULT 0",
  "ALTER TABLE products ADD COLUMN self_retain_quantity INTEGER DEFAULT 0",
  "ALTER TABLE group_buys ADD COLUMN delivered_at DATETIME",
  "CREATE TABLE IF NOT EXISTS platform_revenue (id INTEGER PRIMARY KEY AUTOINCREMENT, group_buy_id INTEGER NOT NULL UNIQUE, diff_cents INTEGER NOT NULL DEFAULT 0, recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (group_buy_id) REFERENCES group_buys(id))",
  "ALTER TABLE products ADD COLUMN split_remaining_quantity INTEGER",
  "ALTER TABLE order_items ADD COLUMN purchase_type TEXT DEFAULT 'whole'",
  "ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'fixed'",
  "ALTER TABLE group_buys ADD COLUMN payment_remark TEXT DEFAULT ''",
  "ALTER TABLE users ADD COLUMN payment_qr TEXT DEFAULT ''",
  "CREATE TABLE IF NOT EXISTS alipay_trades (id INTEGER PRIMARY KEY AUTOINCREMENT, out_trade_no TEXT UNIQUE NOT NULL, group_buy_id INTEGER NOT NULL, user_id INTEGER NOT NULL, amount REAL NOT NULL, subject TEXT NOT NULL, status TEXT DEFAULT 'WAIT_BUYER_PAY', trade_no TEXT DEFAULT '', buyer_logon_id TEXT DEFAULT '', notify_time DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (group_buy_id) REFERENCES group_buys(id), FOREIGN KEY (user_id) REFERENCES users(id))",
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (error) {
    // 仅忽略 "duplicate column name" 错误，其他错误打印日志
    if (!error.message.includes('duplicate column name')) {
      console.error('Migration error:', error.message);
    }
  }
}

// 创建索引以提升查询性能
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_order_items_group_user ON order_items(group_buy_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_payments_group_user ON payments(group_buy_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_buy_id);
  CREATE INDEX IF NOT EXISTS idx_products_group ON products(group_buy_id);
  CREATE INDEX IF NOT EXISTS idx_cost_details_group ON cost_details(group_buy_id);
`);

export default db;
