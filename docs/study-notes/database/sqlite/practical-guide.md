---
title: "SQLite实战指南"
aliases:
  - "SQLite实战"
  - "SQLite应用"
tags:
  - "后端"
  - "数据库"
  - "sqlite"
  - "实战"
  - "笔记"
category: "后端"
folder: "SQLite"
parent: "[[目录]]"
related:
  - "[[后端/数据库/SQLite/SQLite性能优化]]"
  - "[[后端/数据库/SQLite/SQLite高级特性]]"
  - "[[目录]]"
created: 2026-09-06
updated: 2026-09-06
---

# 05 SQLite 实战指南

本章通过真实案例展示 SQLite 在各种场景下的最佳实践，包括 Web 应用、移动开发、数据分析、并发处理、数据库迁移等。

## 5.1 Web 应用中的 SQLite

### 5.1.1 Flask 应用示例

```python
from flask import Flask, g, jsonify, request
import sqlite3

app = Flask(__name__)
DATABASE = 'myapp.sqlite'

def get_db():
    """获取数据库连接（每个请求一个连接）"""
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        # 优化配置
        g.db.execute('PRAGMA journal_mode=WAL')
        g.db.execute('PRAGMA foreign_keys=ON')
        g.db.execute('PRAGMA busy_timeout=5000')
    return g.db

@app.teardown_appcontext
def close_db(exception):
    """请求结束关闭连接"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """初始化数据库"""
    db = get_db()
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
        CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
    ''')

@app.route('/api/users', methods=['POST'])
def create_user():
    db = get_db()
    data = request.json
    try:
        with db:
            cursor = db.execute(
                'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                (data['username'], data['email'], data['password_hash'])
            )
        return jsonify({'id': cursor.lastrowid}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 409

@app.route('/api/users/<int:user_id>/posts')
def get_user_posts(user_id):
    db = get_db()
    posts = db.execute('''
        SELECT p.*, u.username 
        FROM posts p 
        JOIN users u ON p.user_id = u.id 
        WHERE p.user_id = ? 
        ORDER BY p.created_at DESC
        LIMIT 20
    ''', (user_id,)).fetchall()
    return jsonify([dict(post) for post in posts])

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True)
```

### 5.1.2 Django 配置

```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {
            'timeout': 5,
            'init_command': '''
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;
                PRAGMA foreign_keys=ON;
                PRAGMA cache_size=-20000;
            ''',
        },
    }
}
```

### 5.1.3 FastAPI 示例

```python
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import sqlite3
from contextlib import contextmanager

app = FastAPI()

DATABASE = 'myapp.sqlite'

@contextmanager
def get_db():
    """数据库连接上下文管理器"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('PRAGMA busy_timeout=5000')
    try:
        yield conn
    finally:
        conn.close()

class UserCreate(BaseModel):
    username: str
    email: str

@app.post('/users')
def create_user(user: UserCreate):
    with get_db() as conn:
        try:
            with conn:
                cursor = conn.execute(
                    'INSERT INTO users (username, email) VALUES (?, ?)',
                    (user.username, user.email)
                )
            return {'id': cursor.lastrowid}
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=409, detail='User already exists')

@app.get('/users/{user_id}')
def get_user(user_id: int):
    with get_db() as conn:
        user = conn.execute(
            'SELECT * FROM users WHERE id = ?', (user_id,)
        ).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        return dict(user)
```

## 5.2 移动应用开发

### 5.2.1 Android（Kotlin）

