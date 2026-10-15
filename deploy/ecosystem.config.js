// PM2: mantiene la tienda VANTA encendida en el VPS y la reinicia si se cae.
//   vanta  ->  Next.js en 127.0.0.1:3020  (nginx la publica en https://vantagg.co)
// Arrancar:  pm2 start deploy/ecosystem.config.js && pm2 save
// Las variables (DATABASE_URL, llaves, etc.) se leen de .env en la raíz del proyecto: Next.js y Prisma lo cargan solos.
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "vanta",
      cwd: ROOT,
      script: path.join(ROOT, "node_modules", "next", "dist", "bin", "next"),
      args: "start -p 3020 -H 127.0.0.1", // solo nginx habla con la tienda; el puerto 3020 nunca se abre a internet
      // UNA sola copia: límites de intentos, «escribiendo…» del chat y avisos agrupados viven en memoria (no usar cluster)
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 8000,
      max_memory_restart: "900M",
      env: {
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        // Imágenes subidas desde el panel: fuera del repositorio para que los deploys no las toquen
        UPLOADS_DIR: process.env.UPLOADS_DIR || "/var/lib/vanta/uploads",
      },
      out_file: path.join(ROOT, "logs", "vanta.out.log"),
      error_file: path.join(ROOT, "logs", "vanta.err.log"),
      time: true,
    },
  ],
};
