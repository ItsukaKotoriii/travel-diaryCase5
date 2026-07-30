let currentUser = null;
let currentTab = 'feed';
let currentTravels = [];

document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    document.getElementById('loginBtn').addEventListener('click', () => {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    });
    document.getElementById('registerBtn').addEventListener('click', () => {
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('loginForm').style.display = 'none';
    });
    document.getElementById('loginSubmit').addEventListener('click', login);
    document.getElementById('regSubmit').addEventListener('click', register);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.tab;
            renderTab(currentTab);
        });
    });

    document.querySelector('.close').addEventListener('click', () => {
        document.getElementById('detailModal').style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    document.getElementById('deleteTravelBtn').addEventListener('click', deleteTravel);
});

async function checkSession() {
    const res = await fetch('/api/me');
    if (res.ok) {
        const user = await res.json();
        currentUser = user;
        showMainContent();
    } else {
        showAuthForms();
    }
}

function showAuthForms() {
    document.getElementById('authForms').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('registerBtn').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'none';
}

function showMainContent() {
    document.getElementById('authForms').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('registerBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    renderTab(currentTab);
}

async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        showMainContent();
    } else {
        alert('Ошибка входа');
    }
}

async function register() {
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        showMainContent();
    } else {
        alert('Пользователь уже существует');
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    showAuthForms();
}

async function renderTab(tab) {
    const container = document.getElementById('tabContent');
    switch (tab) {
        case 'feed': await renderFeed(container); break;
        case 'my': await renderMy(container); break;
        case 'new': renderNew(container); break;
        default: container.innerHTML = '';
    }
}

async function renderFeed(container) {
    const res = await fetch('/api/travels');
    const travels = await res.json();
    currentTravels = travels;
    container.innerHTML = `<h2>Все публичные записи</h2>`;
    if (travels.length === 0) {
        container.innerHTML += '<p>Записей пока нет</p>';
        return;
    }
    travels.forEach(t => renderTravelCard(container, t));
}

async function renderMy(container) {
    const res = await fetch('/api/travels');
    const all = await res.json();
    const my = all.filter(t => t.userId === currentUser.id);
    currentTravels = my;
    container.innerHTML = `<h2>Мои записи</h2>`;
    if (my.length === 0) {
        container.innerHTML += '<p>Вы ещё не создали ни одной записи</p>';
        return;
    }
    my.forEach(t => renderTravelCard(container, t, true));
}

function renderNew(container) {
    container.innerHTML = `
        <h2>Новая запись о путешествии</h2>
        <form id="newTravelForm" enctype="multipart/form-data">
            <label>Местоположение (город, страна)</label>
            <input type="text" id="travelLocation" required>
            <label>Стоимость путешествия (₽)</label>
            <input type="number" id="travelCost" required>
            <label>Описание</label>
            <textarea id="travelDescription" rows="4" required></textarea>
            <label>Фото (необязательно)</label>
            <input type="file" id="travelImage" accept="image/*">
            <label><input type="checkbox" id="travelPublic" checked> Публичная запись</label>
            <button type="submit">Сохранить</button>
        </form>
    `;
    document.getElementById('newTravelForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('location', document.getElementById('travelLocation').value);
        formData.append('cost', document.getElementById('travelCost').value);
        formData.append('description', document.getElementById('travelDescription').value);
        formData.append('isPublic', document.getElementById('travelPublic').checked);
        const fileInput = document.getElementById('travelImage');
        if (fileInput.files.length > 0) {
            formData.append('image', fileInput.files[0]);
        }
        const res = await fetch('/api/travels', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            renderTab('my');
        } else {
            alert('Ошибка сохранения');
        }
    });
}

function renderTravelCard(container, travel, isOwner = false) {
    const div = document.createElement('div');
    div.className = 'travel-card';
    div.innerHTML = `
        <h3>${travel.location}</h3>
        <div class="meta">${travel.authorName} • ${new Date(travel.createdAt).toLocaleDateString()}</div>
        <p>${travel.description ? travel.description.substring(0, 100) + (travel.description.length > 100 ? '...' : '') : ''}</p>
        <p>💰 ${travel.cost} ₽</p>
        ${travel.image ? `<img src="${travel.image}" alt="Фото">` : ''}
        <div style="margin-top:8px; font-size:0.8rem;">${travel.isPublic ? '🌍 Публичная' : '🔒 Приватная'}</div>
    `;
    div.addEventListener('click', () => openDetail(travel.id, isOwner));
    container.appendChild(div);
}

let currentDetailId = null;

async function openDetail(id, isOwner) {
    const res = await fetch(`/api/travels/${id}`);
    if (!res.ok) return;
    const travel = await res.json();
    currentDetailId = travel.id;
    document.getElementById('detailTitle').textContent = travel.location;
    document.getElementById('detailLocation').textContent = travel.location;
    document.getElementById('detailCost').textContent = travel.cost;
    document.getElementById('detailDescription').textContent = travel.description || '—';
    document.getElementById('detailAuthor').textContent = travel.authorName;
    document.getElementById('detailDate').textContent = new Date(travel.createdAt).toLocaleString();
    const img = document.getElementById('detailImage');
    if (travel.image) {
        img.src = travel.image;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }
    const delBtn = document.getElementById('deleteTravelBtn');
    if (isOwner) {
        delBtn.style.display = 'inline-block';
        delBtn.dataset.id = travel.id;
    } else {
        delBtn.style.display = 'none';
    }
    document.getElementById('detailModal').style.display = 'flex';
}

async function deleteTravel() {
    const id = parseInt(document.getElementById('deleteTravelBtn').dataset.id);
    if (!confirm('Удалить запись?')) return;
    await fetch(`/api/travels/${id}`, { method: 'DELETE' });
    document.getElementById('detailModal').style.display = 'none';
    renderTab(currentTab);
}