```kotlin
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class AppDatabase(context: Context) : SQLiteOpenHelper(
    context, DATABASE_NAME, null, DATABASE_VERSION
) {
    companion object {
        const val DATABASE_NAME = "myapp.db"
        const val DATABASE_VERSION = 1
    }

    override fun onCreate(db: SQLiteDatabase) {
        // 启用 WAL 模式
        db.enableWriteAheadLogging()
        
        // 创建表
        db.execSQL("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """)
        
        db.execSQL("""
            CREATE TABLE notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        
        // 创建索引
        db.execSQL("CREATE INDEX idx_notes_user_id ON notes(user_id)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE users ADD COLUMN phone TEXT")
        }
    }

    override fun onConfigure(db: SQLiteDatabase) {
        super.onConfigure(db)
        db.setForeignKeyConstraintsEnabled(true)
    }
}

// 使用示例
class UserRepository(private val db: AppDatabase) {
    fun insertUser(name: String, email: String): Long {
        val values = ContentValues().apply {
            put("name", name)
            put("email", email)
        }
        return db.writableDatabase.insert("users", null, values)
    }

    fun getUser(userId: Long): User? {
        val cursor = db.readableDatabase.rawQuery(
            "SELECT * FROM users WHERE id = ?",
            arrayOf(userId.toString())
        )
        return cursor.use {
            if (it.moveToFirst()) {
                User(
                    id = it.getLong(0),
                    name = it.getString(1),
                    email = it.getString(2)
                )
            } else null
        }
    }
}
```

### 5.2.2 iOS（Swift）

```swift
import SQLite3

class DatabaseManager {
    private var db: OpaquePointer?
    private let dbPath: String

    init() {
        let fileManager = FileManager.default
        let documentsDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        dbPath = documentsDirectory.appendingPathComponent("myapp.sqlite").path
        
        openDatabase()
        createTables()
    }

    private func openDatabase() {
        if sqlite3_open(dbPath, &db) != SQLITE_OK {
            print("Error opening database")
            return
        }
        
        // 启用 WAL 模式
        executeQuery("PRAGMA journal_mode=WAL")
        executeQuery("PRAGMA foreign_keys=ON")
        executeQuery("PRAGMA busy_timeout=5000")
    }

    private func createTables() {
        let createUsersTable = """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                created_at TEXT DEFAULT (datetime('now'))
            )
        """
        executeQuery(createUsersTable)
        
        let createNotesTable = """
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """
        executeQuery(createNotesTable)
        
        executeQuery("CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id)")
    }

    private func executeQuery(_ query: String) {
        var errMsg: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(db, query, nil, nil, &errMsg) != SQLITE_OK {
            let errorMessage = String(cString: errMsg!)
            print("Error executing query: \(errorMessage)")
            sqlite3_free(errMsg)
        }
    }

    func insertUser(name: String, email: String) -> Int64? {
        let insertQuery = "INSERT INTO users (name, email) VALUES (?, ?)"
        var statement: OpaquePointer?
        
        if sqlite3_prepare_v2(db, insertQuery, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_text(statement, 1, (name as NSString).utf8String, -1, nil)
            sqlite3_bind_text(statement, 2, (email as NSString).utf8String, -1, nil)
            
            if sqlite3_step(statement) == SQLITE_DONE {
                let id = sqlite3_last_insert_rowid(db)
                sqlite3_finalize(statement)
                return id
            }
        }
        
        sqlite3_finalize(statement)
        return nil
    }

    func getUsers() -> [(id: Int64, name: String, email: String)] {
        var users: [(Int64, String, String)] = []
        let query = "SELECT id, name, email FROM users ORDER BY created_at DESC"
        var statement: OpaquePointer?
        
        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            while sqlite3_step(statement) == SQLITE_ROW {
                let id = sqlite3_column_int64(statement, 0)
                let name = String(cString: sqlite3_column_text(statement, 1))
                let email = String(cString: sqlite3_column_text(statement, 2))
                users.append((id, name, email))
            }
        }
        
        sqlite3_finalize(statement)
        return users
    }
}
```

## 5.3 数据分析与处理

### 5.3.1 CSV 数据处理

