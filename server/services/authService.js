import bcrypt from 'bcryptjs';
import { getDb, saveDb } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';

export async function loginUser(username, password) {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT u.*, r.nombre as rol_nombre, 
           e.nombre as emp_nombre, e.apellido_paterno, e.id_sucursal,
           s.nombre as sucursal_nombre,
           p.nombre as puesto_nombre
    FROM usuarios u 
    JOIN roles r ON u.id_rol = r.id 
    JOIN empleados e ON u.id_empleado = e.id
    LEFT JOIN sucursales s ON e.id_sucursal = s.id
    LEFT JOIN puestos p ON e.id_puesto = p.id
    WHERE u.username = ? AND u.activo = 1
  `);
  stmt.bind([username]);
  if (!stmt.step()) {
    stmt.free();
    throw { status: 401, message: 'Usuario o contraseña incorrectos' };
  }
  const row = stmt.getAsObject();
  stmt.free();
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) throw { status: 401, message: 'Usuario o contraseña incorrectos' };
  db.run('UPDATE usuarios SET ultimo_acceso = datetime("now") WHERE id = ?', [row.id]);
  saveDb();
  const token = generateToken({
    id: row.id,
    username: row.username,
    id_empleado: row.id_empleado,
    rol: row.rol_nombre,
    id_sucursal: row.id_sucursal,
    nombre: `${row.emp_nombre} ${row.apellido_paterno}`
  });
  return {
    token,
    user: {
      id: row.id,
      id_empleado: row.id_empleado,
      username: row.username,
      nombre: `${row.emp_nombre} ${row.apellido_paterno}`,
      rol: row.rol_nombre,
      id_sucursal: row.id_sucursal,
      sucursal_nombre: row.sucursal_nombre || null,
      puesto: row.puesto_nombre || null
    }
  };
}

export async function getUserProfile(userId) {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT u.id, u.id_empleado, u.username, u.ultimo_acceso, 
           e.nombre, e.apellido_paterno, e.apellido_materno, e.telefono, e.email, e.id_sucursal, 
           p.nombre as puesto, r.nombre as rol, s.nombre as sucursal_nombre
    FROM usuarios u 
    JOIN empleados e ON u.id_empleado = e.id 
    JOIN puestos p ON e.id_puesto = p.id 
    JOIN roles r ON u.id_rol = r.id 
    LEFT JOIN sucursales s ON e.id_sucursal = s.id 
    WHERE u.id = ?
  `);
  stmt.bind([userId]);
  if (!stmt.step()) { stmt.free(); return null; }
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}
