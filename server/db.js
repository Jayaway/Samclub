import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'campus.sqlite'));

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL,
    avatar TEXT DEFAULT '',
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
    total_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_buy_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    original_price REAL NOT NULL,
    total_quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    is_split_allowed INTEGER DEFAULT 0,
    is_frozen INTEGER DEFAULT 0,
    unit_price REAL NOT NULL,
    FOREIGN KEY (group_buy_id) REFERENCES group_buys(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_buy_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal REAL NOT NULL,
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
`);

export default db;
