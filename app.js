const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const sql = require('mssql');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const methodOverride = require('method-override');
const hbs = require('hbs');
const { randomUUID } = require('crypto');

// Load environment variables
dotenv.config({ path: './.env' });

// Express app setup
const serverApp = express();
const PORT = process.env.PORT || 5000;

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    enableArithAbort: true,
  },
};

const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

poolConnect
  .then(() => console.log('Connected to SQL Server 🚁'))
  .catch((err) => console.error('Error connecting to SQL Server:', err));

serverApp.use(cors());
serverApp.use(bodyParser.urlencoded({ extended: true }));
serverApp.use(bodyParser.json());
serverApp.use(methodOverride('_method'));

const location = path.join(__dirname, './public');
serverApp.use(express.static(location));
serverApp.set('view engine', 'hbs');

serverApp.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

const partialsPath = path.join(__dirname, './views/partials');
hbs.registerPartials(partialsPath);

serverApp.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

const pagesRouter = require('./routes/pages');
const authRouter = require('./routes/auth');

serverApp.use('/', pagesRouter);
serverApp.use('/auth', authRouter);

serverApp.get('/api/user/role', (req, res) => {
  res.json({ role: 'userRoleFromDatabase' });
});

serverApp.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.json({ success: false, message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

serverApp.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

serverApp.listen(PORT, () => {
  console.log(`Express server started @ port ${PORT} 🚀 ${randomUUID()}`);
});

// Electron setup
let mainWindow;
app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