```python
import sqlite3
import csv
import pandas as pd

# 方法 1：使用 pandas（简单）
df = pd.read_csv('large_data.csv')
conn = sqlite3.connect('analysis.db')
df.to_sql('data', conn, index=False, if_exists='replace')

# 使用 SQL 分析
result = pd.read_sql('''
    SELECT category, 
           COUNT(*) as count,
           AVG(value) as avg_value,
           SUM(value) as total
    FROM data
    GROUP BY category
    ORDER BY total DESC
''', conn)

# 方法 2：纯 SQLite（内存效率更高）
conn = sqlite3.connect('analysis.db')
conn.execute('PRAGMA journal_mode=WAL')

# 创建表
conn.execute('''
    CREATE TABLE IF NOT EXISTS data (
        id INTEGER PRIMARY KEY,
        category TEXT,
        value REAL,
        date TEXT
    )
''')

# 批量导入
with open('large_data.csv', 'r') as f:
    reader = csv.DictReader(f)
    batch = []
    for row in reader:
        batch.append((row['category'], float(row['value']), row['date']))
        if len(batch) >= 10000:
            conn.executemany(
                'INSERT INTO data (category, value, date) VALUES (?, ?, ?)',
                batch
            )
            batch = []
    if batch:
        conn.executemany(
            'INSERT INTO data (category, value, date) VALUES (?, ?, ?)',
            batch
        )

conn.commit()

# 创建索引加速分析
conn.execute('CREATE INDEX idx_data_category ON data(category)')
conn.execute('CREATE INDEX idx_data_date ON data(date)')

# 分析查询
results = conn.execute('''
    WITH monthly_stats AS (
        SELECT 
            strftime('%Y-%m', date) as month,
            category,
            COUNT(*) as count,
            AVG(value) as avg_value,
            SUM(value) as total
        FROM data
        GROUP BY month, category
    )
    SELECT * FROM monthly_stats
    WHERE total > (SELECT AVG(total) * 2 FROM monthly_stats)
    ORDER BY total DESC
''').fetchall()

conn.close()
```

### 5.3.2 JSON 数据处理

```python
import sqlite3
import json

conn = sqlite3.connect('json_data.db')

# 创建包含 JSON 列的表
conn.execute('''
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        event_type TEXT,
        event_data TEXT,  -- JSON 格式
        created_at TEXT DEFAULT (datetime('now'))
    )
''')

# 插入 JSON 数据
events = [
    ('click', {'page': '/home', 'button': 'signup', 'user_id': 123}),
    ('view', {'page': '/products', 'duration': 45, 'user_id': 456}),
    ('purchase', {'product_id': 789, 'amount': 99.99, 'user_id': 123})
]

conn.executemany(
    'INSERT INTO events (event_type, event_data) VALUES (?, ?)',
    [(e[0], json.dumps(e[1])) for e in events]
)
conn.commit()

# 查询 JSON 数据
results = conn.execute('''
    SELECT 
        event_type,
        json_extract(event_data, '$.user_id') as user_id,
        json_extract(event_data, '$.page') as page
    FROM events
    WHERE json_extract(event_data, '$.user_id') = 123
''').fetchall()

# 聚合 JSON 数据
results = conn.execute('''
    SELECT 
        event_type,
        COUNT(*) as count,
        json_group_array(json_extract(event_data, '$.user_id')) as user_ids
    FROM events
    GROUP BY event_type
''').fetchall()

conn.close()
```

## 5.4 并发处理模式

### 5.4.1 多进程访问

```python
import sqlite3
import multiprocessing
import time

def worker(worker_id, db_path):
    """工作进程"""
    conn = sqlite3.connect(db_path, timeout=10)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA busy_timeout=10000')
    
    for i in range(100):
        try:
            with conn:
                conn.execute(
                    'INSERT INTO logs (worker_id, message) VALUES (?, ?)',
                    (worker_id, f'Message {i} from worker {worker_id}')
                )
        except sqlite3.OperationalError as e:
            print(f'Worker {worker_id} error: {e}')
            time.sleep(0.1)
    
    conn.close()

if __name__ == '__main__':
    db_path = 'multi_process.db'
    
    # 初始化数据库
    conn = sqlite3.connect(db_path)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY,
            worker_id INTEGER,
            message TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    ''')
    conn.close()
    
    # 启动多个进程
    processes = []
    for i in range(5):
        p = multiprocessing.Process(target=worker, args=(i, db_path))
        p.start()
        processes.append(p)
    
    for p in processes:
        p.join()
    
    # 验证结果
    conn = sqlite3.connect(db_path)
    count = conn.execute('SELECT COUNT(*) FROM logs').fetchone()[0]
    print(f'Total logs: {count}')  # 应该是 500
    conn.close()
```

