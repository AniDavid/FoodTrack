//claude --settings C:\Users\anida\.claude\lmstudio.setting.json

//--- DOM Elements ---
const calendarMonthEl = document.getElementById('calendar-month');
const monthLabelEl = document.getElementById('calendar-month-label');
const prevMonthButton = document.getElementById('prev-month-button');
const todayButton = document.getElementById('today-button');
const nextMonthButton = document.getElementById('next-month-button');
const foodLoggingPanelEl = document.getElementById('food-logging-panel');
const closeLogOverlayButton = document.getElementById('close-log-overlay');
const selectedDateHeaderEl = document.getElementById('selected-date-header');
const dailyCaloriesSummaryEl = document.getElementById('daily-calories-summary');
const foodNameSelect = document.getElementById('foodNameSelect');
const foodNameCustom = document.getElementById('foodNameCustom');
const foodTypeSelect = document.getElementById('foodTypeSelect');
const foodTypeCustom = document.getElementById('foodTypeCustom');
const quantityInput = document.getElementById('quantity');
const caloriesInput = document.getElementById('calories');
const unitSelect = document.getElementById('unitSelect');
const unitCustom = document.getElementById('unitCustom');
const addFoodButton = document.getElementById('add-food-button');
const cancelEditButton = document.getElementById('cancel-edit-button');
const dailyLogListEl = document.getElementById('daily-log-list');

// --- State Management ---
let currentViewDate = new Date(); // Tracks the month/year currently displayed in calendar
let selectedDateKey = ''; // Stores YYYY-MM-DD for the date actively viewed
let editingEntryId = null; // The entry currently being edited, if any

/**
 * Helper function to format a Date object into a standard string key (YYYY-MM-DD).
 * @param {Date} date The date object.
 * @returns {string} The formatted date key.
 */
const formatDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Loads food data from localStorage. 
 * @returns {Object} An object where keys are date strings (YYYY-MM-DD) and values are arrays of food entries.
 */
const loadFoodData = () => {
    try {
        const dataString = localStorage.getItem('foodTrackerData');
        return dataString ? JSON.parse(dataString) : {};
    } catch (e) {
        console.error("Error loading food data from local storage:", e);
        return {};
    }
};

/**
 * Saves the current state of food data to localStorage and syncs to cloud if connected.
 * @param {Object} data The data object to save.
 */
const saveFoodData = (data) => {
    try {
        localStorage.setItem('foodTrackerData', JSON.stringify(data));
        if (window.FoodTrackSync && typeof window.FoodTrackSync.pushToCloud === 'function') {
            window.FoodTrackSync.pushToCloud();
        }
    } catch (e) {
        console.error("Error saving food data to local storage:", e);
    }
};

const loadOptionData = () => {
    try {
        const dataString = localStorage.getItem('foodTrackerOptions');
        const baseOptions = dataString ? JSON.parse(dataString) : { foodNames: [], foodTypes: [], units: [], associations: {} };

        const options = {
            foodNames: Array.isArray(baseOptions.foodNames) ? baseOptions.foodNames : [],
            foodTypes: Array.isArray(baseOptions.foodTypes) ? baseOptions.foodTypes : [],
            units: Array.isArray(baseOptions.units) ? baseOptions.units : [],
            associations: baseOptions.associations && typeof baseOptions.associations === 'object' ? baseOptions.associations : {}
        };

        const foodData = loadFoodData();
        Object.values(foodData).flat().forEach(entry => {
            const foodName = (entry.foodName || '').trim();
            const foodType = (entry.foodType || '').trim();
            const unit = (entry.unit || '').trim();

            addUniqueOption(options.foodNames, foodName);
            addUniqueOption(options.foodTypes, foodType);
            addUniqueOption(options.units, unit);

            if (foodName && foodType && unit) {
                options.associations[foodName] = { type: foodType, unit };
            }
        });

        return options;
    } catch (e) {
        console.error("Error loading dropdown options:", e);
        return { foodNames: [], foodTypes: [], units: [], associations: {} };
    }
};

