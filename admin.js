// admin.js - ПРОСТА і робоча адмін-панель
// ====================================================

console.log('🔧 Простий адмін-модуль завантажується...');

const ADMIN_CODE = 'asn_manual_seton';
let isAdminMode = false;
let adminColor = null;

// ==================== ОСНОВНІ ФУНКЦІЇ ====================

function initAdminModule() {
    console.log('🔧 Ініціалізація простого адмін-модуля...');
    addAdminButton();
    addAdminStyles();
    exportFunctions();
}

function addAdminButton() {
    const interval = setInterval(() => {
        const profileModal = document.getElementById('profile-modal');
        if (!profileModal) return;
        
        if (document.getElementById('admin-toggle-btn')) {
            clearInterval(interval);
            return;
        }
        
        const logoutButton = profileModal.querySelector('.btn-secondary');
        if (!logoutButton) return;
        
        const adminButton = document.createElement('button');
        adminButton.id = 'admin-toggle-btn';
        adminButton.className = 'admin-toggle-button';
        adminButton.innerHTML = '<i class="fas fa-user-shield"></i> Адмін ВИКЛ';
        adminButton.onclick = toggleAdminMode;
        
        logoutButton.parentNode.insertBefore(adminButton, logoutButton);
        clearInterval(interval);
    }, 500);
}

