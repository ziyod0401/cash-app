        const ICONS = {
            'Зарплата': '💼',
            'Электричество': '⚡',
            'Материалы': '📦',
            'Транспорт': '🚗',
            'Прочее': '📝',
            'Продажи': '💳',
            'Прочие приходы': '💰',
            'Корректировка баланса': '🔧'
        };

        const DEFAULT_EXCHANGE_RATE = 12000;
        let currentExchangeRate = DEFAULT_EXCHANGE_RATE;
        let sortOrder = 'date-desc';
        let appData = {
            initialBalanceSUM: 0,
            initialBalanceUSD: 0,
            initialBalances: {
                'cash_nalichnye': { SUM: 0, USD: 0 },
                'cash_beznalichnye': { SUM: 0, USD: 0 }
            },
            expenseCategories: ['Зарплата', 'Электричество', 'Материалы', 'Транспорт', 'Прочее'],
            incomeCategories: ['Продажи', 'Прочие приходы'],
            operations: [],
            sheetId: '',
            deployUrl: '',
            deletedIds: [],
            exchangeRate: DEFAULT_EXCHANGE_RATE,
            templates: [],
            cashes: [
                { id: 'cash_nalichnye', name: '💵 Наличные', type: 'cash' },
                { id: 'cash_beznalichnye', name: '🏦 Безналичные', type: 'card' }
            ]
        };

        let isSynced = false;
        let isOnline = navigator.onLine;
        let currentCashView = 'all';

        document.addEventListener('DOMContentLoaded', () => {
            loadData();
            setDefaultDateTime();
            updateCategorySelect();
            renderCategoryLists();
            updateDashboard();
            updateHistoryFilter();
            checkGoogleAppsScriptConnection();
            setInterval(checkGoogleAppsScriptConnection, 30000);
            setInterval(autoSync, 10000);
            document.querySelector('.fab').style.display = 'flex';
            initTheme();
            currentExchangeRate = appData.exchangeRate || DEFAULT_EXCHANGE_RATE;
            document.getElementById('exchangeRate').value = currentExchangeRate.toLocaleString('ru-RU');
            updateConverter();
            renderTemplatesList();
            updateCashSelects();
            
            // Проверка онлайн/офлайн статуса
            window.addEventListener('online', () => {
                isOnline = true;
                updateOfflineStatus();
                if (isSynced) syncWithGoogleAppsScript();
            });
            window.addEventListener('offline', () => {
                isOnline = false;
                updateOfflineStatus();
            });
            updateOfflineStatus();
        });

        function updateOfflineStatus() {
            const badge = document.getElementById('syncStatus');
            const notice = document.getElementById('offlineNotice');
            if (!isOnline) {
                badge.className = 'sync-badge offline';
                document.getElementById('syncText').textContent = '📱 Офлайн режим';
                notice.classList.add('show');
            } else {
                notice.classList.remove('show');
                if (isSynced) {
                    badge.className = 'sync-badge';
                    document.getElementById('syncText').textContent = 'Синхронизировано';
                }
            }
        }

        function loadData() {
            const saved = localStorage.getItem('cashAppData');
            if (saved) {
                appData = JSON.parse(saved);
                // Убеждаемся что templates существует
                if (!appData.templates) appData.templates = [];
                // Убеждаемся что cashes существует
                if (!appData.cashes || appData.cashes.length === 0) {
                    appData.cashes = [
                        { id: 'cash_nalichnye', name: '💵 Наличные', type: 'cash' },
                        { id: 'cash_beznalichnye', name: '🏦 Безналичные', type: 'card' }
                    ];
                }
                // Убеждаемся что initialBalances существует
                if (!appData.initialBalances) {
                    appData.initialBalances = {
                        'cash_nalichnye': { SUM: appData.initialBalanceSUM || 0, USD: appData.initialBalanceUSD || 0 },
                        'cash_beznalichnye': { SUM: 0, USD: 0 }
                    };
                }
            }
        }

        function saveData() {
            localStorage.setItem('cashAppData', JSON.stringify(appData));
        }

        function formatAmountInput(input) {
            let value = input.value.replace(/\s/g, '');
            value = value.replace(/[^\d.]/g, '');
            let parts = value.split('.');
            if (parts.length > 2) value = parts[0] + '.' + parts[1];
            let [intPart, decPart] = value.split('.');
            intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
            input.value = decPart !== undefined ? intPart + '.' + decPart : intPart;
        }

        function setDefaultDateTime() {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const iso = `${year}-${month}-${day}T${hour}:${minute}`;
            document.getElementById('dateTime').value = iso;
            document.getElementById('adjustDate').value = iso;
            
            // Установка датфильтра по умолчанию
            const dateFromEl = document.getElementById('dateFrom');
            const dateToEl = document.getElementById('dateTo');
            if (dateFromEl) dateFromEl.value = `${year}-${month}-01`;
            if (dateToEl) dateToEl.value = iso.split('T')[0];
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            event.target.classList.add('active');
            const fab = document.querySelector('.fab');
            fab.style.display = tabName === 'dashboard' ? 'flex' : 'none';
            updateDashboard();
            
            if (tabName === 'settings') {
                const currentTheme = localStorage.getItem('theme') || 'light';
                setTimeout(() => setTheme(currentTheme), 0);
                document.getElementById('initialBalanceCash').value = 'cash_nalichnye';
                updateInitialBalanceDisplay();
                updateCashSelects();
            }
            if (tabName === 'history') {
                setDefaultDateTime();
            }
        }

        function openModal(id) {
            document.getElementById(id).classList.add('active');
            setDefaultDateTime();
            if (id === 'adjustBalance') {
                document.getElementById('adjustBalanceCash').value = 'cash_nalichnye';
                document.getElementById('actualBalanceSUM').value = '';
                document.getElementById('actualBalanceUSD').value = '';
                updateAdjustSummary();
            }
            if (id === 'templatesModal') {
                renderTemplatesList();
                updateTemplateCategorySelect();
            }
            if (id === 'exchangeModal') {
                // Инициализирую касс для обмена
                const select = document.getElementById('exchangeCash');
                select.innerHTML = '<option>Выбрать</option>';
                appData.cashes.forEach(cash => {
                    const option = document.createElement('option');
                    option.value = cash.id;
                    option.textContent = cash.name;
                    select.appendChild(option);
                });
                document.getElementById('exchangeRateInput').value = currentExchangeRate.toLocaleString('ru-RU');
                document.getElementById('exchangeAmount').value = '';
                document.getElementById('exchangeResultInput').value = '';
                document.getElementById('exchangeFrom').value = 'USD';
                document.getElementById('exchangeFromBalance').textContent = '0';
                updateExchangeFullUI();
            }
        }

        function closeModal(id) {
            document.getElementById(id).classList.remove('active');
        }

        function updateCategorySelect() {
            const type = document.getElementById('operationType').value;
            const categories = type === 'expense' ? appData.expenseCategories : appData.incomeCategories;
            const select = document.getElementById('category');
            select.innerHTML = '<option>Выбрать</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                select.appendChild(option);
            });
        }

        function renderCategoryLists() {
            ['expenseCategoryList', 'incomeCategoryList'].forEach((id, i) => {
                const container = document.getElementById(id);
                const categories = i === 0 ? appData.expenseCategories : appData.incomeCategories;
                container.innerHTML = '';
                categories.forEach(cat => {
                    if (cat !== 'Корректировка баланса') {
                        const tag = document.createElement('div');
                        tag.className = 'category-badge';
                        tag.innerHTML = `${cat} <span class="remove" onclick="removeCategory('${cat}', '${i === 0 ? 'expense' : 'income'}')">×</span>`;
                        container.appendChild(tag);
                    }
                });
            });
            document.getElementById('expenseCategoryInput').value = '';
            document.getElementById('incomeCategoryInput').value = '';
        }

        function addExpenseCategory() {
            const input = document.getElementById('expenseCategoryInput');
            if (input.value.trim() && !appData.expenseCategories.includes(input.value.trim())) {
                appData.expenseCategories.push(input.value.trim());
                saveData();
                renderCategoryLists();
                updateCategorySelect();
                showMessage('Категория добавлена', 'success');
            }
        }

        function addIncomeCategory() {
            const input = document.getElementById('incomeCategoryInput');
            if (input.value.trim() && !appData.incomeCategories.includes(input.value.trim())) {
                appData.incomeCategories.push(input.value.trim());
                saveData();
                renderCategoryLists();
                updateCategorySelect();
                showMessage('Категория добавлена', 'success');
            }
        }

        function removeCategory(cat, type) {
            const arr = type === 'expense' ? appData.expenseCategories : appData.incomeCategories;
            const idx = arr.indexOf(cat);
            if (idx > -1) {
                arr.splice(idx, 1);
                saveData();
                renderCategoryLists();
                updateCategorySelect();
            }
        }

        function addOperation() {
            let type = document.getElementById('operationType').value;
            let category = document.getElementById('category').value;
            const amountStr = document.getElementById('amount').value.replace(/\s/g, '');
            const amount = parseFloat(amountStr);
            const currency = document.getElementById('currency').value;
            const dateTime = document.getElementById('dateTime').value;
            const description = document.getElementById('description').value;
            const cashId = document.getElementById('operationCash').value;

            if (!category || category === 'Выбрать') {
                category = type === 'expense' ? 'Прочее' : 'Прочие приходы';
            }

            if (!amount || amount <= 0 || !dateTime) {
                showMessage('Заполните сумму и дату', 'error');
                return;
            }

            if (cashId === 'Выбрать') {
                showMessage('Выбери кассу', 'error');
                return;
            }

            appData.operations.push({
                id: Date.now(),
                type, category, amount, currency,
                cashId: cashId,
                dateTime: new Date(dateTime).getTime(),
                description, timestamp: new Date().getTime()
            });

            saveData();
            updateDashboard();
            updateHistoryFilter();
            resetForm();
            setDefaultDateTime();
            showMessage('Операция добавлена', 'success');
            if (isSynced && isOnline) syncWithGoogleAppsScript();
        }

        function resetForm() {
            document.getElementById('operationType').value = 'expense';
            document.getElementById('operationCash').value = 'Выбрать';
            document.getElementById('category').value = 'Выбрать';
            document.getElementById('amount').value = '';
            document.getElementById('description').value = '';
            setDefaultDateTime();
            updateCategorySelect();
        }

        function calculateBalance() {
            let balanceSUM = 0;
            let balanceUSD = 0;
            
            // Считаю начальный остаток для всех касс
            appData.cashes.forEach(cash => {
                if (appData.initialBalances && appData.initialBalances[cash.id]) {
                    balanceSUM += appData.initialBalances[cash.id].SUM || 0;
                    balanceUSD += appData.initialBalances[cash.id].USD || 0;
                }
            });
            
            // Добавляю все операции
            appData.operations.forEach(op => {
                if (op.type === 'income') {
                    if (op.currency === 'SUM') balanceSUM += op.amount;
                    else balanceUSD += op.amount;
                } else {
                    if (op.currency === 'SUM') balanceSUM -= op.amount;
                    else balanceUSD -= op.amount;
                }
            });
            return { balanceSUM, balanceUSD };
        }

        function applyBalanceAdjustment() {
            const actualSumStr = document.getElementById('actualBalanceSUM').value.replace(/\s/g, '');
            const actualUsdStr = document.getElementById('actualBalanceUSD').value.replace(/\s/g, '');
            const actualSUM = parseFloat(actualSumStr) || 0;
            const actualUSD = parseFloat(actualUsdStr) || 0;
            const adjustDate = document.getElementById('adjustDate').value;
            const cashId = document.getElementById('adjustBalanceCash').value;

            // Считаю баланс только для выбранной кассы
            let balanceSUM = 0;
            let balanceUSD = 0;
            appData.operations.forEach(op => {
                if (op.cashId === cashId) {
                    if (op.currency === 'SUM') {
                        if (op.type === 'income') balanceSUM += op.amount;
                        else balanceSUM -= op.amount;
                    } else if (op.currency === 'USD') {
                        if (op.type === 'income') balanceUSD += op.amount;
                        else balanceUSD -= op.amount;
                    }
                }
            });

            const diffSUM = actualSUM - balanceSUM;
            const diffUSD = actualUSD - balanceUSD;

            if (diffSUM !== 0) {
                appData.operations.push({
                    id: Date.now(),
                    type: diffSUM > 0 ? 'income' : 'expense',
                    category: 'Корректировка баланса',
                    amount: Math.abs(diffSUM),
                    currency: 'SUM',
                    cashId: cashId,
                    dateTime: new Date(adjustDate).getTime(),
                    description: 'Корректировка баланса',
                    timestamp: new Date().getTime()
                });
            }

            if (diffUSD !== 0) {
                appData.operations.push({
                    id: Date.now() + 1,
                    type: diffUSD > 0 ? 'income' : 'expense',
                    category: 'Корректировка баланса',
                    amount: Math.abs(diffUSD),
                    currency: 'USD',
                    cashId: cashId,
                    dateTime: new Date(adjustDate).getTime(),
                    description: 'Корректировка баланса',
                    timestamp: new Date().getTime()
                });
            }

            saveData();
            updateDashboard();
            updateHistoryFilter();
            closeModal('adjustBalance');
            if (isSynced && isOnline) syncWithGoogleAppsScript();
            showMessage('Баланс скорректирован', 'success');
        }

        function updateAdjustSummary() {
            const actualSumStr = document.getElementById('actualBalanceSUM').value.replace(/\s/g, '');
            const actualUsdStr = document.getElementById('actualBalanceUSD').value.replace(/\s/g, '');
            const actualSUM = parseFloat(actualSumStr) || 0;
            const actualUSD = parseFloat(actualUsdStr) || 0;
            const cashId = document.getElementById('adjustBalanceCash').value;

            // Считаю баланс только для выбранной кассы
            let balanceSUM = 0;
            let balanceUSD = 0;
            appData.operations.forEach(op => {
                if (op.cashId === cashId) {
                    if (op.currency === 'SUM') {
                        if (op.type === 'income') balanceSUM += op.amount;
                        else balanceSUM -= op.amount;
                    } else if (op.currency === 'USD') {
                        if (op.type === 'income') balanceUSD += op.amount;
                        else balanceUSD -= op.amount;
                    }
                }
            });

            const diffSUM = actualSUM - balanceSUM;
            const diffUSD = actualUSD - balanceUSD;

            const summary = document.getElementById('adjustSummary');
            const summaryText = document.getElementById('adjustSummaryText');

            if (diffSUM === 0 && diffUSD === 0) {
                summary.style.display = 'none';
                return;
            }

            summary.style.display = 'block';
            let text = '';
            if (diffSUM !== 0) {
                const type = diffSUM > 0 ? '➕ Приход' : '➖ Расход';
                text += `${type}: ${Math.abs(diffSUM).toLocaleString('ru-RU')} SUM<br>`;
            }
            if (diffUSD !== 0) {
                const type = diffUSD > 0 ? '➕ Приход' : '➖ Расход';
                text += `${type}: ${Math.abs(diffUSD).toLocaleString('ru-RU')} USD`;
            }
            summaryText.innerHTML = text;
        }

        function updateDashboard() {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // Обновляю кнопки касс
            renderCashButtons();
            
            // Обновляю статистику на основе выбранной кассы
            renderDashboardStats();

            const recent = appData.operations.slice().sort((a, b) => b.dateTime - a.dateTime).slice(0, 5);
            const recentHtml = recent.length > 0 
                ? recent.map(op => operationHTML(op)).join('')
                : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Нет операций</div></div>';
            document.getElementById('recentOps').innerHTML = recentHtml;

            document.getElementById('sheetId').value = appData.sheetId;
            document.getElementById('deployUrl').value = appData.deployUrl;
            updateAnalytics();
        }

        function renderCashButtons() {
            const container = document.getElementById('cashButtons');
            container.innerHTML = appData.cashes.map(cash => `
                <button class="btn ${currentCashView === cash.id ? 'btn-primary' : 'btn-secondary'}" 
                        onclick="switchCashView('${cash.id}')" 
                        style="padding: 10px 16px;">
                    ${cash.name}
                </button>
            `).join('');
            
            // Обновляю кнопку "Все кассы"
            const allBtn = document.getElementById('cashAllBtn');
            if (currentCashView === 'all') {
                allBtn.className = 'btn btn-primary';
            } else {
                allBtn.className = 'btn btn-secondary';
            }
        }

        function switchCashView(cashId) {
            currentCashView = cashId;
            renderCashButtons();
            renderDashboardStats();
        }

        function renderDashboardStats() {
            const container = document.getElementById('mainStats');
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            let html = '';

            if (currentCashView === 'all') {
                // Общий баланспо всем кассам
                const { balanceSUM, balanceUSD } = calculateBalance();
                html += `
                    <div class="stat-card balance">
                        <div class="stat-label">💰 Остаток SUM</div>
                        <div class="stat-value">${balanceSUM.toLocaleString('ru-RU')}</div>
                        <div class="stat-sub">Все кассы</div>
                    </div>
                    <div class="stat-card balance">
                        <div class="stat-label">💵 Остаток USD</div>
                        <div class="stat-value">${balanceUSD.toLocaleString('ru-RU')}</div>
                        <div class="stat-sub">Все кассы</div>
                    </div>
                `;
            } else {
                // Баланс конкретной кассы
                const sumBalance = getCashBalance(currentCashView, 'SUM');
                const usdBalance = getCashBalance(currentCashView, 'USD');
                const cashName = appData.cashes.find(c => c.id === currentCashView)?.name || '';
                
                html += `
                    <div class="stat-card balance">
                        <div class="stat-label">💰 Остаток SUM</div>
                        <div class="stat-value">${sumBalance.toLocaleString('ru-RU')}</div>
                        <div class="stat-sub">${cashName}</div>
                    </div>
                    <div class="stat-card balance">
                        <div class="stat-label">💵 Остаток USD</div>
                        <div class="stat-value">${usdBalance.toLocaleString('ru-RU')}</div>
                        <div class="stat-sub">${cashName}</div>
                    </div>
                `;
            }

            // Доход и расход за сегодня
            let incomeTodaySUM = 0, incomeTodayUSD = 0, expenseTodaySUM = 0, expenseTodayUSD = 0;
            appData.operations.forEach(op => {
                const opDate = new Date(op.dateTime);
                const opToday = new Date(opDate.getFullYear(), opDate.getMonth(), opDate.getDate());
                if (opToday.getTime() === today.getTime()) {
                    // Если выбрана конкретная касса - фильтруем по ней
                    if (currentCashView !== 'all' && op.cashId !== currentCashView) return;
                    
                    if (op.type === 'income') {
                        if (op.currency === 'SUM') incomeTodaySUM += op.amount;
                        else incomeTodayUSD += op.amount;
                    } else {
                        if (op.currency === 'SUM') expenseTodaySUM += op.amount;
                        else expenseTodayUSD += op.amount;
                    }
                }
            });

            html += `
                <div class="stat-card income">
                    <div class="stat-label">➕ Приход SUM</div>
                    <div class="stat-value" style="color: var(--success);">${incomeTodaySUM.toLocaleString('ru-RU')}</div>
                    <div class="stat-sub">Сегодня</div>
                </div>
                <div class="stat-card income">
                    <div class="stat-label">➕ Приход USD</div>
                    <div class="stat-value" style="color: var(--success);">${incomeTodayUSD.toLocaleString('ru-RU')}</div>
                    <div class="stat-sub">Сегодня</div>
                </div>
                <div class="stat-card expense">
                    <div class="stat-label">➖ Расход SUM</div>
                    <div class="stat-value" style="color: var(--danger);">${expenseTodaySUM.toLocaleString('ru-RU')}</div>
                    <div class="stat-sub">Сегодня</div>
                </div>
                <div class="stat-card expense">
                    <div class="stat-label">➖ Расход USD</div>
                    <div class="stat-value" style="color: var(--danger);">${expenseTodayUSD.toLocaleString('ru-RU')}</div>
                    <div class="stat-sub">Сегодня</div>
                </div>
            `;

            container.innerHTML = html;
        }

        function operationHTML(op) {
            const date = new Date(op.dateTime).toLocaleDateString('ru-RU');
            const time = new Date(op.dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            const amountClass = op.type === 'income' ? 'income' : 'expense';
            const sign = op.type === 'income' ? '+' : '−';
            const formattedAmount = op.amount.toLocaleString('ru-RU');
            const icon = ICONS[op.category] || '📝';
            return `
                <div class="operation-item">
                    <div class="operation-icon">${icon}</div>
                    <div class="operation-info">
                        <h4>${op.category}</h4>
                        <div class="operation-details">
                            <span>${date} ${time}</span>
                            ${op.description ? `<span>${op.description}</span>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="operation-amount ${amountClass}">${sign} ${formattedAmount} ${op.currency}</div>
                        <button class="btn btn-secondary btn-small" onclick="editOperation(${op.id})" title="Редактировать">✏️</button>
                        <button class="btn btn-secondary btn-small" onclick="duplicateOperation(${op.id})" title="Дублировать">📋</button>
                        <button class="btn btn-danger btn-small" onclick="deleteOperation(${op.id})">✕</button>
                    </div>
                </div>
            `;
        }

        function updateHistoryFilter() {
            const filterCategory = document.getElementById('filterCategory');
            filterCategory.innerHTML = '<option value="">Все</option>';
            const allCategories = new Set([...appData.expenseCategories, ...appData.incomeCategories]);
            allCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                filterCategory.appendChild(option);
            });
            filterOperations();
        }

        function filterOperations() {
            const filterType = document.getElementById('filterType').value;
            const filterCategory = document.getElementById('filterCategory').value;
            const searchText = document.getElementById('searchInput').value.toLowerCase();
            const dateFrom = document.getElementById('dateFrom').value;
            const dateTo = document.getElementById('dateTo').value;

            let filtered = appData.operations.filter(op => {
                const typeMatch = !filterType || op.type === filterType;
                const categoryMatch = !filterCategory || op.category === filterCategory;
                const searchMatch = !searchText || 
                    op.category.toLowerCase().includes(searchText) || 
                    (op.description && op.description.toLowerCase().includes(searchText));
                
                const opDate = new Date(op.dateTime).toISOString().split('T')[0];
                const dateMatch = (!dateFrom || opDate >= dateFrom) && (!dateTo || opDate <= dateTo);

                return typeMatch && categoryMatch && searchMatch && dateMatch;
            });

            // Сортировка
            filtered.sort((a, b) => {
                switch(sortOrder) {
                    case 'date-asc': return a.dateTime - b.dateTime;
                    case 'date-desc': return b.dateTime - a.dateTime;
                    case 'amount-asc': return a.amount - b.amount;
                    case 'amount-desc': return b.amount - a.amount;
                    default: return b.dateTime - a.dateTime;
                }
            });

            const html = filtered.length > 0
                ? filtered.map(op => operationHTML(op)).join('')
                : '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">Нет операций</div></div>';
            
            document.getElementById('historyList').innerHTML = html;
        }

        function setSortOrder(order) {
            sortOrder = order;
            filterOperations();
        }

        function deleteOperation(id) {
            if (confirm('Удалить операцию?')) {
                appData.operations = appData.operations.filter(op => op.id !== id);
                if (!appData.deletedIds) appData.deletedIds = [];
                if (!appData.deletedIds.includes(id)) {
                    appData.deletedIds.push(id);
                }
                saveData();
                updateDashboard();
                updateHistoryFilter();
                if (isSynced && isOnline) syncWithGoogleAppsScript();
                showMessage('Операция удалена', 'success');
            }
        }

        function updateAnalytics() {
            updateCategoryStats('expenseStats', 'expense');
            updateCategoryStats('incomeStats', 'income');
            updateDailyStats();
        }

        function updateCategoryStats(elementId, type) {
            const stats = {};
            appData.operations.filter(op => op.type === type).forEach(op => {
                if (!stats[op.category]) stats[op.category] = { count: 0, sumSum: 0, sumUsd: 0 };
                stats[op.category].count++;
                if (op.currency === 'SUM') stats[op.category].sumSum += op.amount;
                else stats[op.category].sumUsd += op.amount;
            });

            const html = Object.entries(stats)
                .sort((a, b) => (b[1].sumSum + b[1].sumUsd * 100) - (a[1].sumSum + a[1].sumUsd * 100))
                .map(([category, data]) => {
                    const icon = ICONS[category] || '📝';
                    return `
                    <div class="analytics-item" onclick="openCategoryDetails('${category}', '${type}')">
                        <div style="font-size: 24px; margin-bottom: 8px;">${icon}</div>
                        <div class="analytics-label">${category}</div>
                        <div class="analytics-value">${data.sumSum.toLocaleString('ru-RU')}</div>
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">SUM</div>
                        ${data.sumUsd > 0 ? `<div class="analytics-value" style="font-size: 18px;">${data.sumUsd.toLocaleString('ru-RU')}</div><div class="analytics-sub">USD</div>` : ''}
                        <div class="analytics-sub" style="margin-top: 8px;">Операций: ${data.count}</div>
                    </div>
                `;
                })
                .join('');

            document.getElementById(elementId).innerHTML = html || '<div class="analytics-item"><div class="analytics-label">Нет данных</div></div>';
        }

        function updateDailyStats() {
            const stats = {};
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
                stats[dateStr] = { income: 0, expense: 0 };
            }
            appData.operations.forEach(op => {
                const opDate = new Date(op.dateTime);
                const dateStr = opDate.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
                if (stats[dateStr]) {
                    if (op.type === 'income') stats[dateStr].income += op.amount;
                    else stats[dateStr].expense += op.amount;
                }
            });
            const html = Object.entries(stats).map(([date, data]) => `
                <div class="analytics-item">
                    <div class="analytics-label">${date}</div>
                    <div style="font-size: 13px; color: var(--success); font-weight: 600; margin-bottom: 6px;">➕ ${data.income.toLocaleString('ru-RU')}</div>
                    <div style="font-size: 13px; color: var(--danger); font-weight: 600;">➖ ${data.expense.toLocaleString('ru-RU')}</div>
                </div>
            `).join('');
            document.getElementById('dailyStats').innerHTML = html;
        }

        function openCategoryDetails(category, type) {
            const operations = appData.operations.filter(op => op.category === category && op.type === type);
            if (operations.length === 0) return;

            operations.sort((a, b) => a.dateTime - b.dateTime);
            const firstDate = new Date(operations[0].dateTime).toLocaleDateString('ru-RU');
            const lastDate = new Date(operations[operations.length - 1].dateTime).toLocaleDateString('ru-RU');

            let html = `
                <div style="margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border);">
                    <div style="font-size: 16px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">${category}</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">
                        📅 ${firstDate} - ${lastDate}<br>
                        📊 Операций: ${operations.length}
                    </div>
                </div>
            `;

            let totalSum = 0, totalUsd = 0;
            operations.forEach(op => {
                const date = new Date(op.dateTime).toLocaleDateString('ru-RU');
                const time = new Date(op.dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                const amount = op.amount.toLocaleString('ru-RU');
                html += `
                    <div style="padding: 12px; background: var(--bg); border-radius: 10px; margin-bottom: 8px;">
                        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">${date} ${time}</div>
                        <div style="font-size: 14px; font-weight: 700; color: ${op.type === 'income' ? 'var(--success)' : 'var(--danger)'};">
                            ${op.type === 'income' ? '+' : '−'} ${amount} ${op.currency}
                        </div>
                        ${op.description ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">Заметка: ${op.description}</div>` : ''}
                    </div>
                `;
                if (op.currency === 'SUM') totalSum += op.amount;
                else totalUsd += op.amount;
            });

            html += `
                <div style="padding: 14px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 10px; margin-top: 16px;">
                    <div style="font-size: 12px; font-weight: 700; color: #0369a1; text-transform: uppercase; margin-bottom: 8px;">Итого:</div>
                    ${totalSum > 0 ? `<div style="font-size: 16px; font-weight: 700; color: #0369a1;">SUM: ${totalSum.toLocaleString('ru-RU')}</div>` : ''}
                    ${totalUsd > 0 ? `<div style="font-size: 16px; font-weight: 700; color: #0369a1;">USD: ${totalUsd.toLocaleString('ru-RU')}</div>` : ''}
                </div>
            `;

            document.getElementById('categoryDetailsContent').innerHTML = html;
            document.getElementById('categoryDetails').classList.add('active');
        }

        function updateConverter() {
            const rateStr = document.getElementById('exchangeRate').value.replace(/\s/g, '');
            currentExchangeRate = parseFloat(rateStr) || DEFAULT_EXCHANGE_RATE;
            appData.exchangeRate = currentExchangeRate;
            saveData();
            document.getElementById('currentRate').textContent = currentExchangeRate.toLocaleString('ru-RU');
        }

        function convertUSDtoSUM() {
            const usdStr = document.getElementById('converterUSD').value.replace(/\s/g, '');
            const usd = parseFloat(usdStr) || 0;
            const sum = usd * currentExchangeRate;
            document.getElementById('converterResult').textContent = sum.toLocaleString('ru-RU');
        }

        function convertSUMtoUSD() {
            const sumStr = document.getElementById('converterSUM').value.replace(/\s/g, '');
            const sum = parseFloat(sumStr) || 0;
            const usd = sum / currentExchangeRate;
            document.getElementById('converterResultReverse').textContent = usd.toLocaleString('ru-RU');
        }

        function resetExchangeRate() {
            document.getElementById('exchangeRate').value = DEFAULT_EXCHANGE_RATE.toLocaleString('ru-RU');
            updateConverter();
        }

        function setupGoogleAppsScript() {
            const sheetId = document.getElementById('sheetId').value.trim();
            const deployUrl = document.getElementById('deployUrl').value.trim();
            if (!sheetId || !deployUrl) {
                showMessage('Заполни оба поля', 'error');
                return;
            }
            appData.sheetId = sheetId;
            appData.deployUrl = deployUrl;
            saveData();
            testGoogleAppsScriptConnection();
        }

        async function testGoogleAppsScriptConnection() {
            if (!appData.deployUrl || !isOnline) return;
            updateSyncStatus('Тестирование...', 'connected');
            try {
                const response = await fetch(appData.deployUrl);
                if (response.ok) {
                    updateSyncStatus('Синхронизировано', 'connected');
                    isSynced = true;
                    loadFromGoogleAppsScript();
                    showMessage('Подключено!', 'success');
                } else {
                    updateSyncStatus('Ошибка', 'error');
                    isSynced = false;
                    showMessage('Ошибка подключения', 'error');
                }
            } catch (error) {
                updateSyncStatus('Ошибка', 'error');
                isSynced = false;
                showMessage('Ошибка: ' + error.message, 'error');
            }
        }

        async function checkGoogleAppsScriptConnection() {
            if (!appData.deployUrl || !isOnline) {
                updateSyncStatus('Не настроено', 'error');
                return;
            }
            try {
                const response = await fetch(appData.deployUrl);
                if (response.ok) {
                    updateSyncStatus('Синхронизировано', 'connected');
                    isSynced = true;
                    loadFromGoogleAppsScript();
                } else {
                    updateSyncStatus('Ошибка', 'error');
                    isSynced = false;
                }
            } catch (error) {
                updateSyncStatus('Ошибка', 'error');
                isSynced = false;
            }
        }

        function updateSyncStatus(text, status) {
            const badge = document.getElementById('syncStatus');
            badge.className = `sync-badge ${status === 'error' ? 'error' : ''}`;
            document.getElementById('syncText').textContent = text;
        }

        async function loadFromGoogleAppsScript() {
            if (!appData.deployUrl || !isOnline) return;
            try {
                const response = await fetch(appData.deployUrl);
                const data = await response.json();
                if (data.operations && Array.isArray(data.operations)) {
                    if (!appData.deletedIds) appData.deletedIds = [];
                    const localIds = new Set(appData.operations.map(op => op.id));
                    const remoteIds = new Set(data.operations.map(op => op.id));
                    
                    const toAdd = data.operations.filter(op => 
                        !localIds.has(op.id) && !appData.deletedIds.includes(op.id)
                    );
                    
                    const toDelete = Array.from(localIds).filter(id => !remoteIds.has(id));
                    
                    if (toAdd.length > 0) appData.operations.push(...toAdd);
                    if (toDelete.length > 0) {
                        appData.operations = appData.operations.filter(op => !toDelete.includes(op.id));
                        toDelete.forEach(id => {
                            if (!appData.deletedIds.includes(id)) {
                                appData.deletedIds.push(id);
                            }
                        });
                    }
                    
                    if (toAdd.length > 0 || toDelete.length > 0) {
                        saveData();
                        updateDashboard();
                        updateHistoryFilter();
                    }
                }
            } catch (error) {
                console.error('Load error:', error);
            }
        }

        async function syncWithGoogleAppsScript() {
            if (!appData.deployUrl || !isOnline) return;
            try {
                const response = await fetch(appData.deployUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        operations: appData.operations,
                        initialBalanceSUM: appData.initialBalanceSUM,
                        initialBalanceUSD: appData.initialBalanceUSD
                    })
                });
            } catch (error) {
                console.error('Sync error:', error);
            }
        }

        function autoSync() {
            if (isSynced && appData.deployUrl && isOnline) syncWithGoogleAppsScript();
        }

        function exportToExcel() {
            try {
                if (typeof XLSX === 'undefined') {
                    showMessage('Библиотека загружается, подожди', 'error');
                    return;
                }
                const data = [['Дата', 'Время', 'Тип', 'Категория', 'Сумма', 'Валюта', 'Описание']];
                appData.operations.slice().sort((a, b) => a.dateTime - b.dateTime).forEach(op => {
                    const date = new Date(op.dateTime);
                    const dateStr = date.toLocaleDateString('ru-RU');
                    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    data.push([
                        dateStr, timeStr,
                        op.type === 'income' ? 'Приход' : 'Расход',
                        op.category, op.amount, op.currency,
                        op.description || ''
                    ]);
                });
                const ws = XLSX.utils.aoa_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Касса");
                ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 20 }];
                const fileName = `cash_report_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`;
                XLSX.writeFile(wb, fileName);
                showMessage('Экспортировано в Excel', 'success');
            } catch (error) {
                showMessage('Ошибка: ' + error.message, 'error');
            }
        }

        function exportAllData() {
            const dataStr = JSON.stringify(appData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `cash_backup_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.json`);
            link.click();
            showMessage('Резервная копия загружена', 'success');
        }

        function importData(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const imported = JSON.parse(e.target.result);
                    appData = imported;
                    saveData();
                    updateDashboard();
                    updateHistoryFilter();
                    renderCategoryLists();
                    showMessage('Данные загружены', 'success');
                } catch (error) {
                    showMessage('Ошибка при загрузке', 'error');
                }
            };
            reader.readAsText(file);
        }

        function clearAllData() {
            if (confirm('Удалить ВСЕ данные?')) {
                appData = {
                    initialBalanceSUM: 0,
                    initialBalanceUSD: 0,
                    expenseCategories: ['Зарплата', 'Электричество', 'Материалы', 'Транспорт', 'Прочее'],
                    incomeCategories: ['Продажи', 'Прочие приходы'],
                    operations: [],
                    sheetId: appData.sheetId,
                    deployUrl: appData.deployUrl,
                    deletedIds: [],
                    exchangeRate: DEFAULT_EXCHANGE_RATE
                };
                saveData();
                updateDashboard();
                updateHistoryFilter();
                renderCategoryLists();
                showMessage('Данные очищены', 'success');
            }
        }

        function showMessage(text, type) {
            const msg = document.createElement('div');
            msg.className = `message ${type}`;
            msg.textContent = text;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 3000);
        }

        function initTheme() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            setTheme(savedTheme);
        }

        function setTheme(theme) {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
                document.getElementById('darkThemeBtn').style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)';
                document.getElementById('darkThemeBtn').style.color = 'white';
                document.getElementById('darkThemeBtn').style.border = 'none';
                document.getElementById('lightThemeBtn').style.background = 'var(--bg)';
                document.getElementById('lightThemeBtn').style.color = 'var(--text-primary)';
                document.getElementById('lightThemeBtn').style.border = '1px solid var(--border)';
            } else {
                document.documentElement.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
                document.getElementById('lightThemeBtn').style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)';
                document.getElementById('lightThemeBtn').style.color = 'white';
                document.getElementById('lightThemeBtn').style.border = 'none';
                document.getElementById('darkThemeBtn').style.background = 'var(--bg)';
                document.getElementById('darkThemeBtn').style.color = 'var(--text-primary)';
                document.getElementById('darkThemeBtn').style.border = '1px solid var(--border)';
            }
        }

        function saveInitialBalance() {
            const sumStr = document.getElementById('initialSumInput').value.replace(/\s/g, '');
            const usdStr = document.getElementById('initialUsdInput').value.replace(/\s/g, '');
            const sum = parseFloat(sumStr) || 0;
            const usd = parseFloat(usdStr) || 0;
            const cashId = document.getElementById('initialBalanceCash').value;

            if (sum === 0 && usd === 0) {
                showMessage('Введи хотя бы одну сумму', 'error');
                return;
            }

            appData.initialBalances[cashId] = { SUM: sum, USD: usd };
            
            saveData();
            updateDashboard();
            showMessage('Начальный остаток сохранен', 'success');
        }

        function updateInitialBalanceDisplay() {
            const cashId = document.getElementById('initialBalanceCash').value;
            const balance = appData.initialBalances[cashId] || { SUM: 0, USD: 0 };
            document.getElementById('initialSumInput').value = balance.SUM > 0 ? balance.SUM.toLocaleString('ru-RU') : '';
            document.getElementById('initialUsdInput').value = balance.USD > 0 ? balance.USD.toLocaleString('ru-RU') : '';
        }

        // РЕДАКТИРОВАНИЕ ОПЕРАЦИИ
        let editingOperationId = null;

        function editOperation(id) {
            editingOperationId = id;
            const op = appData.operations.find(o => o.id === id);
            if (!op) return;

            document.getElementById('editOperationType').value = op.type;
            updateEditCategorySelect();
            document.getElementById('editCategory').value = op.category;
            document.getElementById('editAmount').value = op.amount.toLocaleString('ru-RU');
            document.getElementById('editCurrency').value = op.currency;
            
            const date = new Date(op.dateTime);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            document.getElementById('editDateTime').value = `${year}-${month}-${day}T${hour}:${minute}`;
            
            document.getElementById('editDescription').value = op.description || '';
            
            openModal('editOperation');
        }

        function updateEditCategorySelect() {
            const type = document.getElementById('editOperationType').value;
            const categories = type === 'expense' ? appData.expenseCategories : appData.incomeCategories;
            const select = document.getElementById('editCategory');
            select.innerHTML = '';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                select.appendChild(option);
            });
        }

        function saveEditOperation() {
            if (!editingOperationId) return;
            
            const amountStr = document.getElementById('editAmount').value.replace(/\s/g, '');
            const amount = parseFloat(amountStr) || 0;
            
            if (amount <= 0) {
                showMessage('Сумма должна быть больше 0', 'error');
                return;
            }

            const opIndex = appData.operations.findIndex(o => o.id === editingOperationId);
            if (opIndex === -1) return;

            appData.operations[opIndex] = {
                ...appData.operations[opIndex],
                type: document.getElementById('editOperationType').value,
                category: document.getElementById('editCategory').value,
                amount: amount,
                currency: document.getElementById('editCurrency').value,
                dateTime: new Date(document.getElementById('editDateTime').value).getTime(),
                description: document.getElementById('editDescription').value,
                timestamp: new Date().getTime()
            };

            saveData();
            updateDashboard();
            updateHistoryFilter();
            closeModal('editOperation');
            editingOperationId = null;
            if (isSynced && isOnline) syncWithGoogleAppsScript();
            showMessage('Операция обновлена', 'success');
        }

        function deleteEditingOperation() {
            if (editingOperationId && confirm('Удалить операцию?')) {
                deleteOperation(editingOperationId);
                closeModal('editOperation');
                editingOperationId = null;
            }
        }

        function duplicateOperation(id) {
            const op = appData.operations.find(o => o.id === id);
            if (!op) return;

            const newOp = {
                ...op,
                id: Date.now(),
                timestamp: new Date().getTime()
            };

            appData.operations.push(newOp);
            saveData();
            updateDashboard();
            updateHistoryFilter();
            if (isSynced && isOnline) syncWithGoogleAppsScript();
            showMessage('Операция дублирована', 'success');
        }

        // ШАБЛОНЫ
        function renderTemplatesList() {
            const container = document.getElementById('templatesList');
            if (!appData.templates || appData.templates.length === 0) {
                container.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; text-align: center; padding: 20px;">У вас нет шаблонов</div>';
                return;
            }

            container.innerHTML = appData.templates.map((template, index) => `
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="btn btn-primary" style="flex: 1; padding: 10px;" onclick="useTemplate(${index})">
                        ${template.name} • ${template.amount.toLocaleString('ru-RU')} ${template.currency}
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deleteTemplate(${index})">✕</button>
                </div>
            `).join('');
        }

        function updateTemplateCategorySelect() {
            const type = document.getElementById('templateType').value;
            const categories = type === 'expense' ? appData.expenseCategories : appData.incomeCategories;
            const select = document.getElementById('templateCategory');
            select.innerHTML = '';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                select.appendChild(option);
            });
        }

        function createTemplate() {
            const name = document.getElementById('templateName').value.trim();
            const amountStr = document.getElementById('templateAmount').value.replace(/\s/g, '');
            const amount = parseFloat(amountStr) || 0;

            if (!name) {
                showMessage('Введи название шаблона', 'error');
                return;
            }

            if (amount <= 0) {
                showMessage('Сумма должна быть больше 0', 'error');
                return;
            }

            if (!appData.templates) appData.templates = [];

            appData.templates.push({
                name: name,
                type: document.getElementById('templateType').value,
                category: document.getElementById('templateCategory').value,
                amount: amount,
                currency: document.getElementById('templateCurrency').value
            });

            saveData();
            renderTemplatesList();
            
            document.getElementById('templateName').value = '';
            document.getElementById('templateAmount').value = '';
            showMessage('Шаблон создан', 'success');
        }

        function useTemplate(index) {
            const template = appData.templates[index];
            if (!template) return;

            document.getElementById('operationType').value = template.type;
            updateCategorySelect();
            document.getElementById('category').value = template.category;
            document.getElementById('amount').value = template.amount.toLocaleString('ru-RU');
            document.getElementById('currency').value = template.currency;
            setDefaultDateTime();
            
            closeModal('templatesModal');
            switchTab('add');
            showMessage(`Шаблон "${template.name}" загружен`, 'success');
        }

        function deleteTemplate(index) {
            if (confirm('Удалить шаблон?')) {
                appData.templates.splice(index, 1);
                saveData();
                renderTemplatesList();
                showMessage('Шаблон удален', 'success');
            }
        }

        // КАССЫ И ПЕРЕВОДЫ
        function updateCashSelects() {
            const cashSelects = ['operationCash', 'transferFromCash', 'transferToCash'];
            cashSelects.forEach(selectId => {
                const select = document.getElementById(selectId);
                if (!select) return;
                select.innerHTML = '<option>Выбрать</option>';
                appData.cashes.forEach(cash => {
                    const option = document.createElement('option');
                    option.value = cash.id;
                    option.textContent = cash.name;
                    select.appendChild(option);
                });
            });
        }

        function getCashBalance(cashId, currency) {
            let balance = appData.initialBalances[cashId][currency] || 0;
            appData.operations.forEach(op => {
                if (op.cashId === cashId && op.currency === currency) {
                    if (op.type === 'income') balance += op.amount;
                    else balance -= op.amount;
                }
            });
            return balance;
        }

        function transferBetweenCashes() {
            const fromCashId = document.getElementById('transferFromCash').value;
            const toCashId = document.getElementById('transferToCash').value;
            const amountStr = document.getElementById('transferAmount').value.replace(/\s/g, '');
            const amount = parseFloat(amountStr) || 0;
            const currency = document.getElementById('transferCurrency').value;

            if (fromCashId === 'Выбрать' || toCashId === 'Выбрать') {
                showMessage('Выбери касс для перевода', 'error');
                return;
            }

            if (fromCashId === toCashId) {
                showMessage('Выбери разные кассы', 'error');
                return;
            }

            if (amount <= 0) {
                showMessage('Сумма должна быть больше 0', 'error');
                return;
            }

            const fromBalance = getCashBalance(fromCashId, currency);
            if (fromBalance < amount) {
                showMessage(`Недостаточно средств в кассе (есть ${fromBalance.toLocaleString('ru-RU')} ${currency})`, 'error');
                return;
            }

            // Расход из одной кассы
            appData.operations.push({
                id: Date.now(),
                type: 'expense',
                category: 'Перевод между кассами',
                amount: amount,
                currency: currency,
                cashId: fromCashId,
                dateTime: new Date().getTime(),
                description: `Перевод в другую кассу`,
                timestamp: new Date().getTime()
            });

            // Приход в другую кассу
            appData.operations.push({
                id: Date.now() + 1,
                type: 'income',
                category: 'Перевод между кассами',
                amount: amount,
                currency: currency,
                cashId: toCashId,
                dateTime: new Date().getTime(),
                description: `Получение из другой кассы`,
                timestamp: new Date().getTime()
            });

            saveData();
            updateDashboard();
            
            document.getElementById('transferAmount').value = '';
            document.getElementById('transferFromCash').value = 'Выбрать';
            document.getElementById('transferToCash').value = 'Выбрать';
            
            if (isSynced && isOnline) syncWithGoogleAppsScript();
            showMessage('Перевод выполнен', 'success');
        }

        // ОБМЕН ВАЛЮТ В КАССЕ
        function updateExchangeFullUI() {
            updateExchangeCurrency();
            updateExchangeBalance();
        }

        function updateExchangeCurrency() {
            const from = document.getElementById('exchangeFrom').value;
            const to = from === 'USD' ? 'SUM' : 'USD';
            
            document.getElementById('exchangeFromCurr').textContent = from;
            document.getElementById('exchangeToCurr').textContent = to;
        }

        function updateExchangeBalance() {
            const cashId = document.getElementById('exchangeCash').value;
            const from = document.getElementById('exchangeFrom').value;
            
            if (cashId === 'Выбрать') {
                document.getElementById('exchangeFromBalance').textContent = '0';
                return;
            }
            
            const balance = getCashBalance(cashId, from);
            document.getElementById('exchangeFromBalance').textContent = balance.toLocaleString('ru-RU');
        }

        function updateExchangeCalculate() {
            const amountStr = document.getElementById('exchangeAmount').value.replace(/\s/g, '');
            const amount = parseFloat(amountStr) || 0;
            const from = document.getElementById('exchangeFrom').value;
            const rateStr = document.getElementById('exchangeRateInput').value.replace(/\s/g, '');
            const rate = parseFloat(rateStr) || currentExchangeRate;
            
            if (amount <= 0) {
                document.getElementById('exchangeResultInput').value = '';
                return;
            }
            
            let result = 0;
            if (from === 'USD') {
                result = amount * rate;
            } else {
                result = amount / rate;
            }
            
            document.getElementById('exchangeResultInput').value = result.toLocaleString('ru-RU');
        }

        function updateExchangeRateFromResult() {
            const amountStr = document.getElementById('exchangeAmount').value.replace(/\s/g, '');
            const resultStr = document.getElementById('exchangeResultInput').value.replace(/\s/g, '');
            const amount = parseFloat(amountStr) || 0;
            const result = parseFloat(resultStr) || 0;
            const from = document.getElementById('exchangeFrom').value;
            
            if (amount <= 0 || result <= 0) return;
            
            let newRate = 0;
            if (from === 'USD') {
                newRate = result / amount;
            } else {
                newRate = amount / result;
            }
            
            document.getElementById('exchangeRateInput').value = newRate.toLocaleString('ru-RU');
        }

        function resetExchangeRateModal() {
            document.getElementById('exchangeRateInput').value = currentExchangeRate.toLocaleString('ru-RU');
            updateExchangeCalculate();
        }

        function executeExchange() {
            const cashId = document.getElementById('exchangeCash').value;
            const fromCurrency = document.getElementById('exchangeFrom').value;
            const toCurrency = fromCurrency === 'USD' ? 'SUM' : 'USD';
            const amountStr = document.getElementById('exchangeAmount').value.replace(/\s/g, '');
            const amount = parseFloat(amountStr) || 0;
            const resultStr = document.getElementById('exchangeResultInput').value.replace(/\s/g, '');
            const exchangedAmount = parseFloat(resultStr) || 0;

            if (cashId === 'Выбрать') {
                showMessage('Выбери кассу', 'error');
                return;
            }

            if (amount <= 0) {
                showMessage('Сумма должна быть больше 0', 'error');
                return;
            }

            if (exchangedAmount <= 0) {
                showMessage('Сумма получишь должна быть больше 0', 'error');
                return;
            }

            const balance = getCashBalance(cashId, fromCurrency);
            if (balance < amount) {
                showMessage(`Недостаточно ${fromCurrency} (есть ${balance.toLocaleString('ru-RU')})`, 'error');
                return;
            }

            // Расходуем одну валюту
            appData.operations.push({
                id: Date.now(),
                type: 'expense',
                category: 'Обмен валют',
                amount: amount,
                currency: fromCurrency,
                cashId: cashId,
                dateTime: new Date().getTime(),
                description: `Обмен на ${toCurrency}`,
                timestamp: new Date().getTime()
            });

            // Добавляем другую валюту
            appData.operations.push({
                id: Date.now() + 1,
                type: 'income',
                category: 'Обмен валют',
                amount: exchangedAmount,
                currency: toCurrency,
                cashId: cashId,
                dateTime: new Date().getTime(),
                description: `Получено от обмена`,
                timestamp: new Date().getTime()
            });

            saveData();
            updateDashboard();
            closeModal('exchangeModal');
            
            if (isSynced && isOnline) syncWithGoogleAppsScript();
            showMessage(`✅ Обменял ${amount.toLocaleString('ru-RU')} ${fromCurrency} на ${exchangedAmount.toLocaleString('ru-RU')} ${toCurrency}`, 'success');
        }

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) e.target.classList.remove('active');
        });

        document.addEventListener('change', (e) => {
            if (['actualBalanceSUM', 'actualBalanceUSD'].includes(e.target.id)) updateAdjustSummary();
        });