### 5.4.2 读写分离

```python
import sqlite3
import threading

class ReadWriteSplit:
    """读写分离模式"""
    
    def __init__(self, db_path):
        self.db_path = db_path
        self.write_lock = threading.Lock()
        
        # 初始化
        self._execute_write('PRAGMA journal_mode=WAL')
    
    def _get_read_conn(self):
        """获取只读连接"""
        conn = sqlite3.connect(
            f'file:{self.db_path}?mode=ro',
            uri=True,
            check_same_thread=False
        )
        conn.row_factory = sqlite3.Row
        return conn
    
    def _get_write_conn(self):
        """获取读写连接"""
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA busy_timeout=5000')
        return conn
    
    def _execute_write(self, sql, params=()):
        """执行写操作"""
        with self.write_lock:
            conn = self._get_write_conn()
            try:
                with conn:
                    conn.execute(sql, params)
            finally:
                conn.close()
    
    def read(self, sql, params=()):
        """读操作"""
        conn = self._get_read_conn()
        try:
            return conn.execute(sql, params).fetchall()
        finally:
            conn.close()
    
    def write(self, sql, params=()):
        """写操作"""
        self._execute_write(sql, params)

# 使用
db = ReadWriteSplit('myapp.db')

# 读操作（可并发）
users = db.read('SELECT * FROM users WHERE age > ?', (18,))

# 写操作（串行化）
db.write('INSERT INTO users (name, age) VALUES (?, ?)', ('Alice', 25))
```

## 5.5 数据库迁移

### 5.5.1 版本管理

```python
import sqlite3

def get_version(conn):
    """获取数据库版本"""
    try:
        result = conn.execute('PRAGMA user_version').fetchone()
        return result[0]
    except:
        return 0

def set_version(conn, version):
    """设置数据库版本"""
    conn.execute(f'PRAGMA user_version = {version}')

def migrate(db_path):
    """执行迁移"""
    conn = sqlite3.connect(db_path)
    current_version = get_version(conn)
    
    migrations = [
        # 版本 1：初始表
        (1, [
            '''CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE
            )''',
            '''CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                title TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )'''
        ]),
        
        # 版本 2：添加 phone 字段
        (2, [
            'ALTER TABLE users ADD COLUMN phone TEXT',
            'CREATE INDEX idx_users_phone ON users(phone)'
        ]),
        
        # 版本 3：添加 created_at
        (3, [
            "ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT (datetime('now'))",
            "ALTER TABLE posts ADD COLUMN created_at TEXT DEFAULT (datetime('now'))"
        ])
    ]
    
    for version, queries in migrations:
        if current_version < version:
            print(f'Migrating to version {version}...')
            try:
                for query in queries:
                    conn.execute(query)
                set_version(conn, version)
                conn.commit()
                print(f'Successfully migrated to version {version}')
            except Exception as e:
                conn.rollback()
                print(f'Migration failed: {e}')
                raise
    
    conn.close()

# 使用
migrate('myapp.db')
```

### 5.5.2 Alembic 集成

```python
# alembic.ini
[alembic]
script_location = alembic
sqlalchemy.url = sqlite:///myapp.db

# alembic/env.py
from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config
target_metadata = None

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix='sqlalchemy.',
        poolclass=pool.NullPool,
        connect_args={
            'timeout': 10,
            'check_same_thread': False
        }
    )
    
    with connectable.connect() as connection:
        # 启用 WAL 模式
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True  # SQLite 需要 batch 模式
        )
        
        with context.begin_transaction():
            context.run_migrations()

# 迁移脚本示例
# alembic/versions/001_initial.py
def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), unique=True)
    )

def downgrade():
    op.drop_table('users')
```

