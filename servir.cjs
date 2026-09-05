// Servidor mínimo para mirar el panel ya compilado.
//
// El servidor de desarrollo de Astro levanta Vite entero y se come cientos de
// megas; en una máquina justa de memoria se lo lleva el sistema. Esto sirve
// la carpeta dist/ y nada más.
//
//   npm run build      (una vez, y cada vez que se cambie algo)
//   node servir.cjs    →  http://localhost:4322/admin?demo=1

const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "dist");
const PUERTO = Number(process.argv[2]) || 4322;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

http
  .createServer((pedido, respuesta) => {
    const ruta = decodeURIComponent(new URL(pedido.url, "http://x").pathname);

    // Astro genera /admin/index.html, así que /admin y /admin/ apuntan ahí.
    let archivo = path.join(RAIZ, ruta);
    if (!path.extname(archivo)) archivo = path.join(archivo, "index.html");

    // Nadie puede salirse de dist/ con ../
    if (!archivo.startsWith(RAIZ)) {
      respuesta.writeHead(403).end("Prohibido");
      return;
    }

    fs.readFile(archivo, (error, contenido) => {
      if (error) {
        respuesta.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        respuesta.end("No existe: " + ruta);
        return;
      }
      respuesta.writeHead(200, {
        "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream",
        // Sin caché: al recompilar se ve el cambio sin recargar a la fuerza
        "Cache-Control": "no-store",
      });
      respuesta.end(contenido);
    });
  })
  .listen(PUERTO, () => {
    console.log("Panel en  http://localhost:" + PUERTO + "/admin?demo=1");
  });
