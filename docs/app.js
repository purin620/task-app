(() => {
  'use strict';

  const STORAGE_KEY = 'calendarTaskApp.v1';

  /** @type {{events: Array, tasks: Array}} */
  let store = loadStore();

  let viewYear, viewMonth; // 0-indexed month
  let selectedDate = toDateStr(new Date());
  let editingEventId = null;
  let taskFilter = 'all';

  const today = new Date();
  viewYear = today.getFullYear();
  viewMonth = today.getMonth();

  // ---------- Storage ----------
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { events: [], tasks: [], timetable: {}, ...parsed };
      }
    } catch (e) {
      console.warn('データの読み込みに失敗しました', e);
    }
    return { events: [], tasks: [], timetable: {} };
  }

  function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Date helpers ----------
  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isSameDate(dateStr, y, m, d) {
    return dateStr === `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // ---------- DOM refs ----------
  const monthLabel = document.getElementById('monthLabel');
  const calendarGrid = document.getElementById('calendarGrid');
  const selectedDateLabel = document.getElementById('selectedDateLabel');
  const eventList = document.getElementById('eventList');
  const timetableList = document.getElementById('timetableList');
  const taskList = document.getElementById('taskList');
  const taskForm = document.getElementById('taskForm');
  const todayPill = document.getElementById('todayPill');

  // ---------- Theme ----------
  const THEME_KEY = 'calendarTaskApp.theme';
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle.querySelector('.theme-icon');

  function applyTheme(theme) {
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const isDark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    themeIcon.textContent = isDark ? '☀️' : '🌙';
  }

  applyTheme(localStorage.getItem(THEME_KEY));

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  {
    const t = new Date();
    const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
    todayPill.textContent = `${t.getFullYear()}年${t.getMonth() + 1}月${t.getDate()}日（${weekdayNames[t.getDay()]}）`;
  }

  document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
  document.getElementById('todayBtn').addEventListener('click', () => {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    selectedDate = toDateStr(t);
    renderAll();
  });

  function changeMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  }

  // ---------- Calendar rendering ----------
  function renderCalendar() {
    monthLabel.textContent = `${viewYear}年 ${viewMonth + 1}月`;
    calendarGrid.innerHTML = '';

    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];
    // leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      cells.push({ day: daysInPrevMonth - i, otherMonth: true, y: viewMonth === 0 ? viewYear - 1 : viewYear, m: viewMonth === 0 ? 11 : viewMonth - 1 });
    }
    // current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, otherMonth: false, y: viewYear, m: viewMonth });
    }
    // trailing days to complete the grid (multiple of 7)
    let next = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ day: next++, otherMonth: true, y: viewMonth === 11 ? viewYear + 1 : viewYear, m: viewMonth === 11 ? 0 : viewMonth + 1 });
    }

    const todayStr = toDateStr(new Date());

    cells.forEach(cell => {
      const dateStr = `${cell.y}-${String(cell.m + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
      const el = document.createElement('div');
      el.className = 'day-cell';
      if (cell.otherMonth) el.classList.add('other-month');
      if (dateStr === todayStr) el.classList.add('today');
      if (dateStr === selectedDate) el.classList.add('selected');
      el.dataset.date = dateStr;

      const num = document.createElement('div');
      num.className = 'day-num';
      num.textContent = cell.day;
      el.appendChild(num);

      const badges = document.createElement('div');
      badges.className = 'day-badges';

      const dayEvents = store.events.filter(e => e.date === dateStr);
      const dayTasks = store.tasks.filter(t => t.due === dateStr);
      const dayTimetable = (store.timetable && store.timetable[dateStr]) ? store.timetable[dateStr].filter(v => v) : [];
      const items = [
        ...dayEvents.map(e => ({ label: e.title, color: e.color }))
      ];
      if (dayTimetable.length) {
        items.push({ label: dayTimetable.join('・'), isTimetable: true });
      }
      items.push(...dayTasks.map(t => ({ label: t.title, isTask: true })));
      const maxShow = 3;
      items.slice(0, maxShow).forEach(it => {
        const b = document.createElement('div');
        b.className = 'day-badge' + (it.isTask ? ' task-badge' : '') + (it.isTimetable ? ' timetable-badge' : '');
        if (!it.isTask && !it.isTimetable) b.style.background = it.color;
        b.textContent = (it.isTask ? '☑ ' : it.isTimetable ? '🕒 ' : '') + it.label;
        badges.appendChild(b);
      });
      if (items.length > maxShow) {
        const more = document.createElement('div');
        more.className = 'day-more';
        more.textContent = `+${items.length - maxShow}件`;
        badges.appendChild(more);
      }
      el.appendChild(badges);

      el.addEventListener('click', () => {
        selectedDate = dateStr;
        if (cell.otherMonth) {
          viewYear = cell.y;
          viewMonth = cell.m;
        }
        renderAll();
      });

      calendarGrid.appendChild(el);
    });
  }

  // ---------- Day panel (events for selected date) ----------
  function renderDayPanel() {
    const d = new Date(selectedDate + 'T00:00:00');
    const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
    selectedDateLabel.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdayNames[d.getDay()]}）`;

    eventList.innerHTML = '';
    const dayEvents = store.events
      .filter(e => e.date === selectedDate)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

    if (dayEvents.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.innerHTML = `<span class="empty-icon">🗓️</span><span class="empty-text">予定はありません</span>`;
      eventList.appendChild(li);
      return;
    }

    dayEvents.forEach(ev => {
      const li = document.createElement('li');
      li.className = 'event-item';
      li.innerHTML = `
        <span class="event-dot" style="background:${ev.color}"></span>
        <span class="event-info">
          <span class="title">${escapeHtml(ev.title)}</span>
          <span class="meta">${ev.time ? ev.time : '終日'}${ev.note ? ' ・ ' + escapeHtml(ev.note) : ''}</span>
        </span>
      `;
      li.addEventListener('click', () => openEventModal(ev.date, ev));
      eventList.appendChild(li);
    });
  }

  // ---------- Timetable (1日6時限＋4時限目の後に給食) ----------
  const TIMETABLE_PERIOD_COUNT = 6;
  const TIMETABLE_LUNCH_AFTER = 4; // この時限の直後に給食を挟む（時数には含めない）

  function getTimetableEntries(dateStr) {
    if (store.timetable && store.timetable[dateStr]) return store.timetable[dateStr];
    return Array(TIMETABLE_PERIOD_COUNT).fill('');
  }

  function setTimetableEntry(dateStr, index, value) {
    if (!store.timetable) store.timetable = {};
    if (!store.timetable[dateStr]) store.timetable[dateStr] = Array(TIMETABLE_PERIOD_COUNT).fill('');
    store.timetable[dateStr][index] = value;
    if (store.timetable[dateStr].every(v => !v)) delete store.timetable[dateStr];
    saveStore();
  }

  function renderTimetable() {
    timetableList.innerHTML = '';
    const entries = getTimetableEntries(selectedDate);

    for (let i = 0; i < TIMETABLE_PERIOD_COUNT; i++) {
      const li = document.createElement('li');
      li.className = 'timetable-row';
      li.innerHTML = `
        <span class="timetable-period">${i + 1}時限目</span>
        <input type="text" class="timetable-input" maxlength="60" placeholder="教科・内容">
      `;
      const input = li.querySelector('input');
      input.value = entries[i] || '';
      input.addEventListener('change', () => {
        setTimetableEntry(selectedDate, i, input.value.trim());
        renderCalendar();
      });
      timetableList.appendChild(li);

      if (i + 1 === TIMETABLE_LUNCH_AFTER) {
        const lunch = document.createElement('li');
        lunch.className = 'timetable-row timetable-lunch';
        lunch.innerHTML = `
          <span class="timetable-period">給食</span>
          <span class="timetable-lunch-label">🍙 給食の時間（時数には含みません）</span>
        `;
        timetableList.appendChild(lunch);
      }
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // ---------- Event modal ----------
  const eventModal = document.getElementById('eventModal');
  const eventForm = document.getElementById('eventForm');
  const modalTitle = document.getElementById('modalTitle');
  const eventCategoryInput = document.getElementById('eventCategory');
  const eventTitleInput = document.getElementById('eventTitle');
  const eventDateInput = document.getElementById('eventDate');
  const eventTimeInput = document.getElementById('eventTime');
  const eventNoteInput = document.getElementById('eventNote');
  const deleteEventBtn = document.getElementById('deleteEventBtn');

  // 種類ごとの既定色（選択すると自動でこの色に切り替わる。あとから手動で変更も可）
  const CATEGORY_COLORS = {
    '教員の業務': '#6366f1',
    '職員会議': '#0ea5e9',
    '分掌部会': '#a855f7',
    '学部会': '#16a34a',
    '研究日': '#f59e0b'
  };

  document.getElementById('addEventBtn').addEventListener('click', () => openEventModal(selectedDate));
  document.getElementById('cancelEventBtn').addEventListener('click', closeEventModal);
  eventModal.addEventListener('click', (e) => { if (e.target === eventModal) closeEventModal(); });

  eventCategoryInput.addEventListener('change', () => {
    const val = eventCategoryInput.value;
    if (val === '__custom') {
      eventTitleInput.value = '';
      eventTitleInput.focus();
      return;
    }
    if (val) {
      eventTitleInput.value = val;
      const color = CATEGORY_COLORS[val];
      if (color) {
        const radio = document.querySelector(`input[name="eventColor"][value="${color}"]`);
        if (radio) radio.checked = true;
      }
      eventTitleInput.focus();
    }
  });

  function openEventModal(dateStr, existing) {
    editingEventId = existing ? existing.id : null;
    modalTitle.textContent = existing ? '予定を編集' : '予定を追加';
    const presetTitles = Object.keys(CATEGORY_COLORS);
    if (existing && presetTitles.includes(existing.title)) {
      eventCategoryInput.value = existing.title;
    } else if (existing) {
      eventCategoryInput.value = '__custom';
    } else {
      eventCategoryInput.value = '';
    }
    eventTitleInput.value = existing ? existing.title : '';
    eventDateInput.value = dateStr;
    eventTimeInput.value = existing ? (existing.time || '') : '';
    eventNoteInput.value = existing ? (existing.note || '') : '';
    const color = existing ? existing.color : '#6366f1';
    const radio = document.querySelector(`input[name="eventColor"][value="${color}"]`);
    if (radio) radio.checked = true;
    deleteEventBtn.classList.toggle('hidden', !existing);
    eventModal.classList.remove('hidden');
    eventTitleInput.focus();
  }

  function closeEventModal() {
    eventModal.classList.add('hidden');
    editingEventId = null;
  }

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: eventTitleInput.value.trim(),
      date: eventDateInput.value,
      time: eventTimeInput.value,
      note: eventNoteInput.value.trim(),
      color: document.querySelector('input[name="eventColor"]:checked').value
    };
    if (!data.title || !data.date) return;

    if (editingEventId) {
      const idx = store.events.findIndex(ev => ev.id === editingEventId);
      if (idx !== -1) store.events[idx] = { ...store.events[idx], ...data };
    } else {
      store.events.push({ id: uid(), ...data });
    }
    saveStore();
    selectedDate = data.date;
    closeEventModal();
    renderAll();
  });

  deleteEventBtn.addEventListener('click', () => {
    if (!editingEventId) return;
    store.events = store.events.filter(ev => ev.id !== editingEventId);
    saveStore();
    closeEventModal();
    renderAll();
  });

  // ---------- Tasks ----------
  const taskTitleInput = document.getElementById('taskTitle');
  const taskDueInput = document.getElementById('taskDue');
  const taskPriorityInput = document.getElementById('taskPriority');

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    if (!title) return;
    store.tasks.push({
      id: uid(),
      title,
      due: taskDueInput.value || '',
      priority: taskPriorityInput.value,
      done: false
    });
    saveStore();
    taskForm.reset();
    taskPriorityInput.value = 'mid';
    renderAll();
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      taskFilter = btn.dataset.filter;
      renderTasks();
    });
  });

  function renderTasks() {
    taskList.innerHTML = '';
    let tasks = [...store.tasks];
    if (taskFilter === 'active') tasks = tasks.filter(t => !t.done);
    if (taskFilter === 'done') tasks = tasks.filter(t => t.done);

    const priorityOrder = { high: 0, mid: 1, low: 2 };
    tasks.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pd !== 0) return pd;
      return (a.due || '9999').localeCompare(b.due || '9999');
    });

    if (tasks.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-state';
      li.innerHTML = `<span class="empty-icon">📋</span><span class="empty-text">タスクはありません</span>`;
      taskList.appendChild(li);
      renderStats();
      return;
    }

    const priorityLabel = { high: '高', mid: '中', low: '低' };

    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item priority-' + task.priority + (task.done ? ' done' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = task.done;
      checkbox.addEventListener('change', () => {
        task.done = checkbox.checked;
        saveStore();
        renderTasks();
        renderCalendar();
      });
      li.appendChild(checkbox);

      const main = document.createElement('div');
      main.className = 'task-main';
      main.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-meta">
          <span class="priority-badge priority-${task.priority}">${priorityLabel[task.priority]}</span>
          ${task.due ? `<span>期限: ${task.due}</span>` : ''}
        </div>
      `;
      li.appendChild(main);

      const delBtn = document.createElement('button');
      delBtn.className = 'task-delete';
      delBtn.textContent = '✕';
      delBtn.title = '削除';
      delBtn.addEventListener('click', () => {
        store.tasks = store.tasks.filter(t => t.id !== task.id);
        saveStore();
        renderAll();
      });
      li.appendChild(delBtn);

      taskList.appendChild(li);
    });

    renderStats();
  }

  // ---------- Stats ----------
  const statEventsValue = document.getElementById('statEventsValue');
  const statTasksValue = document.getElementById('statTasksValue');
  const statRateValue = document.getElementById('statRateValue');
  const statRateBar = document.getElementById('statRateBar');

  function renderStats() {
    const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    const monthEventCount = store.events.filter(e => e.date.startsWith(monthPrefix)).length;
    const pendingTaskCount = store.tasks.filter(t => !t.done).length;
    const totalTasks = store.tasks.length;
    const doneTasks = totalTasks - pendingTaskCount;
    const rate = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

    statEventsValue.textContent = monthEventCount;
    statTasksValue.textContent = pendingTaskCount;
    statRateValue.textContent = `${rate}%`;
    statRateBar.style.width = `${rate}%`;
  }

  // ---------- Render all ----------
  function renderAll() {
    renderCalendar();
    renderDayPanel();
    renderTimetable();
    renderTasks();
  }

  renderAll();
})();
