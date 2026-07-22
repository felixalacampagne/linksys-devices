const dotenv = require('dotenv');
const path = require('path');

const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const proxyRouterIP = process.env.PROXY_TARGET || '192.168.1.1';

module.exports = {
  '/JNAP': {
    target: 'http://' + proxyRouterIP,
    secure: false,
    changeOrigin: true,
    logLevel: 'info',
    xfwd: true
  }
};