## 5.6 备份与恢复策略

### 5.6.1 自动备份脚本

```python
import sqlite3
import shutil
from datetime import datetime
import os

class SQLiteBackup:
    def __init__(self, db_path, backup_dir):
        self.db_path = db_path
        self.backup_dir = backup_dir
        os.makedirs(backup_dir, exist_ok=True)
    
    def backup(self):
        """创建备份"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(
            self.backup_dir,
            f'backup_{timestamp}.sqlite'
        )
        
        # 使用 SQLite 备份 API（安全，不锁定数据库）
        source = sqlite3.connect(self.db_path)
        target = sqlite3.connect(backup_path)
        
        try:
            source.backup(target)
            print(f'Backup created: {backup_path}')
            
            # 验证备份
            self._verify_backup(backup_path)
            
        finally:
            source.close()
            target.close()
        
        return backup_path
    
    def _verify_backup(self, backup_path):
        """验证备份完整性"""
        conn = sqlite3.connect(backup_path)
        try:
            result = conn.execute('PRAGMA integrity_check').fetchone()
            if result[0] == 'ok':
                print('Backup integrity: OK')
            else:
                print(f'Backup integrity check failed: {result}')
        finally:
            conn.close()
    
    def cleanup(self, keep_days=7):
        """清理旧备份"""
        cutoff = datetime.now().timestamp() - (keep_days * 86400)
        
        for filename in os.listdir(self.backup_dir):
            if filename.startswith('backup_') and filename.endswith('.sqlite'):
                filepath = os.path.join(self.backup_dir, filename)
                if os.path.getmtime(filepath) < cutoff:
                    os.remove(filepath)
                    print(f'Removed old backup: {filename}')

# 使用
backup_manager = SQLiteBackup('myapp.db', '/backups/sqlite')
backup_manager.backup()
backup_manager.cleanup(keep_days=30)
```

### 5.6.2 增量备份

```python
import sqlite3
import subprocess
from datetime import datetime

class IncrementalBackup:
    def __init__(self, db_path, backup_dir):
        self.db_path = db_path
        self.backup_dir = backup_dir
    
    def full_backup(self):
        """完整备份"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = f'{self.backup_dir}/full_{timestamp}.sqlite'
        
        source = sqlite3.connect(self.db_path)
        target = sqlite3.connect(backup_path)
        source.backup(target)
        source.close()
        target.close()
        
        # 记录备份位置
        conn = sqlite3.connect(self.db_path)
        page_count = conn.execute('PRAGMA page_count').fetchone()[0]
        conn.close()
        
        with open(f'{backup_path}.meta', 'w') as f:
            f.write(f'page_count={page_count}\n')
            f.write(f'timestamp={timestamp}\n')
        
        return backup_path
    
    def wal_checkpoint(self):
        """检查点 WAL 文件"""
        conn = sqlite3.connect(self.db_path)
        conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        conn.close()

# 定时任务示例（cron）
# 每小时执行一次 WAL 检查点
# 0 * * * * python /scripts/wal_checkpoint.py
# 每天凌晨 2 点完整备份
# 0 2 * * * python /scripts/full_backup.py
```

## 5.7 常见问题解决

### 5.7.1 "database is locked" 错误

```python
import sqlite3
import time

def safe_execute(conn, sql, params=(), max_retries=5):
    """安全执行，处理数据库锁定"""
    for attempt in range(max_retries):
        try:
            with conn:
                return conn.execute(sql, params)
        except sqlite3.OperationalError as e:
            if 'database is locked' in str(e):
                if attempt < max_retries - 1:
                    wait_time = 0.1 * (2 ** attempt)  # 指数退避
                    print(f'Database locked, retrying in {wait_time}s...')
                    time.sleep(wait_time)
                else:
                    raise
            else:
                raise

# 预防措施
conn = sqlite3.connect('myapp.db')
conn.execute('PRAGMA journal_mode=WAL')
conn.execute('PRAGMA busy_timeout=10000')  # 10 秒超时
conn.execute('PRAGMA synchronous=NORMAL')
```

