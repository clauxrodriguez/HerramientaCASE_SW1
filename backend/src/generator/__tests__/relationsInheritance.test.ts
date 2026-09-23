import { generateSpringBootProject } from '../springBootGenerator';
import AdmZip from 'adm-zip';

jest.setTimeout(30000);

function getEntry(zip: AdmZip, entryPath: string): string | null {
  const e = zip.getEntry(entryPath);
  if (!e) return null;
  return e.getData().toString('utf8');
}

describe('Generator advanced relations & inheritance', () => {
  const uml = {
    package: 'com.example.demo',
    classes: [
      { name: 'Base', attributes: [{ name: 'code', type: 'String' }], methods: [], relations: [] },
      { name: 'Child', attributes: [{ name: 'description', type: 'String' }], methods: [], relations: [ { id: 'r1', type: 'INHERITANCE', source: 'Child', target: 'Base', sourceCardinality: '1', targetCardinality: '1' } ] },
      { name: 'Order', attributes: [{ name: 'number', type: 'String' }], methods: [], relations: [ { id: 'r2', type: 'COMPOSITION', source: 'Order', target: 'OrderItem', sourceCardinality: '1', targetCardinality: '*' } ] },
      { name: 'OrderItem', attributes: [{ name: 'qty', type: 'Integer' }], methods: [], relations: [] },
      { name: 'Tag', attributes: [{ name: 'label', type: 'String' }], methods: [], relations: [ { id: 'r3', type: 'MANY_TO_MANY', source: 'Tag', target: 'Product', sourceCardinality: '*', targetCardinality: '*' } ] },
      { name: 'Product', attributes: [{ name: 'title', type: 'String' }], methods: [], relations: [ { id: 'r4', type: 'MANY_TO_MANY', source: 'Product', target: 'Tag', mappedBy: 'tags', sourceCardinality: '*', targetCardinality: '*' } ] }
    ],
    relations: []
  } as any;

  it('should generate entities with inheritance, helpers and many-to-many mapping', async () => {
    const buffer = await generateSpringBootProject(uml);
    const zip = new AdmZip(buffer);
    const basePath = 'demo/src/main/java/com/example/demo/entity/';

    const childJava = getEntry(zip, basePath + 'Child.java');
    const baseJava = getEntry(zip, basePath + 'Base.java');
    const orderJava = getEntry(zip, basePath + 'Order.java');
    const productJava = getEntry(zip, basePath + 'Product.java');

    expect(childJava).toBeTruthy();
    expect(childJava as string).toContain('class Child extends Base');

    expect(baseJava).toBeTruthy();
    expect(baseJava as string).toContain('@Inheritance(strategy = InheritanceType.JOINED)');

    expect(orderJava).toBeTruthy();
    expect(orderJava as string).toContain('addOrderItem');

    expect(productJava).toBeTruthy();
    expect(productJava as string).toContain('@ManyToMany(mappedBy = "tags"');
  });
});
