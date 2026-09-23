export interface OCRText {
  text: string;
  bbox?: { x: number; y: number; w: number; h: number }; // coordenadas en pixeles
}

export interface Shape {
  type: 'rect' | 'line' | 'arrow' | 'circle' | string;
  bbox?: { x: number; y: number; w: number; h: number };
  points?: Array<{ x: number; y: number }>;
}

/** Resultado estructurado tipo UML simple */
export interface DiagramModel {
  classes: Array<{
    id: string;
    name: string;
    attributes: string[];
    bbox?: { x: number; y: number; w: number; h: number };
  }>;
  relations: Array<{
    from?: string; // class id
    to?: string;   // class id
    type?: string; // association, aggregation, inheritance
    points?: Array<{ x: number; y: number }>;
  }>;
}

/**
 * Construye un modelo UML básico a partir de cajas (shapes) y textos (ocr).
 * Heurística simple:
 *  - Cada rect con texto asociado => clase; primer renglón = nombre, resto = atributos.
 *  - Líneas entre cajas => relación entre las cajas más cercanas a los extremos.
 */
export function buildDiagram(shapes: Shape[], ocrTexts: OCRText[]): DiagramModel {
  const classes: DiagramModel['classes'] = [];
  const relations: DiagramModel['relations'] = [];

  // Asociar textos a rects
  const rects = shapes.filter(s => s.type === 'rect' && s.bbox) as Shape[];

  function centerOf(b: { x: number; y: number; w: number; h: number }) {
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  // For each rect, collect OCR texts whose bbox center lies within the rect bbox (simple)
  rects.forEach((rect, idx) => {
    const bbox = rect.bbox!;
    const texts = ocrTexts.filter(t => {
      if (!t.bbox) return false;
      const cx = t.bbox.x + t.bbox.w / 2;
      const cy = t.bbox.y + t.bbox.h / 2;
      return cx >= bbox.x && cx <= bbox.x + bbox.w && cy >= bbox.y && cy <= bbox.y + bbox.h;
    }).map(t => t.text.trim());

    let name = `Class${idx + 1}`;
    let attributes: string[] = [];

    if (texts.length > 0) {
      // If OCR text contains multiple lines, split first line as name, rest attributes
      const combined = texts.join('\n');
      const lines = combined.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        name = lines[0];
        attributes = lines.slice(1);
      }
    }

    classes.push({
      id: `c${idx + 1}`,
      name,
      attributes,
      bbox,
    });
  });

  // Detect relations from line shapes
  const lines = shapes.filter(s => s.type === 'line' && s.points && s.points.length >= 2) as Shape[];
  lines.forEach(line => {
    const pts = line.points!;
    const start = pts[0];
    const end = pts[pts.length - 1];

    // find closest class center to start/end
    const findClosestClass = (pt: { x: number; y: number }) => {
      let best: any = null;
      let bestDist = Infinity;
      classes.forEach(cl => {
        if (!cl.bbox) return;
        const c = centerOf(cl.bbox);
        const d = Math.hypot(c.x - pt.x, c.y - pt.y);
        if (d < bestDist) {
          bestDist = d;
          best = cl;
        }
      });
      return best;
    };

    const from = findClosestClass(start);
    const to = findClosestClass(end);

    relations.push({
      from: from?.id,
      to: to?.id,
      type: 'association',
      points: pts,
    });
  });

  // If no rects found but OCR has class-like blocks (e.g., title then list),
  // attempt basic parse: split OCR by blank lines and treat blocks as classes.
  if (classes.length === 0 && ocrTexts.length > 0) {
    const combined = ocrTexts.map(t => t.text).join('\n\n');
    const blocks = combined.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    blocks.forEach((blk, i) => {
      const lines = blk.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const name = lines[0] ?? `Class${i + 1}`;
      const attrs = lines.slice(1);
      classes.push({ id: `c_blk_${i + 1}`, name, attributes: attrs });
    });
  }

  return { classes, relations };
}