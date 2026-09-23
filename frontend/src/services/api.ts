import axios, { InternalAxiosRequestConfig } from 'axios';
import { DiagramData, UMLClass, Relation } from '../types/uml';

// URL de respaldo directo a tu backend de Render
const DEFAULT_API_URL = 'https://case-backend-1qbr.onrender.com';

// Limpieza preventiva por si Render inyectó caracteres de Markdown
const rawEnvUrl = import.meta.env.VITE_API_URL || '';
const cleanEnvUrl = rawEnvUrl.replace(/\[\vert{}\]|\(\vert{}\)/g, '').trim();

export const api = axios.create({
  baseURL: cleanEnvUrl || DEFAULT_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const aiService = {
  // Generar UML desde prompt de texto
  generateDiagramFromText: async (prompt: string): Promise<{ classes: UMLClass[]; relations: Relation[] }> => {
    const response = await api.post('/ai/generate-diagram', { text: prompt });
    return response.data;
  },

  // Modificar UML existente con comando en lenguaje natural
  modifyDiagramFromText: async (prompt: string, currentDiagram: DiagramData) => {
    const response = await api.post('/ai/modify-diagram', {
      text: prompt,
      diagram: currentDiagram,
    });
    return response.data;
  },

  // Image-to-diagram mediante archivo subido
  generateFromImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lang', 'es');
    formData.append('useLLM', 'true');

    const response = await api.post('/ai/image-to-diagram', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export const codeGeneratorService = {
  // Descarga ZIP de proyecto Spring Boot
  exportSpringBoot: async (packageName: string, classes: UMLClass[], relations: Relation[]) => {
    const response = await api.post(
      '/generator/spring',
      { package: packageName, classes, relations },
      { responseType: 'blob' }
    );
    const blob = new Blob([response.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${packageName.replace(/\./g, '-')}-springboot.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Descarga ZIP de aplicación Flutter
  exportFlutter: async (projectName: string, classes: UMLClass[], relations: Relation[]) => {
    const response = await api.post(
      '/generator/flutter',
      { name: projectName, classes, relations },
      { responseType: 'blob' }
    );
    const blob = new Blob([response.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}-flutter.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Genera Script DDL SQL PostgreSQL en texto
  exportPostgreSQL: (classes: UMLClass[], relations: Relation[]): string => {
    let sql = `-- Generado por CASE UML Studio\n-- Fecha: ${new Date().toLocaleString()}\n\n`;

    classes.forEach((cls) => {
      const tableName = cls.name.toLowerCase();
      sql += `CREATE TABLE ${tableName} (\n`;
      const attrLines: string[] = [];
      attrLines.push(`  id BIGSERIAL PRIMARY KEY`);

      cls.attributes.forEach((attr) => {
        if (attr.name.toLowerCase() === 'id') return;
        let sqlType = 'VARCHAR(255)';
        const t = attr.type.toLowerCase();
        if (t.includes('int') || t.includes('long')) sqlType = 'BIGINT';
        else if (t.includes('double') || t.includes('float') || t.includes('decimal')) sqlType = 'NUMERIC(12,2)';
        else if (t.includes('date') || t.includes('time')) sqlType = 'TIMESTAMP';
        else if (t.includes('bool')) sqlType = 'BOOLEAN';

        attrLines.push(`  ${attr.name.toLowerCase()} ${sqlType}`);
      });

      sql += attrLines.join(',\n');
      sql += `\n);\n\n`;
    });

    relations.forEach((rel) => {
      const sourceCls = classes.find((c) => c.id === rel.sourceId);
      const targetCls = classes.find((c) => c.id === rel.targetId);
      if (sourceCls && targetCls) {
        sql += `-- Relación ${rel.type} entre ${sourceCls.name} y ${targetCls.name}\n`;
        sql += `ALTER TABLE ${targetCls.name.toLowerCase()} ADD COLUMN ${sourceCls.name.toLowerCase()}_id BIGINT;\n`;
        sql += `ALTER TABLE ${targetCls.name.toLowerCase()} ADD CONSTRAINT fk_${targetCls.name.toLowerCase()}_${sourceCls.name.toLowerCase()} FOREIGN KEY (${sourceCls.name.toLowerCase()}_id) REFERENCES ${sourceCls.name.toLowerCase()}(id);\n\n`;
      }
    });

    return sql;
  },
};

export const xmiService = {
  // Exportar archivo XMI / XML completo equivalente al formato prueba.xml (OMG UML / EA 2.5)
  exportXMI: (diagram: DiagramData): string => {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

    let classesXml = '';
    diagram.classes.forEach((c) => {
      let attrsXml = '';
      c.attributes.forEach((a, aIdx) => {
        const vis = a.visibility === '-' ? 'private' : a.visibility === '#' ? 'protected' : 'public';
        attrsXml += `
                <UML:Attribute name="${a.name}" visibility="${vis}">
                  <UML:ModelElement.taggedValue>
                    <UML:TaggedValue tag="type" value="${a.type}"/>
                    <UML:TaggedValue tag="position" value="${aIdx}"/>
                    <UML:TaggedValue tag="isId" value="${a.isPrimaryKey ? 'true' : 'false'}"/>
                  </UML:ModelElement.taggedValue>
                </UML:Attribute>`;
      });

      let methsXml = '';
      c.methods.forEach((m) => {
        const vis = m.visibility === '-' ? 'private' : m.visibility === '#' ? 'protected' : 'public';
        methsXml += `
                <UML:Operation name="${m.name}" visibility="${vis}">
                  <UML:ModelElement.taggedValue>
                    <UML:TaggedValue tag="returnType" value="${m.returnType}"/>
                  </UML:ModelElement.taggedValue>
                </UML:Operation>`;
      });

      classesXml += `
            <UML:Class name="${c.name}" xmi.id="${c.id}" visibility="public" isAbstract="${c.isAbstract ? 'true' : 'false'}">
              <UML:Classifier.feature>${attrsXml}${methsXml}
              </UML:Classifier.feature>
            </UML:Class>`;
    });

    let relationsXml = '';
    diagram.relations.forEach((r, rIdx) => {
      const sourceCls = diagram.classes.find((c) => c.id === r.sourceId);
      const targetCls = diagram.classes.find((c) => c.id === r.targetId);
      const sName = sourceCls?.name || r.sourceId;
      const tName = targetCls?.name || r.targetId;
      const relId = r.id || `rel_${rIdx + 1}`;

      const rawRelName = (r as any).name || '';
      const isGenericRelName = !rawRelName || rawRelName.toLowerCase().startsWith('rel');
      const relName = isGenericRelName ? '' : rawRelName;
      const nameAttr = relName ? `name="${relName}"` : 'name=""';
      const mtTag = relName ? `\n               <UML:TaggedValue tag="mt" value="${relName}"/>` : '';

      let eaType = 'Association';
      let targetAggregation = 'none';
      let directionVal = 'Unspecified';
      let sourceIsNavigable = 'false';
      let targetIsNavigable = 'false';
      let sourceNavStyle = 'Navigable=Unspecified;';
      let targetNavStyle = 'Navigable=Unspecified;';
      let subtypeXml = '';

      const relTypeStr = (r.type as string).toUpperCase();

      if (relTypeStr === 'COMPOSITION') {
        eaType = 'Aggregation';
        targetAggregation = 'composite';
        directionVal = 'Source -> Destination';
        sourceIsNavigable = 'false';
        targetIsNavigable = 'true';
        sourceNavStyle = 'Navigable=Navigable;';
        targetNavStyle = 'Navigable=Unspecified;';
        subtypeXml = '\n                <UML:TaggedValue tag="subtype" value="Strong"/>';
      } else if (relTypeStr === 'AGGREGATION') {
        eaType = 'Aggregation';
        targetAggregation = 'shared';
        directionVal = 'Source -> Destination';
        sourceIsNavigable = 'false';
        targetIsNavigable = 'true';
        sourceNavStyle = 'Navigable=Navigable;';
        targetNavStyle = 'Navigable=Unspecified;';
      } else if (relTypeStr === 'INHERITANCE' || relTypeStr === 'GENERALIZATION') {
        eaType = 'Generalization';
        directionVal = 'Source -> Destination';
        targetIsNavigable = 'true';
        targetNavStyle = 'Navigable=Navigable;';
      } else {
        eaType = 'Association';
        directionVal = 'Unspecified';
        sourceIsNavigable = 'false';
        targetIsNavigable = 'false';
        sourceNavStyle = 'Navigable=Unspecified;';
        targetNavStyle = 'Navigable=Unspecified;';
      }

      const sCard = r.sourceCardinality || '1';
      const tCard = r.targetCardinality || '*';

      relationsXml += `
            <UML:Association ${nameAttr} xmi.id="${relId}" visibility="public" isRoot="false" isLeaf="false" isAbstract="false">
              <UML:ModelElement.taggedValue>
                <UML:TaggedValue tag="style" value="3"/>
                <UML:TaggedValue tag="ea_type" value="${eaType}"/>
                <UML:TaggedValue tag="direction" value="${directionVal}"/>
                <UML:TaggedValue tag="linemode" value="3"/>
                <UML:TaggedValue tag="linecolor" value="-1"/>
                <UML:TaggedValue tag="linewidth" value="0"/>${subtypeXml}
                <UML:TaggedValue tag="ea_sourceName" value="${sName}"/>
                <UML:TaggedValue tag="ea_targetName" value="${tName}"/>
                <UML:TaggedValue tag="ea_sourceType" value="Class"/>
                <UML:TaggedValue tag="ea_targetType" value="Class"/>
                <UML:TaggedValue tag="ea_sourceID" value="${r.sourceId}"/>
                <UML:TaggedValue tag="ea_targetID" value="${r.targetId}"/>
                <UML:TaggedValue tag="lb" value="${sCard}"/>${mtTag}
                <UML:TaggedValue tag="rb" value="${tCard}"/>
              </UML:ModelElement.taggedValue>
              <UML:Association.connection>
                <UML:AssociationEnd visibility="public" multiplicity="${sCard}" aggregation="none" isOrdered="false" targetScope="instance" changeable="none" isNavigable="${sourceIsNavigable}" type="${r.sourceId}">
                  <UML:ModelElement.taggedValue>
                    <UML:TaggedValue tag="containment" value="Unspecified"/>
                    <UML:TaggedValue tag="sourcestyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;${sourceNavStyle}"/>
                    <UML:TaggedValue tag="ea_end" value="source"/>
                  </UML:ModelElement.taggedValue>
                </UML:AssociationEnd>
                <UML:AssociationEnd visibility="public" multiplicity="${tCard}" aggregation="${targetAggregation}" isOrdered="false" targetScope="instance" changeable="none" isNavigable="${targetIsNavigable}" type="${r.targetId}">
                  <UML:ModelElement.taggedValue>
                    <UML:TaggedValue tag="containment" value="Unspecified"/>
                    <UML:TaggedValue tag="deststyle" value="Union=0;Derived=0;AllowDuplicates=0;Owned=0;${targetNavStyle}"/>
                    <UML:TaggedValue tag="ea_end" value="target"/>
                  </UML:ModelElement.taggedValue>
                </UML:AssociationEnd>
              </UML:Association.connection>
            </UML:Association>`;
    });

    let diagramElementsXml = '';
    diagram.classes.forEach((c, idx) => {
      const left = Math.round(c.x);
      const top = Math.round(c.y);
      const right = left + 220;
      const bottom = top + 180;
      diagramElementsXml += `
        <UML:DiagramElement geometry="Left=${left};Top=${top};Right=${right};Bottom=${bottom};" subject="${c.id}" seqno="${idx + 1}"/>`;
    });

    diagram.relations.forEach((r, rIdx) => {
      const relId = r.id || `rel_${rIdx + 1}`;
      diagramElementsXml += `
        <UML:DiagramElement geometry="SX=0;SY=0;EX=0;EY=0;EDGE=2;" subject="${relId}" style="Mode=3;"/>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<XMI xmi.version="1.1" xmlns:UML="omg.org/UML/1.4" timestamp="${timestamp}">
  <XMI.header>
    <XMI.documentation>
      <XMI.exporter>Enterprise Architect CASE UML Studio</XMI.exporter>
      <XMI.exporterVersion>2.5</XMI.exporterVersion>
    </XMI.documentation>
  </XMI.header>
  <XMI.content>
    <UML:Model name="${diagram.name}" xmi.id="MODEL_1">
      <UML:Namespace.ownedElement>${classesXml}${relationsXml}
      </UML:Namespace.ownedElement>
    </UML:Model>
    <UML:Diagram name="${diagram.name}" xmi.id="DIAGRAM_1" diagramType="ClassDiagram" toolName="Enterprise Architect 2.5">
      <UML:Diagram.element>${diagramElementsXml}
      </UML:Diagram.element>
    </UML:Diagram>
  </XMI.content>
</XMI>`;
  },

  // Importar archivo XMI / XML compatible con el esquema de prueba.xml
  importXMI: (xmiContent: string): { classes: UMLClass[]; relations: Relation[] } | null => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmiContent, 'text/xml');

      const classNodes = Array.from(xmlDoc.getElementsByTagName('UML:Class'));
      const assocNodes = Array.from(xmlDoc.getElementsByTagName('UML:Association'));
      const diagElemNodes = Array.from(xmlDoc.getElementsByTagName('UML:DiagramElement'));

      const geometryMap = new Map<string, { x: number; y: number }>();
      diagElemNodes.forEach((elem) => {
        const subject = elem.getAttribute('subject');
        const geom = elem.getAttribute('geometry');
        if (subject && geom) {
          const leftMatch = geom.match(/Left=(\d+)/i);
          const topMatch = geom.match(/Top=(\d+)/i);
          if (leftMatch && topMatch) {
            geometryMap.set(subject, {
              x: parseInt(leftMatch[1], 10),
              y: parseInt(topMatch[1], 10),
            });
          }
        }
      });

      const classNameToIdMap = new Map<string, string>();
      const parsedClasses: UMLClass[] = [];

      classNodes.forEach((node, index) => {
        const name = node.getAttribute('name') || `Clase_${index + 1}`;
        const rawId = node.getAttribute('xmi.id') || node.getAttribute('id') || `cls-${index + 1}`;
        const isAbstract = node.getAttribute('isAbstract') === 'true';

        classNameToIdMap.set(name.toLowerCase(), rawId);

        // Extraer Atributos
        const attrNodes = Array.from(node.getElementsByTagName('UML:Attribute'));
        const attributes = attrNodes.map((aNode, aIdx) => {
          const aName = aNode.getAttribute('name') || `campo${aIdx}`;
          const rawVis = aNode.getAttribute('visibility');
          let visibility: any = '+';
          if (rawVis === 'private') visibility = '-';
          else if (rawVis === 'protected') visibility = '#';
          else if (rawVis === 'public') visibility = '+';

          let type = 'String';
          const taggedValues = Array.from(aNode.getElementsByTagName('UML:TaggedValue'));
          const typeTag = taggedValues.find((t) => t.getAttribute('tag') === 'type');
          if (typeTag && typeTag.getAttribute('value')) {
            type = typeTag.getAttribute('value')!;
          } else if (aName.toLowerCase() === 'id') {
            type = 'Long';
          }

          const isPrimaryKey = aName.toLowerCase() === 'id';

          return {
            id: `attr-${rawId}-${aIdx}`,
            name: aName,
            type,
            visibility,
            isPrimaryKey,
          };
        });

        // Extraer Métodos (Operations)
        const opNodes = Array.from(node.getElementsByTagName('UML:Operation'));
        const methods = opNodes.map((mNode, mIdx) => {
          const mName = mNode.getAttribute('name') || `metodo${mIdx}`;
          const rawVis = mNode.getAttribute('visibility');
          let visibility: any = '+';
          if (rawVis === 'private') visibility = '-';
          else if (rawVis === 'protected') visibility = '#';
          else if (rawVis === 'public') visibility = '+';

          let returnType = 'void';
          const taggedValues = Array.from(mNode.getElementsByTagName('UML:TaggedValue'));
          const retTag = taggedValues.find((t) => t.getAttribute('tag') === 'returnType');
          if (retTag && retTag.getAttribute('value')) {
            returnType = retTag.getAttribute('value')!;
          }

          return {
            id: `meth-${rawId}-${mIdx}`,
            name: mName,
            returnType,
            visibility,
          };
        });

        // Posición
        const geomPos = geometryMap.get(rawId);
        const col = index % 2;
        const row = Math.floor(index / 2);
        const defaultX = 80 + col * 320;
        const defaultY = 80 + row * 260;

        parsedClasses.push({
          id: rawId,
          name,
          x: geomPos ? geomPos.x : defaultX,
          y: geomPos ? geomPos.y : defaultY,
          attributes,
          methods,
          isAbstract,
        });
      });

      // Extraer Relaciones / Asociaciones
      const parsedRelations: Relation[] = [];
      assocNodes.forEach((assocNode, rIdx) => {
        const relId = assocNode.getAttribute('xmi.id') || assocNode.getAttribute('id') || `rel-${rIdx + 1}`;
        const taggedValues = Array.from(assocNode.getElementsByTagName('UML:TaggedValue'));

        const getTag = (name: string) => {
          const item = taggedValues.find((t) => t.getAttribute('tag') === name);
          return item ? item.getAttribute('value') : null;
        };

        const sName = getTag('ea_sourceName') || '';
        const tName = getTag('ea_targetName') || '';
        let sId = getTag('ea_sourceID') || classNameToIdMap.get(sName.toLowerCase()) || '';
        let tId = getTag('ea_targetID') || classNameToIdMap.get(tName.toLowerCase()) || '';

        if (!sId || !tId) {
          const ends = Array.from(assocNode.getElementsByTagName('UML:AssociationEnd'));
          if (ends.length >= 2) {
            const end1Type = ends[0].getAttribute('type') || '';
            const end2Type = ends[1].getAttribute('type') || '';
            if (end1Type) sId = sId || end1Type;
            if (end2Type) tId = tId || end2Type;
          }
        }

        const lb = getTag('lb') || '1';
        const rb = getTag('rb') || '*';
        const eaType = getTag('ea_type') || 'ONE_TO_MANY';

        if (sId && tId) {
          parsedRelations.push({
            id: relId,
            sourceId: sId,
            targetId: tId,
            type: eaType as any,
            sourceCardinality: lb,
            targetCardinality: rb,
          });
        }
      });

      return { classes: parsedClasses, relations: parsedRelations };
    } catch (err) {
      console.error('Error parseando archivo XML/XMI:', err);
      return null;
    }
  },
};