const saveOptionData = (data) => {
    try {
        const dataToSave = {
            foodNames: Array.isArray(data.foodNames) ? data.foodNames : [],
            foodTypes: Array.isArray(data.foodTypes) ? data.foodTypes : [],
            units: Array.isArray(data.units) ? data.units : [],
            associations: data.associations && typeof data.associations === 'object' ? data.associations : {}
        };
        localStorage.setItem('foodTrackerOptions', JSON.stringify(dataToSave));
        if (window.FoodTrackSync && typeof window.FoodTrackSync.pushToCloud === 'function') {
            window.FoodTrackSync.pushToCloud();
        }
    } catch (e) {
        console.error("Error saving dropdown options to local storage:", e);
    }
};

const rememberFoodAssociation = (foodName, foodType, unit) => {
    const normalizedFoodName = (foodName || '').trim();
    const normalizedFoodType = (foodType || '').trim();
    const normalizedUnit = (unit || '').trim();

    if (!normalizedFoodName || !normalizedFoodType || !normalizedUnit) return;

    const options = loadOptionData();
    options.associations = options.associations || {};
    options.associations[normalizedFoodName] = {
        type: normalizedFoodType,
        unit: normalizedUnit
    };

    addUniqueOption(options.foodNames, normalizedFoodName);
    addUniqueOption(options.foodTypes, normalizedFoodType);
    addUniqueOption(options.units, normalizedUnit);

    saveOptionData(options);
};

const resetFormEditingState = () => {
    editingEntryId = null;
    addFoodButton.textContent = 'הוסף רשומה';
    cancelEditButton.classList.add('hidden');
};

const addUniqueOption = (list, value) => {
    if (!value) return;
    const normalized = value.trim();
    if (!normalized) return;
    if (!list.some(item => item.toLowerCase() === normalized.toLowerCase())) {
        list.push(normalized);
    }
};

const addOptionToSelect = (selectElement, value) => {
    const normalized = value.trim();
    if (!normalized) return;
    const existing = Array.from(selectElement.options).some(option => option.value.toLowerCase() === normalized.toLowerCase());
    if (!existing) {
        const option = document.createElement('option');
        option.value = normalized;
        option.textContent = normalized;
        selectElement.insertBefore(option, selectElement.querySelector('option[value="__new"]'));
    }
};

const populateDropdowns = () => {
    const options = loadOptionData();

    const resetSelect = (selectElement) => {
        const newOption = selectElement.querySelector('option[value="__new"]');
        selectElement.innerHTML = '';
        selectElement.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: 'בחר אפשרות קיימת או הוסף חדשה' }));
        selectElement.appendChild(newOption);
    };

    resetSelect(foodNameSelect);
    resetSelect(foodTypeSelect);
    resetSelect(unitSelect);

    options.foodNames.forEach(name => addOptionToSelect(foodNameSelect, name));
    options.foodTypes.forEach(type => addOptionToSelect(foodTypeSelect, type));
    options.units.forEach(unit => addOptionToSelect(unitSelect, unit));

    foodNameSelect.onchange = () => {
        const selectedFoodName = foodNameSelect.value;

        if (selectedFoodName === '__new') {
            foodTypeSelect.value = '';
            unitSelect.value = '';
            return;
        }

        const association = selectedFoodName ? options.associations[selectedFoodName] : null;

        if (association) {
            foodTypeSelect.value = association.type;
            unitSelect.value = association.unit;
            foodTypeCustom.classList.add('hidden');
            unitCustom.classList.add('hidden');
            foodTypeCustom.value = '';
            unitCustom.value = '';
        } else {
            foodTypeSelect.value = '';
            unitSelect.value = '';
        }
    };
};

/**
 * Renders the calendar view for a given month/year.
 * @param {Date} date The starting date for the month display.
 */
