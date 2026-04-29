const grid = document.getElementById('taskGrid');

async function loadTasks() {
  try {
    const res = await fetch('/api/tasks');
    const tasks = await res.json();
    grid.innerHTML = '';
    tasks.forEach((t, i) => {
      const a = document.createElement('a');
      a.className = 'task-card';
      a.href = `/task.html?id=${t.id}`;
      a.innerHTML = `
        <div class="task-num">TASK ${String(i + 1).padStart(2, '0')}</div>
        <div class="task-name">${t.name}</div>
        <div class="task-desc">${t.description}</div>
        <div class="task-footer">
          <span class="task-tag">${t.category}</span>
          <span class="task-arrow">→</span>
        </div>
      `;
      grid.appendChild(a);
    });
  } catch (e) {
    grid.innerHTML = `<div class="loading">Failed to load tasks: ${e.message}</div>`;
  }
}

loadTasks();
