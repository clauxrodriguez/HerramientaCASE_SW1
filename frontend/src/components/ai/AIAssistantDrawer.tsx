import React, { useEffect, useRef, useState } from 'react';
import { Mic, Loader2, X, Bot, Send, User, Image as ImageIcon } from 'lucide-react';
import { aiService } from '../../services/api';
import { useUMLStore } from '../../stores/useUMLStore';
import { UMLClass, Relation } from '../../types/uml';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'working' | 'success' | 'error';
};

export const AIAssistantDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const [prompt, setPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loadingMode, setLoadingMode] = useState<'generate' | 'modify' | 'image' | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Estoy listo. Pídeme crear, editar, eliminar o relacionar cualquier elemento del diagrama.',
      status: 'success',
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { classes, relations, setClasses, setRelations, projectName, packageName } = useUMLStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingMode]);

  if (!isOpen) return null;

  // Reconocimiento de voz por micrófono (Web Speech API)
  const handleVoiceCommand = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Tu navegador no soporta el API de reconocimiento de voz por micrófono.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  const parseAttr = (attr: any, classId: string, aIdx: number) => {
    if (typeof attr === 'object' && attr !== null) {
      const name = attr.name || attr.title || `campo${aIdx + 1}`;
      const isPk = !!(attr.isId || attr.isPrimaryKey || name.toLowerCase() === 'id' || name.toLowerCase().endsWith('_id'));
      return {
        id: attr.id || `attr-${classId}-${aIdx}`,
        name,
        type: attr.type || 'String',
        visibility: attr.visibility && attr.visibility !== 'undefined' ? attr.visibility : (isPk ? '-' : '+'),
        isPrimaryKey: isPk,
      };
    }

    const rawStr = String(attr).trim();
    let visibility = '+';
    let cleanStr = rawStr;

    if (cleanStr.startsWith('+') || cleanStr.startsWith('-') || cleanStr.startsWith('#')) {
      visibility = cleanStr[0];
      cleanStr = cleanStr.substring(1).trim();
    }

    let name = cleanStr;
    let type = 'String';

    if (cleanStr.includes(':')) {
      const parts = cleanStr.split(':');
      name = parts[0].trim();
      type = parts[1].trim() || 'String';
    } else if (cleanStr.includes(' ')) {
      const parts = cleanStr.split(/\s+/);
      name = parts[0].trim();
      type = parts[1].trim() || 'String';
    }

    const isPk = name.toLowerCase() === 'id' || name.toLowerCase().endsWith('_id') || name.toLowerCase().startsWith('id_');
    if (isPk && visibility === '+') {
      visibility = '-';
    }

    return {
      id: `attr-${classId}-${aIdx}`,
      name: name || `campo${aIdx + 1}`,
      type: type || 'String',
      visibility,
      isPrimaryKey: isPk,
    };
  };

  const parseMeth = (meth: any, classId: string, mIdx: number) => {
    if (typeof meth === 'object' && meth !== null) {
      return {
        id: meth.id || `meth-${classId}-${mIdx}`,
        name: meth.name || `metodo${mIdx + 1}`,
        returnType: meth.returnType || 'void',
        visibility: meth.visibility && meth.visibility !== 'undefined' ? meth.visibility : '+',
      };
    }

    const rawStr = String(meth).trim();
    let visibility = '+';
    let cleanStr = rawStr;

    if (cleanStr.startsWith('+') || cleanStr.startsWith('-') || cleanStr.startsWith('#')) {
      visibility = cleanStr[0];
      cleanStr = cleanStr.substring(1).trim();
    }

    let name = cleanStr;
    let returnType = 'void';

    if (cleanStr.includes(':')) {
      const parts = cleanStr.split(':');
      name = parts[0].trim();
      returnType = parts[1].trim() || 'void';
    }

    name = name.replace(/\(\)/g, '').trim();

    return {
      id: `meth-${classId}-${mIdx}`,
      name: name || `metodo${mIdx + 1}`,
      returnType,
      visibility,
    };
  };

  const applySuggestionsData = (data: any) => {
    if (!data) return;

    const classNameToIdMap = new Map<string, string>();
    const formattedClasses: UMLClass[] = [];
    const formattedRelations: Relation[] = [];

    // 1. Normalizar Clases e IDs + Layout sin Solapamiento
    if (data.classes && Array.isArray(data.classes)) {
      data.classes.forEach((c: any, index: number) => {
        const classId = c.id || `cls-${(c.name || 'clase').toLowerCase().replace(/\s+/g, '')}`;
        if (c.name) classNameToIdMap.set(c.name.toLowerCase(), classId);
        if (c.id) classNameToIdMap.set(c.id.toLowerCase(), classId);

        const col = index % 2;
        const row = Math.floor(index / 2);
        const posX = c.x || (80 + col * 340);
        const posY = c.y || (80 + row * 280);

        const attributes = (c.attributes || []).map((attr: any, aIdx: number) => parseAttr(attr, classId, aIdx));
        const methods = (c.methods || []).map((meth: any, mIdx: number) => parseMeth(meth, classId, mIdx));

        formattedClasses.push({
          id: classId,
          name: c.name || 'ClaseSinNombre',
          x: posX,
          y: posY,
          attributes,
          methods,
          isAbstract: !!c.isAbstract,
        });
      });
    }

    // 2. Normalizar Relaciones
    if (data.relations && Array.isArray(data.relations)) {
      data.relations.forEach((r: any, index: number) => {
        const rawSource = (r.sourceId || r.source || r.from || '').toString().toLowerCase();
        const rawTarget = (r.targetId || r.target || r.to || '').toString().toLowerCase();

        const resolvedSourceId = classNameToIdMap.get(rawSource) || r.sourceId || r.source || r.from;
        const resolvedTargetId = classNameToIdMap.get(rawTarget) || r.targetId || r.target || r.to;

        if (resolvedSourceId && resolvedTargetId) {
          formattedRelations.push({
            id: r.id || `rel-${index + 1}`,
            sourceId: resolvedSourceId,
            targetId: resolvedTargetId,
            type: r.type || 'ONE_TO_MANY',
            sourceCardinality: r.sourceCardinality || '1',
            targetCardinality: r.targetCardinality || '*',
          });
        }
      });
    }

    setClasses(formattedClasses);
    setRelations(formattedRelations);
  };

  // Modificar diagrama existente (Procesador Integral: Agregar, Eliminar, Relacionar)
  const handleModifyText = async (command = prompt) => {
    if (!command.trim()) return;
    setLoadingMode('modify');
    try {
      const currentDiagram = {
        id: 'diag-1',
        name: projectName || 'DiagramaUML',
        package: packageName || 'com.ejemplo',
        classes,
        relations,
      };

      const data = await aiService.modifyDiagramFromText(command, currentDiagram);
      const modifiedDiagram = data?.updatedDiagram || data;
      if (modifiedDiagram && (modifiedDiagram.classes || modifiedDiagram.relations)) {
        if (Array.isArray(data?.actions) && data.actions.length === 0) {
          return 'No encontré una acción aplicable para ese comando.';
        }
        applySuggestionsData(modifiedDiagram);
        return data?.warnings?.length
          ? 'Listo. Apliqué el cambio usando el modo local.'
          : 'Listo. Apliqué el cambio solicitado en el diagrama.';
      }
      throw new Error('Sin respuesta del servidor de IA');
    } catch (err: any) {
      console.warn('Backend de IA no alcanzable, procesando modificación inteligente en cliente...', err);
      
      const promptLower = command.toLowerCase();
      let updatedClasses = JSON.parse(JSON.stringify(classes)) as UMLClass[];
      let updatedRelations = JSON.parse(JSON.stringify(relations)) as Relation[];
      const compactPrompt = promptLower.replace(/[\s_-]+/g, '');
      const targetClass = updatedClasses.find((item) =>
        compactPrompt.includes(item.name.toLowerCase().replace(/[\s_-]+/g, ''))
      );
      const isDeleteIntent = /\b(elimina|eliminar|eliminá|borra|borrar|quita|quitar|remueve|remover)\b/.test(promptLower);

      if (isDeleteIntent) {
        if (/\b(todas?|todos?)\b/.test(promptLower) && /\b(clases?|calses?|tablas?|entidades?)\b/.test(promptLower)) {
          updatedClasses = [];
          updatedRelations = [];
          applySuggestionsData({ classes: updatedClasses, relations: updatedRelations });
          return 'Listo. Eliminé todas las clases y relaciones del diagrama.';
        }

        if (targetClass && /\b(clase|calse|tabla|entidad)\b/.test(promptLower)) {
          updatedClasses = updatedClasses.filter((item) => item.id !== targetClass.id);
          updatedRelations = updatedRelations.filter((relation) =>
            relation.sourceId !== targetClass.id && relation.targetId !== targetClass.id
          );
        } else if (targetClass && /\b(atributo|campo|propiedad)\b/.test(promptLower)) {
          const targetAttribute = targetClass.attributes.find((attribute) =>
            compactPrompt.includes(attribute.name.toLowerCase().replace(/[\s_-]+/g, ''))
          );
          if (targetAttribute) {
            targetClass.attributes = targetClass.attributes.filter((attribute) => attribute.id !== targetAttribute.id);
          }
        } else if (targetClass && /\b(m[eé]todo|funci[oó]n|operaci[oó]n)\b/.test(promptLower)) {
          const targetMethod = targetClass.methods.find((method) =>
            compactPrompt.includes(method.name.toLowerCase().replace(/[\s_-]+/g, ''))
          );
          if (targetMethod) {
            targetClass.methods = targetClass.methods.filter((method) => method.id !== targetMethod.id);
          }
        } else {
          return 'No encontré una clase, atributo o método que coincida con el comando.';
        }

        applySuggestionsData({ classes: updatedClasses, relations: updatedRelations });
        return 'Listo. Eliminé el elemento solicitado del diagrama.';
      }

      const isUpdateIntent = /\b(modifica|modificar|modificá|edita|editar|editá|actualiza|actualizar|cambia|cambiar|cambiá|renombra|renombrar)\b/.test(promptLower);
      if (isUpdateIntent) {
        if (targetClass && /\b(atributo|campo|propiedad)\b/.test(promptLower)) {
          const targetAttribute = targetClass.attributes.find((attribute) =>
            compactPrompt.includes(attribute.name.toLowerCase().replace(/[\s_-]+/g, ''))
          );
          if (!targetAttribute) return 'No encontré ese atributo en la clase indicada.';
          const renameMatch = promptLower.match(/(?:a|por|como)\s+([a-zA-ZÀ-ÿ][\wÀ-ÿ]*)\s*$/i);
          const typeMatch = promptLower.match(/\b(?:tipo|type)\s+([a-zA-Z][\w\[\]]*)\b/i);
          if (renameMatch && !['la', 'el', 'un', 'una', 'de'].includes(renameMatch[1])) targetAttribute.name = renameMatch[1];
          if (typeMatch) targetAttribute.type = typeMatch[1];
          if (promptLower.includes('privado')) targetAttribute.visibility = '-';
          if (promptLower.includes('público') || promptLower.includes('publico')) targetAttribute.visibility = '+';
          if (promptLower.includes('protegido')) targetAttribute.visibility = '#';
          applySuggestionsData({ classes: updatedClasses, relations: updatedRelations });
          return 'Listo. Modifiqué el atributo solicitado.';
        }

        if (targetClass && /\b(m[eé]todo|funci[oó]n|operaci[oó]n)\b/.test(promptLower)) {
          const targetMethod = targetClass.methods.find((method) =>
            compactPrompt.includes(method.name.toLowerCase().replace(/[\s_-]+/g, ''))
          );
          if (!targetMethod) return 'No encontré ese método en la clase indicada.';
          const renameMatch = promptLower.match(/(?:a|por|como)\s+([a-zA-ZÀ-ÿ][\wÀ-ÿ]*)\s*$/i);
          const returnTypeMatch = promptLower.match(/\b(?:retorno|retorna|devuelve|tipo)\s+([a-zA-Z][\w\[\]]*)\b/i);
          if (renameMatch && !['la', 'el', 'un', 'una', 'de'].includes(renameMatch[1])) targetMethod.name = renameMatch[1];
          if (returnTypeMatch) targetMethod.returnType = returnTypeMatch[1];
          if (promptLower.includes('privado')) targetMethod.visibility = '-';
          if (promptLower.includes('público') || promptLower.includes('publico')) targetMethod.visibility = '+';
          if (promptLower.includes('protegido')) targetMethod.visibility = '#';
          applySuggestionsData({ classes: updatedClasses, relations: updatedRelations });
          return 'Listo. Modifiqué el método solicitado.';
        }

        if (targetClass && /\b(clase|calse|tabla|entidad)\b/.test(promptLower)) {
          const renameMatch = promptLower.match(/(?:nombre|llamada|llamado|a)\s+([a-zA-ZÀ-ÿ][\wÀ-ÿ]*)\s*$/i);
          if (renameMatch && !['la', 'el', 'un', 'una', 'de'].includes(renameMatch[1])) targetClass.name = renameMatch[1];
          if (promptLower.includes('abstracta') || promptLower.includes('abstracto')) targetClass.isAbstract = true;
          if (promptLower.includes('concreta') || promptLower.includes('no abstracta')) targetClass.isAbstract = false;
          applySuggestionsData({ classes: updatedClasses, relations: updatedRelations });
          return 'Listo. Modifiqué la clase solicitada.';
        }

        return 'No encontré una clase, atributo o método que coincida con el comando.';
      }

      // ACCIÓN 1: ELIMINAR / BORRAR
      if (promptLower.includes('elimina') || promptLower.includes('borra') || promptLower.includes('quita') || promptLower.includes('remover')) {
        // 1.A: Eliminar Atributo (ej: "elimina el atributo email de la clase cliente")
        if (promptLower.includes('atributo') || promptLower.includes('campo') || promptLower.includes('propiedad')) {
          const targetClass = updatedClasses.find(c => promptLower.includes(c.name.toLowerCase()));
          if (targetClass) {
            const attrToRemove = targetClass.attributes.find(a => promptLower.includes(a.name.toLowerCase()));
            if (attrToRemove) {
              targetClass.attributes = targetClass.attributes.filter(a => a.id !== attrToRemove.id && a.name.toLowerCase() !== attrToRemove.name.toLowerCase());
            } else {
              const nonPkAttr = targetClass.attributes.filter(a => !a.isPrimaryKey);
              if (nonPkAttr.length > 0) {
                const lastId = nonPkAttr[nonPkAttr.length - 1].id;
                targetClass.attributes = targetClass.attributes.filter(a => a.id !== lastId);
              }
            }
          }
        } 
        // 1.B: Eliminar Clase completa (ej: "elimina la clase producto")
        else if (promptLower.includes('clase') || promptLower.includes('tabla') || promptLower.includes('entidad')) {
          const classToRemove = updatedClasses.find(c => promptLower.includes(c.name.toLowerCase()));
          if (classToRemove) {
            updatedClasses = updatedClasses.filter(c => c.id !== classToRemove.id);
            updatedRelations = updatedRelations.filter(r => r.sourceId !== classToRemove.id && r.targetId !== classToRemove.id);
          }
        }
        // 1.C: Eliminar Método (ej: "elimina el método ejecutar de cliente")
        else if (promptLower.includes('metodo') || promptLower.includes('método')) {
          const targetClass = updatedClasses.find(c => promptLower.includes(c.name.toLowerCase()));
          if (targetClass) {
            const methToRemove = targetClass.methods.find(m => promptLower.includes(m.name.toLowerCase()));
            if (methToRemove) {
              targetClass.methods = targetClass.methods.filter(m => m.id !== methToRemove.id);
            }
          }
        }
      }
      // ACCIÓN 2: RELACIONAR / CONECTAR / VINCULAR
      else if (promptLower.includes('relaciona') || promptLower.includes('conecta') || promptLower.includes('vincula') || promptLower.includes('unir')) {
        const foundClasses = updatedClasses.filter(c => promptLower.includes(c.name.toLowerCase()));
        if (foundClasses.length >= 2) {
          const c1 = foundClasses[0];
          const c2 = foundClasses[1];
          const exists = updatedRelations.some(r => 
            (r.sourceId === c1.id && r.targetId === c2.id) || (r.sourceId === c2.id && r.targetId === c1.id)
          );
          if (!exists) {
            let relType: any = 'ONE_TO_MANY';
            let srcCard = '1';
            let tgtCard = '*';

            if (promptLower.includes('muchos a muchos') || promptLower.includes('m:n') || promptLower.includes('*..*')) {
              relType = 'MANY_TO_MANY';
              srcCard = '*';
              tgtCard = '*';
            } else if (promptLower.includes('uno a uno') || promptLower.includes('1:1')) {
              relType = 'ONE_TO_ONE';
              srcCard = '1';
              tgtCard = '1';
            }

            updatedRelations.push({
              id: `rel-${Date.now()}`,
              sourceId: c1.id,
              targetId: c2.id,
              type: relType,
              sourceCardinality: srcCard,
              targetCardinality: tgtCard
            });
          }
        }
      }
      // ACCIÓN 3: AGREGAR / AÑADIR / CREAR
      else {
        const targetClass = updatedClasses.find(c => promptLower.includes(c.name.toLowerCase()));
        const isAttrCmd = promptLower.includes('atributo') || promptLower.includes('campo') || promptLower.includes('propiedad');

        if (targetClass && isAttrCmd) {
          let attrName = '';
          if (promptLower.includes('email') || promptLower.includes('correo')) attrName = 'email';
          else if (promptLower.includes('telefono') || promptLower.includes('celular')) attrName = 'telefono';
          else if (promptLower.includes('direccion')) attrName = 'direccion';
          else if (promptLower.includes('fecha')) attrName = 'fechaRegistro';
          else if (promptLower.includes('estado')) attrName = 'estado';
          else if (promptLower.includes('total') || promptLower.includes('monto')) attrName = 'montoTotal';
          else {
            const matchAttr = command.match(/(?:atributo|campo|propiedad)\s+([a-zA-Z0-9_]+)/i);
            if (matchAttr && !['a', 'la', 'en', 'de', 'tabla', 'clase', 'un', 'una', 'para'].includes(matchAttr[1].toLowerCase())) {
              attrName = matchAttr[1];
            } else {
              attrName = `atributo${targetClass.attributes.length + 1}`;
            }
          }

          let attrType = 'String';
          if (attrName.includes('fecha')) attrType = 'Date';
          if (attrName.includes('monto') || attrName.includes('total') || attrName.includes('precio')) attrType = 'Double';
          if (attrName.includes('edad') || attrName.includes('cantidad')) attrType = 'Integer';

          if (!targetClass.attributes.some(a => a.name.toLowerCase() === attrName.toLowerCase())) {
            targetClass.attributes.push({
              id: `attr-${targetClass.id}-${Date.now()}`,
              name: attrName,
              type: attrType,
              visibility: '+',
              isPrimaryKey: false
            });
          }
        } else if (targetClass && (promptLower.includes('metodo') || promptLower.includes('método'))) {
          let methName = `metodo${targetClass.methods.length + 1}`;
          const matchMeth = command.match(/(?:metodo|método)\s+([a-zA-Z0-9_]+)/i);
          if (matchMeth && !['a', 'la', 'en', 'de', 'tabla', 'clase'].includes(matchMeth[1].toLowerCase())) {
            methName = matchMeth[1];
          }

          if (!targetClass.methods.some(m => m.name.toLowerCase() === methName.toLowerCase())) {
            targetClass.methods.push({
              id: `meth-${targetClass.id}-${Date.now()}`,
              name: methName,
              returnType: 'void',
              visibility: '+'
            });
          }
        } else {
          // Crear nueva clase si no se nombró una existente
          let newClassName = 'NuevaEntidad';
          const words = command.match(/(?:clase|tabla|entidad)\s+(?:llamada|llamado)\s+([a-zA-ZÀ-ÿ][\wÀ-ÿ]*)/i)
            || command.match(/(?:clase|tabla|entidad)\s+([a-zA-ZÀ-ÿ][\wÀ-ÿ]*)/i);
          if (words && !['un', 'una', 'el', 'la', 'atributo', 'campo', 'tabla', 'clase'].includes(words[1].toLowerCase())) {
            newClassName = words[1];
          } else {
            const directName = command.match(/(?:crea|agrega|añade)\s+(?:(?:una?|la|el)\s+)?([a-zA-ZÀ-ÿ][\wÀ-ÿ]*)/i);
            if (directName && !['clase', 'tabla', 'entidad', 'llamada', 'llamado'].includes(directName[1].toLowerCase())) {
              newClassName = directName[1];
            }
            else if (promptLower.includes('factura')) newClassName = 'Factura';
            else if (promptLower.includes('pago')) newClassName = 'Pago';
          }

          const normalizedName = newClassName.toLowerCase() === 'roly' &&
            /\broly\s+(?:y\s+)?(?:relacion|conecta|vincula)/i.test(promptLower)
            ? 'rol'
            : newClassName;
          const cleanName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);

          if (!updatedClasses.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
            const newClass: UMLClass = {
              id: `cls-${cleanName.toLowerCase()}-${Date.now()}`,
              name: cleanName,
              x: 220 + (updatedClasses.length % 2) * 320,
              y: 120 + Math.floor(updatedClasses.length / 2) * 240,
              attributes: [
                { id: `a-${Date.now()}-1`, name: 'id', type: 'Long', visibility: '-', isPrimaryKey: true },
                { id: `a-${Date.now()}-2`, name: 'nombre', type: 'String', visibility: '+' }
              ],
              methods: [
                { id: `m-${Date.now()}-1`, name: 'procesar', returnType: 'Boolean', visibility: '+' }
              ]
            };

            updatedClasses.push(newClass);

            if (updatedClasses.length >= 2) {
              const relatedClass = updatedClasses.find((item) =>
                item.id !== newClass.id && promptLower.includes(item.name.toLowerCase())
              ) || updatedClasses[0];
              updatedRelations.push({
                id: `rel-${Date.now()}`,
                sourceId: relatedClass.id,
                targetId: newClass.id,
                type: 'ONE_TO_MANY',
                sourceCardinality: '1',
                targetCardinality: '*'
              });
            }
          }
        }
      }

      const mockResult = { classes: updatedClasses, relations: updatedRelations };
      applySuggestionsData(mockResult);
      return 'Cambio aplicado con el procesador local porque el servicio de IA no estaba disponible.';
    } finally {
      setLoadingMode(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const messageId = `image-assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `image-user-${Date.now()}`, role: 'user', content: `Analiza esta imagen: ${file.name}` },
      { id: messageId, role: 'assistant', content: 'Estoy leyendo la imagen y preparando el diagrama...', status: 'working' },
    ]);
    setLoadingMode('image');
    try {
      const data = await aiService.generateFromImage(file);
      if (data?.diagram) {
        const imageDiagram = {
          ...data.diagram,
          relations: (data.diagram.relations || []).map((relation: any) => ({
            ...relation,
            type: String(relation.type || '').toUpperCase() === 'COMPOSITION'
              ? 'ASSOCIATION'
              : relation.type,
          })),
        };
        applySuggestionsData(imageDiagram);
        setMessages((current) => current.map((message) =>
          message.id === messageId
            ? { ...message, content: 'Listo. Creé o actualicé el diagrama a partir de la imagen.', status: 'success' }
            : message
        ));
      } else {
        throw new Error('Sin datos de imagen');
      }
    } catch (err) {
      console.warn('Error al procesar imagen, usando fallback...', err);
      const mockResult = {
        classes: [
          {
            id: 'static-nota-venta',
            name: 'NotaVenta',
            x: 80,
            y: 80,
            attributes: [
              { id: 'ai1', name: 'nro', type: 'Integer', visibility: '-' },
              { id: 'ai2', name: 'fecha', type: 'Date', visibility: '+' },
              { id: 'ai3', name: 'monto', type: 'BigDecimal', visibility: '+' }
            ],
            methods: []
          },
          {
            id: 'static-producto',
            name: 'Producto',
            x: 500,
            y: 80,
            attributes: [
              { id: 'ai4', name: 'codigo', type: 'Integer', visibility: '-' },
              { id: 'ai5', name: 'nombre', type: 'String', visibility: '+' },
              { id: 'ai6', name: 'precio', type: 'BigDecimal', visibility: '+' },
              { id: 'ai7', name: 'stock', type: 'Integer', visibility: '+' }
            ],
            methods: []
          },
          {
            id: 'static-detalle-venta',
            name: 'DetalleVenta',
            x: 290,
            y: 330,
            attributes: [
              { id: 'ai8', name: 'precio', type: 'BigDecimal', visibility: '-' },
              { id: 'ai9', name: 'cantidad', type: 'Integer', visibility: '-' }
            ],
            methods: []
          },
          {
            id: 'static-cliente',
            name: 'Cliente',
            x: 80,
            y: 430,
            attributes: [
              { id: 'ai10', name: 'ci', type: 'Integer', visibility: '-' },
              { id: 'ai11', name: 'nombre', type: 'String', visibility: '+' },
              { id: 'ai12', name: 'telefono', type: 'String', visibility: '+' }
            ],
            methods: []
          },
        ],
        relations: [
          { id: 'static-rel-1', sourceId: 'static-cliente', targetId: 'static-nota-venta', type: 'ONE_TO_MANY', sourceCardinality: '1', targetCardinality: '1..*' },
          { id: 'static-rel-2', sourceId: 'static-nota-venta', targetId: 'static-detalle-venta', type: 'ONE_TO_MANY', sourceCardinality: '1', targetCardinality: '1..*' },
          { id: 'static-rel-3', sourceId: 'static-producto', targetId: 'static-detalle-venta', type: 'ONE_TO_MANY', sourceCardinality: '1', targetCardinality: '1..*' }
        ]
      };
      applySuggestionsData(mockResult);
      setMessages((current) => current.map((message) =>
        message.id === messageId
          ? { ...message, content: 'La imagen no pudo procesarse con el servicio; apliqué un diagrama de respaldo.', status: 'error' }
          : message
      ));
    } finally {
      setLoadingMode(null);
    }
  };

  const handleChatSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const command = prompt.trim();
    if (!command || loadingMode !== null) return;

    const messageId = `assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', content: command },
      { id: messageId, role: 'assistant', content: 'Estoy revisando el diagrama...', status: 'working' },
    ]);
    setPrompt('');

    const response = await handleModifyText(command);
    setMessages((current) => current.map((message) =>
      message.id === messageId
        ? { ...message, content: response || 'No pude confirmar el resultado del comando.', status: response ? 'success' : 'error' }
        : message
    ));
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-surface-border shadow-floating z-30 flex flex-col h-full animate-in slide-in-from-right duration-200 font-sans">
      <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-bg">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-lavender-100 text-lavender-600 rounded-lg">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Asistente IA</h3>
            <p className="text-[10px] text-surface-subtext">Asistente del diagramador UML</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-md">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/70">
        {messages.map((message) => (
          <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' && <Bot className="w-5 h-5 mt-1 text-brand-600 shrink-0" />}
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${message.role === 'user' ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white border border-surface-border text-slate-700 rounded-bl-sm'}`}>
              {message.status === 'working' && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}
              {message.content}
            </div>
            {message.role === 'user' && <User className="w-5 h-5 mt-1 text-slate-400 shrink-0" />}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleChatSubmit} className="p-3 border-t border-surface-border bg-white space-y-2">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void handleChatSubmit();
              }
            }}
            placeholder="Escribe qué quieres cambiar en el diagrama..."
            disabled={loadingMode !== null}
            className="w-full min-h-20 max-h-32 resize-y rounded-xl border border-surface-border p-3 pr-20 text-xs text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-1">
            <button type="button" onClick={handleVoiceCommand} disabled={loadingMode !== null} className={`p-1.5 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-slate-500 hover:bg-slate-100'} disabled:opacity-40`} title="Dictar comando">
              <Mic className="w-4 h-4" />
            </button>
            <button type="submit" disabled={loadingMode !== null || !prompt.trim()} className="p-1.5 rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40" title="Enviar comando">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <label className="flex items-center justify-center gap-1.5 cursor-pointer text-[10px] font-medium text-slate-500 hover:text-brand-700">
          <ImageIcon className="w-3.5 h-3.5" /> Crear o actualizar desde una imagen
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={loadingMode !== null} />
        </label>
      </form>
    </div>
  );
};