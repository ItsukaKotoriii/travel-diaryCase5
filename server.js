const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(session({
    secret: 'travel-diary-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Пути к файлам данных
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const usersFile = path.join(DATA_DIR, 'users.json');
const travelsFile = path.join(DATA_DIR, 'travels.json');

function readData(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return [];
    }
}

function writeData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Инициализация файлов
if (!fs.existsSync(usersFile)) writeData(usersFile, []);
if (!fs.existsSync(travelsFile)) writeData(travelsFile, []);

// ---------- ПОЛЬЗОВАТЕЛИ ----------
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const users = readData(usersFile);
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Username already exists' });
    }
    const newUser = { id: Date.now(), username, password };
    users.push(newUser);
    writeData(usersFile, users);
    req.session.userId = newUser.id;
    res.json({ success: true, user: { id: newUser.id, username: newUser.username } });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readData(usersFile);
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    res.json({ success: true, user: { id: user.id, username: user.username } });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const users = readData(usersFile);
    const user = users.find(u => u.id === req.session.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username });
});

app.get('/api/users', (req, res) => {
    const users = readData(usersFile);
    res.json(users.map(u => ({ id: u.id, username: u.username })));
});

// ---------- ПУТЕШЕСТВИЯ ----------
app.post('/api/travels', upload.single('image'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const { location, cost, description, isPublic } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const travels = readData(travelsFile);
    const newTravel = {
        id: Date.now(),
        userId: req.session.userId,
        location,
        cost: parseFloat(cost) || 0,
        description,
        image,
        isPublic: isPublic === 'true',
        createdAt: new Date().toISOString()
    };
    travels.push(newTravel);
    writeData(travelsFile, travels);
    res.json(newTravel);
});

app.get('/api/travels', (req, res) => {
    const travels = readData(travelsFile);
    const users = readData(usersFile);
    // Показываем только публичные записи и свои
    let filtered = travels.filter(t => t.isPublic || (req.session.userId && t.userId === req.session.userId));
   
    const result = filtered.map(t => {
        const user = users.find(u => u.id === t.userId);
        return { ...t, authorName: user ? user.username : 'Unknown' };
    });
    res.json(result);
});

app.get('/api/travels/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const travels = readData(travelsFile);
    const travel = travels.find(t => t.id === id);
    if (!travel) return res.status(404).json({ error: 'Not found' });
    if (!travel.isPublic && (!req.session.userId || travel.userId !== req.session.userId)) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    const users = readData(usersFile);
    const user = users.find(u => u.id === travel.userId);
    res.json({ ...travel, authorName: user ? user.username : 'Unknown' });
});

app.delete('/api/travels/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = parseInt(req.params.id);
    let travels = readData(travelsFile);
    const idx = travels.findIndex(t => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    if (travels[idx].userId !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
    // Удаляем изображение
    if (travels[idx].image) {
        const imgPath = path.join(__dirname, travels[idx].image);
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    travels.splice(idx, 1);
    writeData(travelsFile, travels);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Travel diary running on http://localhost:${PORT}`);
});