function addAdminStyles() {
    if (document.getElementById('admin-styles')) return;
    
    const styles = `
        .admin-toggle-button {
            width: 100%;
            padding: 14px;
            margin-top: 15px;
            background: #d29922;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
        }
        .admin-toggle-button:hover {
            background: #b58900;
        }
        .admin-toggle-button.active {
            background: #238636;
        }
        .admin-toggle-button.active:hover {
            background: #196c2e;
        }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'admin-styles';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}

// ==================== АДМІН-РЕЖИМ ====================

function toggleAdminMode() {
    if (isAdminMode) {
        disableAdminMode();
        return;
    }
    
    const code = prompt('🔐 Введіть адмін-код:');
    if (code !== ADMIN_CODE) {
        alert('❌ Невірний код!');
        return;
    }
    
    isAdminMode = true;
    document.getElementById('admin-toggle-btn').classList.add('active');
    document.getElementById('admin-toggle-btn').innerHTML = '<i class="fas fa-user-shield"></i> Адмін ВКЛ';
    
    // Просто сповіщення
    alert('👑 Адмін-режим увімкнено!\n\nТепер у списку користувачів з\'явиться кнопка "ADS".\nНатисніть на неї для доступу до адмін-функцій.');
    
    // Створюємо просту ADS кнопку в сайдбарі
    createSimpleADSButton();
}

function disableAdminMode() {
    isAdminMode = false;
    document.getElementById('admin-toggle-btn').classList.remove('active');
    document.getElementById('admin-toggle-btn').innerHTML = '<i class="fas fa-user-shield"></i> Адмін ВИКЛ';
    
    // Видаляємо ADS кнопку
    removeADSButton();
    alert('🔒 Адмін-режим вимкнено');
}

function createSimpleADSButton() {
    // Перевіряємо чи вже є кнопка
    if (document.getElementById('ads-admin-btn')) return;
    
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    
    const adsButton = document.createElement('button');
    adsButton.id = 'ads-admin-btn';
    adsButton.style.cssText = `
        width: 90%;
        margin: 10px auto;
        padding: 12px;
        background: linear-gradient(135deg, #6e40c9 0%, #8a2be2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    `;
    adsButton.innerHTML = '<i class="fas fa-user-secret"></i> ADS - Адмін Панель';
    adsButton.onclick = showAdminMenu;
    
    sidebar.appendChild(adsButton);
}

function removeADSButton() {
    const adsButton = document.getElementById('ads-admin-btn');
    if (adsButton) {
        adsButton.remove();
    }
}

// ==================== АДМІН-МЕНЮ ====================

function showAdminMenu() {
    const menuHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: #161b22; padding: 25px; border-radius: 12px; border: 2px solid #58a6ff;
                    z-index: 10000; width: 400px; max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #58a6ff; margin: 0;"><i class="fas fa-user-secret"></i> Адмін Панель</h2>
                <button onclick="closeAdminMenu()" style="background: none; border: none; color: #8b949e; font-size: 24px; cursor: pointer;">×</button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="showAllUsers()" style="padding: 12px; background: #21262d; border: 1px solid #30363d; 
                        border-radius: 6px; color: #c9d1d9; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-users"></i> Всі користувачі
                </button>
                
                <button onclick="showAllMessages()" style="padding: 12px; background: #21262d; border: 1px solid #30363d; 
                        border-radius: 6px; color: #c9d1d9; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-history"></i> Всі повідомлення
                </button>
                
                <button onclick="showColorPicker()" style="padding: 12px; background: linear-gradient(135deg, #6e40c9 0%, #8a2be2 100%); 
                        border: none; border-radius: 6px; color: white; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-palette"></i> Колір повідомлень
                </button>
            </div>
            
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #30363d; color: #8b949e; font-size: 12px;">
                <i class="fas fa-info-circle"></i> Адмін-режим активний
            </div>
        </div>
    `;
    
    const menu = document.createElement('div');
    menu.id = 'admin-menu-overlay';
    menu.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
    `;
    menu.innerHTML = menuHTML;
    
    document.body.appendChild(menu);
}

function closeAdminMenu() {
    const menu = document.getElementById('admin-menu-overlay');
    if (menu) {
        menu.remove();
    }
}

// ==================== АДМІН-ФУНКЦІЇ (ті самі, що були) ====================

async function showAllUsers() {
    try {
        const response = await fetch('/api/admin/all-users');
        const allUsers = await response.json();
        
        let html = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: #161b22; padding: 25px; border-radius: 12px; border: 2px solid #58a6ff;
                        z-index: 10000; width: 800px; max-width: 90%; max-height: 80vh; overflow-y: auto;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #58a6ff; margin: 0;"><i class="fas fa-users"></i> Всі користувачі (${allUsers.length})</h2>
                    <button onclick="closeModal()" style="background: none; border: none; color: #8b949e; font-size: 24px; cursor: pointer;">×</button>
                </div>
                
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #21262d;">
                                <th style="padding: 10px; text-align: left;">ID</th>
                                <th style="padding: 10px; text-align: left;">Логін</th>
                                <th style="padding: 10px; text-align: left;">Статус</th>
                                <th style="padding: 10px; text-align: left;">Дії</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        allUsers.forEach(user => {
            html += `
                <tr style="border-bottom: 1px solid #30363d;">
                    <td style="padding: 10px;">${user.id}</td>
                    <td style="padding: 10px;">
                        <img src="/avatars/${user.avatar || 'default.png'}" 
                             style="width: 30px; height: 30px; border-radius: 50%; vertical-align: middle; margin-right: 10px;">
                        ${user.username}
                    </td>
                    <td style="padding: 10px;">
                        ${user.online ? '<span style="color: #3fb950;">🟢 Онлайн</span>' : '<span style="color: #8b949e;">🔴 Офлайн</span>'}
                    </td>
                    <td style="padding: 10px;">
                        <button onclick="viewUserDetails(${user.id})" style="padding: 5px 10px; background: #21262d; border: 1px solid #30363d; 
                                border-radius: 4px; color: #c9d1d9; cursor: pointer; margin-right: 5px;">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="kickUser(${user.id})" style="padding: 5px 10px; background: #da3633; border: none; 
                                border-radius: 4px; color: white; cursor: pointer;">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        showModal(html);
    } catch (error) {
        console.error('Помилка:', error);
        alert('❌ Помилка завантаження користувачів');
    }
}

async function viewUserDetails(userId) {
    try {
        const response = await fetch(`/api/admin/user/${userId}`);
        const userData = await response.json();
        
        let html = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: #161b22; padding: 25px; border-radius: 12px; border: 2px solid #58a6ff;
                        z-index: 10000; width: 700px; max-width: 90%; max-height: 80vh; overflow-y: auto;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #58a6ff; margin: 0;"><i class="fas fa-user"></i> Деталі користувача</h2>
                    <button onclick="closeModal()" style="background: none; border: none; color: #8b949e; font-size: 24px; cursor: pointer;">×</button>
                </div>
                
                <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                    <img src="/avatars/${userData.avatar || 'default.png'}" 
                         style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
                    <div>
                        <h3 style="margin: 0 0 10px 0;">${userData.username}</h3>
                        <p><strong>ID:</strong> ${userData.id}</p>
                        <p><strong>Статус:</strong> ${userData.online ? '🟢 Онлайн' : '🔴 Офлайн'}</p>
                        <p><strong>Повідомлень:</strong> ${(userData.messages_sent || 0) + (userData.messages_received || 0)}</p>
                        <p><strong>Пароль (хеш):</strong><br>
                           <code style="font-size: 11px; word-break: break-all;">${userData.password || 'не знайдено'}</code>
                        </p>
                    </div>
                </div>
                
                <div style="margin-top: 20px;">
                    <button onclick="kickUser(${userData.id})" style="padding: 10px 20px; background: #da3633; border: none; 
                            border-radius: 6px; color: white; cursor: pointer; font-weight: 600; width: 100%;">
                        <i class="fas fa-sign-out-alt"></i> Вигнати з акаунту
                    </button>
                </div>
            </div>
        `;
        
        showModal(html);
    } catch (error) {
        console.error('Помилка:', error);
        alert('❌ Помилка завантаження даних');
    }
}

async function kickUser(userId) {
    if (!confirm('Ви впевнені, що хочете вигнати цього користувача?')) return;
    
    try {
        const response = await fetch('/api/admin/kick-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('✅ Користувача вигнано!');
            closeModal();
        } else {
            alert(`❌ ${data.error}`);
        }
    } catch (error) {
        alert('❌ Помилка сервера');
    }
}

async function showAllMessages() {
    try {
        const response = await fetch('/api/admin/all-messages');
        const messages = await response.json();
        
        let html = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: #161b22; padding: 25px; border-radius: 12px; border: 2px solid #58a6ff;
                        z-index: 10000; width: 900px; max-width: 90%; max-height: 80vh; overflow-y: auto;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #58a6ff; margin: 0;"><i class="fas fa-history"></i> Всі повідомлення (${messages.length})</h2>
                    <button onclick="closeModal()" style="background: none; border: none; color: #8b949e; font-size: 24px; cursor: pointer;">×</button>
                </div>
                
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #21262d;">
                                <th style="padding: 10px; text-align: left;">Дата</th>
                                <th style="padding: 10px; text-align: left;">Відправник</th>
                                <th style="padding: 10px; text-align: left;">Отримувач</th>
                                <th style="padding: 10px; text-align: left;">Повідомлення</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        messages.slice(0, 50).forEach(msg => { // Обмежуємо 50 повідомленнями
            html += `
                <tr style="border-bottom: 1px solid #30363d;">
                    <td style="padding: 10px; white-space: nowrap;">
                        ${new Date(msg.timestamp).toLocaleTimeString('uk-UA')}<br>
                        <small>${new Date(msg.timestamp).toLocaleDateString('uk-UA')}</small>
                    </td>
                    <td style="padding: 10px;">${msg.sender_name}</td>
                    <td style="padding: 10px;">${msg.receiver_name}</td>
                    <td style="padding: 10px; max-width: 300px;">
                        <div style="word-break: break-word; max-height: 100px; overflow-y: auto; font-size: 14px;">
                            ${escapeHtml(msg.message).substring(0, 200)}
                            ${msg.message.length > 200 ? '...' : ''}
                        </div>
                    </td>
                </tr>
            `;
        });
        
        if (messages.length > 50) {
            html += `
                <tr>
                    <td colspan="4" style="padding: 15px; text-align: center; color: #8b949e;">
                        і ще ${messages.length - 50} повідомлень...
                    </td>
                </tr>
            `;
        }
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        showModal(html);
    } catch (error) {
        console.error('Помилка:', error);
        alert('❌ Помилка завантаження повідомлень');
    }
}

function showColorPicker() {
    const colors = [
        '#58a6ff', '#ff6b6b', '#4ecdc4', '#ffd166',
        '#06d6a0', '#118ab2', '#ef476f', '#073b4c',
        '#ff9a76', '#9d4edd', '#f72585', '#7209b7',
        '#3a86ff', '#fb5607', '#8338ec', '#ff006e'
    ];
    
    let html = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: #161b22; padding: 25px; border-radius: 12px; border: 2px solid #58a6ff;
                    z-index: 10000; width: 500px; max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="color: #58a6ff; margin: 0;"><i class="fas fa-palette"></i> Колір повідомлень</h2>
                <button onclick="closeModal()" style="background: none; border: none; color: #8b949e; font-size: 24px; cursor: pointer;">×</button>
            </div>
            
            <p style="color: #8b949e; margin-bottom: 20px;">Оберіть колір для ваших повідомлень:</p>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 30px;">
                <div style="padding: 20px; background: #58a6ff; border-radius: 8px; cursor: pointer; text-align: center; color: white;
                     ${!adminColor ? 'border: 3px solid white; box-shadow: 0 0 0 2px #58a6ff;' : ''}"
                     onclick="setAdminColor(null)">
                    <i class="fas fa-times"></i><br>
                    <small>Стандартний</small>
                </div>
    `;
    
    colors.forEach(color => {
        html += `
            <div style="padding: 20px; background: ${color}; border-radius: 8px; cursor: pointer;
                 ${adminColor === color ? 'border: 3px solid white; box-shadow: 0 0 0 2px #58a6ff;' : ''}"
                 onclick="setAdminColor('${color}')"
                 title="${color}">
            </div>
        `;
    });
    
    html += `
            </div>
            
            <div style="text-align: center; padding: 15px; background: #21262d; border-radius: 8px;">
                <p style="margin: 0 0 10px 0;">Поточний колір:</p>
                <div id="current-color-preview" style="width: 100px; height: 50px; margin: 0 auto; border-radius: 6px; 
                     border: 2px solid #30363d; background: ${adminColor || '#58a6ff'};"></div>
                <p style="margin: 10px 0 0 0; color: #8b949e; font-size: 14px;">
                    ${adminColor ? 'Ваші наступні повідомлення будуть цього кольору' : 'Використовується стандартний колір'}
                </p>
            </div>
        </div>
    `;
    
    showModal(html);
}

function setAdminColor(color) {
    adminColor = color;
    
    // Оновлюємо пікер
    const preview = document.getElementById('current-color-preview');
    if (preview) {
        preview.style.background = color || '#58a6ff';
    }
    
    // Зберігаємо на сервері
    if (window.currentUser) {
        fetch('/api/save-admin-color', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: window.currentUser.id, color })
        });
    }
    
    // Сповіщення
    if (color) {
        alert(`🎨 Колір змінено на: ${color}\n\nТепер ваші повідомлення будуть цього кольору!`);
    } else {
        alert('🎨 Колір скинуто до стандартного');
    }
    
    closeModal();
}

// ==================== ДОПОМІЖНІ ФУНКЦІЇ ====================

function showModal(html) {
    closeModal(); // Закриваємо попередні модалки
    
    const modal = document.createElement('div');
    modal.id = 'admin-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    modal.innerHTML = html;
    
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.getElementById('admin-modal');
    const menu = document.getElementById('admin-menu-overlay');
    if (modal) modal.remove();
    if (menu) menu.remove();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function exportFunctions() {
    window.toggleAdminMode = toggleAdminMode;
    window.showAllUsers = showAllUsers;
    window.showAllMessages = showAllMessages;
    window.showColorPicker = showColorPicker;
    window.viewUserDetails = viewUserDetails;
    window.kickUser = kickUser;
    window.setAdminColor = setAdminColor;
    window.closeAdminMenu = closeAdminMenu;
    window.closeModal = closeModal;
}

// ==================== ЗАПУСК ====================

// Просто запускаємо без складних патчів
setTimeout(initAdminModule, 1000);

console.log('✅ Простий адмін-модуль завантажено');