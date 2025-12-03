const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Налаштування
const PORT = process.env.PORT || 3000;
const SECRET_CODE = 'nick_label_manual';
const ADMIN_CODE = 'asn_manual_seton';

// Створюємо папки якщо немає
if (!fs.existsSync('avatars')) {
    fs.mkdirSync('avatars');
}

// Створюємо просту дефолтну аватарку
const createDefaultAvatar = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="100" fill="#2d333b"/>
        <circle cx="100" cy="80" r="40" fill="#58a6ff"/>
        <path d="M100 140 Q60 240 140 240 Q180 180 100 140" fill="#58a6ff"/>
    </svg>`;
    fs.writeFileSync('avatars/default.png', svg);
};

if (!fs.existsSync('avatars/default.png')) {
    createDefaultAvatar();
}

// Налаштування завантаження файлів
const storage = multer.diskStorage({
    destination: 'avatars/',
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Тільки зображення дозволені!'));
        }
    }
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Підключення до бази даних
const db = new sqlite3.Database('chat.db', (err) => {
    if (err) {
        console.error('Помилка підключення до БД:', err);
    } else {
        console.log('✅ Підключено до бази даних');
        initializeDatabase();
    }
});

// Ініціалізація БД
function initializeDatabase() {
    // Створюємо таблицю users з адмін-полями
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT DEFAULT 'default.png',
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        online BOOLEAN DEFAULT 0,
        socket_id TEXT,
        admin_color TEXT,
        is_admin BOOLEAN DEFAULT 0
    )`, (err) => {
        if (err) console.error('Помилка створення users:', err);
    });

    // Створюємо таблицю messages з полем color
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'sent',
        color TEXT
    )`, (err) => {
        if (err) console.error('Помилка створення messages:', err);
    });

    // Створюємо індекси
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, receiver_id)`, (err) => {
        if (err) console.error('Помилка створення idx_messages_users:', err);
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_online ON users(online, last_seen)`, (err) => {
        if (err) console.error('Помилка створення idx_users_online:', err);
    });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/avatars', express.static('avatars'));

// ==================== БАЗОВІ API ====================

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Заповніть всі поля' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'Логін має бути мінімум 3 символи' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль має бути мінімум 6 символів' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", 
            [username, hashedPassword], 
            function(err) {
                if (err) {
                    return res.status(400).json({ error: 'Користувач вже існує' });
                }
                res.json({ 
                    success: true, 
                    userId: this.lastID, 
                    username,
                    avatar: 'default.png'
                });
            }
        );
    } catch (error) {
        console.error('Помилка реєстрації:', error);
        res.status(500).json({ error: 'Помилка сервера' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Заповніть всі поля' });
    }
    
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) {
            console.error('Помилка БД при вході:', err);
            return res.status(500).json({ error: 'Помилка сервера' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Користувача не знайдено' });
        }
        
        try {
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Невірний пароль' });
            }
            
            db.run("UPDATE users SET online = 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
            
            res.json({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    avatar: user.avatar || 'default.png',
                    admin_color: user.admin_color || null
                } 
            });
        } catch (error) {
            console.error('Помилка порівняння пароля:', error);
            res.status(500).json({ error: 'Помилка сервера' });
        }
    });
});

app.post('/api/change-username', (req, res) => {
    const { userId, newUsername, code } = req.body;
    
    if (code !== SECRET_CODE) {
        return res.status(403).json({ error: 'Невірний код доступу' });
    }
    
    if (!newUsername || newUsername.length < 3) {
        return res.status(400).json({ error: 'Логін має бути мінімум 3 символи' });
    }
    
    db.run("UPDATE users SET username = ? WHERE id = ?", [newUsername, userId], function(err) {
        if (err) {
            console.error('Помилка зміни ніка:', err);
            return res.status(400).json({ error: 'Цей нік вже зайнятий' });
        }
        res.json({ success: true, username: newUsername });
    });
});

app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не вибрано' });
        }
        
        db.get("SELECT avatar FROM users WHERE id = ?", [userId], (err, user) => {
            if (err) {
                console.error('Помилка отримання аватара:', err);
                return res.status(500).json({ error: 'Помилка сервера' });
            }
            
            // Видаляємо стару аватарку (якщо не дефолтна)
            if (user && user.avatar !== 'default.png') {
                const oldPath = path.join('avatars', user.avatar);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            
            db.run("UPDATE users SET avatar = ? WHERE id = ?", [req.file.filename, userId], (err) => {
                if (err) {
                    console.error('Помилка оновлення аватара:', err);
                    return res.status(500).json({ error: 'Помилка сервера' });
                }
                res.json({ success: true, avatar: req.file.filename });
            });
        });
    } catch (error) {
        console.error('Помилка завантаження:', error);
        res.status(500).json({ error: 'Помилка завантаження' });
    }
});

app.get('/api/users', (req, res) => {
    db.all(`SELECT id, username, avatar, online,
            CASE 
                WHEN online = 1 THEN 'online'
                ELSE strftime('%H:%M', last_seen, 'localtime')
            END as last_seen_display
            FROM users 
            ORDER BY online DESC, username`, 
    (err, users) => {
        if (err) {
            console.error('Помилка отримання користувачів:', err);
            return res.status(500).json({ error: 'Помилка бази даних' });
        }
        res.json(users || []);
    });
});

app.get('/api/messages/:userId1/:userId2', (req, res) => {
    const { userId1, userId2 } = req.params;
    
    db.all(`SELECT m.*, u.username as sender_name, u.avatar as sender_avatar
            FROM messages m 
            JOIN users u ON m.sender_id = u.id 
            WHERE (m.sender_id = ? AND m.receiver_id = ?) 
               OR (m.sender_id = ? AND m.receiver_id = ?) 
            ORDER BY m.timestamp`,
    [userId1, userId2, userId2, userId1], (err, messages) => {
        if (err) {
            console.error('Помилка завантаження повідомлень:', err);
            return res.status(500).json({ error: 'Помилка завантаження повідомлень' });
        }
        res.json(messages || []);
    });
});

// ==================== АДМІН API ====================

app.get('/api/admin/all-messages', (req, res) => {
    db.all(`SELECT m.*, 
            s.username as sender_name, 
            r.username as receiver_name
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            JOIN users r ON m.receiver_id = r.id
            ORDER BY m.timestamp DESC
            LIMIT 1000`, 
    (err, messages) => {
        if (err) {
            console.error('Помилка отримання всіх повідомлень:', err);
            return res.status(500).json({ error: 'Помилка бази даних' });
        }
        res.json(messages || []);
    });
});

app.get('/api/admin/all-users', (req, res) => {
    db.all(`SELECT id, username, avatar, online,
            last_seen,
            (SELECT COUNT(*) FROM messages WHERE sender_id = users.id) as messages_sent,
            (SELECT COUNT(*) FROM messages WHERE receiver_id = users.id) as messages_received
            FROM users 
            ORDER BY username`, 
    (err, users) => {
        if (err) {
            console.error('Помилка отримання всіх користувачів:', err);
            return res.status(500).json({ error: 'Помилка бази даних' });
        }
        res.json(users || []);
    });
});

app.get('/api/admin/user/:id', (req, res) => {
    const userId = req.params.id;
    
    db.get(`SELECT id, username, avatar, online, last_seen,
            (SELECT COUNT(*) FROM messages WHERE sender_id = ?) as messages_sent,
            (SELECT COUNT(*) FROM messages WHERE receiver_id = ?) as messages_received
            FROM users WHERE id = ?`, 
    [userId, userId, userId], (err, user) => {
        if (err) {
            console.error('Помилка отримання користувача:', err);
            return res.status(500).json({ error: 'Помилка сервера' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'Користувача не знайдено' });
        }
        
        // Отримуємо всі повідомлення користувача
        db.all(`SELECT m.*, 
                s.username as sender_name, 
                r.username as receiver_name
                FROM messages m
                JOIN users s ON m.sender_id = s.id
                JOIN users r ON m.receiver_id = r.id
                WHERE m.sender_id = ? OR m.receiver_id = ?
                ORDER BY m.timestamp DESC
                LIMIT 100`,
        [userId, userId], (err2, messages) => {
            if (err2) {
                console.error('Помилка завантаження повідомлень:', err2);
                return res.status(500).json({ error: 'Помилка завантаження повідомлень' });
            }
            
            // Отримуємо пароль (тільки для адміна!)
            db.get("SELECT password FROM users WHERE id = ?", [userId], (err3, passData) => {
                if (err3) {
                    console.error('Помилка отримання пароля:', err3);
                }
                
                const response = {
                    ...user,
                    messages: messages || [],
                    password: passData ? passData.password : null
                };
                res.json(response);
            });
        });
    });
});

app.post('/api/admin/kick-user', (req, res) => {
    const { userId } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Не вказано ID користувача' });
    }
    
    // Оновлюємо статус користувача
    db.run("UPDATE users SET online = 0, socket_id = NULL WHERE id = ?", [userId], (err) => {
        if (err) {
            console.error('Помилка вигнання користувача:', err);
            return res.status(500).json({ error: 'Помилка бази даних' });
        }
        
        // Відключаємо користувача через WebSocket
        const socketId = onlineUsers.get(parseInt(userId));
        if (socketId) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('admin-kicked');
                socket.disconnect();
            }
            onlineUsers.delete(parseInt(userId));
        }
        
        res.json({ success: true, message: 'Користувача вигнано' });
    });
});

app.post('/api/save-admin-color', (req, res) => {
    const { userId, color } = req.body;
    
    if (!userId) {
        return res.status(400).json({ error: 'Не вказано ID користувача' });
    }
    
    db.run("UPDATE users SET admin_color = ? WHERE id = ?", [color, userId], (err) => {
        if (err) {
            console.error('Помилка збереження кольору:', err);
            return res.status(500).json({ error: 'Помилка бази даних' });
        }
        res.json({ success: true });
    });
});

// ==================== WEBSOCKET ====================

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('👤 Користувач підключився:', socket.id);

    socket.on('user-login', (userId) => {
        console.log('👤 Користувач увійшов:', userId);
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        
        db.run("UPDATE users SET online = 1, socket_id = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?", 
            [socket.id, userId]);
        
        // Повідомляємо всім про нового онлайн-користувача
        io.emit('user-status-changed', { userId, online: true });
        
        // Оновлюємо список користувачів для всіх
        updateUsersList();
    });

    socket.on('private-message', ({ to, message, from, color }) => {
        if (!message || !to || !from) return;
        
        console.log(`💬 Повідомлення від ${from} до ${to}: ${message.substring(0, 50)}...`);
        
        const timestamp = new Date().toISOString();
        
        db.run(`INSERT INTO messages (sender_id, receiver_id, message, status, color) 
                VALUES (?, ?, ?, 'delivered', ?)`, 
            [from, to, message, color], 
            function(err) {
                if (err) {
                    console.error('Помилка збереження повідомлення:', err);
                    return;
                }
                
                const messageData = {
                    id: this.lastID,
                    sender_id: from,
                    receiver_id: to,
                    message,
                    timestamp,
                    status: 'delivered',
                    color: color || null
                };
                
                // Відправляємо одержувачу
                const receiverSocketId = onlineUsers.get(parseInt(to));
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('new-message', messageData);
                    
                    // Оновлюємо статус на "прочитано"
                    db.run("UPDATE messages SET status = 'read' WHERE id = ?", [this.lastID]);
                    messageData.status = 'read';
                }
                
                // Підтвердження відправнику
                socket.emit('message-sent', messageData);
            }
        );
    });

    socket.on('typing', ({ to, from }) => {
        const receiverSocketId = onlineUsers.get(parseInt(to));
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('user-typing', { from });
        }
    });

    socket.on('logout', (userId) => {
        console.log('👤 Користувач вийшов:', userId);
        updateUserStatus(userId, false);
        onlineUsers.delete(userId);
    });

    socket.on('admin-kicked', () => {
        console.log('👤 Адмін вигнав користувача:', socket.userId);
        if (socket.userId) {
            updateUserStatus(socket.userId, false);
            onlineUsers.delete(socket.userId);
        }
    });

    socket.on('disconnect', () => {
        console.log('👤 Користувач відключився:', socket.id);
        if (socket.userId) {
            updateUserStatus(socket.userId, false);
            onlineUsers.delete(socket.userId);
        }
    });
});

function updateUserStatus(userId, online) {
    db.run("UPDATE users SET online = ? WHERE id = ?", [online ? 1 : 0, userId], (err) => {
        if (err) console.error('Помилка оновлення статусу:', err);
    });
    io.emit('user-status-changed', { userId, online });
}

function updateUsersList() {
    db.all("SELECT id, username, avatar, online FROM users", (err, users) => {
        if (err) {
            console.error('Помилка оновлення списку користувачів:', err);
        } else {
            io.emit('users-list-updated', users || []);
        }
    });
}

// Автоматичний логаут через 10 хв неактивності
setInterval(() => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    db.run(`UPDATE users SET online = 0 WHERE last_seen < ? AND online = 1`, 
        [tenMinutesAgo], (err) => {
            if (err) console.error('Помилка автоматичного логауту:', err);
        });
}, 60000);

// Обробка помилок
process.on('uncaughtException', (err) => {
    console.error('🔴 Непередбачена помилка:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('🔴 Необроблена помилка промісу:', err);
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущено: http://localhost:${PORT}`);
    console.log(`📱 Адаптивний дизайн для ПК та мобільних`);
    console.log(`🔒 Секретний код для зміни ніка: ${SECRET_CODE}`);
    console.log(`🔐 Адмін-код: ${ADMIN_CODE}`);
    console.log(`💡 Для тесту: відкрийте два вікна/вкладки браузера`);
    console.log(`👑 Адмін-панель доступна в налаштуваннях профілю`);
    console.log(`📊 Переконайтеся, що база даних chat.db створена успішно`);
});