Relación fuerte: la entidad dependiente no puede existir sin su contenedora. Si se elimina la entidad principal, también se eliminan sus componentes.

🔹 Ejemplo: VENTA contiene DETALLE_VENTA
Tabla: VENTA
Campo	Tipo	Clave
id_venta	INTEGER	PK
fecha	DATE	
total	DECIMAL	
Tabla: DETALLE_VENTA
Campo	Tipo	Clave
id_detalle	INTEGER	PK
id_venta	INTEGER	FK → VENTA
id_producto	INTEGER	FK → PRODUCTO
cantidad	INTEGER	
precio_unit	DECIMAL	
Regla: DETALLE_VENTA no tiene sentido sin una VENTA.

Comportamiento: Si se elimina una VENTA, se eliminan sus DETALLE_VENTA.

🧩 AGREGACIÓN
Relación débil: la entidad asociada puede existir por separado. No hay dependencia vital.

🔹 Ejemplo: EMPLEADO pertenece a un DEPARTAMENTO
Tabla: DEPARTAMENTO
Campo	Tipo	Clave
id_departamento	INTEGER	PK
nombre	VARCHAR	
Tabla: EMPLEADO
Campo	Tipo	Clave
id_empleado	INTEGER	PK
nombre	VARCHAR	
cargo	VARCHAR	
id_departamento	INTEGER	FK → DEPARTAMENTO
Regla: Un EMPLEADO puede cambiar de DEPARTAMENTO, o incluso no tener uno asignado.

Comportamiento: Si se elimina un DEPARTAMENTO, los EMPLEADOS pueden mantenerse (o quedar con NULL en id_departamento).




🧬 HERENCIA (Estrategia JOINED)
🧠 Clase base: PERSONA
Tabla: PERSONA
id (PK)
nombre
telefono
👤 Subclase: CLIENTE
Tabla: CLIENTE
id_cliente (PK, FK → PERSONA.id)
tipo
email
contraseña
🏢 Subclase: PROVEEDOR
Tabla: PROVEEDOR
id_proveedor (PK, FK → PERSONA.id)
rubro
telefono
🔗 Relaciones
Cada CLIENTE y PROVEEDOR hereda de PERSONA mediante su clave primaria que también es clave foránea.

Para obtener un objeto completo, se hace un JOIN entre PERSONA y la subclase correspondiente.