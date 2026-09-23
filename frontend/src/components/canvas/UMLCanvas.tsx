import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Rect, Text, Group, Line } from 'react-konva';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Move } from 'lucide-react';
import { useUMLStore } from '../../stores/useUMLStore';
import { emitCursorMove, emitDiagramUpdate } from '../../services/socket';
import { UMLClass } from '../../types/uml';

export const UMLCanvas: React.FC = () => {
  const {
    projectId,
    classes,
    relations,
    selectedClassId,
    selectedRelationId,
    selectClass,
    selectRelation,
    updateClass,
    presence,
    activeTool,
    relationCreationSource,
    setRelationCreationSource,
    addRelation,
    setActiveTool,
  } = useUMLStore();

  const stageRef = useRef<any>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth - 576,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth - 576,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Zoom mediante la rueda del mouse apuntando a la posición del cursor
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    const zoomFactor = e.evt.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(oldScale * zoomFactor, 0.25), 3);

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setStageScale(newScale);
    setStagePos(newPos);
  };

  const handleZoomIn = () => {
    setStageScale((prev) => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setStageScale((prev) => Math.max(prev / 1.2, 0.25));
  };

  const handleResetZoom = () => {
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Ajustar la vista para centrar todas las clases existentes
  const handleFitToScreen = () => {
    if (classes.length === 0) {
      handleResetZoom();
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    classes.forEach((c) => {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + 220 > maxX) maxX = c.x + 220;
      if (c.y + 180 > maxY) maxY = c.y + 180;
    });

    const padding = 60;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const scaleX = dimensions.width / contentWidth;
    const scaleY = dimensions.height / contentHeight;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.3), 1.5);

    setStageScale(newScale);
    setStagePos({
      x: (dimensions.width - contentWidth * newScale) / 2 - (minX - padding) * newScale,
      y: (dimensions.height - contentHeight * newScale) / 2 - (minY - padding) * newScale,
    });
  };

  const handleMouseMove = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (pointer) {
      const relativeX = (pointer.x - stagePos.x) / stageScale;
      const relativeY = (pointer.y - stagePos.y) / stageScale;
      emitCursorMove(projectId, relativeX, relativeY);
    }
  };

  const handleClassClick = (cls: UMLClass) => {
    if (activeTool === 'addRelation') {
      if (!relationCreationSource) {
        setRelationCreationSource(cls.id);
      } else if (relationCreationSource !== cls.id) {
        addRelation({
          id: `rel-${Date.now()}`,
          sourceId: relationCreationSource,
          targetId: cls.id,
          type: 'ONE_TO_MANY',
          sourceCardinality: '1',
          targetCardinality: '*',
        });
        setRelationCreationSource(null);
        setActiveTool('select');
      }
    } else {
      selectClass(cls.id);
    }
  };

  return (
    <div className="flex-1 h-full bg-surface-bg relative overflow-hidden select-none">
      {/* Banner de instrucción para conexión de relaciones */}
      {activeTool === 'addRelation' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-brand-600 text-white text-xs font-medium px-4 py-2 rounded-full shadow-floating flex items-center gap-2 animate-bounce">
          <span>
            {relationCreationSource
              ? 'Haz clic en la segunda clase para completar la relación'
              : 'Haz clic en la primera clase de origen'}
          </span>
        </div>
      )}

      {/* Controles Flotantes de Zoom & Desplazamiento del Lienzo */}
      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur border border-surface-border p-1.5 rounded-xl shadow-floating text-slate-700">
        <button
          onClick={handleZoomOut}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
          title="Alejar (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-xs font-semibold px-2 min-w-[44px] text-center text-slate-700 select-none">
          {Math.round(stageScale * 100)}%
        </span>

        <button
          onClick={handleZoomIn}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition"
          title="Acercar (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        <button
          onClick={handleResetZoom}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition flex items-center gap-1 text-xs font-medium"
          title="Restablecer vista a 100%"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleFitToScreen}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition flex items-center gap-1 text-xs font-medium"
          title="Centrar diagrama en pantalla"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Indicador de Ayuda de Pan & Drag */}
      <div className="absolute bottom-6 left-6 z-20 bg-white/90 backdrop-blur border border-surface-border px-3 py-1.5 rounded-xl shadow-subtle text-[11px] text-slate-500 flex items-center gap-1.5 pointer-events-none">
        <Move className="w-3.5 h-3.5 text-slate-400" />
        <span>Arrastra el fondo para moverte • Rueda para Zoom</span>
      </div>

      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={activeTool === 'select'}
        onWheel={handleWheel}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            selectClass(null);
            selectRelation(null);
            setRelationCreationSource(null);
          }
        }}
      >
        <Layer>
          {/* Renderizado de Relaciones y Multiplicidades */}
          {relations.map((rel) => {
            // Buscar clase origen y destino por ID o por Nombre
            const source = classes.find((c) => c.id === rel.sourceId || c.name.toLowerCase() === rel.sourceId.toLowerCase());
            const target = classes.find((c) => c.id === rel.targetId || c.name.toLowerCase() === rel.targetId.toLowerCase());
            if (!source || !target) return null;

            const isSelectedRelation = selectedRelationId === rel.id;

            const startX = source.x + 110;
            const startY = source.y + 60;
            const endX = target.x + 110;
            const endY = target.y + 60;

            // Posiciones para las multiplicidades a lo largo de la línea
            const sourceMultX = startX + (endX - startX) * 0.25;
            const sourceMultY = startY + (endY - startY) * 0.25;

            const targetMultX = startX + (endX - startX) * 0.75;
            const targetMultY = startY + (endY - startY) * 0.75;

            const sourceMultText = rel.sourceCardinality || (rel.type === 'MANY_TO_ONE' || rel.type === 'MANY_TO_MANY' ? '*' : '1');
            const targetMultText = rel.targetCardinality || (rel.type === 'ONE_TO_MANY' || rel.type === 'MANY_TO_MANY' ? '*' : '1');

            return (
              <Group
                key={rel.id}
                onClick={() => selectRelation(rel.id)}
                onTap={() => selectRelation(rel.id)}
              >
                {/* Línea de Relación interactiva con margen de clic amplio */}
                <Line
                  points={[startX, startY, endX, endY]}
                  stroke={isSelectedRelation ? '#0284C7' : '#475569'}
                  strokeWidth={isSelectedRelation ? 4 : 2.5}
                  dash={rel.type === 'dependency' ? [6, 6] : undefined}
                  hitStrokeWidth={20}
                />

                {/* Badge Multiplicidad Origen */}
                <Group x={sourceMultX - 14} y={sourceMultY - 10} onClick={() => selectRelation(rel.id)}>
                  <Rect
                    width={28}
                    height={20}
                    fill={isSelectedRelation ? '#0284C7' : '#FFFFFF'}
                    stroke="#0284C7"
                    strokeWidth={isSelectedRelation ? 2 : 1.5}
                    cornerRadius={4}
                    shadowColor="rgba(15, 23, 42, 0.15)"
                    shadowBlur={4}
                  />
                  <Text
                    text={sourceMultText}
                    width={28}
                    y={4}
                    align="center"
                    fontSize={11}
                    fontStyle="bold"
                    fill={isSelectedRelation ? '#FFFFFF' : '#0284C7'}
                    fontFamily="Inter, Segoe UI"
                  />
                </Group>

                {/* Badge Multiplicidad Destino */}
                <Group x={targetMultX - 14} y={targetMultY - 10} onClick={() => selectRelation(rel.id)}>
                  <Rect
                    width={28}
                    height={20}
                    fill={isSelectedRelation ? '#0284C7' : '#FFFFFF'}
                    stroke="#0284C7"
                    strokeWidth={isSelectedRelation ? 2 : 1.5}
                    cornerRadius={4}
                    shadowColor="rgba(15, 23, 42, 0.15)"
                    shadowBlur={4}
                  />
                  <Text
                    text={targetMultText}
                    width={28}
                    y={4}
                    align="center"
                    fontSize={11}
                    fontStyle="bold"
                    fill={isSelectedRelation ? '#FFFFFF' : '#0284C7'}
                    fontFamily="Inter, Segoe UI"
                  />
                </Group>
              </Group>
            );
          })}

          {/* Clases UML */}
          {classes.map((umlClass) => {
            const isSelected = selectedClassId === umlClass.id;
            const isRelationSource = relationCreationSource === umlClass.id;
            const headerHeight = 36;
            const attrHeight = Math.max(24, umlClass.attributes.length * 20 + 8);
            const methodHeight = Math.max(24, umlClass.methods.length * 20 + 8);
            const totalHeight = headerHeight + attrHeight + methodHeight;

            return (
              <Group
                key={umlClass.id}
                x={umlClass.x}
                y={umlClass.y}
                draggable={activeTool === 'select'}
                onDragMove={(e) => {
                  updateClass(umlClass.id, { x: e.target.x(), y: e.target.y() });
                  emitDiagramUpdate(projectId, { classes, relations });
                }}
                onClick={() => handleClassClick(umlClass)}
              >
                {/* Rectángulo Base de la Clase */}
                <Rect
                  width={220}
                  height={totalHeight}
                  fill="#FFFFFF"
                  stroke={
                    isRelationSource
                      ? '#A78BFA'
                      : isSelected
                      ? '#0284C7'
                      : '#E2E8F0'
                  }
                  strokeWidth={isSelected || isRelationSource ? 2 : 1}
                  cornerRadius={6}
                  shadowColor="rgba(15, 23, 42, 0.08)"
                  shadowBlur={10}
                  shadowOffsetY={3}
                />

                {/* Encabezado de la Clase */}
                <Rect
                  width={220}
                  height={headerHeight}
                  fill={
                    isRelationSource
                      ? '#F3E8FF'
                      : isSelected
                      ? '#E0F2FE'
                      : '#F8FAFC'
                  }
                  cornerRadius={[6, 6, 0, 0]}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                />
                <Text
                  text={umlClass.name}
                  x={10}
                  y={10}
                  width={200}
                  align="center"
                  fontStyle={umlClass.isAbstract ? 'italic bold' : 'bold'}
                  fontSize={13}
                  fill="#0F172A"
                  fontFamily="Inter, Segoe UI"
                />

                {/* Línea Divisoria de Atributos */}
                <Line points={[0, headerHeight, 220, headerHeight]} stroke="#E2E8F0" strokeWidth={1} />
                {umlClass.attributes.map((attr, idx) => {
                  const rawVis = (attr as any).visibility;
                  const vis = rawVis && rawVis !== 'undefined' ? rawVis : '+';
                  return (
                    <Text
                      key={attr.id}
                      text={`${vis} ${attr.name}: ${attr.type}`}
                      x={12}
                      y={headerHeight + 6 + idx * 20}
                      fontSize={11}
                      fill="#334155"
                      fontFamily="Inter, Segoe UI"
                    />
                  );
                })}

                {/* Línea Divisoria de Métodos */}
                <Line
                  points={[0, headerHeight + attrHeight, 220, headerHeight + attrHeight]}
                  stroke="#E2E8F0"
                  strokeWidth={1}
                />
                {umlClass.methods.map((method, idx) => {
                  const rawVis = (method as any).visibility;
                  const vis = rawVis && rawVis !== 'undefined' ? rawVis : '+';
                  return (
                    <Text
                      key={method.id}
                      text={`${vis} ${method.name}(): ${method.returnType}`}
                      x={12}
                      y={headerHeight + attrHeight + 6 + idx * 20}
                      fontSize={11}
                      fill="#475569"
                      fontFamily="Inter, Segoe UI"
                    />
                  );
                })}
              </Group>
            );
          })}

          {/* Punteros de Usuarios Colaboradores */}
          {Object.values(presence).map((p) => {
            if (!p.cursor) return null;
            return (
              <Group key={p.userId} x={p.cursor.x} y={p.cursor.y}>
                <polygon points="0,0 0,14 10,10" fill={p.color || '#38BDF8'} />
                <Text
                  text={p.userName}
                  x={12}
                  y={12}
                  fontSize={10}
                  fill="#FFFFFF"
                  padding={3}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
};
