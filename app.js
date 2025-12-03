// Конфігурація
const CONFIG = {
    AUTO_LOGOUT_MINUTES: 10,
    TYPING_TIMEOUT: 1000,
    MESSAGE_ANIMATION_DELAY: 100
};

// Глобальні змінні
let socket = null;
let currentUser = null;
let selectedUserId = null;
let users = [];
let typingTimeout = null;
let activityTimeout = null;
let isSidebarOpen = false;

// ==================== УТІЛІТИ ====================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <div>${message}</div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatLastSeen(dateString) {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'щойно';
    if (diffMins < 60) return `${diffMins} хв тому`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} год тому`;
    return date.toLocaleDateString('uk-UA');
}

// ==================== АВТОРИЗАЦІЯ ====================
function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    document.querySelector(`.tab[onclick*="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
    
    // Очищаємо помилки
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    document.getElementById('register-success').textContent = '';
}

async function login(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        document.getElementById('login-error').textContent = 'Заповніть всі поля';
        return false;
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вхід...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            initChat();
            showNotification('Успішний вхід!', 'success');
        } else {
            document.getElementById('login-error').textContent = data.error;
            showNotification(data.error, 'error');
        }
    } catch (error) {
        document.getElementById('login-error').textContent = 'Помилка з\'єднання';
        showNotification('Помилка з\'єднання з сервером', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
    
    return false;
}

async function register(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;
    
    if (password !== password2) {
        document.getElementById('register-error').textContent = 'Паролі не співпадають';
        return false;
    }
    
    if (username.length < 3) {
        document.getElementById('register-error').textContent = 'Логін має бути мінімум 3 символи';
        return false;
    }
    
    if (password.length < 6) {
        document.getElementById('register-error').textContent = 'Пароль має бути мінімум 6 символів';
        return false;
    }
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Реєстрація...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('register-success').textContent = 'Реєстрація успішна! Можете увійти';
            document.getElementById('register-error').textContent = '';
            showNotification('Реєстрація успішна!', 'success');
            
            // Автозаповнення форми входу
            switchTab('login');
            document.getElementById('login-username').value = username;
            document.getElementById('login-password').value = '';
        } else {
            document.getElementById('register-error').textContent = data.error;
            showNotification(data.error, 'error');
        }
    } catch (error) {
        document.getElementById('register-error').textContent = 'Помилка з\'єднання';
        showNotification('Помилка з\'єднання з сервером', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
    
    return false;
}

// ==================== ІНІЦІАЛІЗАЦІЯ ЧАТУ ====================
function initChat() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'flex';
    
    // Налаштування WebSocket
    socket = io();
    
    // Налаштування профілю
    document.getElementById('my-username').textContent = currentUser.username;
    document.getElementById('my-avatar').src = `/avatars/${currentUser.avatar}`;
    document.getElementById('modal-avatar').src = `/avatars/${currentUser.avatar}`;
    document.getElementById('modal-username').value = currentUser.username;
    
    // Повідомляємо сервер про вхід
    socket.emit('user-login', currentUser.id);
    
    // Отримуємо список користувачів
    loadUsers();
    
    // Налаштування подій WebSocket
    socket.on('users-list-updated', (usersList) => {
        users = usersList.filter(u => u.id !== currentUser.id);
        renderUsersList();
    });
    
    socket.on('new-message', (message) => {
        if (message.sender_id == selectedUserId || message.receiver_id == selectedUserId) {
            addMessageToChat(message);
            
            // Якщо чат відкритий, відмічаємо як прочитане
            if (message.sender_id == selectedUserId) {
                socket.emit('message-read', { 
                    messageId: message.id,
                    receiverId: currentUser.id 
                });
            }
        }
    });
    
    socket.on('user-typing', (data) => {
        if (data.from == selectedUserId) {
            showTypingIndicator(true);
        }
    });
    
    socket.on('user-status-changed', (data) => {
        const user = users.find(u => u.id == data.userId);
        if (user) {
            user.online = data.online ? 1 : 0;
            renderUsersList();
            
            // Оновлюємо статус у заголовку чату
            if (selectedUserId == data.userId) {
                const statusElement = document.querySelector('#current-chat-user .status');
                if (statusElement) {
                    statusElement.className = data.online ? 'status' : 'status offline';
                    statusElement.innerHTML = data.online ? 
                        '<span class="online-dot"></span> Онлайн' : 
                        'Офлайн';
                }
            }
        }
    });
    
    socket.on('message-sent', (message) => {
        // Оновлюємо статус повідомлення
        const messageElement = document.querySelector(`[data-message-id="${message.id}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement) {
                statusElement.innerHTML = getStatusIcon(message.status);
            }
        }
    });
    
    // Завантаження аватарок
    document.getElementById('avatar-upload').addEventListener('change', uploadAvatar);
    
    // Налаштування введення повідомлень
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('input', handleTyping);
    messageInput.addEventListener('keydown', handleKeyDown);
    
    // Адаптивність
    setupResponsive();
    
    // Таймер активності
    resetActivityTimer();
    setupActivityTracking();
    
    // Оновлення часу останньої активності
    setInterval(() => {
        document.getElementById('last-seen').value = new Date().toLocaleString('uk-UA');
    }, 60000);
        // ===== ДОДАЄМО АДМІН-КНОПКУ =====
    setTimeout(() => {
        const profileModal = document.getElementById('profile-modal');
        if (profileModal) {
            const logoutButton = profileModal.querySelector('.btn-secondary');
            if (logoutButton) {
                // Перевіряємо чи кнопка вже існує
                if (!document.getElementById('admin-toggle')) {
                    const adminButton = document.createElement('button');
                    adminButton.id = 'admin-toggle';
                    adminButton.className = 'btn';
                    adminButton.style.marginTop = '15px';
                    adminButton.style.background = 'var(--warning)';
                    adminButton.innerHTML = '<i class="fas fa-user-shield"></i> Адмін ВИКЛ';
                    adminButton.onclick = toggleAdminMode;
                    
                    logoutButton.parentNode.insertBefore(adminButton, logoutButton);
                }
            }
        }
    }, 500); // Невелика затримка для гарантії завантаження DOM
}

function setupResponsive() {
    // Перевіряємо ширину екрану
    const checkWidth = () => {
        if (window.innerWidth <= 768) {
            document.querySelector('.desktop-only').style.display = 'none';
            closeSidebar(); // На мобільних закриваємо сайдбар за замовчуванням
        } else {
            document.querySelector('.desktop-only').style.display = 'inline';
            openSidebar(); // На ПК відкриваємо сайдбар
        }
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (isSidebarOpen) {
        closeSidebar();
    } else {
        openSidebar();
    }
}

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.add('active');
    isSidebarOpen = true;
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('active');
    isSidebarOpen = false;
}

// ==================== РОБОТА З КОРИСТУВАЧАМИ ====================
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const usersList = await response.json();
        users = usersList.filter(u => u.id !== currentUser.id);
        renderUsersList();
    } catch (error) {
        console.error('Помилка завантаження користувачів:', error);
    }
}

function renderUsersList() {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fas fa-users fa-2x" style="margin-bottom: 15px;"></i>
                <p>Немає інших користувачів</p>
                <p style="font-size: 14px;">Запросіть колег приєднатися!</p>
            </div>
        `;
        return;
    }
    
    users.forEach(user => {
        const statusText = user.online ? 
            '<span class="online-dot"></span> Онлайн' : 
            `Був(ла) ${formatLastSeen(user.last_seen_display)}`;
        
        const userItem = document.createElement('div');
        userItem.className = `user-item ${user.id == selectedUserId ? 'active' : ''}`;
        userItem.onclick = () => selectUser(user.id);
        
        userItem.innerHTML = `
            <img class="user-avatar" src="/avatars/${user.avatar || 'default.png'}" 
                 alt="${user.username}" 
                 onerror="this.src='/avatars/default.png'">
            <div class="user-info">
                <div class="user-name" title="${user.username}">
                    ${user.username}
                </div>
                <div class="user-status ${user.online ? 'online' : 'offline'}">
                    ${statusText}
                </div>
            </div>
        `;
        
        container.appendChild(userItem);
    });
}

async function selectUser(userId) {
    selectedUserId = userId;
    renderUsersList();
    
    const user = users.find(u => u.id == userId);
    if (user) {
        document.getElementById('current-chat-user').innerHTML = `
            <img class="avatar" src="/avatars/${user.avatar || 'default.png'}" 
                 style="width: 50px; height: 50px;"
                 onerror="this.src='/avatars/default.png'">
            <div>
                <h3>${user.username}</h3>
                <div class="status ${user.online ? '' : 'offline'}">
                    ${user.online ? '<span class="online-dot"></span> Онлайн' : 'Офлайн'}
                </div>
            </div>
        `;
    }
    
    // На мобільних закриваємо сайдбар після вибору
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
    
    // Вмикаємо поле вводу
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
    
    // Завантажуємо історію повідомлень
    await loadMessages(userId);
}

// ==================== ПОВІДОМЛЕННЯ ====================
async function loadMessages(userId) {
    try {
        const response = await fetch(`/api/messages/${currentUser.id}/${userId}`);
        const messages = await response.json();
        
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comment-alt"></i>
                    <h3>Початок розмови</h3>
                    <p>Ще немає повідомлень. Напишіть перше повідомлення!</p>
                </div>
            `;
            return;
        }
        
        messages.forEach(msg => {
            addMessageToChat(msg, false);
        });
        
        // Прокручуємо вниз
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, CONFIG.MESSAGE_ANIMATION_DELAY);
    } catch (error) {
        console.error('Помилка завантаження повідомлень:', error);
    }
}

function addMessageToChat(message, scroll = true) {
    const container = document.getElementById('messages-container');
    
    // Видаляємо welcome message якщо воно є
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const isSent = message.sender_id == currentUser.id;
    const messageUser = users.find(u => u.id == message.sender_id) || currentUser;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'} slide-in-right`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    const time = formatTime(message.timestamp);
    
    messageDiv.innerHTML = `
        <img class="message-avatar" src="/avatars/${messageUser.avatar || 'default.png'}" 
             alt="${messageUser.username}"
             onerror="this.src='/avatars/default.png'">
        <div style="max-width: 100%;">
            <div class="message-content">${escapeHtml(message.message).replace(/\n/g, '<br>')}</div>
            <div class="message-time">
                ${time}
                ${isSent ? `<span class="message-status">${getStatusIcon(message.status)}</span>` : ''}
            </div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    
    if (scroll) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, CONFIG.MESSAGE_ANIMATION_DELAY);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusIcon(status) {
    switch(status) {
        case 'sent': return '<i class="fas fa-check" style="opacity: 0.5;"></i>';
        case 'delivered': return '<i class="fas fa-check-double" style="opacity: 0.7;"></i>';
        case 'read': return '<i class="fas fa-check-double" style="color: #58a6ff;"></i>';
        default: return '';
    }
}

function handleTyping() {
    if (!selectedUserId) return;
    
    // Відправляємо подію друкування
    socket.emit('typing', { to: selectedUserId, from: currentUser.id });
    
    // Автозбільшення поля вводу
    const textarea = document.getElementById('message-input');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    
    // Скидаємо таймер
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        showTypingIndicator(false);
    }, CONFIG.TYPING_TIMEOUT);
}

function handleKeyDown(e) {
    if (!selectedUserId) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
    // Shift+Enter залишаємо для нового рядка
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message || !selectedUserId || !currentUser) return;
    
    // Відправляємо через WebSocket
    socket.emit('private-message', {
        to: selectedUserId,
        message: message,
        from: currentUser.id
    });
    
    // Додаємо повідомлення локально
    const tempMessage = {
        id: Date.now(),
        sender_id: currentUser.id,
        receiver_id: selectedUserId,
        message: message,
        timestamp: new Date().toISOString(),
        status: 'sent'
    };
    
    addMessageToChat(tempMessage);
    
    // Очищаємо поле вводу
    input.value = '';
    input.style.height = 'auto';
    
    // Приховуємо індикатор друкування
    showTypingIndicator(false);
}

function showTypingIndicator(show) {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;
    
    if (show) {
        const user = users.find(u => u.id == selectedUserId);
        if (user) {
            indicator.textContent = `${user.username} друкує...`;
            indicator.style.display = 'block';
        }
    } else {
        indicator.textContent = '';
        indicator.style.display = 'none';
    }
}

// ==================== ПРОФІЛЬ ====================
function openProfileModal() {
    document.getElementById('profile-modal').style.display = 'flex';
    document.getElementById('last-seen').value = new Date().toLocaleString('uk-UA');
    document.body.style.overflow = 'hidden'; // Блокуємо прокрутку під модалкою
}

function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
    document.body.style.overflow = ''; // Відновлюємо прокрутку
    document.getElementById('profile-message').innerHTML = '';
    document.getElementById('new-username').value = '';
    document.getElementById('change-code').value = '';
}

async function uploadAvatar() {
    const fileInput = document.getElementById('avatar-upload');
    const file = fileInput.files[0];
    
    if (!file) return;
    
    // Перевірка розміру (5MB max)
    if (file.size > 5 * 1024 * 1024) {
        document.getElementById('profile-message').innerHTML = 
            '<div class="error">Файл занадто великий (макс. 5MB)</div>';
        return;
    }
    
    // Попередній перегляд
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('modal-avatar').src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', currentUser.id);
    
    try {
        const response = await fetch('/api/upload-avatar', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (data.success) {
            currentUser.avatar = data.avatar;
            document.getElementById('my-avatar').src = `/avatars/${data.avatar}`;
            document.getElementById('modal-avatar').src = `/avatars/${data.avatar}`;
            document.getElementById('profile-message').innerHTML = 
                '<div class="success">Аватар успішно оновлено!</div>';
            
            showNotification('Аватар оновлено!', 'success');
        } else {
            document.getElementById('profile-message').innerHTML = 
                `<div class="error">${data.error}</div>`;
        }
    } catch (error) {
        document.getElementById('profile-message').innerHTML = 
            '<div class="error">Помилка завантаження</div>';
    }
    
    fileInput.value = '';
}

async function changeUsername() {
    const newUsername = document.getElementById('new-username').value.trim();
    const code = document.getElementById('change-code').value;
    
    if (!newUsername || !code) {
        document.getElementById('profile-message').innerHTML = 
            '<div class="error">Заповніть всі поля</div>';
        return;
    }
    
    if (newUsername.length < 3) {
        document.getElementById('profile-message').innerHTML = 
            '<div class="error">Логін має бути мінімум 3 символи</div>';
        return;
    }
    
    try {
        const response = await fetch('/api/change-username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: currentUser.id, 
                newUsername, 
                code 
            })
        });
        
        const data = await response.json();
        const messageDiv = document.getElementById('profile-message');
        
        if (data.success) {
            currentUser.username = data.username;
            document.getElementById('my-username').textContent = data.username;
            document.getElementById('modal-username').value = data.username;
            messageDiv.innerHTML = '<div class="success">Логін успішно змінено!</div>';
            document.getElementById('new-username').value = '';
            document.getElementById('change-code').value = '';
            
            showNotification('Логін успішно змінено!', 'success');
        } else {
            messageDiv.innerHTML = `<div class="error">${data.error}</div>`;
        }
    } catch (error) {
        document.getElementById('profile-message').innerHTML = 
            '<div class="error">Помилка з\'єднання</div>';
    }
}

// ==================== АКТИВНІСТЬ ТА ВИХІД ====================
function setupActivityTracking() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetActivityTimer, { passive: true });
    });
}

function resetActivityTimer() {
    clearTimeout(activityTimeout);
    activityTimeout = setTimeout(() => {
        if (currentUser && socket) {
            showNotification('Сесія закінчилась. Будь ласка, увійдіть знову.', 'error');
            logout();
        }
    }, CONFIG.AUTO_LOGOUT_MINUTES * 60 * 1000);
}

function logout() {
    if (socket) {
        socket.emit('logout', currentUser.id);
        socket.disconnect();
    }
    
    // Повертаємося на сторінку входу
    document.getElementById('chat-container').style.display = 'none';
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').textContent = '';
    
    // Скидаємо стан
    currentUser = null;
    selectedUserId = null;
    users = [];
    
    showNotification('Ви вийшли з системи', 'info');
}

// ==================== ІНІЦІАЛІЗАЦІЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 MSG-CHAT 2.0 готовий до роботи!');
    console.log('💡 Підказки:');
    console.log('   1. Відкрийте два вікна браузера для тестування');
    console.log('   2. На ПК: ширина більше 768px - повний інтерфейс');
    console.log('   3. На мобільних: меню зліва, чат справа');
    console.log('   4. Enter - відправити, Shift+Enter - новий рядок');
    console.log('   5. Автовихід через 10 хв неактивності');
    console.log(`   6. Секретний код для зміни ніка: nick_label_manual`);
    
    // Автозаповнення для демо (видалити в продакшені)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        console.log('🔧 Локальне середовище: тестові дані відключені');
    }

// ==================== АДМІН-ПАНЕЛЬ ====================
let isAdminMode = false;
let adminColor = null;

function toggleAdminMode() {
    if (isAdminMode) {
        disableAdminMode();
        return;
    }
    
    const code = prompt('Введіть адмін-код:');
    if (code !== 'asn_manual_seton') {
        showNotification('Невірний адмін-код!', 'error');
        return;
    }
    
    isAdminMode = true;
    const adminBtn = document.getElementById('admin-toggle');
    if (adminBtn) {
        adminBtn.innerHTML = '<i class="fas fa-user-shield"></i> Адмін ВКЛ';
        adminBtn.style.background = '#238636';
    }
    
    // Створюємо меню ADS
    createAdminMenu();
    
    // Завантажуємо адмін-дані
    loadAdminData();
    
    showNotification('Адмін-режим активовано', 'success');
}

function disableAdminMode() {
    isAdminMode = false;
    const adminBtn = document.getElementById('admin-toggle');
    if (adminBtn) {
        adminBtn.innerHTML = '<i class="fas fa-user-shield"></i> Адмін ВИКЛ';
        adminBtn.style.background = 'var(--warning)';
    }
    
    // Видаляємо меню ADS
    removeAdminMenu();
    
    // Скидаємо колір повідомлень
    adminColor = null;
    if (currentUser) {
        saveAdminColor(null);
    }
    
    showNotification('Адмін-режим вимкнено', 'info');
}

function createAdminMenu() {
    const usersList = document.getElementById('users-list');
    if (!usersList) return; // Перевірка на null
    
    // Перевіряємо чи меню вже існує
    if (document.querySelector('.ads-header')) return;
    
    // Додаємо заголовок ADS
    const adsHeader = document.createElement('div');
    adsHeader.className = 'ads-header';
    adsHeader.innerHTML = `
        <div style="padding: 15px 20px; background: rgba(88, 166, 255, 0.1); border-bottom: 1px solid var(--border);">
            <h3 style="color: var(--primary); margin: 0;">
                <i class="fas fa-user-secret"></i> ADS - Адмін Панель
            </h3>
            <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                <button onclick="showAllUsers()" class="btn-small">
                    <i class="fas fa-users"></i> Всі юзери
                </button>
                <button onclick="showAllMessages()" class="btn-small">
                    <i class="fas fa-history"></i> Всі повідомлення
                </button>
                <button onclick="showColorPicker()" class="btn-small">
                    <i class="fas fa-palette"></i> Колір повід.
                </button>
            </div>
        </div>
    `;
    
    // Вставляємо перед списком користувачів
    if (usersList.parentNode) {
        usersList.parentNode.insertBefore(adsHeader, usersList);
        
        // Зберігаємо оригінальний список користувачів
        if (!window.originalUsersList) {
            window.originalUsersList = usersList.innerHTML;
        }
    }
    
    // Додаємо стилі для маленьких кнопок
    if (!document.querySelector('#admin-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-styles';
        style.innerHTML = `
            .btn-small {
                padding: 8px 12px;
                background: var(--bg-input);
                border: 1px solid var(--border);
                border-radius: 6px;
                color: var(--text);
                cursor: pointer;
                font-size: 12px;
                flex: 1;
                transition: all 0.3s;
                min-width: 100px;
            }
            .btn-small:hover {
                background: var(--primary);
                color: white;
            }
            .ads-header {
                flex-shrink: 0;
            }
            .admin-user-btn {
                background: none;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                padding: 5px;
                font-size: 16px;
                transition: color 0.3s;
            }
            .admin-user-btn:hover {
                color: var(--primary);
            }
        `;
        document.head.appendChild(style);
    }
}

function removeAdminMenu() {
    const adsHeader = document.querySelector('.ads-header');
    if (adsHeader) {
        adsHeader.remove();
    }
    
    // Відновлюємо оригінальний список
    const usersList = document.getElementById('users-list');
    if (window.originalUsersList) {
        usersList.innerHTML = window.originalUsersList;
    }
}

async function loadAdminData() {
    try {
        // Завантажуємо всіх користувачів
        const response = await fetch('/api/admin/all-users');
        const allUsers = await response.json();
        
        // Оновлюємо список користувачів з адмін-функціями
        updateUsersListWithAdmin(allUsers);
    } catch (error) {
        console.error('Помилка завантаження адмін-даних:', error);
    }
}

function updateUsersListWithAdmin(usersList) {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Перевірка на наявність користувачів
    if (!usersList || usersList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                <i class="fas fa-users fa-2x" style="margin-bottom: 15px;"></i>
                <p>Немає інших користувачів</p>
            </div>
        `;
        return;
    }
    
    usersList.filter(u => u.id !== currentUser.id).forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.onclick = () => selectUser(user.id); // Додаємо обробник кліку
        
        const lastSeen = user.last_seen ? formatLastSeen(user.last_seen) : 'ніколи';
        const messagesCount = (user.messages_sent || 0) + (user.messages_received || 0);
        
        userItem.innerHTML = `
            <img class="user-avatar" src="/avatars/${user.avatar || 'default.png'}" 
                 alt="${user.username}"
                 onerror="this.src='/avatars/default.png'">
            <div class="user-info" style="flex: 1;">
                <div class="user-name" title="${user.username}">
                    ${user.username}
                    <span style="font-size: 10px; background: var(--bg-input); padding: 2px 5px; border-radius: 3px; margin-left: 5px;">
                        ${messagesCount} повід.
                    </span>
                </div>
                <div class="user-status ${user.online ? 'online' : 'offline'}">
                    ${user.online ? '<span class="online-dot"></span> Онлайн' : `Був ${lastSeen}`}
                </div>
            </div>
            <button class="admin-user-btn" onclick="event.stopPropagation(); viewUserDetails(${user.id})" title="Деталі">
                <i class="fas fa-info-circle"></i>
            </button>
        `;
        
        container.appendChild(userItem);
    });
}
async function viewUserDetails(userId) {
    try {
        const response = await fetch(`/api/admin/user/${userId}`);
        const userData = await response.json();
        
        // Створюємо модальне вікно з деталями
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2><i class="fas fa-user"></i> Детальна інформація</h2>
                    <button class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</button>
                </div>
                
                <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                    <img src="/avatars/${userData.avatar || 'default.png'}" 
                         style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <h3>${userData.username}</h3>
                        <p><strong>ID:</strong> ${userData.id}</p>
                        <p><strong>Статус:</strong> ${userData.online ? '🟢 Онлайн' : '🔴 Офлайн'}</p>
                        <p><strong>Остання активність:</strong> ${new Date(userData.last_seen).toLocaleString('uk-UA')}</p>
                        <p><strong>Повідомлень відправлено:</strong> ${userData.messages_sent || 0}</p>
                        <p><strong>Повідомлень отримано:</strong> ${userData.messages_received || 0}</p>
                        <p><strong>Пароль (хеш):</strong> ${userData.password ? userData.password.substring(0, 30) + '...' : 'не знайдено'}</p>
                    </div>
                </div>
                
                <div style="margin-top: 20px;">
                    <button class="btn" onclick="kickUser(${userData.id})" style="background: var(--danger);">
                        <i class="fas fa-sign-out-alt"></i> Вигнати з акаунту
                    </button>
                </div>
                
                <div style="margin-top: 30px;">
                    <h3><i class="fas fa-comments"></i> Останні повідомлення</h3>
                    <div style="max-height: 300px; overflow-y: auto; margin-top: 10px; background: var(--bg-input); padding: 10px; border-radius: 8px;">
                        ${userData.messages.length === 0 ? '<p style="text-align: center; color: var(--text-secondary);">Немає повідомлень</p>' : 
                        userData.messages.map(msg => `
                            <div style="padding: 10px; border-bottom: 1px solid var(--border);">
                                <div style="display: flex; justify-content: space-between;">
                                    <strong>${msg.sender_name} → ${msg.receiver_name}</strong>
                                    <small>${formatTime(msg.timestamp)}</small>
                                </div>
                                <div style="margin-top: 5px; color: var(--text-secondary);">
                                    ${escapeHtml(msg.message).substring(0, 100)}${msg.message.length > 100 ? '...' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Помилка завантаження деталей:', error);
        showNotification('Помилка завантаження даних', 'error');
    }
}

async function kickUser(userId) {
    if (!confirm('Ви впевнені, що хочете вигнати цього користувача?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/kick-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        const data = await response.json();
        if (data.success) {
            showNotification('Користувача вигнано!', 'success');
            loadAdminData(); // Оновлюємо список
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        showNotification('Помилка сервера', 'error');
    }
}

async function showAllUsers() {
    try {
        const response = await fetch('/api/admin/all-users');
        const allUsers = await response.json();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h2><i class="fas fa-users"></i> Всі користувачі (${allUsers.length})</h2>
                    <button class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</button>
                </div>
                
                <div style="max-height: 500px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--bg-input);">
                                <th style="padding: 10px; text-align: left;">ID</th>
                                <th style="padding: 10px; text-align: left;">Логін</th>
                                <th style="padding: 10px; text-align: left;">Статус</th>
                                <th style="padding: 10px; text-align: left;">Остання активність</th>
                                <th style="padding: 10px; text-align: left;">Повідомлень</th>
                                <th style="padding: 10px; text-align: left;">Дії</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allUsers.map(user => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 10px;">${user.id}</td>
                                    <td style="padding: 10px;">
                                        <img src="/avatars/${user.avatar || 'default.png'}" 
                                             style="width: 30px; height: 30px; border-radius: 50%; vertical-align: middle; margin-right: 10px;">
                                        ${user.username}
                                    </td>
                                    <td style="padding: 10px;">
                                        ${user.online ? '<span style="color: var(--success);">🟢 Онлайн</span>' : '<span style="color: var(--text-secondary);">🔴 Офлайн</span>'}
                                    </td>
                                    <td style="padding: 10px;">
                                        ${user.last_seen ? formatLastSeen(user.last_seen) : 'ніколи'}
                                    </td>
                                    <td style="padding: 10px;">
                                        ${(user.messages_sent || 0) + (user.messages_received || 0)}
                                    </td>
                                    <td style="padding: 10px;">
                                        <button onclick="viewUserDetails(${user.id})" class="btn-small">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button onclick="kickUser(${user.id})" class="btn-small" style="background: var(--danger); margin-left: 5px;">
                                            <i class="fas fa-sign-out-alt"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Помилка:', error);
        showNotification('Помилка завантаження користувачів', 'error');
    }
}

async function showAllMessages() {
    try {
        const response = await fetch('/api/admin/all-messages');
        const messages = await response.json();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 1000px;">
                <div class="modal-header">
                    <h2><i class="fas fa-history"></i> Всі повідомлення (${messages.length})</h2>
                    <button class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</button>
                </div>
                
                <div style="max-height: 600px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: var(--bg-input);">
                                <th style="padding: 10px; text-align: left;">Дата</th>
                                <th style="padding: 10px; text-align: left;">Відправник</th>
                                <th style="padding: 10px; text-align: left;">Отримувач</th>
                                <th style="padding: 10px; text-align: left;">Повідомлення</th>
                                <th style="padding: 10px; text-align: left;">Статус</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${messages.map(msg => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 10px; white-space: nowrap;">
                                        ${formatTime(msg.timestamp)}<br>
                                        <small style="color: var(--text-secondary);">
                                            ${new Date(msg.timestamp).toLocaleDateString('uk-UA')}
                                        </small>
                                    </td>
                                    <td style="padding: 10px;">
                                        ${msg.sender_name} (ID: ${msg.sender_id})
                                    </td>
                                    <td style="padding: 10px;">
                                        ${msg.receiver_name} (ID: ${msg.receiver_id})
                                    </td>
                                    <td style="padding: 10px; max-width: 300px;">
                                        <div style="word-break: break-all; max-height: 100px; overflow-y: auto;">
                                            ${escapeHtml(msg.message)}
                                        </div>
                                    </td>
                                    <td style="padding: 10px;">
                                        <span style="color: ${msg.status === 'read' ? 'var(--success)' : 'var(--warning)'}">
                                            ${msg.status === 'read' ? 'Прочитано' : msg.status === 'delivered' ? 'Доставлено' : 'Відправлено'}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Помилка:', error);
        showNotification('Помилка завантаження повідомлень', 'error');
    }
}

function showColorPicker() {
    const colors = [
        '#58a6ff', // стандартний
        '#ff6b6b', '#4ecdc4', '#ffd166', '#06d6a0',
        '#118ab2', '#ef476f', '#073b4c', '#ff9a76',
        '#9d4edd', '#f72585', '#7209b7', '#3a86ff',
        '#fb5607', '#8338ec', '#ff006e', '#3a86ff'
    ];
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h2><i class="fas fa-palette"></i> Вибір кольору повідомлень</h2>
                <button class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
                <p>Оберіть колір для ваших повідомлень:</p>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 20px;">
                    <div style="padding: 20px; background: #58a6ff; border-radius: 8px; cursor: pointer; text-align: center; color: white;"
                         onclick="setAdminColor(null)">
                        <i class="fas fa-times"></i><br>
                        Стандартний
                    </div>
                    ${colors.map(color => `
                        <div style="padding: 20px; background: ${color}; border-radius: 8px; cursor: pointer;"
                             onclick="setAdminColor('${color}')">
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-top: 30px;">
                    <p>Поточний колір:</p>
                    <div id="current-color-preview" style="width: 100px; height: 50px; margin: 10px auto; border-radius: 8px; border: 2px solid var(--border); background: ${adminColor || '#58a6ff'};"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function setAdminColor(color) {
    adminColor = color;
    document.getElementById('current-color-preview').style.background = color || '#58a6ff';
    
    if (color) {
        showNotification(`Колір повідомлень змінено!`, 'success');
    } else {
        showNotification(`Колір повідомлень скинуто до стандартного`, 'info');
    }
    
    // Зберігаємо колір на сервері
    saveAdminColor(color);
}

async function saveAdminColor(color) {
    if (!currentUser) return;
    
    try {
        await fetch('/api/save-admin-color', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, color })
        });
    } catch (error) {
        console.error('Помилка збереження кольору:', error);
    }
}

// Оновлюємо функцію додавання повідомлення для врахування кольору
function addMessageToChat(message, scroll = true) {
    const container = document.getElementById('messages-container');
    
    // Видаляємо welcome message якщо воно є
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const isSent = message.sender_id == currentUser.id;
    const messageUser = users.find(u => u.id == message.sender_id) || currentUser;
    
    // Визначаємо колір повідомлення
    const messageColor = message.color || (isAdminMode && adminColor && isSent ? adminColor : null);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'} slide-in-right`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    const time = formatTime(message.timestamp);
    
    messageDiv.innerHTML = `
        <img class="message-avatar" src="/avatars/${messageUser.avatar || 'default.png'}" 
             alt="${messageUser.username}"
             onerror="this.src='/avatars/default.png'">
        <div style="max-width: 100%;">
            <div class="message-content" ${messageColor ? `style="background: ${messageColor}"` : ''}>
                ${escapeHtml(message.message).replace(/\n/g, '<br>')}
            </div>
            <div class="message-time">
                ${time}
                ${isSent ? `<span class="message-status">${getStatusIcon(message.status)}</span>` : ''}
            </div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    
    if (scroll) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, CONFIG.MESSAGE_ANIMATION_DELAY);
    }
}

});