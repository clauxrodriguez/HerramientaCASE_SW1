import { generateSpringBootProject } from '../springBootGenerator';
import AdmZip from 'adm-zip';

jest.setTimeout(30000);

function getEntry(zip: AdmZip, entryPath: string): string | null {
  const e = zip.getEntry(entryPath);
  if (!e) return null;
  return e.getData().toString('utf8');
}

describe('Generator intermediate entity relations (avoid unnecessary join tables)', () => {
  /**
   * Test case: PRODUCTO_VENTA_DETALLE es una entidad intermedia que conecta PRODUCTO y VENTA.
   * Debe generar:
   * - @OneToMany(mappedBy = "producto") en PRODUCTO hacia PRODUCTO_VENTA_DETALLE
   * - @OneToMany(mappedBy = "venta") en VENTA hacia PRODUCTO_VENTA_DETALLE
   * - @ManyToOne hacia PRODUCTO en PRODUCTO_VENTA_DETALLE (campo "producto")
   * - @ManyToOne hacia VENTA en PRODUCTO_VENTA_DETALLE (campo "venta")
   * - NO debe crear tablas de unión adicionales
   */
  const uml = {
    package: 'com.example',
    classes: [
      {
        name: 'PRODUCTO',
        attributes: [
          { name: 'idProducto', type: 'Integer', isId: true },
          { name: 'nombre', type: 'String' }
        ],
        methods: [],
        relations: []
      },
      {
        name: 'VENTA',
        attributes: [
          { name: 'id', type: 'Integer', isId: true },
          { name: 'fecha', type: 'LocalDate' },
          { name: 'total', type: 'Float' }
        ],
        methods: [],
        relations: []
      },
      {
        name: 'PRODUCTO_VENTA_DETALLE',
        attributes: [
          { name: 'cantidad', type: 'Integer' },
          { name: 'precio', type: 'Float' }
        ],
        methods: [],
        relations: []
      }
    ],
    relations: [
      {
        id: 'rel1',
        type: 'ONE_TO_MANY',
        source: 'PRODUCTO',
        target: 'PRODUCTO_VENTA_DETALLE',
        sourceCardinality: '1..*',
        targetCardinality: '0..*'
      },
      {
        id: 'rel2',
        type: 'ONE_TO_MANY',
        source: 'VENTA',
        target: 'PRODUCTO_VENTA_DETALLE',
        sourceCardinality: '1..*',
        targetCardinality: '0..*'
      }
    ]
  } as any;

  it('should generate correct ONE_TO_MANY relations with mappedBy for intermediate entities', async () => {
    const buffer = await generateSpringBootProject(uml);
    const zip = new AdmZip(buffer);
    // El nombre del proyecto se genera del package: com.example -> example
    const basePath = 'example/src/main/java/com/example/entity/';

    // Los nombres de archivo se generan en mayúsculas desde los nombres de clase
    const productoJava = getEntry(zip, basePath + 'PRODUCTO.java');
    const ventaJava = getEntry(zip, basePath + 'VENTA.java');
    // PRODUCTO_VENTA_DETALLE se convierte a PRODUCTOVENTADETALLE
    const productoVentaDetalleJava = getEntry(zip, basePath + 'PRODUCTOVENTADETALLE.java');

    expect(productoJava).toBeTruthy();
    expect(ventaJava).toBeTruthy();
    expect(productoVentaDetalleJava).toBeTruthy();

    // Verificar que PRODUCTO tiene @OneToMany con mappedBy hacia PRODUCTO_VENTA_DETALLE
    expect(productoJava as string).toContain('@OneToMany');
    expect(productoJava as string).toContain('mappedBy = "producto"');
    expect(productoJava as string).toContain('List<PRODUCTOVENTADETALLE>');

    // Verificar que VENTA tiene @OneToMany con mappedBy hacia PRODUCTO_VENTA_DETALLE
    expect(ventaJava as string).toContain('@OneToMany');
    expect(ventaJava as string).toContain('mappedBy = "venta"');
    expect(ventaJava as string).toContain('List<PRODUCTOVENTADETALLE>');

    // Verificar que PRODUCTO_VENTA_DETALLE tiene @ManyToOne hacia PRODUCTO
    expect(productoVentaDetalleJava as string).toContain('@ManyToOne');
    expect(productoVentaDetalleJava as string).toContain('private PRODUCTO producto');
    expect(productoVentaDetalleJava as string).toContain('@JoinColumn(name = "producto_id")');

    // Verificar que PRODUCTO_VENTA_DETALLE tiene @ManyToOne hacia VENTA
    expect(productoVentaDetalleJava as string).toContain('private VENTA venta');
    expect(productoVentaDetalleJava as string).toContain('@JoinColumn(name = "venta_id")');

    // Verificar que NO se crean tablas de unión innecesarias
    // (no debe haber @JoinTable en las relaciones ONE_TO_MANY)
    expect(productoJava as string).not.toContain('@JoinTable');
    expect(ventaJava as string).not.toContain('@JoinTable');
  });

  it('should generate correct foreign keys in intermediate entity', async () => {
    const buffer = await generateSpringBootProject(uml);
    const zip = new AdmZip(buffer);
    const basePath = 'example/src/main/java/com/example/entity/';

    const productoVentaDetalleJava = getEntry(zip, basePath + 'PRODUCTOVENTADETALLE.java');

    expect(productoVentaDetalleJava).toBeTruthy();

    const content = productoVentaDetalleJava as string;

    // Verificar que tiene ambas relaciones MANY_TO_ONE
    const productoManyToOne = content.match(/@ManyToOne[\s\S]*?private PRODUCTO producto/);
    const ventaManyToOne = content.match(/@ManyToOne[\s\S]*?private VENTA venta/);

    expect(productoManyToOne).toBeTruthy();
    expect(ventaManyToOne).toBeTruthy();

    // Verificar que las FKs tienen nombres correctos
    expect(content).toContain('@JoinColumn(name = "producto_id")');
    expect(content).toContain('@JoinColumn(name = "venta_id")');
  });

  it('should not create unnecessary join tables for intermediate entities', async () => {
    const buffer = await generateSpringBootProject(uml);
    const zip = new AdmZip(buffer);
    const basePath = 'example/src/main/java/com/example/entity/';

    const productoJava = getEntry(zip, basePath + 'PRODUCTO.java');
    const ventaJava = getEntry(zip, basePath + 'VENTA.java');

    expect(productoJava).toBeTruthy();
    expect(ventaJava).toBeTruthy();

    const productoContent = productoJava as string;
    const ventaContent = ventaJava as string;

    // Verificar que las relaciones ONE_TO_MANY usan mappedBy (no @JoinTable)
    expect(productoContent).toContain('mappedBy = "producto"');
    expect(ventaContent).toContain('mappedBy = "venta"');

    // Verificar que NO hay @JoinTable en las relaciones ONE_TO_MANY
    // (solo debería haber @JoinTable en relaciones MANY_TO_MANY)
    const productoJoinTable = productoContent.match(/@OneToMany[\s\S]*?@JoinTable/);
    const ventaJoinTable = ventaContent.match(/@OneToMany[\s\S]*?@JoinTable/);

    expect(productoJoinTable).toBeNull();
    expect(ventaJoinTable).toBeNull();
  });
});

