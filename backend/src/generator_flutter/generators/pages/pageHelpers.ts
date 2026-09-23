/**
 * Helpers para generación de páginas (List/Form) del generador Flutter.
 *
 * Contiene utilidades para:
 *  - Normalizar nombres (snake_case / PascalCase) usados en rutas y clases.
 *  - Convertir valores tomados de TextEditingController al tipo Dart esperado,
 *    teniendo en cuenta nullability y valores por defecto.
 *
 * Estas funciones son utilizadas por los generadores de páginas para producir
 * código Dart compatible con los modelos y servicios generados.
 */

import { UMLAttribute } from '../modelGenerator';
import { mapUmlTypeToDart, getDefaultValue } from '../../utils/typeMapper';

/**
 * Convierte un nombre a snake_case (lower_case_with_underscores).
 * - Elimina caracteres no alfanuméricos.
 * - Reemplaza espacios por '_' y pasa todo a minúsculas.
 *
 * Ej: "User Profile" -> "user_profile"
 */
export const makeLower = (n: string) =>
  n.replace(/[^\w\s]/g, '').replace(/\s+/g, '_').toLowerCase();

/**
 * Convierte un nombre a PascalCase (UpperCamelCase).
 * - Elimina caracteres no alfanuméricos.
 * - Divide por espacios/underscores y capitaliza cada parte.
 *
 * Ej: "user_profile" -> "UserProfile"
 */
export const toPascal = (n: string) =>
  n
    .replace(/[^\w\s]/g, ' ')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

/**
 * Genera la expresión Dart que obtiene/convierte el valor desde un
 * TextEditingController según el tipo Dart mapeado desde UML.
 *
 * Reglas y comportamientos:
 * - Usa mapUmlTypeToDart para determinar el tipo Dart objetivo (ej: DateTime, double, int, bool, String).
 * - Respeta la propiedad `nullable` del atributo:
 *   - Si nullable === true, la expresión puede devolver null cuando el parseo falla o el campo está vacío.
 *   - Si nullable === false, se aplica un valor por defecto mediante getDefaultValue cuando el parseo falla.
 * - Para DateTime utiliza DateTime.tryParse(...).
 * - Para double/int utiliza double.tryParse(...) / int.tryParse(...) y fallback al default si no es nullable.
 * - Para bool realiza una comparación con 'true'/'false' en minúsculas.
 * - Para String devuelve el texto tal cual; si es nullable devuelve null cuando está vacío.
 *
 * Ejemplos generados:
 * - DateTime no-nullable -> DateTime.tryParse(_dateController.text) ?? DateTime.now()
 * - double nullable -> double.tryParse(_priceController.text)
 * - String nullable -> _nameController.text.isEmpty ? null : _nameController.text
 */
export function valueFromController(attr: UMLAttribute): string {
  const dartType = mapUmlTypeToDart(attr.type || 'string');
  const name = attr.name;
  const nullable = !!attr.nullable;
  const defaultVal = getDefaultValue(dartType, nullable);

  switch (dartType) {
    case 'DateTime':
      // Si es nullable devolvemos DateTime.tryParse(...) (puede ser null)
      // Si no es nullable devolvemos tryParse() ?? defaultVal (ej: DateTime.now())
      return nullable
        ? `DateTime.tryParse(_${name}Controller.text)`
        : `DateTime.tryParse(_${name}Controller.text) ?? ${defaultVal}`;
    case 'double':
      return nullable
        ? `double.tryParse(_${name}Controller.text)`
        : `double.tryParse(_${name}Controller.text) ?? ${defaultVal}`;
    case 'int':
      return nullable
        ? `int.tryParse(_${name}Controller.text)`
        : `int.tryParse(_${name}Controller.text) ?? ${defaultVal}`;
    case 'bool':
      // Para booleanos, si es nullable devolvemos null si no se reconoce true/false
      return nullable
        ? `(_${name}Controller.text.toLowerCase() == 'true') ? true : (_${name}Controller.text.toLowerCase() == 'false' ? false : null)`
        : `_${name}Controller.text.toLowerCase() == 'true'`;
    default:
      // String u otros: si es nullable devolvemos null cuando está vacío
      return nullable
        ? `_${name}Controller.text.isEmpty ? null : _${name}Controller.text`
        : `_${name}Controller.text`;
  }
}