/**
 * Generador de la página de lista (ListPage) para una clase UML.
 * Produce una pantalla Flutter que:
 *  - Muestra una lista de objetos obtenidos desde el servicio correspondiente.
 *  - Permite crear un nuevo elemento (navegando al FormPage).
 *  - Permite editar un elemento (navegando al FormPage con el item).
 *  - Permite eliminar un elemento (llamando al servicio).
 *
 * Nota: Las plantillas generadas usan convenciones:
 *  - Archivos en lib/pages/<lower>/<lower>_list_page.dart
 *  - Modelo en lib/models/<lower>.dart con clase PascalCase
 *  - Servicio en lib/services/<lower>_service.dart con clase PascalCaseService
 */

import { UMLAttribute } from '../modelGenerator'; // Tipo que describe atributos UML
import { ProcessedRelation } from '../../utils/relationMapper';
import { makeLower } from './pageHelpers'; // Helper para convertir nombres a snake_case

/** Genera el código Dart de la ListPage para la clase proporcionada */
export function generateListPageDart(
  className: string,
  attributes: UMLAttribute[],
  relations: ProcessedRelation[] = []
): string {
  // Nombre en minúsculas y con guiones bajos para rutas e imports (ej: "user_profile")
  const lowerName = makeLower(className);
  // Nombre plural simple para mensajes/etiquetas (se agrega 's' al final)
  const pluralName = `${lowerName}s`;

  // Validar que haya atributos
  if (!attributes || attributes.length === 0) {
    throw new Error(`La clase ${className} no tiene atributos definidos. Se requiere al menos un atributo para generar la página de lista.`);
  }

  // Intentamos encontrar el atributo que actúa como id; si no hay, usamos el primero
  const idAttr = attributes.find(a => a.isId) || attributes[0];
  
  // Validar que idAttr existe
  if (!idAttr) {
    throw new Error(`La clase ${className} no tiene atributos válidos.`);
  }

  // Atributos que se mostrarán en el card de la lista (excluimos el id y tomamos hasta 3)
  const displayAttrs = attributes.filter(a => !a.isId).slice(0, 3);
  // Fragmento Dart con los Text(...) para mostrar en el subtitle del ListTile
  const displayFields = displayAttrs
    .map(attr => `                Text('${attr.name}: \${item.${attr.name}}'),`)
    .join('\n');
  
  // Campos de relaciones para mostrar en el card
  const relationFields = relations.map(rel => {
    if (rel.isList) {
      // Lista: mostrar cantidad de elementos
      return `                if (item.${rel.fieldName}.isNotEmpty) Text('${rel.fieldName}: \${item.${rel.fieldName}.length} elemento(s)'),`;
    } else {
      // Objeto único: mostrar ID o nombre si está disponible
      return `                if (item.${rel.fieldName} != null) Text('${rel.fieldName}: \${item.${rel.fieldName}.${idAttr.name} ?? "N/A"}'),`;
    }
  }).join('\n');
  
  // Código para cargar relaciones en _loadData
  const loadRelationsCode = relations.length > 0
    ? `final relationNames = [${relations.map(r => `'${r.fieldName}'`).join(', ')}];\n      final items = await _service.list(includeRelations: relationNames);`
    : 'final items = await _service.list();';

  // Plantilla completa retornada como string (contenido de lib/pages/<lower>/<lower>_list_page.dart)
  return `import 'package:flutter/material.dart';
import '../../models/${lowerName}.dart';
import '../../services/${lowerName}_service.dart';
import '${lowerName}_form_page.dart';

/// Página que muestra la lista de ${className}
/// - Usa ${className}Service para operaciones CRUD
/// - Permite crear, editar y eliminar items
class ${className}ListPage extends StatefulWidget {
  const ${className}ListPage({Key? key}) : super(key: key);

  @override
  State<${className}ListPage> createState() => _${className}ListPageState();
}

class _${className}ListPageState extends State<${className}ListPage> {
  // Instancia del servicio que maneja la comunicación (API/local)
  final ${className}Service _service = ${className}Service();

  // Estado local de la lista, indicador de carga y mensajes de error diferenciados
  List<${className}>? _items;
  bool _isLoading = true;

  // Error ocurrido durante la carga inicial (no crítico: se muestra discretamente)
  String? _loadErrorMessage;

  // Error de operaciones de mutación (guardar/eliminar). Estas operaciones deben notificar
  // al usuario con SnackBar o pantalla cuando corresponda.
  String? _operationErrorMessage;

  @override
  void initState() {
    super.initState();
    // Carga inicial de datos al montar el widget
    _loadData();
  }

  /// Carga los datos desde el servicio y actualiza el estado
  /// Incluye relaciones automáticamente si están definidas
  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _loadErrorMessage = null;
      _operationErrorMessage = null;
    });
    try {
      // Obtener nombres de relaciones para incluir en la consulta
      ${loadRelationsCode}
      setState(() { _items = items; _isLoading = false; });
    } catch (e) {
      // Fallo en la carga inicial: dejamos la lista vacía y guardamos el mensaje,
      // pero NO mostramos un error crítico. Permitimos reintento.
      setState(() { _items = []; _loadErrorMessage = e.toString(); _isLoading = false; });
      // opcional: debugPrint('Carga inicial ${lowerName} fallida: \$e');
    }
  }

  /**
   * Elimina un item:
   *  - Pregunta confirmación al usuario
   *  - Llama al servicio delete con el id convertido a String (el id puede ser nullable)
   *  - Actualiza la lista o muestra error en snackbar
   */
  Future<void> _deleteItem(${className} item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirmar eliminación'),
        content: Text('¿Está seguro de eliminar este ${lowerName}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Eliminar'),
            style: TextButton.styleFrom(foregroundColor: Colors.red)),
        ],
      ),
    );

    if (confirm == true) {
      try {
        // Convertimos id a String por seguridad si es nullable
        await _service.delete(item.${idAttr.name}?.toString());
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('${className} eliminado correctamente')));
        await _loadData();
      } catch (e) {
        // Mostrar error de operación (Snackbar)
        final msg = 'Error al eliminar: \$e';
        setState(() { _operationErrorMessage = msg; });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    }
  }

  /// Navega a la página de creación (FormPage). Si retorna true, recarga la lista.
  /// Si la FormPage devolviera un mensaje de error (por convención), también lo mostramos.
  void _navigateToCreate() async {
    final result = await Navigator.push(context, MaterialPageRoute(builder: (context) => ${className}FormPage()));
    if (result == true) {
      await _loadData();
    } else if (result is String && result.isNotEmpty) {
      // convención: FormPage puede retornar String con mensaje de error al fallar guardar
      setState(() { _operationErrorMessage = result; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result)));
    }
  }

  /// Navega a la página de edición pasando el item seleccionado
  void _navigateToEdit(${className} item) async {
    final result = await Navigator.push(context, MaterialPageRoute(builder: (context) => ${className}FormPage(item: item)));
    if (result == true) {
      await _loadData();
    } else if (result is String && result.isNotEmpty) {
      setState(() { _operationErrorMessage = result; });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('${className}s'), actions: [ IconButton(icon: const Icon(Icons.add), onPressed: _navigateToCreate) ]),
      body: _buildBody(),
      floatingActionButton: FloatingActionButton(onPressed: _navigateToCreate, child: const Icon(Icons.add)),
    );
  }

  /// Construye el cuerpo de la pantalla con distintos estados (cargando, error no crítico, vacío o lista)
  Widget _buildBody() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    // Si hubo fallo en la carga inicial, mostramos un mensaje discreto y opción reintentar,
    // pero permitimos que el usuario cree nuevos elementos.
    if (_items == null || _items!.isEmpty) {
      return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        if (_loadErrorMessage != null) ...[
          const Icon(Icons.info_outline, size: 48, color: Colors.orange),
          const SizedBox(height: 8),
          const Text('No se pudieron cargar los datos. Puedes reintentar o crear uno nuevo.', textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(_loadErrorMessage!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          const SizedBox(height: 12),
          ElevatedButton(onPressed: _loadData, child: const Text('Reintentar')),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: _navigateToCreate, child: const Text('Crear nuevo')),
        ] else ...[
          const Icon(Icons.inbox, size: 64, color: Colors.grey),
          const SizedBox(height: 16),
          const Text('No hay ${pluralName} registrados'),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _navigateToCreate, child: const Text('Crear el primero')),
        ]
      ]));
    }

    // Lista poblada: mostramos cada item en un Card con título, subtítulo y acciones
    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        itemCount: _items!.length,
        padding: const EdgeInsets.all(8),
        itemBuilder: (context, index) {
          final item = _items![index];
          return Card(margin: const EdgeInsets.symmetric(vertical: 4), child: ListTile(
            // Título muestra el id del item
            title: Text('${className} #\${item.${idAttr.name}}'),
            // Subtítulo muestra los campos seleccionados (displayFields) y relaciones
            subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
${displayFields}${relationFields ? '\n' + relationFields : ''}
            ]),
            // Botón eliminar que llama a _deleteItem
            trailing: IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => _deleteItem(item)),
            // Tap para editar
            onTap: () => _navigateToEdit(item),
          ));
        },
      ),
    );
  }
 }
`;
}