const renderCalendar = (date) => {
    // Preserve selection across re-renders
    const previousSelected = selectedDateKey;

    calendarMonthEl.innerHTML = ''; // Clear previous content
    
    // Set currentViewDate to the provided date object so we can track changes.
    currentViewDate = new Date(date.getFullYear(), date.getMonth(), 1);

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    // Header (Day names)
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    dayNames.forEach(name => {
        const header = document.createElement('div');
        header.classList.add('day-header');
        header.textContent = name;
        calendarMonthEl.appendChild(header);
    });

    // Calculate first day of the month
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Add filler days if necessary
    for (let i = 0; i < firstDayOfMonth; i++) {
        const filler = document.createElement('div');
        filler.classList.add('calendar-day', 'filler');
        filler.textContent = '';
        calendarMonthEl.appendChild(filler);
    }

    // Add actual days
    const optionsData = loadFoodData();
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'calendar-day-item');
        dayDiv.textContent = day;
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayDiv.dataset.date = dateKey;
        dayDiv.dataset.fullDate = new Date(`${dateKey}T00:00:00`).toDateString();

        // Mark days that have entries
        if (optionsData[dateKey] && Array.isArray(optionsData[dateKey]) && optionsData[dateKey].length > 0) {
            dayDiv.classList.add('has-entries');
        }

        calendarMonthEl.appendChild(dayDiv);
    }

    // Update month label
    const monthName = currentViewDate.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
    monthLabelEl.textContent = monthName;

    const todayKey = formatDateKey(new Date());

    // Try to preserve previously-selected day if it still belongs to the month
    const preservedEl = previousSelected ? document.querySelector(`.calendar-day[data-date="${previousSelected}"]`) : null;
    if (preservedEl) {
        document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('active'));
        preservedEl.classList.add('active');
        selectedDateKey = previousSelected;
    } else {
        const isCurrentMonth = todayKey.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
        const defaultKey = isCurrentMonth ? todayKey : `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const defaultEl = document.querySelector(`.calendar-day[data-date="${defaultKey}"]`) || document.querySelector('.calendar-day');
        if (defaultEl) {
            document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('active'));
            defaultEl.classList.add('active');
            selectedDateKey = defaultEl.dataset.date;
        }
    }
};

const goToPreviousMonth = () => {
    const previousMonth = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1);
    renderCalendar(previousMonth);
};

const goToToday = () => {
    selectedDateKey = '';
    renderCalendar(new Date());
};

const toggleCustomField = (selectElement, customInput) => {
    if (selectElement.value === '__new') {
        customInput.classList.remove('hidden');
        customInput.focus();
    } else {
        customInput.classList.add('hidden');
        customInput.value = '';
    }
};

const getDropdownValue = (selectElement, customInput) => {
    if (selectElement.value === '__new') {
        return customInput.value.trim();
    }
    return selectElement.value.trim();
};

const goToNextMonth = () => {
    const nextMonth = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
    renderCalendar(nextMonth);
};

/**
 * Handles changing the visible date when a calendar day is clicked.
 * @param {HTMLElement} element The clicked day element.
 */
const handleDateClick = (element) => {
    if (!element) return;
    // 1. Update state and UI class
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    
    selectedDateKey = element.dataset.date;
    const displayDate = new Date(`${selectedDateKey}T00:00:00`);
    
    // 2. Update Header (e.g., "Monday, October 15, 2024")
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    selectedDateHeaderEl.textContent = displayDate.toLocaleDateString('he-IL', dateOptions).replace(/,/g, '');

    // 3. Show logging overlay and render entries
    foodLoggingPanelEl.classList.add('visible');
    renderDailyLog();
};

/**
 * Renders the food log for the currently selected day.
 */
const renderDailyLog = () => {
    const foodData = loadFoodData();
    const entries = foodData[selectedDateKey] || [];

    dailyLogListEl.innerHTML = ''; // Clear previous list
    dailyCaloriesSummaryEl.textContent = '';

    if (entries.length === 0) {
        dailyLogListEl.innerHTML = '<p style="padding:15px; background-color:#fff9e6; border-left: 5px solid #ffc107;">אין רישומים ליום זה עדיין. הוסף את הארוחה הראשונה!</p>';
        return;
    }

    const calorieValues = entries.map(entry => (typeof entry.calories === 'number' && !Number.isNaN(entry.calories)) ? entry.calories : 0);
    const totalCalories = calorieValues.reduce((sum, value) => sum + value, 0);
    const hasAnyCalories = entries.some(entry => typeof entry.calories === 'number' && !Number.isNaN(entry.calories));

    if (hasAnyCalories) {
        dailyCaloriesSummaryEl.textContent = `סך כל הקלוריות ליום: ${totalCalories} kcal`;
    }

    // Display in reverse order (most recent first)
    entries.slice().reverse().forEach(entry => {
        const li = document.createElement('li');
        const foodName = entry.foodName || '';
        const foodType = entry.foodType || '';
        const quantity = (typeof entry.quantity === 'number') ? entry.quantity : '';
        const unit = entry.unit || '';
        const calories = (typeof entry.calories === 'number') ? entry.calories : undefined;
        const time = entry.time || 'N/A';

        li.innerHTML = `
            <span class="log-entry-text">${time} • ${foodName}${foodType ? ` • ${foodType}` : ''} • ${quantity} ${unit}${calories ? ` • ${calories} kcal` : ''}</span>
            <div class="entry-actions">
                <button class="edit-entry" aria-label="ערוך" title="ערוך" data-date="${selectedDateKey}" data-index="${entry.id}">
                    <span class="edit-icon">✎</span>
                </button>
                <button class="delete-entry" aria-label="מחק" title="מחק" data-date="${selectedDateKey}" data-index="${entry.id}">
                    <span class="delete-icon">✕</span>
                </button>
            </div>
        `;
        dailyLogListEl.appendChild(li);
    });
};


/**
 * Handles form submission, adding a new food entry.
 */
const addFoodEntry = (event) => {
    event.preventDefault();

    const foodData = loadFoodData();

    // Validation Check
    const foodName = getDropdownValue(foodNameSelect, foodNameCustom);
    const foodType = getDropdownValue(foodTypeSelect, foodTypeCustom);
    const quantityValue = parseFloat(quantityInput.value);
    const unit = getDropdownValue(unitSelect, unitCustom);
    const caloriesValueRaw = caloriesInput ? caloriesInput.value : '';
    const caloriesValue = caloriesValueRaw === '' ? undefined : parseFloat(caloriesValueRaw);

    if (!foodName || !foodType || Number.isNaN(quantityValue) || quantityValue <= 0 || !unit) {
        alert('אנא מלא את כל השדות החובה: שם מזון, סוג מזון, כמות חיובית ויחידה.');
        return;
    }

    const isEditing = Boolean(editingEntryId);
    const newEntry = {
        id: editingEntryId || String(Date.now()),
        foodName,
        foodType,
        quantity: quantityValue,
        unit,
        calories: Number.isFinite(caloriesValue) ? caloriesValue : undefined,
        time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };

    if (!foodData[selectedDateKey]) {
        foodData[selectedDateKey] = [];
    }

    if (isEditing) {
        foodData[selectedDateKey] = foodData[selectedDateKey].map(entry => entry.id === editingEntryId ? { ...entry, ...newEntry } : entry);
    } else {
        foodData[selectedDateKey].push(newEntry);
    }
    saveFoodData(foodData);
    rememberFoodAssociation(foodName, foodType, unit);

    // Refresh calendar markers to show days with entries
    // Ensure the calendar day element for this date shows the indicator immediately
    const dayEl = document.querySelector(`.calendar-day[data-date="${selectedDateKey}"]`);
    if (dayEl) dayEl.classList.add('has-entries');
    renderCalendar(currentViewDate);

    const options = loadOptionData();
    addUniqueOption(options.foodNames, foodName);
    addUniqueOption(options.foodTypes, foodType);
    addUniqueOption(options.units, unit);
    saveOptionData(options);
    populateDropdowns();

    // 2. Render updated list and clear form
    renderDailyLog();
    resetFormFields();
    resetFormEditingState();
};

const resetFormFields = () => {
    foodNameSelect.value = '';
    foodTypeSelect.value = '';
    quantityInput.value = '';
    if (caloriesInput) caloriesInput.value = '';
    unitSelect.value = '';
    foodNameCustom.value = '';
    foodTypeCustom.value = '';
    unitCustom.value = '';
    foodNameCustom.classList.add('hidden');
    foodTypeCustom.classList.add('hidden');
    unitCustom.classList.add('hidden');
};


/**
 * Event delegation for deleting entries.
 */
const setupEventListeners = () => {
    document.getElementById('food-entry-form').addEventListener('submit', addFoodEntry);
    cancelEditButton.addEventListener('click', () => {
        resetFormFields();
        resetFormEditingState();
    });
    closeLogOverlayButton.addEventListener('click', () => {
        foodLoggingPanelEl.classList.remove('visible');
    });
    foodLoggingPanelEl.addEventListener('click', (event) => {
        if (event.target === foodLoggingPanelEl) {
            foodLoggingPanelEl.classList.remove('visible');
        }
    });
    prevMonthButton.addEventListener('click', goToPreviousMonth);
    todayButton.addEventListener('click', goToToday);
    nextMonthButton.addEventListener('click', goToNextMonth);
    foodNameSelect.addEventListener('change', () => {
        toggleCustomField(foodNameSelect, foodNameCustom);

        const selectedFoodName = foodNameSelect.value;
        if (!selectedFoodName || selectedFoodName === '__new') {
            foodTypeSelect.value = '';
            unitSelect.value = '';
            return;
        }

        const options = loadOptionData();
        const association = options.associations[selectedFoodName];
        if (association) {
            foodTypeSelect.value = association.type;
            unitSelect.value = association.unit;
            foodTypeCustom.classList.add('hidden');
            unitCustom.classList.add('hidden');
            foodTypeCustom.value = '';
            unitCustom.value = '';
        } else {
            foodTypeSelect.value = '';
            unitSelect.value = '';
        }
    });
    foodTypeSelect.addEventListener('change', () => toggleCustomField(foodTypeSelect, foodTypeCustom));
    unitSelect.addEventListener('change', () => toggleCustomField(unitSelect, unitCustom));
    // Ensure calendar day clicks always open the log (works after re-render)
    calendarMonthEl.addEventListener('click', (e) => {
        const dayEl = e.target.closest('.calendar-day-item');
        if (dayEl) handleDateClick(dayEl);
    });

    dailyLogListEl.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-entry');
        if (deleteButton) {
            const dateKey = deleteButton.dataset.date;
            const entryIdToDelete = deleteButton.dataset.index;

            if (confirm("האם אתה בטוח שברצונך למחוק את הרשומה הזו?")) {
                let foodData = loadFoodData();
                const entries = foodData[dateKey] || [];

                foodData[dateKey] = entries.filter(entry => String(entry.id) !== entryIdToDelete);

                saveFoodData(foodData);
                renderDailyLog();

                const dayElAfter = document.querySelector(`.calendar-day[data-date="${dateKey}"]`);
                if (dayElAfter) {
                    if (foodData[dateKey] && foodData[dateKey].length > 0) {
                        dayElAfter.classList.add('has-entries');
                    } else {
                        dayElAfter.classList.remove('has-entries');
                    }
                }
                renderCalendar(currentViewDate);
            }
            return;
        }

        const editButton = e.target.closest('.edit-entry');
        if (editButton) {
            const entryIdToEdit = editButton.dataset.index;
            enterEditMode(entryIdToEdit);
            foodLoggingPanelEl.classList.remove('visible');
        }
    });
};

const enterEditMode = (entryId) => {
    const foodData = loadFoodData();
    const entry = (foodData[selectedDateKey] || []).find(item => item.id === entryId);
    if (!entry) return;

    editingEntryId = entryId;
    addFoodButton.textContent = 'שמור שינויים';
    cancelEditButton.classList.remove('hidden');

    foodNameSelect.value = entry.foodName || '';
    if (!Array.from(foodNameSelect.options).some(option => option.value === entry.foodName)) {
        addOptionToSelect(foodNameSelect, entry.foodName);
    }
    foodTypeSelect.value = entry.foodType || '';
    if (!Array.from(foodTypeSelect.options).some(option => option.value === entry.foodType)) {
        addOptionToSelect(foodTypeSelect, entry.foodType);
    }
    quantityInput.value = entry.quantity || '';
    unitSelect.value = entry.unit || '';
    if (!Array.from(unitSelect.options).some(option => option.value === entry.unit)) {
        addOptionToSelect(unitSelect, entry.unit);
    }
    caloriesInput.value = typeof entry.calories === 'number' ? entry.calories : '';
};

// --- Cloud Auth & Backup UI Controller ---

let isRegisterMode = false;

/**
 * Returns a friendly Hebrew error message for Firebase Auth errors.
 * @param {Error} error 
 * @returns {string}
 */
const getAuthErrorMessage = (error) => {
    if (!error) return 'שגיאה לא ידועה, אנא נסה שוב.';
    const code = error.code || '';
    switch (code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return 'כתובת אימייל או סיסמה שגויים.';
        case 'auth/email-already-in-use':
            return 'כתובת אימייל זו כבר רשומה במערכת. אנא בחר בהתחברות.';
        case 'auth/invalid-email':
            return 'כתובת אימייל אינה תקינה.';
        case 'auth/weak-password':
            return 'הסיסמה קצרה מדי. נדרשים לפחות 6 תווים.';
        case 'auth/network-request-failed':
            return 'שגיאת רשת. אנא בדוק את החיבור לאינטרנט.';
        case 'auth/configuration-not-found':
        case 'auth/operation-not-allowed':
            return 'שירות ההתחברות טרם הופעל ב-Firebase Console. יש להיכנס ל-Firebase Console > Authentication > Sign-in method ולהפעיל את Google ו/או Email/Password.';
        case 'auth/popup-closed-by-user':
            return 'חלון ההתחברות נסגר על ידי המשתמש.';
        case 'auth/popup-blocked':
            return 'הדפדפן חסם את חלון ההתחברות. אנא אפשר חלונות קופצים.';
        default:
            return error.message || 'ההתחברות נכשלה, אנא נסה שוב.';
    }
};

/**
 * Display or clear an error message in the login dialog.
 * @param {string|null} message 
 */
const showAuthError = (message) => {
    const errorEl = document.getElementById('auth-error-msg');
    if (!errorEl) return;
    if (message) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    } else {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
};

/**
 * Open the login dialog modal.
 */
const openLoginModal = () => {
    const modal = document.getElementById('login-modal');
    if (modal) {
        showAuthError(null);
        modal.classList.remove('hidden');
    }
};

/**
 * Close the login dialog modal.
 */
const closeLoginModal = () => {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.classList.add('hidden');
        showAuthError(null);
    }
};

/**
 * Updates the header auth state (user profile vs login button) and handles auto-login popup on launch.
 * @param {Object} syncState 
 */
const updateAuthUI = (syncState = {}) => {
    const user = syncState.user || (window.FoodTrackSync ? window.FoodTrackSync.getUser() : null);
    const isAuthResolved = syncState.isAuthResolved || (window.FoodTrackSync && window.FoodTrackSync.isAuthResolved ? window.FoodTrackSync.isAuthResolved() : false);

    const loggedInHeader = document.getElementById('auth-header-logged-in');
    const loggedOutHeader = document.getElementById('auth-header-logged-out');
    const headerUserName = document.getElementById('header-user-name');
    const headerUserAvatar = document.getElementById('header-user-avatar');

    if (user) {
        // User is logged in
        if (loggedInHeader) loggedInHeader.classList.remove('hidden');
        if (loggedOutHeader) loggedOutHeader.classList.add('hidden');

        const displayName = user.displayName || user.email?.split('@')[0] || 'משתמש';
        if (headerUserName) {
            headerUserName.textContent = displayName;
        }

        if (headerUserAvatar) {
            if (user.photoURL) {
                headerUserAvatar.innerHTML = `<img src="${user.photoURL}" alt="${displayName}">`;
            } else {
                const initial = displayName.charAt(0).toUpperCase();
                headerUserAvatar.textContent = initial || '👤';
            }
        }

        // Close login dialog if open
        closeLoginModal();
    } else {
        // User is logged out
        if (loggedInHeader) loggedInHeader.classList.add('hidden');
        if (loggedOutHeader) loggedOutHeader.classList.remove('hidden');

        // Check if we should pop up the login dialog on launch
        const isGuest = sessionStorage.getItem('foodTrackGuestMode') === 'true';
        if (isAuthResolved && !user && !isGuest) {
            openLoginModal();
        }
    }
};

/**
 * Switches the email card between Login and Register modes.
 * @param {boolean} register 
 */
const setEmailAuthMode = (register) => {
    isRegisterMode = register;
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const nameField = document.getElementById('register-name-field');
    const submitBtn = document.getElementById('email-submit-btn');

    if (register) {
        if (tabRegister) tabRegister.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
        if (nameField) nameField.classList.remove('hidden');
        if (submitBtn) submitBtn.textContent = 'הרשמה וסנכרון';
    } else {
        if (tabLogin) tabLogin.classList.add('active');
        if (tabRegister) tabRegister.classList.remove('active');
        if (nameField) nameField.classList.add('hidden');
        if (submitBtn) submitBtn.textContent = 'התחבר';
    }
    showAuthError(null);
};

/**
 * Exports current food logs and options as a downloadable JSON file.
 */
const exportDataAsJSON = () => {
    try {
        const exportPayload = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            foodTrackerData: loadFoodData(),
            foodTrackerOptions: loadOptionData()
        };

        const jsonStr = JSON.stringify(exportPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const todayStr = formatDateKey(new Date());
        const link = document.createElement('a');
        link.href = url;
        link.download = `food-track-backup-${todayStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Export failed:', e);
        alert('שגיאה בייצוא הקובץ. אנא נסה שוב.');
    }
};

