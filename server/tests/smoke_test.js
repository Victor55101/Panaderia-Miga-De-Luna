

const API_URL = 'http://localhost:3001/api';

async function runTest() {
  console.log('🚀 Iniciando Smoke Test de Fase 3 (Producción y Traslados)...');

  // 1. Login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const { token, user } = await loginRes.json();
  console.log('✅ Login exitoso:', user.username);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Test Producción
  console.log('\n--- Test Producción ---');
  // Obtener inventario actual del Bolillo (ID 1) en Planta (ID 1)
  const invRes = await fetch(`${API_URL}/inventarios?sucursalId=1`, { headers });
  const inventarios = await invRes.json();
  const bolilloInv = inventarios.find(i => i.id_producto === 1) || { existencia: 0 };
  console.log(`Existencia inicial de Bolillo: ${bolilloInv.existencia}`);

  // Registrar Producción
  const prodData = {
    id_sucursal: 1,
    fecha: new Date().toISOString().split('T')[0],
    observaciones: 'Test smoke producción',
    detalles: [
      { id_producto: 1, cantidad: 100 }
    ]
  };

  const createProdRes = await fetch(`${API_URL}/produccion`, {
    method: 'POST',
    headers,
    body: JSON.stringify(prodData)
  });
  const production = await createProdRes.json();
  if (production.error) throw new Error(`Error en producción: ${production.error}`);
  console.log('✅ Producción registrada:', production.id);

  // Verificar aumento de inventario
  const invRes2 = await fetch(`${API_URL}/inventarios?sucursalId=1`, { headers });
  const inventarios2 = await invRes2.json();
  const bolilloInv2 = inventarios2.find(i => i.id_producto === 1);
  console.log(`Existencia post-producción: ${bolilloInv2.existencia} (Esperado: ${bolilloInv.existencia + 100})`);

  // 3. Test Traslados
  console.log('\n--- Test Traslados ---');
  // Trasladar 50 bolillos de Planta (1) a Sucursal Centro (2)
  const trasladoData = {
    id_sucursal_origen: 1,
    id_sucursal_destino: 2,
    id_repartidor: 22, // Gabriel (repartidor)
    fecha_salida: new Date().toISOString().split('T')[0],
    observaciones: 'Test smoke traslado',
    detalles: [
      { id_producto: 1, cantidad: 50 }
    ]
  };

  const createTrasRes = await fetch(`${API_URL}/traslados`, {
    method: 'POST',
    headers,
    body: JSON.stringify(trasladoData)
  });
  const traslado = await createTrasRes.json();
  if (traslado.error) throw new Error(`Error en traslado: ${traslado.error}`);
  console.log('✅ Traslado registrado (Salida):', traslado.id);

  // Verificar descuento en origen
  const invRes3 = await fetch(`${API_URL}/inventarios?sucursalId=1`, { headers });
  const inventarios3 = await invRes3.json();
  const bolilloInv3 = inventarios3.find(i => i.id_producto === 1);
  console.log(`Existencia en origen post-salida: ${bolilloInv3.existencia} (Esperado: ${bolilloInv2.existencia - 50})`);

  // Confirmar entrega
  const confirmRes = await fetch(`${API_URL}/traslados/${traslado.id}/confirmar`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id_empleado_recibe: 4 }) // María (gerente centro)
  });
  const confirmResult = await confirmRes.json();
  if (confirmResult.error) throw new Error(`Error en confirmación: ${confirmResult.error}`);
  console.log('✅ Traslado entregado');

  // Verificar aumento en destino
  const invRes4 = await fetch(`${API_URL}/inventarios?sucursalId=2`, { headers });
  const inventarios4 = await invRes4.json();
  const bolilloInv4 = inventarios4.find(i => i.id_producto === 1);
  console.log(`Existencia en destino post-entrega: ${bolilloInv4.existencia}`);

  // 4. Test Producto Estrella History
  console.log('\n--- Test Producto Estrella ---');
  // Obtener specs actuales
  const specRes = await fetch(`${API_URL}/productos/12/especificaciones`, { headers });
  if (!specRes.ok) {
    console.error(`❌ Error obteniendo specs: ${specRes.status}`);
    console.error(await specRes.text());
    return;
  }
  const currentSpec = await specRes.json();
  
  // Actualizar specs
  const updateRes = await fetch(`${API_URL}/productos/12/especificaciones`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...currentSpec,
      receta_base: 'Receta actualizada via smoke test'
    })
  });
  if (!updateRes.ok) {
    console.error(`❌ Error actualizando specs: ${updateRes.status}`);
    console.error(await updateRes.text());
    return;
  }
  const updateResult = await updateRes.json();
  console.log(`✅ Nueva versión creada: ${updateResult.version}`);

  // 5. Test Inventario Actions
  console.log('\n--- Test Inventario Actions ---');
  // Ajustar inventario
  const adjustRes = await fetch(`${API_URL}/inventarios/movimiento`, { // Corrected path: /movimiento
    method: 'POST',
    headers,
    body: JSON.stringify({
      id_sucursal: 2,
      id_producto: 1,
      tipo_movimiento: 'entrada',
      cantidad: 10,
      referencia: 'Ajuste manual smoke test'
    })
  });
  if (adjustRes.ok) console.log('✅ Ajuste de inventario exitoso');
  else {
    console.error('❌ Error en ajuste de inventario');
    console.error(await adjustRes.text());
  }

  // Configurar límites
  // Primero buscar el ID del registro de inventario para producto 1 en sucursal 2
  const invSearchRes = await fetch(`${API_URL}/inventarios?sucursalId=2`, { headers });
  const items = await invSearchRes.json();
  const item = items.find(i => i.id_producto === 1);

  if (item) {
    const limitRes = await fetch(`${API_URL}/inventarios/${item.id}/limites`, { // Corrected path: /:id/limites
      method: 'PATCH', // Corrected method: PATCH
      headers,
      body: JSON.stringify({
        minimo: 30,
        maximo: 600
      })
    });
    if (limitRes.ok) console.log('✅ Límites configurados exitosamente');
    else console.error('❌ Error configurando límites');
  } else {
    console.error('❌ No se encontró el registro de inventario para probar límites');
  }

  console.log('\n🏁 Smoke Test finalizado con éxito.');
}

runTest().catch(console.error);
