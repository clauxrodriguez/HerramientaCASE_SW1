import { generateSpringBootProject } from '../springBootGenerator';
import AdmZip from 'adm-zip';

function getEntry(zip: AdmZip, entryPath: string): string | null {
  const e = zip.getEntry(entryPath);
  if (!e) return null;
  return e.getData().toString('utf8');
}

describe('ID recognition and Postman collection generation', () => {
  const uml = {
    package: 'com.example.demo',
    classes: [
      { name: 'Producto', attributes: [ { name: 'idProductos', type: 'Long' }, { name: 'nombre', type: 'String' }, { name: 'precioUnitario', type: 'BigDecimal' } ], relations: [] }
    ]
  } as any;

  it('should treat idProductos as @Id and omit it from Request DTO and sample JSON', async () => {
    const buffer = await generateSpringBootProject(uml);
    const zip = new AdmZip(buffer);
    const basePath = 'demo/src/main/java/com/example/demo/';

    const entityJava = getEntry(zip, basePath + 'entity/Producto.java');
    const requestDto = getEntry(zip, basePath + 'dto/ProductoRequest.java');
    const postman = getEntry(zip, 'demo/docs/demo-postman-collection.json');

    expect(entityJava).toBeTruthy();
  expect(entityJava as string).toContain('idProductos');
  expect(entityJava as string).toContain('@Id');
  // No fallback Long id field added
  expect(entityJava as string).not.toMatch(/private Long id;\s+@Id/);
  // Should NOT have @NotNull annotation on idProductos now
  const idLineIndex = (entityJava as string).indexOf('idProductos');
  const startLine = (entityJava as string).lastIndexOf('\n', idLineIndex);
  const endSemi = (entityJava as string).indexOf(';', idLineIndex) + 1;
  const fieldBlock = (entityJava as string).substring(Math.max(0, startLine), Math.max(endSemi, idLineIndex));
  expect(fieldBlock).not.toContain('@NotNull');

    expect(requestDto).toBeTruthy();
    // Request DTO should not include idProductos field
    expect(requestDto as string).not.toContain('idProductos');

    expect(postman).toBeTruthy();
    const collectionJson = JSON.parse(postman as string);
    const createItem = collectionJson.item.find((f: any) => f.name === 'Producto')?.item?.find((i: any) => /Create Producto/i.test(i.name));
    expect(createItem).toBeTruthy();
    const body = JSON.parse(createItem.request.body.raw);
    expect(body.idProductos).toBeUndefined();
  });
});
