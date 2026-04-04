// ============================================================
// Script de inicialización de MongoDB
// Crea el usuario de aplicación para ai-service.
// El usuario root (MONGO_INITDB_ROOT_USERNAME/PASSWORD) se crea
// automáticamente por la imagen oficial de MongoDB.
//
// Las credenciales de ai_user se leen desde las variables de
// entorno MONGO_APP_USER y MONGO_APP_PASSWORD, inyectadas por
// docker-compose.
// ============================================================

const appUser = process.env.MONGO_APP_USER || 'ai_user';
const appPassword = process.env.MONGO_APP_PASSWORD || 'ai_pass';

db = db.getSiblingDB('ai_db');

db.createUser({
  user: appUser,
  pwd: appPassword,
  roles: [
    { role: 'readWrite', db: 'ai_db' }
  ]
});

// Colecciones iniciales (MongoDB las crea al primer insert,
// pero crearlas explícitamente permite definir índices desde el inicio)
db.createCollection('chat_sessions');
db.createCollection('chat_messages');
db.createCollection('analytics_cache');

db.chat_sessions.createIndex({ userId: 1, updatedAt: -1 });
db.chat_messages.createIndex({ sessionId: 1, createdAt: 1 });
db.analytics_cache.createIndex({ userId: 1 }, { unique: true });