### 5.7.2 数据库损坏恢复

```python
import sqlite3
import subprocess

def check_integrity(db_path):
    """检查数据库完整性"""
    conn = sqlite3.connect(db_path)
    result = conn.execute('PRAGMA integrity_check').fetchall()
    conn.close()
    
    if result[0][0] == 'ok':
        print('Database integrity: OK')
        return True
    else:
        print('Database corruption detected:')
        for row in result:
            print(f'  {row[0]}')
        return False

def recover_database(db_path, recovered_path):
    """恢复损坏的数据库"""
    # 方法 1：使用 .recover 命令
    try:
        result = subprocess.run(
            ['sqlite3', db_path, '.recover'],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            # 将恢复的 SQL 导入新数据库
            with open(recovered_path, 'w') as f:
                f.write(result.stdout)
            
            # 创建新数据库
            new_db = sqlite3.connect(f'{recovered_path}.db')
            new_db.executescript(result.stdout)
            new_db.close()
            
            print(f'Recovery successful: {recovered_path}.db')
            return True
    except Exception as e:
        print(f'Recovery failed: {e}')
    
    # 方法 2：导出可读取的数据
    try:
        conn = sqlite3.connect(db_path)
        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
        
        recovered_conn = sqlite3.connect(recovered_path)
        
        for (table_name,) in tables:
            try:
                # 尝试读取表数据
                data = conn.execute(f'SELECT * FROM {table_name}').fetchall()
                
                # 获取表结构
                schema = conn.execute(
                    f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table_name}'"
                ).fetchone()[0]
                
                # 在恢复的数据库中创建表
                recovered_conn.execute(schema)
                
                # 插入数据
                if data:
                    placeholders = ','.join(['?' for _ in data[0]])
                    recovered_conn.executemany(
                        f'INSERT INTO {table_name} VALUES ({placeholders})',
                        data
                    )
                
                print(f'Recovered table: {table_name} ({len(data)} rows)')
                
            except Exception as e:
                print(f'Failed to recover table {table_name}: {e}')
        
        conn.close()
        recovered_conn.close()
        
    except Exception as e:
        print(f'Recovery failed: {e}')
        return False
    
    return True

# 使用
if not check_integrity('myapp.db'):
    recover_database('myapp.db', 'recovered.sql')
```

### 5.7.3 性能问题排查

```python
import sqlite3

def diagnose_performance(db_path):
    """诊断性能问题"""
    conn = sqlite3.connect(db_path)
    
    print('=== SQLite Performance Diagnosis ===\n')
    
    # 1. 基本配置
    print('1. Configuration:')
    for pragma in ['journal_mode', 'synchronous', 'cache_size', 
                   'page_size', 'wal_autocheckpoint']:
        result = conn.execute(f'PRAGMA {pragma}').fetchone()
        print(f'   {pragma}: {result[0]}')
    
    # 2. 数据库大小
    print('\n2. Database Size:')
    page_count = conn.execute('PRAGMA page_count').fetchone()[0]
    page_size = conn.execute('PRAGMA page_size').fetchone()[0]
    db_size_mb = (page_count * page_size) / (1024 * 1024)
    print(f'   Total size: {db_size_mb:.2f} MB')
    print(f'   Page count: {page_count}')
    print(f'   Page size: {page_size} bytes')
    
    # 3. 表统计
    print('\n3. Table Statistics:')
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    
    for (table_name,) in tables:
        count = conn.execute(f'SELECT COUNT(*) FROM {table_name}').fetchone()[0]
        print(f'   {table_name}: {count} rows')
    
    # 4. 索引统计
    print('\n4. Index Statistics:')
    indexes = conn.execute(
        "SELECT name, tbl_name FROM sqlite_master WHERE type='index'"
    ).fetchall()
    
    for idx_name, table_name in indexes:
        print(f'   {idx_name} on {table_name}')
    
    # 5. WAL 状态
    print('\n5. WAL Status:')
    wal_size = conn.execute('PRAGMA wal_checkpoint').fetchone()
    print(f'   WAL checkpoint: {wal_size}')
    
    # 6. 碎片检查
    print('\n6. Fragmentation:')
    freelist = conn.execute('PRAGMA freelist_count').fetchone()[0]
    print(f'   Free pages: {freelist}')
    if freelist > 0:
        print(f'   Suggestion: Run VACUUM to reclaim {freelist * page_size / 1024 / 1024:.2f} MB')
    
    conn.close()

# 使用
diagnose_performance('myapp.db')
```