/**
 * Imports food logs and options from an uploaded JSON file.
 * @param {File} file 
 */
const importDataFromJSON = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || typeof parsed !== 'object') {
                throw new Error('קובץ לא תקין');
            }

            let incomingFoodData = {};
            let incomingOptions = {};

            if (parsed.foodTrackerData) {
                incomingFoodData = parsed.foodTrackerData;
                incomingOptions = parsed.foodTrackerOptions || {};
            } else {
                incomingFoodData = parsed;
            }

            const currentFoodData = loadFoodData();
            const currentOptions = loadOptionData();

            const mergedFoodData = { ...currentFoodData };
            for (const [dateKey, entries] of Object.entries(incomingFoodData)) {
                if (!Array.isArray(entries)) continue;
                if (!mergedFoodData[dateKey]) {
                    mergedFoodData[dateKey] = [...entries];
                } else {
                    const entryMap = new Map();
                    mergedFoodData[dateKey].forEach(item => { if (item && item.id) entryMap.set(String(item.id), item); });
                    entries.forEach(item => { if (item && item.id) entryMap.set(String(item.id), item); });
                    mergedFoodData[dateKey] = Array.from(entryMap.values());
                }
            }

            const mergedOptions = {
                foodNames: Array.from(new Set([...currentOptions.foodNames, ...(incomingOptions.foodNames || [])])),
                foodTypes: Array.from(new Set([...currentOptions.foodTypes, ...(incomingOptions.foodTypes || [])])),
                units: Array.from(new Set([...currentOptions.units, ...(incomingOptions.units || [])])),
                associations: { ...(currentOptions.associations || {}), ...(incomingOptions.associations || {}) }
            };

            saveFoodData(mergedFoodData);
            saveOptionData(mergedOptions);

            populateDropdowns();
            renderCalendar(currentViewDate);
            renderDailyLog();

            alert('הנתונים שוחזרו בהצלחה!');
            closeLoginModal();
        } catch (err) {
            console.error('Import error:', err);
            alert('שגיאה בקריאת הקובץ. ודא שזהו קובץ גיבוי JSON תקין.');
        }
    };
    reader.readAsText(file);
};

