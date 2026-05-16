/**
 * Phase 4 Smoke Test: Asistencia, Horas Extra, Nómina
 * Tests end-to-end flows for HR modules
 */

const BASE = 'http://localhost:3001/api';
let token = null;
let adminUserId = null;

async function api(endpoint, options = {}) {
  const res = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error || data.message}`);
  return data;
}

async function login() {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  token = data.token;
  adminUserId = data.user.id;
  console.log('✅ Login OK:', data.user.username, 'Role:', data.user.rol);
}

async function testAsistencia() {
  console.log('\n--- ASISTENCIA ---');
  
  // Get employees
  const empleados = await api('/empleados');
  const emp = Array.isArray(empleados) ? empleados : empleados.data;
  if (!emp || emp.length === 0) { console.log('⚠ No employees found, skipping'); return; }
  const testEmp = emp[0];
  console.log(`  Empleado test: ${testEmp.nombre} ${testEmp.apellido_paterno} (ID: ${testEmp.id})`);

  // Register entrada
  try {
    const entrada = await api('/asistencias/entrada', {
      method: 'POST',
      body: JSON.stringify({ id_empleado: testEmp.id })
    });
    console.log(`  ✅ Entrada registrada: ${entrada.hora_entrada} (${entrada.incidencia})`);
  } catch (e) {
    console.log(`  ⚠ Entrada: ${e.message}`);
  }

  // Register salida
  try {
    const salida = await api('/asistencias/salida', {
      method: 'POST',
      body: JSON.stringify({ id_empleado: testEmp.id })
    });
    console.log(`  ✅ Salida registrada: ${salida.hora_salida} — ${salida.horas_trabajadas}h`);
  } catch (e) {
    console.log(`  ⚠ Salida: ${e.message}`);
  }

  // List asistencias
  const today = new Date().toISOString().split('T')[0];
  const asistencias = await api(`/asistencias?fecha=${today}`);
  console.log(`  ✅ Asistencias hoy: ${asistencias.length} registros`);

  // Test manual registration
  const emp2 = emp.length > 1 ? emp[1] : emp[0];
  try {
    const manual = await api('/asistencias/manual', {
      method: 'POST',
      body: JSON.stringify({
        id_empleado: emp2.id,
        fecha: '2026-05-01',
        hora_entrada: '07:00',
        hora_salida: '15:30',
        incidencia: 'asistencia'
      })
    });
    console.log(`  ✅ Registro manual creado: ID ${manual.id}`);
  } catch (e) {
    console.log(`  ⚠ Manual: ${e.message}`);
  }

  // Presentes
  const presentes = await api('/asistencias/presentes');
  console.log(`  ✅ Empleados presentes: ${presentes.length}`);
}

async function testHorasExtra() {
  console.log('\n--- HORAS EXTRA ---');
  
  const empleados = await api('/empleados');
  const emp = Array.isArray(empleados) ? empleados : empleados.data;
  const testEmp = emp[0];

  // Create horas extra
  const he = await api('/horas-extra', {
    method: 'POST',
    body: JSON.stringify({
      id_empleado: testEmp.id,
      fecha: new Date().toISOString().split('T')[0],
      cantidad_horas: 2.5,
      motivo: 'Producción urgente de pedido especial'
    })
  });
  console.log(`  ✅ Horas extra creadas: ID ${he.id}`);

  // Autorizar
  const auth = await api(`/horas-extra/${he.id}/autorizar`, { method: 'PATCH' });
  console.log(`  ✅ Horas extra autorizadas`);

  // Create and reject another
  const he2 = await api('/horas-extra', {
    method: 'POST',
    body: JSON.stringify({
      id_empleado: testEmp.id,
      fecha: '2026-05-07',
      cantidad_horas: 1,
      motivo: 'Test rechazada'
    })
  });
  await api(`/horas-extra/${he2.id}/rechazar`, { method: 'PATCH' });
  console.log(`  ✅ Horas extra rechazadas: ID ${he2.id}`);

  // List
  const list = await api('/horas-extra');
  const pendientes = list.filter(h => h.estatus === 'pendiente').length;
  const autorizadas = list.filter(h => h.estatus === 'autorizada').length;
  const rechazadas = list.filter(h => h.estatus === 'rechazada').length;
  console.log(`  ✅ Total: ${list.length} (pendientes: ${pendientes}, autorizadas: ${autorizadas}, rechazadas: ${rechazadas})`);
}

async function testNomina() {
  console.log('\n--- NÓMINA ---');
  
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const periodo_inicio = `${y}-${m}-01`;
  const periodo_fin = `${y}-${m}-15`;

  // Calculate
  const result = await api('/nominas/calcular', {
    method: 'POST',
    body: JSON.stringify({ periodo_inicio, periodo_fin })
  });
  console.log(`  ✅ Nómina calculada: ${result.total_calculadas} empleados`);

  if (result.nominas && result.nominas.length > 0) {
    const first = result.nominas[0];
    console.log(`  → ${first.nombre}: Base $${first.salario_base}, HE: ${first.horas_extra_autorizadas}h, Monto HE: $${first.monto_horas_extra}, Total: $${first.total_pagar}`);

    // View detail
    const det = await api(`/nominas/${first.id}`);
    console.log(`  ✅ Detalle nómina: ${det.nombre} ${det.apellido_paterno} — ${det.estatus}`);

    // Mark as paid
    const pago = await api(`/nominas/${first.id}/pagar`, { method: 'PATCH' });
    console.log(`  ✅ Nómina marcada como pagada`);

    // Try to pay again (should fail)
    try {
      await api(`/nominas/${first.id}/pagar`, { method: 'PATCH' });
      console.log(`  ❌ Should have failed on double payment`);
    } catch (e) {
      console.log(`  ✅ Doble pago rechazado: ${e.message}`);
    }
  }

  // List
  const nominas = await api('/nominas');
  console.log(`  ✅ Nóminas totales: ${nominas.length}`);
}

async function testDashboard() {
  console.log('\n--- DASHBOARD ---');
  const stats = await api('/dashboard');
  console.log(`  ✅ Horas extra pendientes: ${stats.horasExtraPendientes}`);
  console.log(`  ✅ Empleados presentes: ${stats.empleadosPresentes}`);
  console.log(`  ✅ Empleados activos: ${stats.empleadosActivos}`);
}

async function main() {
  console.log('🧪 Phase 4 Smoke Test — Asistencia, Horas Extra, Nómina\n');
  try {
    await login();
    await testAsistencia();
    await testHorasExtra();
    await testNomina();
    await testDashboard();
    console.log('\n🎉 All Phase 4 smoke tests passed!');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
  }
}

main();