## 5.8 最佳实践总结

### 5.8.1 架构设计

```text
✅ 推荐：
  · 单写者模式（避免写入冲突）
  · 读写分离（多个只读连接）
  · 连接池（复用连接）
  · 定期备份（自动 + 手动）
  · 版本管理（user_version）

❌ 避免：
  · 多进程同时写入
  · 长时间持有连接
  · 大事务（拆分小事务）
  · 忽略错误处理
  · 不备份数据库
```

### 5.8.2 代码规范

```python
# ✅ 好的实践
class DatabaseManager:
    def __init__(self, db_path):
        self.db_path = db_path
    
    def get_connection(self):
        """获取优化配置的連接"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA foreign_keys=ON')
        conn.execute('PRAGMA busy_timeout=5000')
        return conn
    
    def execute(self, sql, params=()):
        """执行写操作"""
        conn = self.get_connection()
        try:
            with conn:
                cursor = conn.execute(sql, params)
                return cursor.lastrowid
        finally:
            conn.close()
    
    def query(self, sql, params=()):
        """执行查询"""
        conn = self.get_connection()
        try:
            return conn.execute(sql, params).fetchall()
        finally:
            conn.close()

# ❌ 避免的做法
# 1. 不关闭连接
conn = sqlite3.connect('mydb.db')
conn.execute('INSERT INTO ...')
# 忘记关闭！

# 2. 不用事务
for item in items:
    conn.execute('INSERT INTO ...', item)  # 每行自动提交

# 3. SQL 注入
conn.execute(f"SELECT * FROM users WHERE name = '{user_input}'")

# 4. 忽略错误
try:
    conn.execute('INSERT INTO ...')
except:
    pass  # 忽略所有错误
```

### 5.8.3 部署检查清单

```text
部署前检查：
  □ 启用 WAL 模式
  □ 启用外键约束
  □ 设置 busy_timeout
  □ 创建必要的索引
  □ 测试数据库迁移
  □ 配置自动备份
  □ 设置监控告警
  □ 文档化恢复流程

性能检查：
  □ 使用 EXPLAIN QUERY PLAN 检查查询
  □ 批量操作使用事务
  □ 预编译常用查询
  □ 定期 ANALYZE
  □ 定期 VACUUM（如果需要）

安全检查：
  □ 使用参数化查询
  □ 限制文件权限
  □ 加密敏感数据（SQLCipher）
  □ 定期备份到异地
```

---

## 本章小结

- Web 应用：每个请求一个连接，启用 WAL，使用上下文管理器
- 移动应用：启用 WAL，使用原生 API，处理版本升级
- 数据分析：批量导入，创建索引，使用窗口函数
- 并发处理：单写者模式，读写分离，忙等超时
- 数据库迁移：版本管理，Alembic 集成
- 备份恢复：自动备份，增量备份，完整性检查
- 问题排查：数据库锁定、损坏恢复、性能诊断
- 最佳实践：连接管理、事务使用、参数化查询