/**
 * Setup event listeners for Authentication and Login Modal.
 */
const setupAuthListeners = () => {
    const loginModal = document.getElementById('login-modal');
    const closeLoginModalBtn = document.getElementById('close-login-modal');
    const headerLoginBtn = document.getElementById('header-login-btn');
    const headerLogoutBtn = document.getElementById('header-logout-btn');
    const googleLoginBtn = document.getElementById('modal-google-login-btn');
    const guestLoginBtn = document.getElementById('guest-login-btn');
    const tabLoginBtn = document.getElementById('auth-tab-login');
    const tabRegisterBtn = document.getElementById('auth-tab-register');
    const emailAuthForm = document.getElementById('email-auth-form');
    const exportJsonBtn = document.getElementById('export-json-button');
    const importJsonInput = document.getElementById('import-json-file');

    // Header Login button click
    if (headerLoginBtn) {
        headerLoginBtn.addEventListener('click', () => {
            sessionStorage.removeItem('foodTrackGuestMode');
            openLoginModal();
        });
    }

    // Header Logout (Sign Off) button click
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', async () => {
            if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
                try {
                    sessionStorage.removeItem('foodTrackGuestMode');
                    if (window.FoodTrackSync && typeof window.FoodTrackSync.logout === 'function') {
                        await window.FoodTrackSync.logout();
                    }
                    // Automatically popup login dialog on sign off
                    openLoginModal();
                } catch (e) {
                    console.error('Logout error:', e);
                }
            }
        });
    }

    // Close Modal Button
    if (closeLoginModalBtn) {
        closeLoginModalBtn.addEventListener('click', () => {
            sessionStorage.setItem('foodTrackGuestMode', 'true');
            closeLoginModal();
        });
    }

    // Guest Mode Button
    if (guestLoginBtn) {
        guestLoginBtn.addEventListener('click', () => {
            sessionStorage.setItem('foodTrackGuestMode', 'true');
            closeLoginModal();
        });
    }

    // Dismiss by clicking outside modal sheet
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                sessionStorage.setItem('foodTrackGuestMode', 'true');
                closeLoginModal();
            }
        });
    }

    // Google Sign-In button
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            try {
                showAuthError(null);
                if (!window.FoodTrackSync) {
                    showAuthError('שירות הסנכרון נטען כעת, אנא נסה שוב בעוד מספר שניות.');
                    return;
                }
                googleLoginBtn.disabled = true;
                googleLoginBtn.style.opacity = '0.7';
                await window.FoodTrackSync.loginWithGoogle();
                sessionStorage.removeItem('foodTrackGuestMode');
                closeLoginModal();
            } catch (err) {
                console.error('Google login error:', err);
                if (err.code !== 'auth/popup-closed-by-user') {
                    showAuthError(getAuthErrorMessage(err));
                }
            } finally {
                if (googleLoginBtn) {
                    googleLoginBtn.disabled = false;
                    googleLoginBtn.style.opacity = '1';
                }
            }
        });
    }

    // Tabs for Email Login vs Register
    if (tabLoginBtn) {
        tabLoginBtn.addEventListener('click', () => setEmailAuthMode(false));
    }
    if (tabRegisterBtn) {
        tabRegisterBtn.addEventListener('click', () => setEmailAuthMode(true));
    }

    // Email & Password Form Submit
    if (emailAuthForm) {
        emailAuthForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showAuthError(null);

            const email = (document.getElementById('auth-email')?.value || '').trim();
            const password = document.getElementById('auth-password')?.value || '';
            const displayName = (document.getElementById('auth-display-name')?.value || '').trim();
            const submitBtn = document.getElementById('email-submit-btn');

            if (!email || !password) {
                showAuthError('אנא הזן כתובת אימייל וסיסמה.');
                return;
            }

            if (password.length < 6) {
                showAuthError('הסיסמה חייבת לכלול לפחות 6 תווים.');
                return;
            }

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'מתחבר...';
                }

                if (isRegisterMode) {
                    await window.FoodTrackSync.registerWithEmail(email, password, displayName);
                } else {
                    await window.FoodTrackSync.loginWithEmail(email, password);
                }

                sessionStorage.removeItem('foodTrackGuestMode');
                emailAuthForm.reset();
                closeLoginModal();
            } catch (err) {
                console.error('Email auth error:', err);
                showAuthError(getAuthErrorMessage(err));
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = isRegisterMode ? 'הרשמה וסנכרון' : 'התחבר';
                }
            }
        });
    }

    // Export & Import backup JSON
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', exportDataAsJSON);
    }
    if (importJsonInput) {
        importJsonInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                importDataFromJSON(file);
                importJsonInput.value = '';
            }
        });
    }
};

/**
 * Initialization function run when the page loads.
 */
document.addEventListener('DOMContentLoaded', () => {
    populateDropdowns();
    setupEventListeners();
    setupAuthListeners();

    // Initial calendar render using today's date
    renderCalendar(new Date());

    // Listen for real-time cloud data updates from Firestore
    window.addEventListener('foodTrack:cloudDataUpdated', () => {
        populateDropdowns();
        renderCalendar(currentViewDate);
        renderDailyLog();
    });

    // Listen for sync/auth status changes
    window.addEventListener('foodTrack:syncStatusChanged', (e) => {
        updateAuthUI(e.detail);
    });

    // Listen for auth resolution event on launch
    window.addEventListener('foodTrack:authResolved', (e) => {
        updateAuthUI({ user: e.detail?.user, isAuthResolved: true });
    });

    // Initial auth UI check
    if (window.FoodTrackSync && typeof window.FoodTrackSync.whenAuthReady === 'function') {
        window.FoodTrackSync.whenAuthReady().then((user) => {
            updateAuthUI({ user, isAuthResolved: true });
        });
    } else {
        updateAuthUI();
    }
});