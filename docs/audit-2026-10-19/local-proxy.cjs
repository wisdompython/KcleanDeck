// Audit-only equivalent of Caddy routing; no application source changes.
const http = require('node:http');
const server = http.createServer((req, res) => {
  const api = /^\/(?:api|media|static|backstage)(?:\/|$)/.test(req.url) || req.url === '/healthz';
  const out = http.request({hostname:'127.0.0.1', port:api?8019:3019, path:req.url, method:req.method, headers:req.headers}, incoming => {
    res.writeHead(incoming.statusCode, incoming.headers);
    incoming.pipe(res);
  });
  out.on('error', err => { res.writeHead(502); res.end(err.message); });
  req.pipe(out);
});
server.on('upgrade', (req, socket, head) => {
  const upstream = require('node:net').connect(3019, '127.0.0.1', () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${req.rawHeaders.reduce((s,v,i,a)=>i%2?s:s+a[i]+': '+a[i+1]+'\r\n','')}\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on('error', () => socket.destroy());
  socket.on('error', () => upstream.destroy());
});
server.listen(8089, '127.0.0.1', () => console.log('Audit proxy http://127.0.0.1:8089'));
