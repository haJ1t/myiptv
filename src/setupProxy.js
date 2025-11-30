const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/proxy',
    createProxyMiddleware({
      target: 'http://54.36.233.25:8080',
      changeOrigin: true,
      pathRewrite: {
        '^/proxy': '', // /proxy'yi kaldır
      },
      onProxyReq: (proxyReq, req, res) => {
        // CORS headers ekle
        proxyReq.setHeader('Origin', 'http://54.36.233.25:8080');
      },
      onProxyRes: (proxyRes, req, res) => {
        // CORS headers ekle
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      },
      logLevel: 'debug',
    })
  );
};
