/**
 * Generador de la página de formulario (FormPage) para una clase UML.
 * Produce el código Dart de una pantalla que permite crear/editar instancias
 * de la clase recibida. Los comentarios explicativos están en español.
 */

import { UMLAttribute } from '../modelGenerator';
import { ProcessedRelation } from '../../utils/relationMapper';
import { makeLower, valueFromController } from './pageHelpers';

/**
 * Detecta si un atributo es un ID por nombre o por la propiedad isId
 * @param attr - Atributo a verificar
 * @returns true si el atributo es un ID
 */
function isIdAttribute(attr: UMLAttribute): boolean {
  if (attr.isId) return true;
  
  // Detectar IDs por nombre común
  const nameLower = attr.name.toLowerCase();
  const idPatterns = [
    /^id$/,           // "id"
    /^id[a-z]/,       // "idFactura", "idProducto"
    /^[a-z]*id$/,     // "userId", "productId"
    /^id_[a-z]/,      // "id_user", "id_producto"
  ];
  
  return idPatterns.some(pattern => pattern.test(nameLower));
}

/** Genera FormPage */
export function generateFormPageDart(
  className: string,
  attributes: UMLAttribute[],
  relations: ProcessedRelation[] = []
): string {
  // Validar que haya atributos
  if (!attributes || attributes.length === 0) {
    throw new Error(`La clase ${className} no tiene atributos definidos. Se requiere al menos un atributo para generar la página de formulario.`);
  }

  // Nombre en minúsculas/underscore para rutas e imports de archivos
  const lowerName = makeLower(className);

  // Encontrar el atributo ID primero para asegurarnos de excluirlo correctamente
  // Usar la función isIdAttribute que detecta IDs por nombre o por isId
  const idAttr = attributes.find(a => isIdAttribute(a));
  // Si no hay atributo ID, usar el primer atributo o 'id' por defecto
  // IMPORTANTE: Asegurar que siempre tenga un valor válido (no undefined)
  const idFieldName = (idAttr?.name ?? attributes[0]?.name ?? 'id');
  
  // Atributos editables: excluimos el id (detectado por isIdAttribute) porque normalmente no se edita
  // También excluimos cualquier atributo que se llame igual que el ID para evitar duplicados
  const editableAttrs = attributes.filter(a => {
    // Excluir si es ID (por isId o por nombre) o si tiene el mismo nombre que el campo ID
    if (isIdAttribute(a)) return false;
    if (idFieldName && a.name === idFieldName) return false;
    return true;
  });
  
  // Validar que haya al menos un atributo editable
  // EXCEPCIÓN: Si todos los atributos son IDs pero hay al menos un atributo, permitir generar
  // (útil para tablas intermedias que pueden tener solo IDs de relaciones)
  if (editableAttrs.length === 0 && attributes.length > 0) {
    // Si todos son IDs, usar el primer atributo como editable (será nullable/opcional)
    // Esto permite generar formularios para tablas intermedias con solo IDs
    console.warn(`⚠️  La clase ${className} solo tiene atributos ID. Se generará formulario con campos opcionales.`);
    // Permitir continuar, pero usar todos los atributos como "editables" (aunque sean IDs)
    // En este caso, los IDs se tratarán como opcionales/nullable
  }

  // Determinar qué atributos usar para los campos del formulario
  // Si no hay editables (solo IDs), usar todos los atributos pero marcarlos como opcionales
  const formAttrs = editableAttrs.length > 0 ? editableAttrs : attributes;
  
  // Genera declaraciones de TextEditingController para cada campo del formulario
  const controllers = formAttrs
    .map(attr => `  final TextEditingController _${attr.name}Controller = TextEditingController();`)
    .join('\n');

  // Inicializa los controllers con los valores del item si estamos en edición
  const initControllers = formAttrs
    .map(attr => `      _${attr.name}Controller.text = widget.item?.${attr.name}?.toString() ?? '';`)
    .join('\n');

  // Genera las llamadas a dispose() para cada controller
  const disposeControllers = formAttrs
    .map(attr => `    _${attr.name}Controller.dispose();`)
    .join('\n');

  // Genera los campos del formulario (TextFormField) con su validador cuando es requerido
  // Para tablas intermedias con solo IDs, todos los campos son opcionales
  const formFields = formAttrs
    .map(attr => {
      // Si es ID o si no hay atributos editables (solo IDs), hacer el campo opcional
      const isRequired = !attr.nullable && !attr.isId && editableAttrs.length > 0;
      // Validador en español: comprueba null o cadena vacía
      const validator = isRequired
        ? `validator: (value) => (value == null || value.isEmpty) ? 'Campo requerido' : null,`
        : '';
      return `            TextFormField(controller: _${attr.name}Controller, decoration: InputDecoration(labelText: '${attr.name}', border: const OutlineInputBorder()), ${validator}),`;
    })
    .join('\n            const SizedBox(height: 16),\n');

  // Construir TODOS los atributos para el constructor del modelo
  // El constructor requiere TODOS los parámetros, así que necesitamos pasar todos los atributos
  // Para atributos editables: usar valores de los controllers
  // Para IDs: null al crear, mantener valor al editar
  const allAttributeFields = attributes.map(attr => {
    // Verificar si es ID usando la función isIdAttribute (detecta por isId o por nombre)
    const isIdField = isIdAttribute(attr);
    
    // Si el atributo está en formAttrs (tiene controller), usar el controller
    // Si no, es un ID que no se muestra en el formulario
    const hasController = formAttrs.some(a => a.name === attr.name);
    
    if (hasController) {
      // Atributo con controller: usar valor del controller
      return `        ${attr.name}: ${valueFromController(attr)},`;
    } else if (isIdField) {
      // ID sin controller: null al crear, mantener valor al editar
      // El modelo ya tiene este campo como nullable (int?), así que null es válido
      return `        ${attr.name}: _isEditing ? widget.item!.${attr.name} : null,`;
    } else {
      // Atributo sin controller (no debería pasar, pero por seguridad)
      return `        ${attr.name}: _isEditing ? widget.item!.${attr.name} : null,`;
    }
  }).join('\n');
  
  // Relaciones: valores por defecto al crear, mantener valores al editar
  // Las relaciones se cargan desde el backend, no se editan en el formulario
  const relationFields = relations.map(rel => {
    if (rel.isList) {
      // Lista: lista vacía al crear, mantener del item al editar
      return `        ${rel.fieldName}: _isEditing ? (widget.item!.${rel.fieldName} ?? []) : [],`;
    } else {
      // Objeto único: null al crear, mantener del item al editar
      return `        ${rel.fieldName}: _isEditing ? widget.item!.${rel.fieldName} : null,`;
    }
  }).join('\n');

  // Plantilla Dart completa de la página de formulario
  return `import 'package:flutter/material.dart';
import '../../models/${lowerName}.dart';
import '../../services/${lowerName}_service.dart';

class ${className}FormPage extends StatefulWidget {
  // item: si se proporciona, la página funciona en modo edición; si es null, en modo creación
  final ${className}? item;
  const ${className}FormPage({Key? key, this.item}) : super(key: key);

  @override
  State<${className}FormPage> createState() => _${className}FormPageState();
}

class _${className}FormPageState extends State<${className}FormPage> {
  // Clave del formulario para validación
  final _formKey = GlobalKey<FormState>();
  final ${className}Service _service = ${className}Service();
${controllers}
  bool _isLoading = false;
  //Indicador si se trata de edición (item != null)
  bool get _isEditing => widget.item != null;

  @override
  void initState() {
    super.initState();
    // Si estamos editando, inicializamos los controllers con los valores del item
    if (_isEditing) {
${initControllers}
    }
  }

  @override
  void dispose() {
${disposeControllers}
    super.dispose();
  }

  // Función que guarda el formulario: valida, construye el objeto y llama al servicio
  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      // Construimos la instancia del modelo usando las expresiones generadas
      // IMPORTANTE: El ID es automático (null al crear, se mantiene al editar)
      // Las relaciones se mantienen del item original si estamos editando, valores por defecto si creamos
      // El constructor requiere TODOS los parámetros (atributos + relaciones)
      final item = ${className}(
${allAttributeFields}${relationFields ? '\n' + relationFields : ''}
      );

      if (_isEditing) {
        // Si editamos, usamos el id del item original para el update
        await _service.update(widget.item!.${idFieldName}, item);
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('${className} actualizado correctamente')));
      } else {
        // Si creamos, llamamos al servicio create
        await _service.create(item);
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('${className} creado correctamente')));
      }

      // Volvemos con resultado true para que la lista recargue
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      // Mostramos error en snackbar si ocurre una excepción
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: \$e')));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? 'Editar ${className}' : 'Crear ${className}')),
      body: _isLoading ? const Center(child: CircularProgressIndicator()) : SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
${formFields}
            const SizedBox(height: 24),
            Row(children: [
              // Botón cancelar: regresa sin cambios
              Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar'))),
              const SizedBox(width: 16),
              // Botón guardar: ejecuta _save()
              Expanded(child: ElevatedButton(onPressed: _save, child: Text(_isEditing ? 'Actualizar' : 'Crear'))),
            ]),
          ]),
        ),
      ),
    );
  }
}
`;}